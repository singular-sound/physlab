'use strict';
/* ============================================================
   教学内容：课程（按教材实验内容 1–8 排）、预习/思考题
   每一步：do 要做什么；ids 高亮哪些部件；check 怎样算做到；
          why 做到之后讲为什么；auto "帮我做"；form 需要填数核对
   ============================================================ */

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;
const fnum = (v, n = 3) => (v == null || !isFinite(v)) ? '—' : (+v.toPrecision(n)).toString();
const rand = (a, b) => a + Math.random() * (b - a);

function resetBench() {
  Object.assign(S, { power: false, inten: 0.5, focus: FOCUS_BEST, rot: 0, hpos: 0, swpvar: 1, mag: false, tpos: 9,
    trigAlt: false, trigMode: 'AUTO', source: 'CH1', level: 0, slope: '+', vmode: 'CH1', chop: false, inv: false });
  S.ch[0] = { vi: 2, vvar: 1, pos: 0, cpl: 'AC' };
  S.ch[1] = { vi: 2, vvar: 1, pos: 0, cpl: 'AC' };
  S.conn = { CH1: null, CH2: null, EXT: null };
  Object.assign(S.A, { wave: 'sine', amp: 3, offset: 0, on: false, cur: 0, entry: '' }); setAFreq(1000);
  Object.assign(S.B, { wave: 'sine', amp: 2.4, peek: false });
}
function powerOnNow() { if (!S.power) { S.power = true; S.powerT = now() - 3; } }
function randomB(lo, hi) {
  S.B.range = 2000; S.B.fine = rand(0.3, 0.7);
  const target = rand(lo, hi);
  S.B.coarse = clamp((target / (2000 * (1 + 0.06 * (S.B.fine - 0.5))) - 0.1) / 0.9, 0, 1);
  updateBFreq();
}
// 让某通道的波形高度落在 lo~hi 格之间
function fitV(i, lo = 4.5, hi = 7.5) {
  const src = srcObj(S.conn[i ? 'CH2' : 'CH1']); if (!src) return;
  for (let k = 0; k < VDIV.length; k++) {
    const pp = 2 * src.a * CAL_ERR.v[i] / VDIV[k];
    if (pp >= lo && pp <= hi) { S.ch[i].vi = k; return; }
  }
  for (let k = VDIV.length - 1; k >= 0; k--) if (2 * src.a * CAL_ERR.v[i] / VDIV[k] <= 8) { S.ch[i].vi = k; return; }
}
function signalStable() { return isTriggered(); }
function yt() { return S.power && !isXY(); }
function lastPhotoSince(t) { const p = Teach.photos[Teach.photos.length - 1]; return p && p.t >= t ? p : null; }
function ratioErr(target) { const fA = S.A.freq, fB = genFreqAt(S.B, now()); return Math.abs(fA / fB - target) / target; }

const PRESET = [
  ['TRIGGER MODE 拨到 AUTO', () => S.trigMode === 'AUTO', 'tmode'],
  ['SOURCE 拨到 CH1', () => S.source === 'CH1', 'source'],
  ['垂直 MODE 拨到 CH1', () => S.vmode === 'CH1', 'vmode'],
  ['CH1 耦合拨到 AC', () => S.ch[0].cpl === 'AC', 'cpl1'],
  ['CH1 的 VAR 顺时针拧到头（CAL）', () => S.ch[0].vvar >= 1, 'var1'],
  ['SWP.VAR 顺时针拧到头（CAL）', () => S.swpvar >= 1, 'swpvar'],
];

const LESSONS = [
  /* ---------------------------------------------------------- */
  {
    id: 'tour', title: '认识面板', sub: '先把每个旋钮叫什么、管什么过一遍', setup: () => { resetBench(); },
    steps: [
      { do: '左边大屏是示波管的荧光屏。横向 10 大格、竖向 8 大格；中间的十字线上还有小刻度，每 5 小格是 1 大格（1 小格 = 0.2 格）。所有测量都是在这里数格子。', ids: [], box: [14, 36, 452, 392] },
      { do: '大屏下面一排：INTEN 调亮度，FOCUS 调粗细，TRACE ROTATION 把歪掉的线转平，POWER 是电源。', ids: ['inten', 'focus', 'rot', 'power'] },
      { do: '右上角的小液晶屏（LCD）显示四个数：左上是 TIME/DIV，右上是频率计，下面是 CH1、CH2 的 VOLTS/DIV。读数时，1 格代表多少就看它。', ids: ['lcd'] },
      { do: 'HORIZONTAL（水平）区管横向，也就是时间轴：TIME/DIV 决定 1 格多少时间，SWP.VAR 是它的微调（测量时要在 CAL），POSITION 左右挪，×10 MAG 横向放大。', ids: ['tdiv', 'swpvar', 'hpos', 'mag'] },
      { do: 'TRIGGER（触发）区管"波形稳不稳"：MODE 选 AUTO，SOURCE 选用哪路信号触发，LEVEL 调触发电平，SLOPE 选上升沿还是下降沿。', ids: ['tmode', 'source', 'level', 'slope'] },
      { do: 'VERTICAL（垂直）区左半边是 CH1：VOLTS/DIV 决定 1 格多少伏，VAR 是它的微调（测量时要在 CAL），POSITION 上下挪，AC-GND-DC 选耦合方式，最下面是输入插座。', ids: ['v1', 'var1', 'pos1', 'cpl1', 'ch1in'] },
      { do: '中间：MODE 选显示哪一路（CH1 / CH2 / DUAL 两路 / ADD 相加），ALT/CHOP 选两路怎么画，CH2 INV 把 CH2 上下颠倒，CAL 端子输出 1 kHz 的标准方波。', ids: ['vmode', 'chop', 'inv', 'cal'] },
      { do: '右半边是 CH2，和 CH1 一模一样。X-Y 模式下 CH1 是 X 轴、CH2 是 Y 轴。', ids: ['v2', 'var2', 'pos2', 'cpl2', 'ch2in'] },
      { do: '下面两台信号源：A 的频率能直接读出来，当"已知信号"；B 的读数遮住了，当"待测信号"。实验室里那台不太稳的 YB1602 就是拿来当待测信号的，B 也会轻微飘。', ids: ['aDisp', 'bDisp'] },
      { do: '接线：点信号源的 OUTPUT 插座，或者点示波器的 CH1 / CH2 插座，在弹出的菜单里选接哪里。CAL 端子也一样。准备好了就去下一课开机。', ids: ['aoutj', 'boutj', 'ch1in', 'ch2in'] },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'power', title: '开机，找到扫描线', sub: '实验内容 1 前半：亮度、聚焦、位移',
    setup: () => {
      resetBench();
      Object.assign(S, { inten: 0.1, focus: 0.24, hpos: -0.22, trigMode: 'NORM', source: 'CH2', vmode: 'DUAL', swpvar: 0.55 });
      Object.assign(S.ch[0], { pos: 0.86, cpl: 'DC', vvar: 0.5 });
    },
    steps: [
      { do: '开机前先把旋钮摆到起始位置。上一组同学可能乱拧过，这一步上课时也要做。', list: PRESET,
        check: () => PRESET.every(p => p[1]()),
        auto: () => { S.trigMode = 'AUTO'; S.source = 'CH1'; S.vmode = 'CH1'; S.ch[0].cpl = 'AC'; S.ch[0].vvar = 1; S.swpvar = 1; },
        why: 'AUTO 保证没有信号时也会扫描，屏上一直有线。两个 VAR 不在 CAL 时读数是错的，而且 LCD 不会提醒你，所以开机前就拧好，免得后面忘了。' },
      { do: '按 POWER 开机，指示灯会亮。', ids: ['power'], check: () => S.power, auto: () => { S.power = true; S.powerT = now(); },
        why: '示波管要预热一两秒，亮线才慢慢出来。暂时不用示波器时把亮度调暗就行，不要反复开关机。' },
      { do: '屏上还是黑的。先怀疑亮度：把 INTEN 往右拧到 40%～80%。', ids: ['inten'], check: () => S.inten >= 0.35 && S.inten <= 0.85, auto: () => { S.inten = 0.55; },
        why: '亮度太低是"开机看不到线"的第一个原因。亮度也别太高，线会发毛，光点停在一处久了还会烧坏荧光屏。' },
      { do: '还是看不到线：它跑到屏幕外面去了。拧 CH1 的 ▲POSITION▼ 把线拉回中间那条横线附近，再把水平 ◀POSITION▶ 也拧回中间。', ids: ['pos1', 'hpos'],
        check: () => Math.abs(S.ch[0].pos * VPOS_RANGE) < 0.3 && Math.abs(S.hpos * HPOS_RANGE) < 0.6, auto: () => { S.ch[0].pos = 0; S.hpos = 0; },
        why: '光迹偏出屏幕是第二个常见原因（预习思考题 1）。排查顺序：电源 → 亮度 → 位移 → 触发模式 → 耦合。' },
      { do: '线有点虚。拧 FOCUS，找到线最细的位置。', ids: ['focus'], check: () => Math.abs(S.focus - FOCUS_BEST) < 0.05, auto: () => { S.focus = FOCUS_BEST; },
        why: 'FOCUS 改变电子束在屏上会聚的程度，线越细，数格子越准。' },
      { do: '做个对照：把 TRIGGER MODE 拨到 NORM，线会消失；看完再拨回 AUTO。', ids: ['tmode'],
        watch: f => { if (S.trigMode === 'NORM') f.norm = true; }, check: f => f.norm && S.trigMode === 'AUTO', auto: () => { S.trigMode = 'AUTO'; Teach.f.norm = true; },
        why: 'NORM 模式下，没有触发信号就不扫描，屏上什么都没有。现在没接信号，所以线没了。这也是"开机没线"的原因之一，实验里一律用 AUTO。' },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'sine', title: '接信号，调出稳定的正弦波', sub: '实验内容 1 后半：TIME/DIV、LEVEL、VOLTS/DIV',
    setup: () => {
      resetBench(); powerOnNow();
      Object.assign(S, { tpos: 5, level: 0.96 }); S.ch[0].vi = 0;
      Object.assign(S.A, { wave: 'tri' }); setAFreq(600);
    },
    steps: [
      { do: '接线：点信号源 A 的 OUTPUT 插座（或示波器的 CH1 插座），选"接到 CH1"。', ids: ['aoutj', 'ch1in'], check: () => S.conn.CH1 === 'A', auto: () => { S.conn.CH1 = 'A'; } },
      { do: '把信号源 A 设成正弦波、1 kHz：按"正弦波"，再依次按 1、kHz。', ids: ['aw_sine', 'ak_1', 'ak_kHz'],
        check: () => S.A.wave === 'sine' && Math.abs(S.A.freq - 1000) < 0.01, auto: () => { S.A.wave = 'sine'; setAFreq(1000); },
        why: '实验室三种信号源按键各不一样（见"示波器实验注意要点"），但思路相同：输入数字 → 选单位。' },
      { do: '按 OUTPUT ON，旁边的灯要亮。', ids: ['aout'], check: () => S.A.on, auto: () => { S.A.on = true; },
        why: '注意要点里专门写了：没信号先看 output on 的灯亮没亮。' },
      { do: '屏上是一片挤在一起的线，因为扫描太慢，一屏塞了几十个周期。顺时针拧 TIME/DIV，直到屏上剩 2～5 个完整的波。', ids: ['tdiv'],
        check: () => yt() && Truth.cycles(0) >= 1.8 && Truth.cycles(0) <= 5.5, auto: () => { S.tpos = 11; },
        why: 'TIME/DIV 是横向 1 格代表的时间。1 kHz 的周期是 1 ms，0.2 ms/格时一屏 10 格 = 2 ms，正好 2 个周期。' },
      { do: '波形在左右乱跑，看不清。拧 LEVEL，直到波形停住不动。', ids: ['level'], check: () => signalStable(), auto: () => { S.level = 0; },
        why: '每次扫描都要等信号涨到 LEVEL 设定的高度才开始，所以每次都从波形的同一点画起，画出来的波形重合在一起，就稳了。LEVEL 拧出了波形的上下范围，就等不到这个点，扫描只好自己乱跑。这就是"触发"和"同步"（思考题 4、6）。' },
      { do: '波形太矮。顺时针拧 CH1 的 VOLTS/DIV，让波形尽量高，但不要超出屏幕（不超过 8 格）。', ids: ['v1'],
        check: () => Truth.ppDiv(0) >= 4 && Truth.ppDiv(0) <= 8, auto: () => fitV(0, 4, 8),
        why: '波形占的格数越多，数格子的相对误差越小。超出屏幕就看不到波峰波谷，没法读了。' },
      { do: '体验 VAR：把 CH1 的 VAR 往左拧一点，看波形变矮；再顺时针拧回 CAL。', ids: ['var1'],
        watch: f => { if (S.ch[0].vvar < 0.85) f.low = true; }, check: f => f.low && S.ch[0].vvar >= 1, auto: () => { S.ch[0].vvar = 1; Teach.f.low = true; },
        why: '注意刚才 LCD 上的 VOLTS/DIV 一直没变！VAR 不在 CAL 时，波形高度变了，读数却不提醒你。所以测量前一定检查两个 VAR 都在 CAL。' },
      { do: '体验 SWP.VAR：把它往左拧一点，看波形横向被拉开；再顺时针拧回 CAL。', ids: ['swpvar'],
        watch: f => { if (S.swpvar < 0.85) f.low = true; }, check: f => f.low && S.swpvar >= 1, auto: () => { S.swpvar = 1; Teach.f.low = true; },
        why: '和 VAR 一样：它连续改变扫描速度，LCD 读数不变。测周期前必须在 CAL。' },
      { do: '体验 ×10 MAG：按下去，波形横向放大 10 倍；看完再按一下弹起来。', ids: ['mag'],
        watch: f => { if (S.mag) f.on = true; }, check: f => f.on && !S.mag, auto: () => { S.mag = false; Teach.f.on = true; },
        why: '按下时 1 格代表的时间是 LCD 读数的 1/10。测量时它必须是弹起的。' },
      { do: '最后做个反例：把 LEVEL 一直往右拧到头，看波形又开始跑；再拧回来，让它重新停住。', ids: ['level'],
        watch: f => { if (S.power && !isTriggered()) f.run = true; }, check: f => f.run && signalStable(), auto: () => { S.level = 0; Teach.f.run = true; },
        why: '记住调稳波形的顺序：先拧 TIME/DIV 让屏上有两三个波、大致不跑，再拧 LEVEL 让它完全停住（注意要点第一条）。' },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'measure', title: '测峰-峰值和周期', sub: '实验内容 2、3：数格子 a、b、c、d、e',
    setup: () => {
      resetBench(); powerOnNow();
      S.conn.CH1 = 'A'; Object.assign(S.A, { wave: 'sine', on: true, amp: r2(rand(2.2, 4.6)) }); setAFreq(1000);
      S.tpos = 11; fitV(0); S.ch[0].pos = rand(-0.06, 0.06);
    },
    steps: [
      { do: '读数前先确认：CH1 的 VAR 和 SWP.VAR 都在 CAL，×10 MAG 是弹起的。', ids: ['var1', 'swpvar', 'mag'],
        check: () => S.ch[0].vvar >= 1 && S.swpvar >= 1 && !S.mag, auto: () => { S.ch[0].vvar = 1; S.swpvar = 1; S.mag = false; } },
      { do: '拧 CH1 的 POSITION，把波谷正好压在一条横格线上（按住 Shift 拖动可以微调）。', ids: ['pos1'],
        check: () => { const t = Truth.troughDiv(0); return Math.abs(t - Math.round(t)) < 0.06 && t >= -4.05 && Truth.peakDiv(0) <= 4.05; },
        auto: () => { const t = Truth.troughDiv(0), pp = Truth.ppDiv(0); let target = Math.round(t); while (target + pp > 4.05 && target > -4) target--; while (target < -4) target++; S.ch[0].pos += (target - t) / VPOS_RANGE; },
        why: '波谷对齐格线后，只要看波峰落在第几格、还多几小格，就是峰-峰值的格数 a。估读到 0.1 格（半个小格）。' },
      { do: '读数：数波峰到波谷占几格，记作 a；看 LCD 左下角的 CH1 读数，记作 b（单位 V/格）。从这一步起，两个 VAR、SWP.VAR 不能离开 CAL，×10 MAG 不能按。', ids: ['lcd'],
        form: [['a', 'a（格）'], ['b', 'b（V/格）']], solve: () => ({ a: r1(Truth.ppDiv(0)), b: VDIV[S.ch[0].vi] }),
        verify: v => {
          const a0 = Truth.ppDiv(0), b0 = VDIV[S.ch[0].vi];
          const okA = near(v.a, a0, 0.2), okB = near(v.b, b0, b0 * 0.001);
          const upp = v.a * v.b, U = upp / (2 * Math.SQRT2);
          Teach.mem.a = v.a; Teach.mem.b = v.b;
          return { ok: okA && okB, html:
            (okA ? '' : `<div class="bad-t">a 读得不太对，再数一下（差了 ${fnum(Math.abs(v.a - a0), 2)} 格以上）。</div>`) +
            (okB ? '' : `<div class="bad-t">b 要看 LCD 上 CH1 那一格的读数，换算成伏：mV 要除以 1000。</div>`) +
            `峰-峰值 Upp = a·b = <b>${fnum(upp)} V</b>，有效值 U = Upp / (2√2) = <b>${fnum(U)} V</b>。<br>` +
            (okA && okB ? `<span class="muted">信号源 A 实际输出 ${S.A.amp.toFixed(2)} Vpp。你测的偏大约 ${fnum((upp / S.A.amp - 1) * 100, 2)}%：这是仪器本身的误差，第 4 课用标准方波修正它。</span>` : '') };
        } },
      { do: '读周期：从一个波谷数到第 c 个周期后的波谷，这 c 个周期占几格，记作 d；看 LCD 左上角的 TIME/DIV，记作 e（单位 ms）。c 取 1 或 2 都行，取得越多越准。a、b 已经读完，CH1 的 VOLTS/DIV 别再动（下一课修正还要用同一个档位）。', ids: ['lcd', 'hpos'],
        form: [['c', 'c（个）'], ['d', 'd（格）'], ['e', 'e（ms/格）']], solve: () => ({ c: 2, d: r1(2 * Truth.periodDiv(0)), e: +(tdivNominal() * 1e3).toPrecision(3) }),
        verify: v => {
          const p = Truth.periodDiv(0), e0 = tdivNominal() * 1e3;
          const okC = v.c >= 1 && Number.isInteger(v.c), okD = okC && near(v.d, v.c * p, 0.2), okE = near(v.e, e0, e0 * 0.001);
          const T = v.d * v.e / v.c, f = 1000 / T;
          Teach.mem.c = v.c; Teach.mem.d = v.d; Teach.mem.e = v.e;
          return { ok: okC && okD && okE, html:
            (okC ? '' : '<div class="bad-t">c 是周期的个数，要填整数。</div>') +
            (okC && !okD ? `<div class="bad-t">d 不太对：${v.c} 个周期大约占 ${fnum(v.c * p, 2)} 格附近，再数一下。</div>` : '') +
            (okE ? '' : '<div class="bad-t">e 看 LCD 左上角，μs 要除以 1000 换成 ms。</div>') +
            `周期 T = d·e / c = <b>${fnum(T)} ms</b>，频率 f = 1/T = <b>${fnum(f, 4)} Hz</b>。<br>` +
            (okC && okD && okE ? `<span class="muted">LCD 右上角的频率计读 ${fmtFreq(counterFreq(now()))}，比数格子准。差的那一点同样是仪器扫描速度的误差。</span>` : '') };
        } },
      { do: '拍照：大屏幕和小液晶屏要拍在同一张照片里。点页面顶上的"拍照"。读完的档位（VOLTS/DIV、TIME/DIV）都别动。', ids: [],
        check: f => !!lastPhotoSince(f.t0), auto: () => takePhoto(),
        why: '注意要点：步骤 2 测完要大小屏同时拍照。报告里要贴照片、写上图名。' },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'cal', title: '用标准方波修正', sub: '实验内容 4：f、g 两个格数',
    setup: () => {
      if (S.conn.CH1 !== 'A' || isXY()) { LESSONS[3].setup(); }
      powerOnNow();
    },
    steps: [
      { do: '档位一个都别动（VOLTS/DIV、TIME/DIV 保持刚才测量时的位置）。把 CH1 的线从信号源 A 上拔下来，接到 CAL 端子上：点 CH1 插座，选"接 CAL 标准方波"。', ids: ['ch1in', 'cal'],
        check: () => S.conn.CH1 === 'CAL', auto: () => { S.conn.CH1 = 'CAL'; },
        why: 'CAL 端子输出的方波，频率和幅度都是准的（1 kHz、2 Vp-p）。用同样的档位去量它，量出来的格数和它的真实值一比，就知道这台示波器偏了多少。' },
      { do: '数方波：峰-峰值占几格记作 f，一个周期占几格记作 g。', ids: [],
        form: [['f', 'f（格）'], ['g', 'g（格）']], solve: () => { S.conn.CH1 = 'CAL'; return { f: r1(Truth.ppDiv(0)), g: r1(Truth.periodDiv(0)) }; },
        verify: v => {
          const f0 = Truth.ppDiv(0), g0 = Truth.periodDiv(0);
          const ok = near(v.f, f0, 0.2) && near(v.g, g0, 0.2);
          const m = Teach.mem;
          let corr = '';
          if (m.a && m.d && m.c) {
            const U = m.a / v.f * 2, T = 0.001 * m.d / (m.c * v.g) * 1e3;
            corr = `用第 3 课你读的 a=${m.a}、c=${m.c}、d=${m.d} 修正：<br>U<sub>pp</sub> = a/f × 2 V = <b>${fnum(U)} V</b>，T = 0.001·d/(c·g) = <b>${fnum(T)} ms</b>。<br><span class="muted">信号源 A 的真实值：${S.A.amp.toFixed(2)} Vpp，${fnum(1000 / S.A.freq)} ms。修正后应该比修正前更接近。</span>`;
          } else corr = '<span class="muted">（先做第 3 课，这里会用你那时读的 a、c、d 算出修正后的结果。）</span>';
          return { ok, html: (ok ? '' : '<div class="bad-t">格数不太对，再数一下。方波的竖边很淡，看上下两条平线之间的距离。</div>') +
            corr + '<div class="why" style="margin-top:8px"><b>教材的公式为什么是 U = a/f？</b> 第 99 页把标准方波当成 1 V 来写，所以 a/f 直接就是伏数。第 98 页面板说明写的是 2 Vp-p，那就要乘 2。上课时看清 CAL 旁边印的是多少，按实际的算。</div>' };
        } },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'dc', title: '测直流分量', sub: '实验内容 5：GND 定零线，AC、DC 比波谷',
    setup: () => {
      resetBench(); powerOnNow();
      S.conn.CH1 = 'A'; Object.assign(S.A, { wave: 'tri', on: true, amp: 2, offset: r2((Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.8)) }); setAFreq(1000);
      S.tpos = 11; S.ch[0].vi = 3; S.ch[0].pos = rand(-0.2, 0.2);
    },
    steps: [
      { do: '信号源 A 已经换成三角波，还叠加了一个直流电压（就当不知道是多少，整个测量过程中别碰信号源的 OFFSET）。先把 CH1 耦合拨到 GND。', ids: ['cpl1'], check: () => S.ch[0].cpl === 'GND', auto: () => { S.ch[0].cpl = 'GND'; },
        why: 'GND 把输入接地，屏上这条横线就是 0 V 的位置。' },
      { do: '拧 CH1 的 POSITION，把这条横线对到正中间那条横格线上。', ids: ['pos1'], check: () => S.ch[0].cpl === 'GND' && Math.abs(S.ch[0].pos * VPOS_RANGE) < 0.05,
        auto: () => { S.ch[0].pos = 0; }, why: '零线定好之后 POSITION 就不能再动了，后面两次读数都以它为准。' },
      { do: '拨回 AC，记下波谷在第几格（中线以上为正，以下为负，例如 −2.0）。零线已经定好：从现在起 CH1 的 POSITION 和 VOLTS/DIV 都不能动。', ids: ['cpl1'],
        form: [['yac', 'AC 波谷（格）']], solve: () => { S.ch[0].cpl = 'AC'; return { yac: r1(Truth.troughDiv(0)) }; },
        verify: v => { const ok = S.ch[0].cpl === 'AC' && near(v.yac, Truth.troughDiv(0), 0.15); if (ok) Teach.mem.yac = v.yac;
          return { ok, html: S.ch[0].cpl !== 'AC' ? '<div class="bad-t">先把耦合拨到 AC 再读。</div>' : ok ? 'AC 档：电容把直流挡住了，波形以零线为中心上下对称。' : '<div class="bad-t">再看一下波谷的位置，估读到 0.1 格。</div>' }; } },
      { do: '拨到 DC，波形整体跳了一下。再记下波谷在第几格。', ids: ['cpl1'],
        form: [['ydc', 'DC 波谷（格）']], solve: () => { S.ch[0].cpl = 'DC'; return { ydc: r1(Truth.troughDiv(0)) }; },
        verify: v => { const ok = S.ch[0].cpl === 'DC' && near(v.ydc, Truth.troughDiv(0), 0.15); if (ok) Teach.mem.ydc = v.ydc;
          return { ok, html: S.ch[0].cpl !== 'DC' ? '<div class="bad-t">先把耦合拨到 DC 再读。</div>' : ok ? 'DC 档：直流也放进来了，整个波形被它抬高（或压低）了。' : '<div class="bad-t">再看一下波谷的位置。</div>' }; } },
      { do: '算直流分量：(DC 波谷 − AC 波谷) × VOLTS/DIV。填 mV。', ids: ['lcd'],
        form: [['dc', '直流分量（mV）']], solve: () => ({ dc: Teach.mem.ydc != null && Teach.mem.yac != null ? +((Teach.mem.ydc - Teach.mem.yac) * VDIV[S.ch[0].vi] * 1000).toFixed(1) : 0 }),
        verify: v => {
          const m = Teach.mem, vd = VDIV[S.ch[0].vi];
          const expect = m.ydc != null && m.yac != null ? (m.ydc - m.yac) * vd * 1000 : null;
          const ok = expect != null && near(v.dc, expect, Math.abs(expect) * 0.03 + 5);
          return { ok, html: expect == null ? '<div class="bad-t">先完成上面两步的读数。</div>' :
            (ok ? '' : `<div class="bad-t">按你读的数应该是 (${m.ydc} − ${m.yac}) × ${vd * 1000} mV = ${fnum(expect)} mV。</div>`) +
            `<span class="muted">信号源 A 实际叠加的直流是 ${(S.A.offset * 1000).toFixed(0)} mV。</span>` };
        } },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'lissa', title: '李萨如图形测频率', sub: '实验内容 6：1:1、2:3、1:3',
    setup: () => {
      resetBench(); powerOnNow(); randomB(800, 1400);
      Object.assign(S.A, { wave: 'sine', on: true, amp: 3 }); setAFreq(500); S.A.cur = 1;
      S.tpos = 11;
    },
    steps: [
      { do: '接线：已知信号 A 接 CH1（X 轴），待测信号 B 接 CH2（Y 轴）。', ids: ['aoutj', 'boutj', 'ch1in', 'ch2in'],
        check: () => S.conn.CH1 === 'A' && S.conn.CH2 === 'B', auto: () => { S.conn.CH1 = 'A'; S.conn.CH2 = 'B'; } },
      { do: '垂直 MODE 拨到 DUAL，确认两条波形都在屏上。', ids: ['vmode'], check: () => S.vmode === 'DUAL' && yt(), auto: () => { S.vmode = 'DUAL'; if (isXY()) S.tpos = 11; },
        why: '先在 DUAL 下确认两路都有信号，再进 X-Y。不然图形不对，你分不清是哪一路出了问题。' },
      { do: '把两路的 VOLTS/DIV 调到波形高度都在 4～7 格之间。', ids: ['v1', 'v2'],
        check: () => [0, 1].every(i => Truth.ppDiv(i) >= 3.5 && Truth.ppDiv(i) <= 7.5), auto: () => { fitV(0); fitV(1); },
        why: 'X-Y 模式下，CH1 的 VOLTS/DIV 决定图形多宽，CH2 的决定多高。两边差不多大，图形才好数切点。' },
      { do: 'TIME/DIV 逆时针拧到头，进入 X-Y 模式（LCD 左上角显示 X-Y）。从这一步起接线不能再改。', ids: ['tdiv'], check: () => isXY(), auto: () => { S.tpos = 0; },
        why: 'X-Y 模式下不再用锯齿波扫描：CH1 的信号加到 X 偏转板，CH2 加到 Y 偏转板，光点同时被两个方向的振动拉着走，画出来的就是李萨如图形。' },
      { do: '调信号源 A 的频率，做出 1:1 的图形（一个椭圆、斜线或圆）。图形转得越慢，越接近。提示：B 的频率在 1 kHz 上下；◀ ▶ 选好调节位，拧 FREQUENCY。', ids: ['afreq', 'ak_◀', 'ak_▶'],
        check: () => isXY() && ratioErr(1) < 0.003, auto: () => setAFreq(Math.round(S.B.F)),
        why: 'X、Y 两个方向的频率成整数比时，图形才是封闭、稳定的。两台信号源永远不可能完全一样，所以图形总会慢慢转。等它转到形状清楚的时候拍下来。' },
      { do: '拍照，然后在照片上数：横线贴着图形顶边，切到几个点记作 Nx；竖线贴着右边，切到几个点记作 Ny。再记下 A 的频率 fx。', ids: [],
        form: [['nx', 'Nx'], ['ny', 'Ny'], ['fx', 'fx（Hz）']], solve: () => solveLissa(1),
        verify: v => verifyLissa(v, 1) },
      { do: '调出 2:3（fx : fy = 2 : 3）：把 A 调到 B 的三分之二左右。', ids: ['afreq'],
        check: () => isXY() && ratioErr(2 / 3) < 0.003, auto: () => setAFreq(Math.round(S.B.F * 2 / 3)) },
      { do: '拍照，数 Nx、Ny，记下 fx。', ids: [], form: [['nx', 'Nx'], ['ny', 'Ny'], ['fx', 'fx（Hz）']], solve: () => solveLissa(2 / 3), verify: v => verifyLissa(v, 2 / 3) },
      { do: '调出 1:3：把 A 调到 B 的三分之一左右。', ids: ['afreq'],
        check: () => isXY() && ratioErr(1 / 3) < 0.003, auto: () => setAFreq(Math.round(S.B.F / 3)) },
      { do: '拍照，数 Nx、Ny，记下 fx。', ids: [], form: [['nx', 'Nx'], ['ny', 'Ny'], ['fx', 'fx（Hz）']], solve: () => solveLissa(1 / 3), verify: v => verifyLissa(v, 1 / 3) },
      { do: '三次算出的 fy 应该差不多，取平均就是待测频率。现在可以点信号源 B 的显示屏，揭开看答案。', ids: ['bDisp'], check: () => S.B.peek, auto: () => { S.B.peek = true; } },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'phase', title: '李萨如图形测相位差', sub: '实验内容 7：φ = arcsin(a/b)',
    setup: () => {
      resetBench(); powerOnNow(); randomB(900, 1300);
      S.conn.CH1 = 'A'; S.conn.CH2 = 'B';
      Object.assign(S.A, { wave: 'sine', on: true, amp: 3 }); setAFreq(Math.round(S.B.F * 0.97)); S.A.cur = 0;
      S.tpos = 0; fitV(0); fitV(1); S.B.amp = 2.4;
    },
    steps: [
      { do: '现在是 X-Y 模式，A 接 CH1、B 接 CH2。把 A 的频率调到和 B 一样（1:1），屏上是一个慢慢变形的椭圆。图形已经居中，拍照前别动水平 POSITION 和 CH2 的 POSITION。', ids: ['afreq'],
        check: () => isXY() && ratioErr(1) < 0.002, auto: () => setAFreq(Math.round(S.B.F)) },
      { do: '想一想：频率已经调成一样了，椭圆为什么还在变？（课后思考题 3）想好了点"下一步"看答案。', ids: [],
        why: '两台信号源各自独立，频率不可能分毫不差，总差那么零点几赫兹。两路信号的相位差就随时间慢慢变，椭圆就在"斜线 → 椭圆 → 圆 → 椭圆 → 斜线"之间来回变。频率差越小，变得越慢。' },
      { do: '等它变成一个斜着的椭圆时，点"拍照"定格。', ids: [], check: f => { const p = lastPhotoSince(f.t0); return p && p.xy; }, auto: () => takePhoto() },
      { do: '打开"照片"里刚拍的那张，量两个长度：a 是椭圆和中间那条横线两个交点之间的距离；b 是椭圆最左到最右的距离。都用格数。', ids: [],
        form: [['a', 'a（格）'], ['b', 'b（格）']],
        solve: () => { let p = Teach.photos.filter(x => x.xy).pop(); if (!p) { takePhoto(); p = Teach.photos[Teach.photos.length - 1]; } const b = r1(Truth.ppDiv(0)); return { a: r1(b * Math.sin(p.truth.phase * Math.PI / 180)), b }; },
        verify: v => {
          const p = Teach.photos.filter(x => x.xy).pop();
          if (!(v.b > 0) || v.a > v.b) return { ok: false, html: '<div class="bad-t">a 不可能比 b 大，再量一下。</div>' };
          const phi = Math.asin(v.a / v.b) * 180 / Math.PI;
          const ok = p && near(phi, p.truth.phase, 6);
          return { ok, html: `φ = arcsin(a/b) = arcsin(${v.a}/${v.b}) = <b>${fnum(phi)}°</b>` +
            (p ? `<br><span class="muted">拍照那一刻真实的相位差是 ${fnum(p.truth.phase)}°。</span>` : '') +
            (ok ? '' : '<div class="bad-t">差得有点多。a、b 都是整段长度（不是一半），在照片上用格子再量一次。</div>') };
        } },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'beat', title: '拍频法测频率', sub: '实验内容 8：ADD 模式下一鼓一缩的"拍"',
    setup: () => {
      resetBench(); powerOnNow(); randomB(800, 1200);
      Object.assign(S.A, { wave: 'sine', on: true, amp: 1.2 }); setAFreq(700); S.A.cur = 1;
      S.tpos = 11; S.B.amp = 3;
    },
    steps: [
      { do: '接线：待测信号 B 接 CH1，可调的标准信号 A 接 CH2。', ids: ['boutj', 'aoutj', 'ch1in', 'ch2in'],
        check: () => S.conn.CH1 === 'B' && S.conn.CH2 === 'A', auto: () => { S.conn.CH1 = 'B'; S.conn.CH2 = 'A'; } },
      { do: '垂直 MODE 拨 CH1，把 B 的波形调稳、调到 3～4 格高（两路加起来最高能到 8 格，正好占满屏幕；调 CH1 的 VOLTS/DIV 或 B 的幅度）。LCD 右上角的频率计能告诉你它大概多少赫兹。', ids: ['vmode', 'v1', 'level', 'bamp'],
        check: () => yt() && S.vmode === 'CH1' && signalStable() && Truth.ppDiv(0) >= 2.5 && Truth.ppDiv(0) <= 4.2,
        auto: () => { if (isXY()) S.tpos = 11; S.vmode = 'CH1'; S.level = 0; fitV(0, 2.5, 4.2); } },
      { do: '垂直 MODE 拨 CH2，调 A：频率调到和 B 差不多（相差 5% 以内），高度也调得和 B 差不多（拧 A 的幅度或 CH2 的 VOLTS/DIV）。', ids: ['vmode', 'afreq', 'aamp', 'v2'],
        check: () => { const fB = genFreqAt(S.B, now()); const d = Math.abs(S.A.freq - fB); const r = Truth.ppDiv(1) / Truth.ppDiv(0);
          return S.vmode === 'CH2' && d < 0.05 * fB && d > 0.3 && r > 0.7 && r < 1.4; },
        auto: () => { S.vmode = 'CH2'; setAFreq(Math.round(S.B.F * 1.02)); S.ch[1].vi = S.ch[0].vi; S.A.amp = r2(S.B.amp * CAL_ERR.v[0] / CAL_ERR.v[1]); },
        why: '两个频率很接近、幅度也差不多的信号加起来，拍才明显：鼓起来时接近两倍高，缩下去时几乎抵消成零。' },
      { do: '垂直 MODE 拨 ADD，确认 CH2 INV 是弹起的。后面几步都不能再按它。', ids: ['vmode', 'inv'], check: () => S.vmode === 'ADD' && !S.inv, auto: () => { S.vmode = 'ADD'; S.inv = false; },
        why: 'CH2 INV 按下时显示的是 CH1 − CH2，拍还在，但相位关系变了，判断容易乱。教材写的是"通道 2 极性选 NORM"，就是弹起。' },
      { do: '逆时针拧 TIME/DIV（扫描变慢），直到屏上能看到 1～3 个完整的"橄榄"——外轮廓一鼓一缩。', ids: ['tdiv'],
        check: () => { const n = 10 * tdivEff() * Math.abs(S.A.freq - genFreqAt(S.B, now())); return yt() && S.vmode === 'ADD' && n >= 0.8 && n <= 4; },
        auto: () => { const df = Math.abs(S.A.freq - S.B.F); let best = 1, bd = 1e9; for (let p = 1; p <= 20; p++) { const n = 10 * TDIV[p - 1] * CAL_ERR.t * df; const d = Math.abs(n - 2); if (d < bd) { bd = d; best = p; } } S.tpos = best; },
        why: '一个拍的时间是 1/|f₂ − f₁|。频率差 20 Hz 时一个拍 50 ms，用 10 ms/格，一屏 100 ms 正好两个拍。' },
      { do: '拍的形状会在屏上抖动、换位置（因为拍和扫描不同步），这是正常的。形状清楚时点"拍照"定格。', ids: [], check: f => !!lastPhotoSince(f.t0), auto: () => takePhoto() },
      { do: '在照片上量一个拍的长度 X（相邻两个"细腰"之间的格数），记下 A 的频率 f₁ 和 TIME/DIV 读数。', ids: ['lcd'],
        form: [['x', 'X（格）'], ['f1', 'f₁（Hz）'], ['e', 'TIME/DIV（ms）']],
        solve: () => { let p = Teach.photos[Teach.photos.length - 1]; if (!p || p.xy) { takePhoto(); p = Teach.photos[Teach.photos.length - 1]; } return { x: r1(p.truth.beatDiv), f1: p.truth.fA, e: +(p.truth.tdiv * 1e3).toPrecision(3) }; },
        verify: v => {
          const p = Teach.photos[Teach.photos.length - 1];
          const okE = p && near(v.e, p.truth.tdiv * 1e3, p.truth.tdiv * 1e3 * 0.001);
          const okX = p && near(v.x, p.truth.beatDiv, Math.max(0.3, p.truth.beatDiv * 0.08));
          const okF = p && near(v.f1, p.truth.fA, 0.6);
          const f3 = 1000 / (v.x * v.e);
          Teach.mem.f1 = v.f1; Teach.mem.f3 = f3;
          return { ok: okE && okX && okF, html:
            `拍频 f₃ = 1 / (X × TIME/DIV) = <b>${fnum(f3)} Hz</b>。待测频率是 f₁ + f₃ = <b>${fnum(v.f1 + f3, 5)}</b> 或 f₁ − f₃ = <b>${fnum(v.f1 - f3, 5)}</b> Hz，下一步判断是哪个。` +
            (okE ? '' : '<div class="bad-t">TIME/DIV 读数不对，看照片下面的 LCD，换算成 ms。</div>') +
            (okF ? '' : '<div class="bad-t">f₁ 是拍照时 A 的频率。</div>') +
            (okX ? '' : `<div class="bad-t">X 量得不太准，照片上一个拍大约 ${fnum(p ? p.truth.beatDiv : 0, 2)} 格附近，再量一下。</div>`) };
        } },
      { do: '判断取加还是减：把 A 的频率稍微调高一点（几赫兹），看拍变快（橄榄变短）还是变慢（橄榄变长）。', ids: ['afreq'],
        form: [['sign', '变慢填 1，变快填 2']], solve: () => ({ sign: genFreqAt(S.B, now()) > (Teach.mem.f1 || S.A.freq) ? 1 : 2 }),
        verify: v => {
          const higher = genFreqAt(S.B, now()) > (Teach.mem.f1 || S.A.freq);
          const right = higher ? 1 : 2;
          return { ok: v.sign === right, html: (v.sign === right ? '' : '<div class="bad-t">再试一次：调高 A 之后仔细看拍的长度怎么变。</div>') +
            '<div class="why"><b>道理：</b>拍频是两个频率之差。A 调高后拍变慢，说明 A 在往 B 靠近，B 比 A 高，取 f₁ + f₃；拍变快，说明 A 在远离 B，B 比 A 低，取 f₁ − f₃。（这个判断方法教材没写，是按原理推的，老师讲了别的方法以老师为准。）</div>' };
        } },
      { do: '点信号源 B 的显示屏，揭开看答案。', ids: ['bDisp'], check: () => S.B.peek, auto: () => { S.B.peek = true; } },
    ],
  },
  /* ---------------------------------------------------------- */
  {
    id: 'off', title: '收尾', sub: '关电源，整理仪器', setup: () => {},
    steps: [
      { do: '实验做完：先把亮度调暗，再按 POWER 关机。', ids: ['inten', 'power'], check: () => !S.power, auto: () => { S.power = false; },
        why: '离开前检查一遍：表 1 四行数据和标准方波的 f、g 都记了；李萨如 3 张、椭圆 1 张、拍 3 张照片都拍清楚了；CAL 端子旁边印的电压拍到了；请老师检查数据，预习章和实验数据章都盖了。' },
    ],
  },
];

function solveLissa(target) {
  const want = { 1: [1, 1], [2 / 3]: [3, 2], [1 / 3]: [3, 1] }[target];
  return { nx: want[0], ny: want[1], fx: S.A.freq };
}
function verifyLissa(v, target) {
  const want = { 1: [1, 1], [2 / 3]: [3, 2], [1 / 3]: [3, 1] }[target];
  const okN = v.nx / v.ny === want[0] / want[1];
  const fy = v.fx * v.nx / v.ny;
  const okF = near(v.fx, S.A.freq, Math.max(1, S.A.freq * 0.005));
  (Teach.mem.fy = Teach.mem.fy || {})[target] = fy;
  return { ok: okN && okF, html:
    `fy = fx · Nx / Ny = ${v.fx} × ${v.nx} / ${v.ny} = <b>${fnum(fy, 5)} Hz</b>` +
    (okN ? '' : `<div class="bad-t">切点数不对。fx : fy = ${target === 1 ? '1:1' : target > 0.5 ? '2:3' : '1:3'} 时，Nx / Ny 应该等于 fy / fx = ${want[0]}/${want[1]}。横线贴顶边数切点，竖线贴右边数切点。</div>`) +
    (okF ? '' : '<div class="bad-t">fx 填信号源 A 显示屏上的频率。</div>') };
}

/* ---------------- 思考题 ---------------- */

const QUIZ = [
  ['开机后屏上既没有扫描线也没有光点，可能是什么原因？', '亮度（INTEN）太暗；光迹偏出了屏幕（X、Y 位移拧偏了）；触发模式在 NORM 又没有信号；电源没开或者还没预热好。按"电源 → 亮度 → 位移 → 触发模式"的顺序排查。'],
  ['暂时不用示波器时，是关机还是调暗？', '把亮度调到最暗，不关机。频繁开关机伤仪器，示波管重新开机还要预热。'],
  ['为什么观察波形时 X 偏转板要加锯齿波？加恒定电压行不行？', '锯齿波随时间线性增大，光点的水平位置就和时间成正比，波形才能沿时间轴展开；扫完一次迅速回到左边重新开始。加恒定电压，光点只会停在一个固定的水平位置，屏上只剩一条竖线。'],
  ['"同步"指什么？', '扫描周期是信号周期的整数倍（Tx = nTy），每次扫描都从波形的同一点开始，画出来的波形重合在一起，就稳定不跑了。'],
  ['怎样测周期和峰-峰值？', '先把 VAR 和 SWP.VAR 拧到 CAL。峰-峰值 = 竖直方向格数 a × VOLTS/DIV 读数 b；周期 = c 个周期占的格数 d × TIME/DIV 读数 e ÷ c。'],
  ['"触发"是什么？', '信号到达设定的电平（LEVEL）、并且按设定的方向（SLOPE 的 + 或 −）穿过它时，才开始一次扫描。这样每次扫描都从波形的同一点开始，是实现同步的手段。'],
  ['直流分量怎么测？', '先拨 GND，把零线对到中间。拨 AC：电容挡住直流，记下波谷位置；拨 DC：交流、直流一起进来，再记波谷位置。两次的位置差 × VOLTS/DIV 就是直流分量。'],
  ['李萨如图形测频率的原理？', '两个互相垂直的振动合成，频率成整数比时图形稳定、封闭。水平切线的切点数 Nx 和竖直切线的切点数 Ny 之比等于频率的反比：Nx / Ny = fy / fx。'],
  ['李萨如图形测相位差的原理？', '同频的两个信号合成一个椭圆。设 x = X·sinωt，y = Y·sin(ωt + φ)，在 y = 0 处 x = X·sinφ，所以 sinφ = a / b：a 是椭圆在 x 轴上的截距，b 是水平方向的最大宽度。'],
  ['拍频法怎么测未知频率？', '两个频率相近的信号叠加，合振幅忽大忽小，这叫拍，拍频 = 两频率之差 f₃ = |f₂ − f₁|。量出一个拍的长度 X，f₃ = 1/(X × TIME/DIV)。再改变已知频率 f₁ 看拍变快还是变慢，判断待测频率是 f₁ + f₃ 还是 f₁ − f₃。'],
];
const QUIZ_AFTER = [
  ['扫描频率远大于或远小于输入信号频率时，屏上是什么样？（课后思考题 1）', '扫描频率远大于信号频率（扫得太快）：一次扫描只画了信号很小的一段，看到的接近一条斜线或平线。扫描频率远小于信号频率（扫得太慢）：一屏挤进很多个周期，密密麻麻连成一片亮带。在模拟器里把 TIME/DIV 拧到两头试试。'],
  ['正弦波不断向右或向左"跑"，什么情况向右、什么情况向左？调哪几个旋钮？（课后思考题 2）', '没同步时，扫描周期 Tx 不是信号周期 Ty 的整数倍。Tx 比 nTy 稍大，每次扫描都比上一次晚开始一点，波形看起来向左跑；Tx 比 nTy 稍小，波形向右跑。先拧 TIME/DIV（必要时 SWP.VAR）让它接近不跑，再拧 LEVEL 让触发把它锁住。在模拟器里把 LEVEL 拧出范围，再慢慢拧 SWP.VAR，能看到波形跑的方向在变。'],
  ['X、Y 偏转板上的正弦电压频率相等时，图形为什么还在时刻转动？（课后思考题 3）', '两路信号来自两台独立的信号源，频率不可能严格相等，差值哪怕只有零点几赫兹，相位差也在随时间慢慢变化，椭圆的形状就跟着周期性地变（看起来像在转）。频率差越小，转得越慢。'],
];

/* ---------------- 禁区：教材叮嘱过不能动的东西，动了这一步就失败 ----------------
   from/to：在第几步到第几步之间生效（从 0 数）；base：进入 from 那一步时的面板；back：失败后回到第几步重做 */
const GUARDS = {
  measure: [
    { from: 2, to: 4, label: '两个 VAR、SWP.VAR 离开 CAL，按 ×10 MAG', ids: ['var1', 'swpvar', 'mag'], back: 0,
      test: () => (S.ch[0].vvar < 1 && 'CH1 的 VAR 离开了 CAL') || (S.swpvar < 1 && 'SWP.VAR 离开了 CAL') || (S.mag && '按下了 ×10 MAG'),
      why: '读数前确认过的"校准"状态被破坏了：这时屏上 1 格已经不等于 LCD 上写的值，刚才读的数全部作废，要从确认 CAL 那一步重来。' },
    { from: 3, to: 4, label: 'CH1 的 VOLTS/DIV', ids: ['v1'], back: 2,
      test: b => S.ch[0].vi !== b.ch[0].vi && '读完 a、b 之后拧了 CH1 的 VOLTS/DIV',
      why: '你记下的 b、照片里的波形高度和现在的档位对不上了，而且下一课修正要用同一个档位量标准方波。要回到读 a、b 那一步重新读。' },
    { from: 4, to: 4, label: 'TIME/DIV', ids: ['tdiv'], back: 3,
      test: b => S.tpos !== b.tpos && '读完周期之后拧了 TIME/DIV',
      why: '你记下的 e 和照片里的波形对不上了，下一课修正也要用同一个扫描档位。要回到读周期那一步重新读。' },
  ],
  cal: [
    { from: 0, to: 1, label: 'VOLTS/DIV、TIME/DIV、两个 VAR', ids: ['v1', 'tdiv', 'var1', 'swpvar'], back: 0,
      test: b => (S.ch[0].vi !== b.ch[0].vi && '拧了 VOLTS/DIV') || (S.tpos !== b.tpos && '拧了 TIME/DIV') || (S.ch[0].vvar < 1 && 'VAR 离开了 CAL') || (S.swpvar < 1 && 'SWP.VAR 离开了 CAL'),
      why: '教材原话是"在通道灵敏度开关和扫描频率旋钮不变的情况下"。修正靠的是"同一个档位下标准方波占几格"，档位一变，量出来的 f、g 就和第 3 课的 a、d 不配套了。真实实验里要回去重测 a、d；这里先回到本课开始时，档位会恢复成测量时的样子。' },
  ],
  dc: [
    { from: 0, to: 4, label: '信号源 A 的 OFFSET', ids: ['aoff'], back: 0,
      test: b => S.A.offset !== b.A.offset && '动了信号源的 OFFSET',
      why: '你要测的就是这个直流电压，测的过程中把它改了，前面的读数就不算数了。' },
    { from: 2, to: 4, label: 'CH1 的 POSITION、VOLTS/DIV', ids: ['pos1', 'v1'], back: 0,
      test: b => (Math.abs(S.ch[0].pos - b.ch[0].pos) * VPOS_RANGE > 0.02 && '零线定好以后拧了 CH1 的 POSITION') || (S.ch[0].vi !== b.ch[0].vi && '中途换了 VOLTS/DIV'),
      why: 'AC、DC 两次波谷的位置都是相对零线、在同一个档位下读的。零线一挪、或者 1 格代表的电压一变，两次读数就没法相减了。要回到 GND 重新定零线。' },
  ],
  lissa: [
    { from: 3, to: 10, label: '接线', ids: ['ch1in', 'ch2in'], back: 0,
      test: b => (S.conn.CH1 !== b.conn.CH1 || S.conn.CH2 !== b.conn.CH2) && '进了 X-Y 模式以后改了接线',
      why: 'X 轴接的是已知的 fx、Y 轴接的是待测的 fy，换了线，Nx、Ny 和 fx、fy 的对应关系就全乱了。要从接线那一步重来。' },
  ],
  phase: [
    { from: 0, to: 2, label: '水平 POSITION、CH2 的 POSITION', ids: ['hpos', 'pos2'], back: 0,
      test: b => (Math.abs(S.hpos - b.hpos) * HPOS_RANGE > 0.05 || Math.abs(S.ch[1].pos - b.ch[1].pos) * VPOS_RANGE > 0.05) && '拍照前挪了图形的位置',
      why: 'a 是椭圆和中间那条横线的截距，图形中心离开刻度中心，截距就量不准了。要回到这一课开头重新调。' },
  ],
  beat: [
    { from: 3, to: 6, label: 'CH2 INV', ids: ['inv'], back: 3,
      test: () => S.inv && '按下了 CH2 INV',
      why: '教材要求"通道 2 极性选 NORM"（弹起）。按下后显示的是 CH1 − CH2，拍的样子会变，后面的读数和判断都不对了。要回到拨 ADD 那一步。' },
  ],
};
LESSONS.forEach(L => { L.guards = (GUARDS[L.id] || []).map((g, i) => ({ ...g, id: L.id + i })); });
