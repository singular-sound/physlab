'use strict';
/* ============================================================
   示波器物理引擎：信号源、耦合、触发、扫描、CRT 余辉绘制、LCD
   时间单位一律是秒，电压是伏，屏幕坐标用"格"(div)
   ============================================================ */

const TWO_PI = Math.PI * 2;
const DIV = 40;                 // 1 格 = 40 逻辑像素
const CW = 460, CH = 380;       // CRT 画布逻辑尺寸
const CX = CW / 2, CY = CH / 2; // 屏幕中心
const VPOS_RANGE = 6;           // 垂直 POSITION 旋钮满量程 ±6 格
const HPOS_RANGE = 6;           // 水平 POSITION 满量程 ±6 格
const AUTO_TO = 0.04;           // AUTO 模式等触发的超时（≈25 Hz）
const MAXS = 14;                // 每帧最多画多少次扫描
const TAU = 0.075;              // 余辉（含人眼视觉暂留）时间常数
const FOCUS_BEST = 0.62;

// VOLTS/DIV：逆时针到头 5V，顺时针到头 1mV，共 12 档
const VDIV = [5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
// TIME/DIV：位置 0 = X-Y（逆时针到头），1..20 = 0.5s ... 0.2μs
const TDIV = [0.5, 0.2, 0.1, 50e-3, 20e-3, 10e-3, 5e-3, 2e-3, 1e-3,
  500e-6, 200e-6, 100e-6, 50e-6, 20e-6, 10e-6, 5e-6, 2e-6, 1e-6, 0.5e-6, 0.2e-6];

// 仪器自身的标定误差（真实仪器老化的样子）：垂直增益、扫描速度都有百分之二三的偏差。
// 这正是教材"用标准方波修正测量结果"要解决的问题。
const CAL_ERR = { v: [1.028, 0.976], t: 1.021 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now() / 1000;

const S = {
  power: false, powerT: -10,
  inten: 0.5, focus: 0.5, rot: 0,
  hpos: 0, swpvar: 1, mag: false, tpos: 9,
  trigAlt: false, trigMode: 'AUTO', source: 'CH1', level: 0, slope: '+',
  ch: [
    { vi: 2, vvar: 1, pos: 0, cpl: 'AC' },
    { vi: 2, vvar: 1, pos: 0, cpl: 'AC' },
  ],
  vmode: 'CH1', chop: false, inv: false,
  conn: { CH1: null, CH2: null, EXT: null },
  A: { wave: 'sine', freq: 1000, amp: 3, offset: 0, on: false, ph0: 0, tRef: 0, cur: 0, entry: '' },
  B: { wave: 'sine', range: 2000, coarse: 0.6, fine: 0.5, amp: 2.4, F: 1000, ph0: 0, tRef: 0,
       eps: 2.6e-4, wd: TWO_PI / 19, th: Math.random() * TWO_PI, peek: false },
};

/* ---------------- 信号源 ---------------- */

function genPhase(g, t) {
  if (g === S.B) {
    const e = g.eps, w = g.wd, th = g.th;
    return g.ph0 + TWO_PI * g.F * ((t - g.tRef) - (e / w) * (Math.cos(w * t + th) - Math.cos(w * g.tRef + th)));
  }
  return g.ph0 + TWO_PI * g.freq * (t - g.tRef);
}
function genFreqAt(g, t) {
  return g === S.B ? g.F * (1 + g.eps * Math.sin(g.wd * t + g.th)) : g.freq;
}
function rebase(g, t) { g.ph0 = genPhase(g, t) % TWO_PI; g.tRef = t; }

function bFreqFromDials(b) {
  return b.range * (0.1 + 0.9 * b.coarse) * (1 + 0.06 * (b.fine - 0.5));
}
function setAFreq(f) {
  const t = now(); rebase(S.A, t);
  S.A.freq = clamp(Math.round(f * 100) / 100, 0.1, 2e6);
}
function updateBFreq() {
  const t = now(); rebase(S.B, t);
  S.B.F = bFreqFromDials(S.B);
}

function waveVal(w, ph) {
  const s = Math.sin(ph);
  if (w === 'sine') return s;
  if (w === 'tri') return (2 / Math.PI) * Math.asin(s);
  return s >= 0 ? 1 : -1;
}

function srcObj(name) {
  if (name === 'A') {
    const g = S.A; if (!g.on) return null;
    return { name, wave: g.wave, a: g.amp / 2, d: g.offset, f: g.freq,
      phase: t => genPhase(g, t), freqAt: () => g.freq };
  }
  if (name === 'B') {
    const g = S.B;
    return { name, wave: g.wave, a: g.amp / 2, d: 0, f: g.F,
      phase: t => genPhase(g, t), freqAt: t => genFreqAt(g, t) };
  }
  if (name === 'CAL') return { name, wave: 'square', a: 1, d: 1, f: 1000, phase: t => TWO_PI * 1000 * t, freqAt: () => 1000 };
  if (name === 'LINE') return { name, wave: 'sine', a: 1, d: 0, f: 50, phase: t => TWO_PI * 50 * t, freqAt: () => 50 };
  return null;
}

/* ---------------- 垂直通道 ---------------- */

function chanSig(i) {
  const c = S.ch[i];
  if (c.cpl === 'GND') return null;
  const s = srcObj(S.conn[i ? 'CH2' : 'CH1']);
  if (!s) return null;
  let a = s.a, d = s.d;
  if (c.cpl === 'AC') { d = 0; a *= s.f / Math.hypot(s.f, 3); } // 隔直电容：去掉直流，极低频也衰减
  return { s, a, d };
}
function vAt(sig, t) { return sig ? sig.a * waveVal(sig.s.wave, sig.s.phase(t)) + sig.d : 0; }
function varFactor(v) { return 0.4 + 0.6 * v; }              // VAR 拧到头是 1，最小 1/2.5
function gainDiv(i) { const c = S.ch[i]; return CAL_ERR.v[i] * varFactor(c.vvar) / VDIV[c.vi]; } // 每伏多少格
function sgn(i) { return i === 1 && S.inv ? -1 : 1; }

/* ---------------- 水平 ---------------- */

function isXY() { return S.tpos === 0; }
function tdivNominal() { return TDIV[S.tpos - 1]; }
function tdivEff() { return tdivNominal() * CAL_ERR.t * (1 + 1.5 * (1 - S.swpvar)); }

/* ---------------- 触发 ---------------- */

// 返回触发器描述：在信号相位到达 phc 时触发；null 表示触发不了
function trigFor(sweepCh) {
  const lv = S.level;
  if (S.source === 'LINE') return mkTrig(srcObj('LINE'), lv * 1.25, 0, -1);
  if (S.source === 'EXT') {
    const s = srcObj(S.conn.EXT); if (!s || s.a < 0.05) return null;
    return mkTrig(s, (lv * 3 - s.d) / s.a, 0, -1);
  }
  const idx = trigChannel(sweepCh);
  const sig = chanSig(idx); if (!sig) return null;
  const g = gainDiv(idx), aDiv = sig.a * g, dDiv = sig.d * g;
  if (aDiv < 0.2) return null;          // 不到 0.4 格峰峰值，触发灵敏度不够
  const inv = sgn(idx) < 0;
  return mkTrig(sig.s, (lv * 4.4 - (inv ? -dDiv : dDiv)) / aDiv, inv ? Math.PI : 0, idx);
}
function trigChannel(sweepCh) {
  if (S.vmode === 'CH1') return 0;
  if (S.vmode === 'CH2') return 1;
  if (S.vmode === 'DUAL' && !S.chop && S.trigAlt && sweepCh >= 0) return sweepCh;
  return S.source === 'CH2' ? 1 : 0;
}
function mkTrig(s, r, phOff, idx) {
  if (!s || !(Math.abs(r) < 0.995)) return null;
  const up = S.slope === '+';
  let phc;
  if (s.wave === 'sine') phc = up ? Math.asin(r) : Math.PI - Math.asin(r);
  else if (s.wave === 'tri') phc = up ? r * Math.PI / 2 : Math.PI - r * Math.PI / 2;
  else phc = up ? 0 : Math.PI;
  return { s, phOff, phc, idx };
}
function nextTrig(tr, t) {
  const s = tr.s, ph = s.phase(t) + tr.phOff;
  const k = Math.ceil((ph - tr.phc) / TWO_PI - 1e-9);
  const target = tr.phc + k * TWO_PI;
  let tt = t + (target - ph) / (TWO_PI * s.freqAt(t));
  for (let i = 0; i < 2; i++) {
    const e = s.phase(tt) + tr.phOff - target;
    tt -= e / (TWO_PI * s.freqAt(tt));
  }
  return tt < t ? t : tt;
}
// 频率计：显示触发源信号的频率（与 LEVEL 无关）
function counterFreq(t) {
  if (S.source === 'LINE') return 50;
  if (S.source === 'EXT') { const s = srcObj(S.conn.EXT); return s && s.a > 0.05 ? s.freqAt(t) : null; }
  const idx = trigChannel(-1), sig = chanSig(idx);
  if (!sig || sig.a * gainDiv(idx) < 0.2) return null;
  return sig.s.freqAt(t);
}
function isTriggered() {
  if (!S.power || isXY()) return false;
  if (S.trigMode === 'TV-V' || S.trigMode === 'TV-H') return false;
  const tr = trigFor(S.vmode === 'DUAL' && !S.chop && S.trigAlt ? 0 : -1);
  if (!tr) return false;
  if (S.trigMode === 'AUTO') {
    const P = 10 * tdivEff() * 1.2, T = 1 / tr.s.f;
    if (T * Math.ceil(P / T) > AUTO_TO + P) return false;  // 信号太慢，AUTO 会自己跑
  }
  return true;
}

/* ---------------- 绘制 ---------------- */

const E = { active: [], ready: 0, alt: 0, lastT: 0, lastTd: 0, cvs: null, ctx: null, dpr: 1, blur: -1, lcdT: 0, hooks: [] };

function initScreen(canvas, glow) {
  E.cvs = canvas; E.ctx = canvas.getContext('2d');
  if (glow) { E.glow = glow; glow.width = CW / 2; glow.height = CH / 2; E.gctx = glow.getContext('2d'); }
  E.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = CW * E.dpr; canvas.height = CH * E.dpr;
  rebase(S.A, now()); S.B.F = bFreqFromDials(S.B); rebase(S.B, now());
  requestAnimationFrame(frame);
}

function warm() { return clamp((now() - S.powerT - 0.7) / 1.6, 0, 1); }
function beamOn() { return S.power && warm() > 0 && S.inten > 0.02; }
function baseB() { return Math.pow(S.inten, 1.6) * 1.7 * warm(); }
function lineW() { return 1.25 + Math.max(0, S.inten - 0.72) * 5; }

function frame() {
  const t1 = now();
  let t0 = E.lastT || t1 - 0.016;
  if (t1 - t0 > 0.1) t0 = t1 - 0.1;
  E.lastT = t1;
  const ctx = E.ctx, dpr = E.dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-(t1 - t0) / TAU)})`;
  ctx.fillRect(0, 0, E.cvs.width, E.cvs.height);

  if (beamOn()) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(CX, CY); ctx.rotate(S.rot * 4 * Math.PI / 180); ctx.translate(-CX, -CY);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (isXY()) renderXY(t0, t1); else renderYT(t0, t1);
  } else { E.active = []; E.ready = t1; }

  const blur = Math.round((Math.abs(S.focus - FOCUS_BEST) * 9 + Math.max(0, S.inten - 0.78) * 3) * 10) / 10;
  if (blur !== E.blur) { E.blur = blur; E.cvs.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none'; }

  if (E.gctx) { E.gctx.clearRect(0, 0, CW / 2, CH / 2); E.gctx.drawImage(E.cvs, 0, 0, CW / 2, CH / 2); }
  for (const h of E.hooks) h(t1);
  if (t1 - E.lcdT > 0.2) { E.lcdT = t1; updateLCD(t1); }

  if (t1 - S.A.tRef > 200) rebase(S.A, t1);
  if (t1 - S.B.tRef > 200) rebase(S.B, t1);
  requestAnimationFrame(frame);
}

function tracesFor(ch) {
  switch (S.vmode) {
    case 'CH1': return [{ i: 0 }];
    case 'CH2': return [{ i: 1 }];
    case 'ADD': return [{ i: 'add' }];
    default: return S.chop ? [{ i: 0, chop: 0 }, { i: 1, chop: 1 }] : [{ i: ch < 0 ? 0 : ch }];
  }
}
function traceFn(tr) {
  if (tr.i === 'add') {
    const s0 = chanSig(0), s1 = chanSig(1), g0 = gainDiv(0), g1 = gainDiv(1) * sgn(1);
    const p = (S.ch[0].pos + S.ch[1].pos) * VPOS_RANGE;
    return { f: Math.max(s0 ? s0.s.f : 0, s1 ? s1.s.f : 0), y: t => vAt(s0, t) * g0 + vAt(s1, t) * g1 + p };
  }
  const i = tr.i, sig = chanSig(i), g = gainDiv(i) * sgn(i), p = S.ch[i].pos * VPOS_RANGE;
  return { f: sig ? sig.s.f : 0, y: t => vAt(sig, t) * g + p };
}

function sweepInterval(trig, P) {
  if (!trig) return P;
  const T = 1 / trig.s.f;
  return T * Math.ceil(P / T - 1e-9);
}

function renderYT(t0, t1) {
  const td = tdivEff(), Ts = 10 * td, H = Math.max(0.2 * Ts, 1.5e-6), P = Ts + H;
  if (td !== E.lastTd) { E.active = []; E.lastTd = td; }
  const dt = t1 - t0;
  const dualAlt = S.vmode === 'DUAL' && !S.chop;
  const trig0 = (S.trigMode === 'AUTO' || S.trigMode === 'NORM') ? trigFor(dualAlt ? 0 : -1) : null;
  if (S.trigMode === 'NORM' && !trig0) { E.active = []; E.ready = t1; return; }
  let interval = sweepInterval(trig0, P);
  if (S.trigMode === 'AUTO' && trig0 && interval > AUTO_TO + P) interval = P;
  const duty = clamp(Ts / interval, 0, 1);
  let B = baseB() * (0.28 + 0.72 * Math.sqrt(duty));
  if (dualAlt) B *= 0.8;
  if (S.vmode === 'DUAL' && S.chop) B *= 0.75;

  if (P * MAXS < dt) {
    // 扫描远比一帧快：抽样画若干次扫描，触发稳定时它们完全重合
    E.active = []; E.ready = t1;
    const list = [];
    for (let k = 0; k < MAXS; k++) {
      const tk = t0 + (k + Math.random()) * dt / MAXS;
      const ch = dualAlt ? (k & 1) : -1;
      const st = startAt(tk, ch, P, true);
      if (st != null) list.push({ st, ch });
    }
    const a = Math.min(1, B * 2.2 / Math.max(1, list.length / (dualAlt ? 2 : 1)));
    for (const sw of list) drawSweep(sw, sw.st, sw.st + Ts, a, td);
    return;
  }
  // 逐次扫描：慢扫描时能看到光点从左往右走
  const perFrame = dt / interval;
  const a = Math.min(1, B * 2.2 / Math.max(1, perFrame / (dualAlt ? 2 : 1)));
  const keep = [];
  for (const sw of E.active) {
    const ta = Math.max(sw.st, t0), tb = Math.min(sw.st + Ts, t1);
    if (tb > ta) drawSweep(sw, ta, tb, a, td);
    if (sw.st + Ts > t1) keep.push(sw);
  }
  let t = Math.max(E.ready, t0 - P), guard = 0;
  while (guard++ < MAXS * 2) {
    const ch = dualAlt ? E.alt : -1;
    const st = startAt(t, ch, P, false);
    if (st == null || st >= t1) break;
    const sw = { st, ch };
    drawSweep(sw, Math.max(st, t0), Math.min(st + Ts, t1), a, td);
    if (st + Ts > t1) keep.push(sw);
    if (dualAlt) E.alt ^= 1;
    t = st + P;
  }
  E.ready = t; E.active = keep;
}

function startAt(t, ch, P, sampled) {
  const m = S.trigMode;
  const tr = (m === 'AUTO' || m === 'NORM') ? trigFor(ch) : null;
  if (m === 'NORM') return tr ? nextTrig(tr, t) : null;
  if (tr) { const tt = nextTrig(tr, t); if (tt - t <= AUTO_TO) return tt; }
  return sampled ? Math.floor(t / P) * P : t;   // 自由扫描：周期就是 扫描时间 + 回扫
}

function xPx(xd) { return CX + (xd - 5) * DIV; }
function yPx(yd) { return CY - clamp(yd, -7, 7) * DIV; }

function drawSweep(sw, ta, tb, alpha, td) {
  const m = S.mag ? 10 : 1, hp = S.hpos * HPOS_RANGE;
  const tva = sw.st + td * (((-0.9 - 5 - hp) / m) + 5);
  const tvb = sw.st + td * (((10.9 - 5 - hp) / m) + 5);
  ta = Math.max(ta, tva, sw.st); tb = Math.min(tb, tvb, sw.st + 10 * td);
  if (tb <= ta) return;
  const xOf = t => ((t - sw.st) / td - 5) * m + 5 + hp;
  const pxSpan = (tb - ta) / td * m * DIV;
  for (const tr of tracesFor(sw.ch)) {
    const fn = traceFn(tr);
    const cycles = fn.f * (tb - ta);
    const n = clamp(Math.ceil(Math.max(cycles * 40, pxSpan / 1.5)), 2, 5000);
    const P = newPaths();
    const chopFast = tr.chop != null && td < 50e-6;
    let px = null, py = 0;
    for (let k = 0; k <= n; k++) {
      const t = ta + (tb - ta) * k / n;
      if (chopFast && (Math.floor(t / 2e-6) & 1) !== tr.chop) { px = null; continue; }
      const x = xPx(xOf(t)), y = yPx(fn.y(t)) + (Math.random() - 0.5) * 0.7;
      if (px != null) addSeg(P, px, py, x, y);
      px = x; py = y;
    }
    strokePaths(P, alpha);
  }
}

// 光点走得越快，单位长度上留下的电子越少，线就越暗（方波的竖边几乎看不见）
function newPaths() { return [new Path2D(), new Path2D(), new Path2D()]; }
function addSeg(P, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const b = d < 5 ? 0 : d < 14 ? 1 : 2;
  P[b].moveTo(x0, y0); P[b].lineTo(x1, y1);
}
function strokePaths(P, alpha) { strokePath(P[0], alpha); strokePath(P[1], alpha * 0.6); strokePath(P[2], alpha * 0.22); }
function strokePath(path, alpha) {
  const ctx = E.ctx, lw = lineW();
  ctx.strokeStyle = `rgba(70,255,150,${alpha * 0.16})`; ctx.lineWidth = lw * 3.6; ctx.stroke(path);
  ctx.strokeStyle = `rgba(160,255,200,${alpha})`; ctx.lineWidth = lw; ctx.stroke(path);
}

function renderXY(t0, t1) {
  const s0 = chanSig(0), s1 = chanSig(1);
  const g0 = gainDiv(0), g1 = gainDiv(1) * sgn(1);
  const hp = S.hpos * HPOS_RANGE, p1 = S.ch[1].pos * VPOS_RANGE;
  const fmax = Math.max(s0 ? s0.s.f : 0, s1 ? s1.s.f : 0);
  const B = baseB();
  if (fmax === 0) {
    const ctx = E.ctx, x = xPx(5 + vAt(s0, t1) * g0 + hp), y = yPx(vAt(s1, t1) * g1 + p1);
    ctx.fillStyle = `rgba(160,255,200,${Math.min(1, B * 0.6)})`;
    ctx.beginPath(); ctx.arc(x, y, lineW() * 1.1, 0, TWO_PI); ctx.fill();
    return;
  }
  const n = clamp(Math.ceil(fmax * (t1 - t0) * 72), 24, 9000);
  const P = newPaths();
  let px = null, py = 0;
  for (let k = 0; k <= n; k++) {
    const t = t0 + (t1 - t0) * k / n;
    const x = xPx(5 + vAt(s0, t) * g0 + hp) + (Math.random() - 0.5) * 0.6, y = yPx(vAt(s1, t) * g1 + p1) + (Math.random() - 0.5) * 0.6;
    if (px != null) addSeg(P, px, py, x, y);
    px = x; py = y;
  }
  strokePaths(P, Math.min(1, B * 0.75));
}

/* ---------------- LCD ---------------- */

function fmtTime(s) {
  if (s >= 1) return s + 's';
  if (s >= 1e-3) return +(s * 1e3).toPrecision(3) + 'ms';
  return +(s * 1e6).toPrecision(3) + 'μs';
}
function fmtVolt(v) { return v >= 1 ? v + 'V' : +(v * 1e3).toPrecision(3) + 'mV'; }
function fmtFreq(f) {
  if (f == null) return '- - - - -';
  if (f >= 1e6) return (f / 1e6).toPrecision(5) + ' MHz';
  if (f >= 1e3) return (f / 1e3).toPrecision(5) + ' kHz';
  return f.toPrecision(5) + ' Hz';
}

const LCD = {};
function updateLCD(t) {
  if (!LCD.el) return;
  LCD.el.classList.toggle('off', !S.power);
  if (!S.power) return;
  const test = LCD.testUntil && t < LCD.testUntil;
  LCD.el.classList.toggle('test', !!test);
  if (test) { LCD.tl.textContent = '8.8.8.8'; LCD.tr.textContent = '8.8.8.8.8 Hz'; LCD.bl.textContent = 'CH1 8.8V'; LCD.br.textContent = 'CH2 8.8V'; LCD.mag.textContent = 'x10'; return; }
  LCD.tl.textContent = isXY() ? 'X-Y' : fmtTime(tdivNominal());
  LCD.mag.textContent = S.mag && !isXY() ? 'x10' : '';
  LCD.tr.textContent = fmtFreq(counterFreq(t));
  LCD.bl.textContent = 'CH1 ' + fmtVolt(VDIV[S.ch[0].vi]);
  LCD.br.textContent = 'CH2 ' + fmtVolt(VDIV[S.ch[1].vi]);
}

/* ---------------- 给教学模块用的"真值" ---------------- */

const Truth = {
  // 屏幕上某通道峰-峰值占多少格（信号本身的格数，不含 POSITION）
  ppDiv(i) { const sig = chanSig(i); return sig ? 2 * sig.a * gainDiv(i) : 0; },
  troughDiv(i) { const sig = chanSig(i); const p = S.ch[i].pos * VPOS_RANGE; return sig ? (sig.d - sig.a) * gainDiv(i) + p : p; },
  peakDiv(i) { const sig = chanSig(i); const p = S.ch[i].pos * VPOS_RANGE; return sig ? (sig.d + sig.a) * gainDiv(i) + p : p; },
  periodDiv(i) { const sig = chanSig(i); if (!sig || isXY()) return 0; return (1 / sig.s.f) / tdivEff() * (S.mag ? 10 : 1); },
  cycles(i) { const p = this.periodDiv(i); return p ? 10 / p : 0; },
  srcOf(i) { return S.conn[i ? 'CH2' : 'CH1']; },
  freqOf(name) { const s = srcObj(name); return s ? s.f : 0; },
  // 李萨如：X(CH1) 与 Y(CH2) 的瞬时相位差，折算到 0~90°
  xyPhaseDeg(t) {
    const s0 = chanSig(0), s1 = chanSig(1); if (!s0 || !s1) return null;
    const d = (s1.s.phase(t) + (S.inv ? Math.PI : 0)) - s0.s.phase(t);
    return Math.asin(Math.abs(Math.sin(d))) * 180 / Math.PI;
  },
};
