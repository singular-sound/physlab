'use strict';
/* ============================================================
   面板：旋钮、按键、拨动开关、插座、信号源、连接线、提示框
   坐标都是"实验台"内的像素坐标（实验台整体按屏幕宽度缩放）
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, parent, style) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
};

const Panel = { specs: {}, els: {}, listeners: [], scale: 1, tipFor: null, mode: 'teach' };
const GEN_A = { x: 0, y: 640 }, GEN_B = { x: 670, y: 640 };

const WAVE_CN = { sine: '正弦', tri: '三角', square: '方波' };
const SRC_CN = { A: '信号源 A', B: '信号源 B', CAL: 'CAL 标准方波' };

const Snd = {
  on: true, ctx: null,
  play(kind) {
    if (!this.on) return;
    try {
      const c = this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (c.state === 'suspended') c.resume();
      const cfg = { sel: [0.016, 3400, 6, 0.22], btn: [0.04, 1700, 3, 0.32], slide: [0.03, 2300, 4, 0.3], plug: [0.06, 900, 2.5, 0.4], key: [0.025, 2600, 4, 0.22] }[kind] || [0.02, 2500, 5, 0.2];
      const n = Math.ceil(c.sampleRate * cfg[0]), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, cfg[2]);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = cfg[1]; f.Q.value = 1.4;
      const g = c.createGain(); g.gain.value = cfg[3];
      src.connect(f); f.connect(g); g.connect(c.destination); src.start();
    } catch (e) { /* 浏览器不让出声就算了 */ }
  },
};

function changed(id) {
  const k = Panel.specs[id] && Panel.specs[id].kind;
  if (k === 'sel' || k === 'enc') Snd.play('sel');
  else if (k === 'btn') Snd.play('btn');
  else if (k === 'key') Snd.play('key');
  else if (k === 'slide') Snd.play('slide');
  else if (k === 'bnc' || k === 'term') Snd.play('plug');
  Panel.refresh();
  for (const f of Panel.listeners) f(id);
}

/* ---------------- 通用部件 ---------------- */

function place(e, x, y, w, h) {
  Object.assign(e.style, { left: (x - w / 2) + 'px', top: (y - h / 2) + 'px', width: w + 'px', height: h + 'px' });
}
function legend(parent, text, x, y, cls = '') {
  const l = el('div', 'legend ' + cls, parent); l.innerHTML = text;
  l.style.left = x + 'px'; l.style.top = y + 'px';
  return l;
}

function addCtl(spec) {
  const parent = spec.parent || $('#scope');
  const ox = spec.ox || 0, oy = spec.oy || 0;
  Panel.specs[spec.id] = spec;
  let e;
  const sz = spec.size || 44;
  switch (spec.kind) {
    case 'knob': case 'sel': case 'enc': {
      e = el('div', 'ctl knob' + (spec.big ? ' big' : ''), parent);
      place(e, spec.x, spec.y, sz, sz);
      el('div', 'rot', e); el('div', 'lit', e);
      if (spec.ticks) drawTicks(parent, spec);
      break;
    }
    case 'screw':
      e = el('div', 'ctl screw', parent); place(e, spec.x, spec.y, sz, sz); el('div', 'rot', e); break;
    case 'btn':
      e = el('div', 'ctl btn' + (spec.cls ? ' ' + spec.cls : ''), parent);
      place(e, spec.x, spec.y, spec.w || 30, spec.h || 20);
      break;
    case 'slide': {
      const h = spec.h || 64;
      e = el('div', 'ctl slide', parent); place(e, spec.x, spec.y, 10, h);
      el('div', 'track', e);
      const lever = el('div', 'lever', e);
      spec._opts = spec.options.map((o, k) => {
        const oy2 = spec.y - h / 2 + 8 + k * (h - 16) / (spec.options.length - 1);
        const t = el('div', 'slide-opt', parent);
        t.textContent = o;
        if (spec.labelSide === 'left') { t.style.right = (1180 - (spec.x - 12)) + 'px'; t.style.top = (oy2 - 8) + 'px'; }
        else { t.style.left = (spec.x + 12) + 'px'; t.style.top = (oy2 - 8) + 'px'; }
        if (spec.labelSide === 'left' && parent !== $('#scope')) { t.style.right = ''; t.style.left = (spec.x - 12) + 'px'; t.style.transform = 'translateX(-100%)'; }
        t.addEventListener('click', ev => { ev.stopPropagation(); spec.set(k); changed(spec.id); });
        t.addEventListener('pointerenter', ev => showTip(spec, ev));
        t.addEventListener('pointerleave', hideTip);
        return { t, y: oy2 - (spec.y - h / 2) - 8 };
      });
      spec._lever = lever;
      break;
    }
    case 'bnc':
      e = el('div', 'ctl bnc', parent); place(e, spec.x, spec.y, sz, sz); break;
    case 'term':
      e = el('div', 'ctl term ' + (spec.color || ''), parent); place(e, spec.x, spec.y, sz, sz); break;
    case 'key':
      e = el('div', 'key ' + (spec.cls || ''), parent);
      Object.assign(e.style, { left: spec.x + 'px', top: spec.y + 'px', width: (spec.w || 34) + 'px', height: (spec.h || 28) + 'px' });
      e.textContent = spec.text; e.classList.add('ctl');
      break;
  }
  e.tabIndex = 0;
  e.dataset.id = spec.id;
  e.setAttribute('role', spec.kind === 'btn' || spec.kind === 'key' ? 'button' : 'slider');
  e.setAttribute('aria-label', spec.name || spec.label || spec.id);
  if (spec.label) legend(parent, spec.label, spec.lx ?? spec.x, spec.ly ?? (spec.y - (spec.kind === 'btn' ? (spec.h || 20) / 2 : sz / 2) - 18), spec.lcls || '');
  Panel.els[spec.id] = e;
  bindCtl(e, spec);
  return e;
}

function drawTicks(parent, spec) {
  const sz = spec.size, R = sz / 2 + 7, n = spec.ticks;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ticks');
  const W = sz + 60;
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
  Object.assign(svg.style, { left: (spec.x - W / 2) + 'px', top: (spec.y - W / 2) + 'px', width: W + 'px', height: W + 'px' });
  let s = '';
  for (let k = 0; k < n; k++) {
    const a = (-140 + 280 * k / (n - 1)) * Math.PI / 180;
    const c = W / 2;
    const x1 = c + Math.sin(a) * R, y1 = c - Math.cos(a) * R, x2 = c + Math.sin(a) * (R + 4), y2 = c - Math.cos(a) * (R + 4);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${spec.tickColor || '#3a3933'}" stroke-width="1.2"/>`;
  }
  (spec.tickLabels || []).forEach(([k, txt]) => {
    const a = (-140 + 280 * k / (n - 1)) * Math.PI / 180, c = W / 2, r2 = R + 13;
    s += `<text x="${c + Math.sin(a) * r2}" y="${c - Math.cos(a) * r2 + 3}" font-size="9" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="600" text-anchor="middle" fill="${spec.tickColor || '#3a3933'}">${txt}</text>`;
  });
  svg.innerHTML = s;
  parent.appendChild(svg);
}

function bindCtl(e, spec) {
  const k = spec.kind;
  e.addEventListener('pointerenter', ev => showTip(spec, ev));
  e.addEventListener('pointerleave', () => { if (!e._drag) hideTip(); });
  if (k === 'knob' || k === 'sel' || k === 'enc' || k === 'screw') {
    // 只有按住才拧：往右或往上拖 = 顺时针。档位旋钮每 STEP 像素走一格（咔哒），连续旋钮 FULL 像素拧满一圈
    const STEP = k === 'enc' ? 18 : 26, FULL = 320;
    const span = () => (spec.max ?? 1) - (spec.min ?? 0);
    const endDrag = () => {
      const d = e._drag; if (!d) return;
      e._drag = null;
      try { e.releasePointerCapture(d.id); } catch (err) { /* 已经释放了 */ }
      e.classList.remove('dragging'); document.body.classList.remove('knob-drag');
      if (!e.matches(':hover')) hideTip();
    };
    e.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      e.focus({ preventScroll: true });
      try { e.setPointerCapture(ev.pointerId); } catch (err) { /* 拿不到捕获也能拖，只是移出旋钮后会停 */ }
      e._drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, last: 0, acc: 0, v: spec.get ? spec.get() : 0 };
      e.classList.add('dragging'); document.body.classList.add('knob-drag');
      showTip(spec, ev);
    });
    e.addEventListener('pointermove', ev => {
      const d = e._drag; if (!d || ev.pointerId !== d.id) return;
      if (ev.pointerType === 'mouse' && ev.buttons === 0) { endDrag(); return; }   // 鼠标已经松开
      const delta = (ev.clientX - d.x) - (ev.clientY - d.y);
      const inc = delta - d.last; d.last = delta;
      const fine = ev.shiftKey || ev.altKey;
      if (k === 'sel' || k === 'enc') {
        d.acc += inc * (fine ? 0.4 : 1);
        let steps = 0;
        while (d.acc >= STEP) { d.acc -= STEP; steps++; }
        while (d.acc <= -STEP) { d.acc += STEP; steps--; }
        if (steps && k === 'sel') {
          const v = clamp(spec.get() + steps, 0, spec.steps - 1);
          if (v !== spec.get()) { spec.set(v); changed(spec.id); } else d.acc = 0;   // 拧到头就顶住
        } else if (steps) { spec.step(steps); changed(spec.id); }
      } else {
        d.v = clamp(d.v + inc * span() / FULL * (fine ? 0.12 : 1), spec.min ?? 0, spec.max ?? 1);
        spec.set(d.v); changed(spec.id);
      }
      showTip(spec, ev);
    });
    e.addEventListener('pointerup', endDrag);
    e.addEventListener('pointercancel', endDrag);
    e.addEventListener('lostpointercapture', endDrag);
    e.addEventListener('keydown', ev => {
      const m = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[ev.key];
      if (m) { ev.preventDefault(); nudge(spec, m, ev.shiftKey); showTip(spec); }
    });
  } else if (k === 'btn' || k === 'key') {
    const act = () => { spec.press(); changed(spec.id); showTip(spec); };
    e.addEventListener('click', act);
    e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); act(); } });
  } else if (k === 'slide') {
    // 按住拨杆上下拖：拖到哪一档就是哪一档；只点一下不拖，就往下切一档
    const n = spec.options.length;
    const idxAt = y => { const r = e.getBoundingClientRect(); return clamp(Math.round((y - r.top) / r.height * (n - 1)), 0, n - 1); };
    const end = ev => {
      const d = e._drag; if (!d) return;
      e._drag = null;
      try { e.releasePointerCapture(d.id); } catch (err) { /* 已经释放了 */ }
      e.classList.remove('dragging'); document.body.classList.remove('knob-drag');
      if (!d.moved && ev.type === 'pointerup') { spec.set((spec.get() + 1) % n); changed(spec.id); }
      showTip(spec);
    };
    e.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      ev.preventDefault(); e.focus({ preventScroll: true });
      try { e.setPointerCapture(ev.pointerId); } catch (err) { /* 拿不到捕获也能拨 */ }
      e._drag = { id: ev.pointerId, y: ev.clientY, moved: false };
      showTip(spec, ev);
    });
    e.addEventListener('pointermove', ev => {
      const d = e._drag; if (!d || ev.pointerId !== d.id) return;
      if (ev.pointerType === 'mouse' && ev.buttons === 0) { end(ev); return; }
      if (!d.moved && Math.abs(ev.clientY - d.y) < 4) return;
      if (!d.moved) { d.moved = true; e.classList.add('dragging'); document.body.classList.add('knob-drag'); }
      const k2 = idxAt(ev.clientY);
      if (k2 !== spec.get()) { spec.set(k2); changed(spec.id); showTip(spec, ev); }
    });
    e.addEventListener('pointerup', end);
    e.addEventListener('pointercancel', end);
    e.addEventListener('keydown', ev => {
      const m = { ArrowUp: -1, ArrowDown: 1 }[ev.key];
      if (m) { ev.preventDefault(); spec.set(clamp(spec.get() + m, 0, spec.options.length - 1)); changed(spec.id); }
    });
  } else if (k === 'bnc' || k === 'term') {
    const act = () => openMenu(spec, e);
    e.addEventListener('click', act);
    e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); act(); } });
  }
}

function nudge(spec, dir, fine) {
  if (spec.kind === 'sel') {
    const v = clamp(spec.get() + dir, 0, spec.steps - 1);
    if (v !== spec.get()) { spec.set(v); changed(spec.id); }
  } else if (spec.kind === 'enc') { spec.step(dir); changed(spec.id); }
  else {
    const span = (spec.max ?? 1) - (spec.min ?? 0);
    spec.set(clamp(spec.get() + dir * span * (fine ? 0.004 : 0.02), spec.min ?? 0, spec.max ?? 1)); changed(spec.id);
  }
}

/* ---------------- 提示框 ---------------- */

function showTip(spec, ev) {
  const tip = $('#tip');
  const val = spec.fmt ? spec.fmt() : '';
  const desc = Panel.mode === 'teach' && spec.desc ? `<div class="dsc">${spec.desc}</div>` : '';
  tip.innerHTML = `<b>${spec.name || spec.label || spec.id}</b>${val ? `<span class="v">${val}</span>` : ''}${desc}`;
  tip.hidden = false;
  const e = Panel.els[spec.id];
  const r = e.getBoundingClientRect();
  let x = r.right + 12, y = r.top - 6;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  if (x + tw > innerWidth - 8) x = r.left - tw - 12;
  if (x < 8) { x = Math.min(innerWidth - tw - 8, Math.max(8, r.left)); y = r.bottom + 10; }
  if (y + th > innerHeight - 8) y = innerHeight - th - 8;
  tip.style.left = x + 'px'; tip.style.top = Math.max(8, y) + 'px';
}
function hideTip() { $('#tip').hidden = true; }

/* ---------------- 接线菜单 ---------------- */

function openMenu(spec, anchor) {
  const m = $('#menu');
  m.innerHTML = `<div class="mh">${spec.menuTitle}</div>`;
  for (const [label, fn, cur] of spec.menu()) {
    const b = el('button', cur ? 'cur' : '', m); b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => { fn(); m.hidden = true; changed(spec.id); });
  }
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  let x = r.left, y = r.bottom + 8;
  if (x + m.offsetWidth > innerWidth - 8) x = innerWidth - m.offsetWidth - 8;
  if (y + m.offsetHeight > innerHeight - 8) y = r.top - m.offsetHeight - 8;
  m.style.left = Math.max(8, x) + 'px'; m.style.top = Math.max(8, y) + 'px';
}
document.addEventListener('pointerdown', ev => {
  const m = $('#menu');
  if (!m.hidden && !m.contains(ev.target) && !ev.target.closest('.bnc,.term')) m.hidden = true;
});

function connect(input, src) { S.conn[input] = src; }
function inputMenu(input) {
  const cur = S.conn[input];
  return [
    ['接 信号源 A', () => connect(input, 'A'), cur === 'A'],
    ['接 信号源 B', () => connect(input, 'B'), cur === 'B'],
    ['接 CAL 标准方波（面板上的 CAL 端子）', () => connect(input, 'CAL'), cur === 'CAL'],
    ['拔掉', () => connect(input, null), cur == null],
  ];
}
function sourceMenu(src) {
  const items = [];
  for (const inp of ['CH1', 'CH2', 'EXT']) {
    const nm = inp === 'EXT' ? 'TRIG IN' : inp;
    if (S.conn[inp] === src) items.push([`从 ${nm} 拔掉`, () => connect(inp, null), true]);
    else items.push([`接到 ${nm}` + (S.conn[inp] ? `（替换 ${SRC_CN[S.conn[inp]]}）` : ''), () => connect(inp, src), false]);
  }
  return items;
}

/* ---------------- 示波器面板定义 ---------------- */

function buildScope() {
  const sc = $('#scope');
  const sec = (x, y, w, h, title, tx) => {
    const d = el('div', 'sec', sc, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    if (title) { const t = el('div', 'sec-title', sc); t.textContent = title; t.style.left = (tx ?? x + 12) + 'px'; t.style.top = (y - 7) + 'px'; }
    return d;
  };
  sec(860, 16, 308, 220, 'TRIGGER', 990);
  sec(498, 128, 350, 108, 'HORIZONTAL', 610);
  const band = el('div', 'band', sc, { left: '498px', top: '248px', width: '670px' }); band.textContent = 'VERTICAL';
  el('div', '', sc, { position: 'absolute', left: '838px', top: '276px', width: '1.5px', height: '296px', background: 'var(--panel-line)' });

  // ---- CRT 区 ----
  addCtl({ id: 'inten', kind: 'knob', x: 62, y: 508, size: 46, label: 'INTEN', name: 'INTEN 亮度',
    get: () => S.inten, set: v => S.inten = v, fmt: () => Math.round(S.inten * 100) + '%',
    desc: '调光迹亮度。太暗看不见，太亮线会发毛、光点停久了会烧屏。暂时不用时把它调暗，不要关机。' });
  addCtl({ id: 'focus', kind: 'knob', x: 142, y: 508, size: 46, label: 'FOCUS', name: 'FOCUS 聚焦',
    get: () => S.focus, set: v => S.focus = v, fmt: () => Math.round(S.focus * 100) + '%',
    desc: '让扫描线变细、变清楚。拧到线最细的位置就对了。' });
  addCtl({ id: 'rot', kind: 'screw', x: 218, y: 508, size: 22, min: -1, max: 1, label: 'TRACE<br>ROTATION', lcls: 'sm', ly: 470, name: 'TRACE ROTATION 光迹旋转',
    get: () => S.rot, set: v => S.rot = v, fmt: () => (S.rot * 4).toFixed(1) + '°',
    desc: '一字螺丝孔：扫描线如果是歪的，用它转平，让线和横格线平行。平时不用动。' });
  addCtl({ id: 'autotb', kind: 'btn', x: 290, y: 512, w: 32, h: 22, label: 'AUTO<br>TIMEBASE', lcls: 'sm', ly: 470, name: 'AUTO TIMEBASE',
    press: () => autoTimebase(), fmt: () => '',
    desc: '频率计读数稳定时按一下，自动把 TIME/DIV 换到能看清几个周期的档位。实验里读数还是要自己数格子。' });
  addCtl({ id: 'power', kind: 'btn', cls: 'power', x: 400, y: 510, w: 58, h: 34, label: 'POWER', ly: 470, name: 'POWER 电源',
    press: () => { S.power = !S.power; if (S.power) { S.powerT = now(); LCD.testUntil = now() + 0.7; } }, fmt: () => S.power ? '开' : '关',
    desc: '按下开机、指示灯亮；再按一次弹起关机。开机后要等一两秒示波管才出亮线。' });
  Panel.powerLed = el('div', 'led', sc, { left: '446px', top: '505px' });

  // ---- LCD ----
  LCD.el = $('#lcd'); LCD.tl = $('#lcdTL'); LCD.tr = $('#lcdTR'); LCD.bl = $('#lcdBL'); LCD.br = $('#lcdBR'); LCD.mag = $('#lcdMag');
  Panel.specs.lcd = { id: 'lcd', name: 'LCD 小液晶屏', desc: '左上：TIME/DIV（横向 1 大格多少时间）；右上：触发信号的频率；下面两个：CH1、CH2 的 VOLTS/DIV（竖向 1 大格多少伏）。注意：VAR 不在 CAL 时，这里的数不会变，读数就不准了。' };
  Panel.els.lcd = LCD.el;
  LCD.el.addEventListener('pointerenter', ev => showTip(Panel.specs.lcd, ev));
  LCD.el.addEventListener('pointerleave', hideTip);

  // ---- 水平 ----
  addCtl({ id: 'hpos', kind: 'knob', x: 548, y: 188, size: 44, min: -1, max: 1, label: '◀ POSITION ▶', name: '水平 POSITION',
    get: () => S.hpos, set: v => S.hpos = v, fmt: () => (S.hpos * HPOS_RANGE).toFixed(2) + ' 格',
    desc: '把波形左右平移。X-Y 模式下它管 X 方向的位置。' });
  addCtl({ id: 'mag', kind: 'btn', x: 616, y: 212, w: 30, h: 20, label: '×10 MAG', lcls: 'sm', name: '×10 MAG 扩展',
    press: () => S.mag = !S.mag, fmt: () => S.mag ? '按下（放大 10 倍）' : '弹起',
    desc: '按下后横向放大 10 倍，看波形的细节。这时 1 格代表的时间是 TIME/DIV 读数的 1/10，测量前记得弹起来。' });
  addCtl({ id: 'swpvar', kind: 'knob', x: 690, y: 188, size: 40, label: 'SWP. VAR', name: 'SWP.VAR 扫描微调',
    ticks: 2, tickLabels: [[1, 'CAL']],
    get: () => S.swpvar, set: v => S.swpvar = v > 0.985 ? 1 : v, fmt: () => S.swpvar >= 1 ? 'CAL（校准）' : '未校准 ×' + (1 + 1.5 * (1 - S.swpvar)).toFixed(2),
    desc: '连续改变扫描速度，最多慢到 2.5 倍。顺时针拧到头是 CAL，只有在 CAL 时 TIME/DIV 的读数才准。测周期前必须拧到 CAL。' });
  addCtl({ id: 'tdiv', kind: 'sel', big: true, x: 790, y: 184, size: 66, steps: 21, label: 'TIME/DIV', ly: 134, name: 'TIME/DIV 扫描时间',
    ticks: 21, tickLabels: [[0, 'X-Y'], [20, '.2μs']],
    get: () => S.tpos, set: v => S.tpos = v, fmt: () => S.tpos === 0 ? 'X-Y 模式' : fmtTime(TDIV[S.tpos - 1]) + ' / 格',
    desc: '横向 1 大格代表多少时间。顺时针越来越快（波形被拉开），逆时针越来越慢（波形被压紧）。逆时针拧到头进入 X-Y 模式，用来看李萨如图形。' });

  // ---- 触发 ----
  addCtl({ id: 'trigalt', kind: 'btn', x: 892, y: 70, w: 30, h: 20, label: 'TRIG. ALT', lcls: 'sm', name: 'TRIG. ALT 交替触发',
    press: () => S.trigAlt = !S.trigAlt, fmt: () => S.trigAlt ? '按下' : '弹起',
    desc: 'DUAL 交替显示时，让 CH1、CH2 各用自己的信号触发，两路频率不同时也都能稳住。本实验一般不用。' });
  addCtl({ id: 'tmode', kind: 'slide', x: 1000, y: 86, h: 74, labelSide: 'left', options: ['AUTO', 'NORM', 'TV-V', 'TV-H'], label: 'MODE', lx: 985, ly: 32, name: 'TRIGGER MODE 触发模式',
    get: () => ['AUTO', 'NORM', 'TV-V', 'TV-H'].indexOf(S.trigMode), set: k => S.trigMode = ['AUTO', 'NORM', 'TV-V', 'TV-H'][k], fmt: () => S.trigMode,
    desc: 'AUTO：没触发信号也会自动扫描，屏上总有线，实验用这个。NORM：没触发就不扫描，屏上什么都没有。TV-V/TV-H：看电视信号用的，本实验不用。' });
  addCtl({ id: 'source', kind: 'slide', x: 1130, y: 86, h: 74, labelSide: 'left', options: ['CH1', 'CH2', 'LINE', 'EXT'], label: 'SOURCE', lx: 1112, ly: 32, name: 'SOURCE 触发源',
    get: () => ['CH1', 'CH2', 'LINE', 'EXT'].indexOf(S.source), set: k => S.source = ['CH1', 'CH2', 'LINE', 'EXT'][k], fmt: () => S.source,
    desc: '拿哪个信号来决定"什么时候开始扫描"。DUAL/ADD 时选 CH1 就按 CH1 的信号触发。LINE 是按 50 Hz 电源触发，EXT 是按 TRIG IN 端子的外部信号触发。' });
  addCtl({ id: 'level', kind: 'knob', x: 905, y: 190, size: 44, min: -1, max: 1, label: 'LEVEL', name: 'LEVEL 触发电平',
    get: () => S.level, set: v => S.level = v, fmt: () => (S.level >= 0 ? '+' : '') + (S.level * 4.4).toFixed(2) + ' 格',
    desc: '设定信号涨到多高时开始一次扫描。电平要落在波形的上下范围之内才能触发；拧出范围，波形就会乱跑。调稳波形：先拧 TIME/DIV，再拧它。' });
  addCtl({ id: 'slope', kind: 'btn', x: 990, y: 196, w: 30, h: 20, label: 'SLOPE  + / −', lcls: 'sm', name: 'SLOPE 触发斜率',
    press: () => S.slope = S.slope === '+' ? '-' : '+', fmt: () => S.slope === '+' ? '+ 上升沿触发' : '− 下降沿触发',
    desc: '弹起是"+"：信号往上穿过电平时触发，波形从上升段开始画；按下是"−"：往下穿过时触发。' });
  addCtl({ id: 'trigin', kind: 'bnc', x: 1110, y: 196, size: 38, label: 'TRIG IN', lcls: 'sm', name: 'TRIG IN 外触发输入', menuTitle: 'TRIG IN 接什么？',
    menu: () => inputMenu('EXT'), fmt: () => S.conn.EXT ? '接了 ' + SRC_CN[S.conn.EXT] : '空着',
    desc: '外部触发信号输入端，要配合 SOURCE 拨到 EXT 用。本实验用不到。' });

  // ---- CH1 ----
  const vdesc = n => `竖向 1 大格代表多少伏，共 12 档（5V～1mV）。顺时针越来越灵敏，波形越高。读数看 LCD 上的 ${n}。`;
  addCtl({ id: 'v1', kind: 'sel', big: true, x: 562, y: 338, size: 66, steps: 12, label: 'VOLTS/DIV', ly: 286, name: 'CH1 VOLTS/DIV',
    ticks: 12, tickLabels: [[0, '5V'], [11, '1mV']],
    get: () => S.ch[0].vi, set: v => S.ch[0].vi = v, fmt: () => fmtVolt(VDIV[S.ch[0].vi]) + ' / 格', desc: vdesc('CH1') + 'X-Y 模式下它管 X 方向的大小。' });
  addCtl({ id: 'pos1', kind: 'knob', x: 666, y: 334, size: 42, min: -1, max: 1, label: '▲ POSITION ▼', name: 'CH1 垂直 POSITION',
    get: () => S.ch[0].pos, set: v => S.ch[0].pos = v, fmt: () => (S.ch[0].pos * VPOS_RANGE).toFixed(2) + ' 格',
    desc: '把 CH1 的波形上下平移。读数时用它把波谷对到一条横格线上，好数格子。' });
  addCtl({ id: 'var1', kind: 'knob', x: 750, y: 318, size: 36, label: 'VAR', name: 'CH1 VAR 灵敏度微调', ticks: 2, tickLabels: [[1, 'CAL']],
    get: () => S.ch[0].vvar, set: v => S.ch[0].vvar = v > 0.985 ? 1 : v, fmt: () => S.ch[0].vvar >= 1 ? 'CAL（校准）' : '未校准 ×' + varFactor(S.ch[0].vvar).toFixed(2),
    desc: '连续调波形高度，最多缩到 1/2.5。顺时针拧到头是 CAL。不在 CAL 时 LCD 的 VOLTS/DIV 读数不会提醒你，但读出来的电压是错的。' });
  addCtl({ id: 'chop', kind: 'btn', x: 722, y: 414, w: 30, h: 20, label: 'ALT / CHOP', lcls: 'sm', name: 'ALT/CHOP 双踪显示方式',
    press: () => S.chop = !S.chop, fmt: () => S.chop ? 'CHOP（断续）' : 'ALT（交替）',
    desc: 'DUAL 时两条线怎么画。弹起 ALT：一次扫描画 CH1、下一次画 CH2，扫描快时用。按下 CHOP：两路快速切换着同时画，扫描慢时用（不然会看到两条线轮流闪）。' });
  addCtl({ id: 'cpl1', kind: 'slide', x: 628, y: 470, h: 58, options: ['AC', 'GND', 'DC'], name: 'CH1 AC-GND-DC 耦合',
    get: () => ['AC', 'GND', 'DC'].indexOf(S.ch[0].cpl), set: k => S.ch[0].cpl = ['AC', 'GND', 'DC'][k], fmt: () => S.ch[0].cpl,
    desc: 'AC：中间串了个电容，直流被挡掉，只看交流部分。GND：输入接地，屏上是一条代表 0 V 的横线，用来定零线。DC：交流直流一起进来。测直流分量就靠 AC 和 DC 的差别。' });
  addCtl({ id: 'ch1in', kind: 'bnc', x: 545, y: 528, size: 42, label: 'CH1 (X)', ly: 488, name: 'CH1 (X) 输入', menuTitle: 'CH1 接什么？',
    menu: () => inputMenu('CH1'), fmt: () => S.conn.CH1 ? '接了 ' + SRC_CN[S.conn.CH1] : '空着',
    desc: '通道 1 的输入插座。X-Y 模式下它是 X 轴的信号。点一下选择接哪根线。' });

  // ---- MODE ----
  addCtl({ id: 'vmode', kind: 'slide', x: 790, y: 470, h: 72, options: ['CH1', 'CH2', 'DUAL', 'ADD'], label: 'MODE', lx: 800, ly: 412, name: 'VERT MODE 垂直方式',
    get: () => ['CH1', 'CH2', 'DUAL', 'ADD'].indexOf(S.vmode), set: k => S.vmode = ['CH1', 'CH2', 'DUAL', 'ADD'][k], fmt: () => S.vmode,
    desc: 'CH1：只显示通道 1。CH2：只显示通道 2。DUAL：两条线同时显示。ADD：把两路信号加起来显示成一条（拍频实验用）。' });

  // ---- CH2 ----
  addCtl({ id: 'var2', kind: 'knob', x: 880, y: 318, size: 36, label: 'VAR', name: 'CH2 VAR 灵敏度微调', ticks: 2, tickLabels: [[1, 'CAL']],
    get: () => S.ch[1].vvar, set: v => S.ch[1].vvar = v > 0.985 ? 1 : v, fmt: () => S.ch[1].vvar >= 1 ? 'CAL（校准）' : '未校准 ×' + varFactor(S.ch[1].vvar).toFixed(2),
    desc: '和 CH1 的 VAR 一样：顺时针拧到头是 CAL，测量前要在 CAL。' });
  addCtl({ id: 'pos2', kind: 'knob', x: 966, y: 334, size: 42, min: -1, max: 1, label: '▲ POSITION ▼', name: 'CH2 垂直 POSITION',
    get: () => S.ch[1].pos, set: v => S.ch[1].pos = v, fmt: () => (S.ch[1].pos * VPOS_RANGE).toFixed(2) + ' 格',
    desc: '把 CH2 的波形上下平移。X-Y 模式下它管 Y 方向的位置。' });
  addCtl({ id: 'v2', kind: 'sel', big: true, x: 1076, y: 338, size: 66, steps: 12, label: 'VOLTS/DIV', ly: 286, name: 'CH2 VOLTS/DIV',
    ticks: 12, tickLabels: [[0, '5V'], [11, '1mV']],
    get: () => S.ch[1].vi, set: v => S.ch[1].vi = v, fmt: () => fmtVolt(VDIV[S.ch[1].vi]) + ' / 格', desc: vdesc('CH2') + 'X-Y 模式下它管 Y 方向的大小。' });
  addCtl({ id: 'inv', kind: 'btn', x: 906, y: 414, w: 30, h: 20, label: 'CH2 INV', lcls: 'sm', name: 'CH2 INV 反相',
    press: () => S.inv = !S.inv, fmt: () => S.inv ? '按下（CH2 上下颠倒）' : '弹起',
    desc: '按下后 CH2 的波形上下颠倒。ADD 模式下按下它就变成 CH1 − CH2。拍频实验要确认它是弹起的。' });
  addCtl({ id: 'cal', kind: 'term', x: 872, y: 524, size: 24, label: 'CAL<br>2Vp-p', lcls: 'sm', ly: 486, name: 'CAL 标准方波输出', menuTitle: '把哪个通道的线接到 CAL？',
    menu: () => sourceMenu('CAL').slice(0, 2), fmt: () => '1 kHz、2 Vp-p 方波',
    desc: '仪器自带的标准信号：1 kHz、峰峰值 2 V 的方波（教材第 98 页）。用来修正测量结果。注意教材第 99 页写的是 1 V，上课时看清端子旁边印的数。' });
  addCtl({ id: 'gnd', kind: 'term', color: 'black', x: 928, y: 526, size: 20, label: 'GND', lcls: 'sm', ly: 494, name: 'GND 接地端',
    menu: () => [], menuTitle: '接地端（不用接）', fmt: () => '', desc: '示波器的接地端，本实验不用接。' });
  addCtl({ id: 'cpl2', kind: 'slide', x: 1004, y: 470, h: 58, options: ['AC', 'GND', 'DC'], name: 'CH2 AC-GND-DC 耦合',
    get: () => ['AC', 'GND', 'DC'].indexOf(S.ch[1].cpl), set: k => S.ch[1].cpl = ['AC', 'GND', 'DC'][k], fmt: () => S.ch[1].cpl,
    desc: '和 CH1 一样：AC 挡直流，GND 定零线，DC 全部放进来。' });
  addCtl({ id: 'ch2in', kind: 'bnc', x: 1112, y: 528, size: 42, label: 'CH2 (Y)', ly: 488, name: 'CH2 (Y) 输入', menuTitle: 'CH2 接什么？',
    menu: () => inputMenu('CH2'), fmt: () => S.conn.CH2 ? '接了 ' + SRC_CN[S.conn.CH2] : '空着',
    desc: '通道 2 的输入插座。X-Y 模式下它是 Y 轴的信号。' });

  drawGraticule();
  buildCabinet();
}

function buildCabinet() {
  const plane = $('#plane');
  const box = (x, y, w, h, d, top, side, before) => {
    const mk = (cls, st, bg) => { const f = el('div', 'face ' + cls, null, st); f.style.background = bg; plane.insertBefore(f, before); return f; };
    mk('top', { left: x + 'px', top: (y - d) + 'px', width: w + 'px', height: d + 'px' }, top);
    mk('side-l', { left: (x - d) + 'px', top: y + 'px', width: d + 'px', height: h + 'px' }, side);
    mk('side-r', { left: (x + w) + 'px', top: y + 'px', width: d + 'px', height: h + 'px' }, side);
  };
  const vents = 'repeating-linear-gradient(90deg,#0000 0 14px,#00000038 14px 18px)';
  box(-9, -9, 1198, 602, 330,
    `${vents} 50% 40%/70% 26% no-repeat,linear-gradient(0deg,#cfd0ca,#b6b7b1)`,
    `linear-gradient(90deg,#9fa09a,#c4c5bf 40%,#a7a8a2),repeating-linear-gradient(0deg,#0000 0 40px,#0000000d 40px 41px)`, $('#scope'));
  box(-7, 633, 664, 276, 240, `linear-gradient(0deg,#3a3f43,#2b2f32)`, `linear-gradient(90deg,#24282b,#383d41 45%,#25292c)`, $('#genA'));
  box(663, 633, 524, 276, 240, `linear-gradient(0deg,#3a3f43,#2b2f32)`, `linear-gradient(90deg,#24282b,#383d41 45%,#25292c)`, $('#genA'));
  // 示波器脚下的搁板
  const shelf = el('div', 'face', null, { left: '-60px', top: '596px', width: '1300px', height: '16px', background: 'linear-gradient(#7c6047,#4d3a2a)', boxShadow: '0 12px 22px #0009', borderRadius: '2px' });
  plane.insertBefore(shelf, $('#genA'));
  const shelfTop = el('div', 'face top', null, { left: '-60px', top: (596 - 340) + 'px', width: '1300px', height: '340px', background: 'linear-gradient(0deg,#8a6b50,#5e4733)' });
  plane.insertBefore(shelfTop, plane.firstChild);
  for (const [x, y] of [[40, 588], [1110, 588]]) el('div', 'face', null, { left: x + 'px', top: y + 'px', width: '34px', height: '10px', background: '#151515', borderRadius: '0 0 4px 4px' });
  // 面板四角的螺丝
  for (const [x, y, r] of [[8, 8, 20], [1160, 8, 70], [8, 564, 110], [1160, 564, 45]]) { const sc = el('div', 'pscrew', $('#scope'), { left: x + 'px', top: y + 'px' }); sc.style.setProperty('--r', r + 'deg'); }
}

function drawGraticule() {
  const g = $('#grat');
  let s = '';
  const x0 = CX - 5 * DIV, y0 = CY - 4 * DIV;
  const c = '#9fb5a8';
  for (let i = 0; i <= 10; i++) s += `<line x1="${x0 + i * DIV}" y1="${y0}" x2="${x0 + i * DIV}" y2="${y0 + 8 * DIV}" stroke="${c}" stroke-opacity="${i === 0 || i === 10 ? .55 : .3}" stroke-width="1"/>`;
  for (let j = 0; j <= 8; j++) s += `<line x1="${x0}" y1="${y0 + j * DIV}" x2="${x0 + 10 * DIV}" y2="${y0 + j * DIV}" stroke="${c}" stroke-opacity="${j === 0 || j === 8 ? .55 : .3}" stroke-width="1"/>`;
  for (let k = 0; k <= 50; k++) { const x = x0 + k * DIV / 5; s += `<line x1="${x}" y1="${CY - 3}" x2="${x}" y2="${CY + 3}" stroke="${c}" stroke-opacity=".5"/>`; }
  for (let k = 0; k <= 40; k++) { const y = y0 + k * DIV / 5; s += `<line x1="${CX - 3}" y1="${y}" x2="${CX + 3}" y2="${y}" stroke="${c}" stroke-opacity=".5"/>`; }
  for (const [yd, lab] of [[3, '100'], [2.4, '90'], [-2.4, '10'], [-3, '0%']]) {
    const y = CY - yd * DIV;
    s += `<line x1="${x0}" y1="${y}" x2="${x0 + 10 * DIV}" y2="${y}" stroke="${c}" stroke-opacity=".35" stroke-dasharray="1.5 6.5"/>`;
    s += `<text x="${x0 + 3}" y="${y - 2}" font-size="7" font-family="Barlow Condensed,Arial Narrow,sans-serif" fill="${c}" fill-opacity=".6">${lab}</text>`;
  }
  g.innerHTML = s;
}

function autoTimebase() {
  if (!S.power) return;
  const f = counterFreq(now());
  if (!f) { toast('频率计没读到稳定的信号，AUTO TIMEBASE 不起作用。'); return; }
  const want = 2.5 / f / 10 / CAL_ERR.t;
  let best = 1, bd = 1e9;
  for (let p = 1; p <= 20; p++) { const d = Math.abs(Math.log(TDIV[p - 1] / want)); if (d < bd) { bd = d; best = p; } }
  S.tpos = best;
}

/* ---------------- 信号源 A ---------------- */

function buildGenA() {
  const p = $('#genA'), O = { parent: p };
  const t = el('div', 'gtitle', p); t.innerHTML = '信号源 A · 函数信号发生器<small>已知频率：屏幕上读得到准确频率</small>';
  const disp = el('div', 'gen-disp', p, { left: '18px', top: '62px', width: '326px', height: '82px' });
  disp.innerHTML = '<div class="big" id="aBig"></div><div class="sub" id="aSub"></div>';
  Panel.els.aDisp = disp;
  Panel.specs.aDisp = { id: 'aDisp', name: '频率显示', desc: '显示当前输出频率。带下划线的那一位，就是 FREQUENCY 旋钮正在调的位。' };
  disp.addEventListener('pointerenter', ev => showTip(Panel.specs.aDisp, ev)); disp.addEventListener('pointerleave', hideTip);

  ['sine', 'tri', 'square'].forEach((w, k) => addCtl({ ...O, id: 'aw_' + w, kind: 'key', x: 18 + k * 70, y: 160, w: 62, h: 26, text: WAVE_CN[w] + '波', name: '波形：' + WAVE_CN[w] + '波',
    press: () => S.A.wave = w, fmt: () => S.A.wave === w ? '当前' : '', desc: '选择输出波形。' }));

  const keys = [['7', '8', '9', 'Hz'], ['4', '5', '6', 'kHz'], ['1', '2', '3', '←'], ['0', '.', '◀', '▶']];
  keys.forEach((row, r) => row.forEach((k, c) => {
    const id = 'ak_' + k;
    addCtl({ ...O, id, kind: 'key', cls: k.length > 1 ? 'wide' : '', x: 366 + c * 40, y: 20 + r * 36, w: 34, h: 28, text: k,
      name: k === 'Hz' || k === 'kHz' ? `单位键 ${k}` : k === '←' ? '删除' : k === '◀' || k === '▶' ? `调节位 ${k}` : `数字键 ${k}`,
      desc: k === 'Hz' || k === 'kHz' ? '先按数字，再按单位键，频率就设好了。例：1 0 0 Hz。' :
        k === '◀' || k === '▶' ? '左右移动调节位（下划线），决定 FREQUENCY 旋钮一次改个位、十位还是百位。' : '输入频率数字。',
      press: () => keyA(k), fmt: () => '' });
  }));
  addCtl({ ...O, id: 'afreq', kind: 'enc', x: 566, y: 80, size: 64, label: 'FREQUENCY', ly: 30, name: 'FREQUENCY 频率旋钮',
    step: d => setAFreq(S.A.freq + d * Math.pow(10, S.A.cur)), get: () => 0,
    fmt: () => S.A.freq.toFixed(2) + ' Hz', desc: '连续调频率：每拧一格，带下划线的那一位加 1 或减 1。用 ◀ ▶ 换调节位。调李萨如图形、拍频时用它慢慢调。' });
  addCtl({ ...O, id: 'aamp', kind: 'knob', x: 252, y: 222, size: 44, label: 'AMPLITUDE', ly: 184, name: '幅度',
    min: 0, max: 10, get: () => S.A.amp, set: v => S.A.amp = Math.round(v * 100) / 100, fmt: () => S.A.amp.toFixed(2) + ' Vpp', desc: '输出信号的峰-峰值。' });
  addCtl({ ...O, id: 'aoff', kind: 'knob', x: 340, y: 222, size: 44, label: 'OFFSET', ly: 184, name: '直流偏置',
    min: -2.5, max: 2.5, get: () => S.A.offset, set: v => S.A.offset = Math.abs(v) < 0.04 ? 0 : Math.round(v * 100) / 100,
    fmt: () => (S.A.offset >= 0 ? '+' : '') + S.A.offset.toFixed(2) + ' V', desc: '给信号叠加一个直流电压，整个波形上下平移。"测直流分量"测的就是它。' });
  addCtl({ ...O, id: 'aout', kind: 'key', x: 440, y: 206, w: 78, h: 30, text: 'OUTPUT ON', name: 'OUTPUT ON 输出开关',
    press: () => S.A.on = !S.A.on, fmt: () => S.A.on ? '输出中（灯亮）' : '没输出（灯灭）',
    desc: '按下灯亮才有信号输出。注意要点里专门提醒：没信号先看这个灯亮没亮。' });
  Panel.aLed = el('div', 'led green', p, { left: '526px', top: '216px' });
  legend(p, 'OUTPUT', 600, 172);
  addCtl({ ...O, id: 'aoutj', kind: 'bnc', x: 600, y: 220, size: 40, name: '信号源 A 输出插座', menuTitle: '信号源 A 的线接到哪？',
    menu: () => sourceMenu('A'), fmt: () => connList('A'), desc: '信号源 A 的输出。点一下，选择接到示波器的哪个通道。' });
  const help = el('div', '', p, { position: 'absolute', left: '18px', top: '196px', width: '200px', font: '12px/1.45 var(--font-ui)', color: '#9fa9a5' });
  help.textContent = '设频率：按数字再按 Hz 或 kHz。微调：◀ ▶ 选位，拧 FREQUENCY。';
}

function keyA(k) {
  const A = S.A;
  if (/^[0-9.]$/.test(k)) { if (k === '.' && A.entry.includes('.')) return; if (A.entry.length < 9) A.entry += k; return; }
  if (k === '←') { A.entry = A.entry.slice(0, -1); return; }
  if (k === 'Hz' || k === 'kHz') {
    const v = parseFloat(A.entry); A.entry = '';
    if (!(v > 0)) return;
    setAFreq(v * (k === 'kHz' ? 1000 : 1));
    return;
  }
  if (k === '◀') A.cur = Math.min(6, A.cur + 1);
  if (k === '▶') A.cur = Math.max(-2, A.cur - 1);
}

function connList(src) {
  const ins = ['CH1', 'CH2', 'EXT'].filter(i => S.conn[i] === src).map(i => i === 'EXT' ? 'TRIG IN' : i);
  return ins.length ? '接到 ' + ins.join('、') : '没接';
}

/* ---------------- 信号源 B ---------------- */

const B_RANGES = [20, 200, 2000, 20000, 200000];
function buildGenB() {
  const p = $('#genB'), O = { parent: p };
  const t = el('div', 'gtitle', p); t.innerHTML = '信号源 B · 待测信号<small>频率读数遮住了，当它是未知频率（像实验室那台 YB1602）</small>';
  el('div', 'led green on', p, { left: '486px', top: '16px' });
  const disp = el('div', 'gen-disp', p, { left: '18px', top: '62px', width: '232px', height: '76px' });
  Panel.els.bDisp = disp;
  Panel.specs.bDisp = { id: 'bDisp', name: '频率显示（已遮住）', desc: '实验里待测信号的频率要用示波器测出来，所以这里先遮住。测完可以揭开对答案。' };
  disp.addEventListener('pointerenter', ev => showTip(Panel.specs.bDisp, ev)); disp.addEventListener('pointerleave', hideTip);
  disp.addEventListener('click', () => { S.B.peek = !S.B.peek; changed('bDisp'); });
  B_RANGES.forEach((r, k) => addCtl({ ...O, id: 'br_' + r, kind: 'key', cls: 'wide', x: 18 + k * 47, y: 152, w: 42, h: 26, text: r >= 1000 ? r / 1000 + 'k' : String(r),
    name: '频段 ' + (r >= 1000 ? r / 1000 + ' kHz' : r + ' Hz'), press: () => { S.B.range = r; updateBFreq(); }, fmt: () => S.B.range === r ? '当前频段' : '',
    desc: '选频段：按钮上的数是这一档的最高频率（单位 Hz，k 是千）。频段内用粗调、细调旋钮连续调。' }));
  ['sine', 'tri', 'square'].forEach((w, k) => addCtl({ ...O, id: 'bw_' + w, kind: 'key', x: 18 + k * 70, y: 198, w: 62, h: 26, text: WAVE_CN[w] + '波', name: '波形：' + WAVE_CN[w] + '波',
    press: () => S.B.wave = w, fmt: () => S.B.wave === w ? '当前' : '', desc: '选择输出波形。' }));
  addCtl({ ...O, id: 'bcoarse', kind: 'knob', x: 318, y: 100, size: 58, label: '频率 粗调', ly: 52, name: '频率粗调',
    get: () => S.B.coarse, set: v => { S.B.coarse = v; updateBFreq(); }, fmt: () => '刻度 ' + (0.1 + 0.9 * S.B.coarse).toFixed(2) + ' × 频段', desc: '在当前频段里大范围调频率。' });
  addCtl({ ...O, id: 'bfine', kind: 'knob', x: 408, y: 100, size: 44, label: '细调', ly: 58, name: '频率细调',
    get: () => S.B.fine, set: v => { S.B.fine = v; updateBFreq(); }, fmt: () => Math.round((S.B.fine - 0.5) * 200) + '%', desc: '小范围微调频率（±3%）。' });
  addCtl({ ...O, id: 'bamp', kind: 'knob', x: 318, y: 214, size: 44, label: 'AMPLITUDE', ly: 176, name: '幅度',
    min: 0, max: 10, get: () => S.B.amp, set: v => S.B.amp = Math.round(v * 100) / 100, fmt: () => S.B.amp.toFixed(2) + ' Vpp', desc: '输出信号的峰-峰值。' });
  legend(p, 'OUTPUT', 446, 176);
  addCtl({ ...O, id: 'boutj', kind: 'bnc', x: 446, y: 220, size: 40, name: '信号源 B 输出插座', menuTitle: '信号源 B 的线接到哪？',
    menu: () => sourceMenu('B'), fmt: () => connList('B'), desc: '信号源 B 的输出（它一直在输出）。点一下，选择接到示波器的哪个通道。' });
}

/* ---------------- 连接线 ---------------- */

const JACKS = {
  CH1: () => ({ x: 545, y: 528 }), CH2: () => ({ x: 1112, y: 528 }), EXT: () => ({ x: 1110, y: 196 }),
  A: () => ({ x: GEN_A.x + 600, y: GEN_A.y + 220 }), B: () => ({ x: GEN_B.x + 446, y: GEN_B.y + 220 }), CAL: () => ({ x: 872, y: 524 }),
};
const CABLE_COLOR = { A: '#c8372d', B: '#2c64b8', CAL: '#e3b22b' };

function drawCables() {
  const svg = $('#cables');
  let s = `<defs><filter id="cblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5"/></filter>
    <radialGradient id="plugG" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9c9c9"/><stop offset=".7" stop-color="#7d7d7d"/><stop offset="1" stop-color="#3c3c3c"/></radialGradient></defs>`;
  for (const inp of ['CH1', 'CH2', 'EXT']) {
    const src = S.conn[inp]; if (!src) continue;
    const a = JACKS[src](), b = JACKS[inp](), col = CABLE_COLOR[src];
    let d;
    if (src === 'CAL') d = `M${a.x} ${a.y} C${a.x} ${a.y + 70}, ${b.x} ${b.y + 70}, ${b.x} ${b.y}`;
    else if (inp === 'EXT') d = `M${a.x} ${a.y} C${a.x} ${a.y - 140}, ${b.x + 120} ${b.y + 260}, ${b.x} ${b.y}`;
    else { const dx = Math.abs(a.x - b.x); d = `M${a.x} ${a.y} C${a.x + 60} ${a.y + 110 + dx * 0.05}, ${b.x + 120} ${b.y + 200 + dx * 0.1}, ${b.x} ${b.y}`; }
    s += `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="10" stroke-linecap="round" transform="translate(7 12)" filter="url(#cblur)"/>`;
    s += `<path d="${d}" fill="none" stroke="#0b0b0b" stroke-width="9" stroke-linecap="round"/>`;
    s += `<path d="${d}" fill="none" stroke="#2a2a2a" stroke-width="6" stroke-linecap="round"/>`;
    s += `<path d="${d}" pathLength="100" fill="none" stroke="${col}" stroke-width="9.5" stroke-dasharray="7 86 7"/>`;
    s += `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="1.6" stroke-linecap="round" transform="translate(-1.5 -2)"/>`;
    for (const p of [a, b]) {
      const r = src === 'CAL' && p === a ? 8 : 14;
      if (r === 8) { s += `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#111"/><circle cx="${p.x}" cy="${p.y}" r="6" fill="${col}"/><circle cx="${p.x - 2}" cy="${p.y - 2}" r="2" fill="#fff8"/>`; continue; }
      s += `<circle cx="${p.x + 3}" cy="${p.y + 6}" r="${r + 2}" fill="#000" fill-opacity=".45" filter="url(#cblur)"/>`;
      s += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="url(#plugG)" stroke="#2a2a2a" stroke-width="1"/>`;
      s += `<circle cx="${p.x}" cy="${p.y}" r="${r - 4}" fill="none" stroke="#5a5a5a" stroke-width="2" stroke-dasharray="2 2.2"/>`;
      s += `<circle cx="${p.x}" cy="${p.y}" r="${r - 8}" fill="#1b1b1b"/><circle cx="${p.x}" cy="${p.y}" r="2" fill="${col}"/>`;
    }
  }
  svg.innerHTML = s;
}

/* ---------------- 刷新外观 ---------------- */

function angleOf(spec) {
  if (spec.kind === 'sel') return -140 + 280 * spec.get() / (spec.steps - 1);
  if (spec.kind === 'enc') return (S.A.freq * 7) % 360;
  const mn = spec.min ?? 0, mx = spec.max ?? 1;
  return -140 + 280 * (spec.get() - mn) / (mx - mn);
}

Panel.refresh = function () {
  for (const id in Panel.specs) {
    const sp = Panel.specs[id], e = Panel.els[id];
    if (!e || !sp.kind) continue;
    if (sp.kind === 'knob' || sp.kind === 'sel' || sp.kind === 'enc' || sp.kind === 'screw') e.firstChild.style.transform = `rotate(${angleOf(sp)}deg)`;
    else if (sp.kind === 'slide') {
      const k = sp.get();
      sp._lever.style.top = (sp._opts[k].y) + 'px';
      sp._opts.forEach((o, j) => o.t.classList.toggle('sel', j === k));
    }
  }
  const on = (id, v) => Panel.els[id] && Panel.els[id].classList.toggle('on', !!v);
  on('power', S.power); on('mag', S.mag); on('trigalt', S.trigAlt); on('slope', S.slope === '-'); on('chop', S.chop); on('inv', S.inv);
  Panel.powerLed.classList.toggle('on', S.power);
  ['sine', 'tri', 'square'].forEach(w => { on('aw_' + w, S.A.wave === w); on('bw_' + w, S.B.wave === w); });
  B_RANGES.forEach(r => on('br_' + r, S.B.range === r));
  on('aout', S.A.on); Panel.aLed.classList.toggle('on', S.A.on);
  for (const [id, inp] of [['ch1in', 'CH1'], ['ch2in', 'CH2'], ['trigin', 'EXT']]) {
    const e = Panel.els[id], src = S.conn[inp];
    e.classList.toggle('connected', !!src); if (src) e.style.setProperty('--cable', CABLE_COLOR[src]);
  }
  refreshGenDisplays();
  drawCables();
  updateLCD(now());
};

function refreshGenDisplays() {
  const A = S.A;
  const big = $('#aBig');
  if (A.entry) big.innerHTML = `<span class="entry">${A.entry.padStart(10, ' ')}_</span>`;
  else {
    const str = A.freq.toFixed(2).padStart(10, ' ');
    const dot = str.indexOf('.');
    const idx = A.cur >= 0 ? dot - 1 - A.cur : dot - A.cur;
    big.innerHTML = [...str].map((c, i) => i === idx ? `<u>${c === ' ' ? '0' : c}</u>` : c).join('') + ' Hz';
  }
  $('#aSub').textContent = `${WAVE_CN[A.wave]}波   ${A.amp.toFixed(2)} Vpp   偏置 ${A.offset >= 0 ? '+' : ''}${A.offset.toFixed(2)} V`;
  const bd = Panel.els.bDisp;
  if (S.B.peek) { bd.classList.remove('cover'); bd.innerHTML = `<div class="big" id="bBig">${fmtFreq(genFreqAt(S.B, now())).padStart(11, ' ')}</div><div class="sub">${WAVE_CN[S.B.wave]}波 ${S.B.amp.toFixed(2)} Vpp · 点击遮住</div>`; }
  else { bd.classList.add('cover'); bd.innerHTML = '<div>频率读数已遮住</div><div style="color:#ffd166">点这里揭开看答案</div>'; }
}
E.hooks.push(t => { if (S.B.peek && t - (Panel._bT || 0) > 0.25) { Panel._bT = t; const b = $('#bBig'); if (b) b.textContent = fmtFreq(genFreqAt(S.B, t)).padStart(11, ' '); } });

/* ---------------- 缩放、提示 ---------------- */

function fitStage() {
  const wrap = $('#stageWrap'), stage = $('#stage');
  const flat2d = stage.classList.contains('skin2d');
  const W = flat2d ? 1180 : 1260, H = flat2d ? 910 : 1060;   // 2D 视角没有桌子和墙，画面更紧凑
  const s = Math.min(1, wrap.clientWidth / W);
  Panel.scale = s;
  stage.style.transform = `scale(${s})`;
  wrap.style.height = Math.ceil(H * s) + 'px';
}

let toastT = 0;
function toast(msg, warn) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (warn ? ' warn' : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200);
}

function highlight(ids) {
  document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
  for (const id of ids || []) {
    const e = Panel.els[id];
    if (e) e.classList.add('hl');
    const sp = Panel.specs[id];
    if (sp && sp._opts) sp._opts.forEach(o => o.t.classList.add('hl'));
  }
}

function buildPanel() {
  buildScope(); buildGenA(); buildGenB();
  initScreen($('#crt'), $('#crtGlow'));
  fitStage();
  new ResizeObserver(fitStage).observe($('#stageWrap'));
  Panel.refresh();
}
