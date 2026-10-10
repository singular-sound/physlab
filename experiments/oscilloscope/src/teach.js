'use strict';
/* ============================================================
   侧栏：模式切换、课程引导、原理动画、提问、记录表、照片、诊断
   ============================================================ */

const Teach = { mode: 'teach', tab: 'lessons', lesson: null, step: 0, done: [], f: {}, mem: {}, photos: [], formMsg: {}, finished: {}, forms: {}, notes: [], pv: null, resume: null, stepSnap: {}, gbase: {}, fail: null, fails: {} };

const store = {
  get(k, d) { try { const v = localStorage.getItem('osc-sim-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('osc-sim-' + k, JSON.stringify(v)); } catch (e) { /* 存不了就算了 */ } },
};

const TABS = {
  teach: [['lessons', '课程'], ['principle', '原理'], ['quiz', '思考题'], ['records', '记录表'], ['photos', '照片'], ['notes', '我的记录']],
  sim: [['tasks', '实验任务'], ['principle', '原理'], ['quiz', '思考题'], ['records', '记录表'], ['photos', '照片'], ['notes', '我的记录']],
};

function setMode(m) {
  Teach.mode = m; Panel.mode = m;
  $('#modeTeach').classList.toggle('on', m === 'teach');
  $('#modeSim').classList.toggle('on', m === 'sim');
  $('#btnNote').hidden = m === 'teach';   // 教学模式里记录按钮在每一步的按钮行里
  if (m === 'sim') { Teach.lesson = null; highlight([]); clearBox(); if (Teach.tab === 'lessons') Teach.tab = 'tasks'; }
  else if (Teach.tab === 'tasks') Teach.tab = 'lessons';
  store.set('mode', m);
  renderTabs(); renderPane();
}

function renderTabs() {
  const nav = $('#tabs'); nav.innerHTML = '';
  for (const [id, label] of TABS[Teach.mode]) {
    const b = el('button', Teach.tab === id ? 'on' : '', nav); b.type = 'button'; b.textContent = label + (id === 'photos' && Teach.photos.length ? ` ${Teach.photos.length}` : '') + (id === 'notes' && Teach.notes.length ? ` ${Teach.notes.length}` : '');
    b.addEventListener('click', () => { Teach.tab = id; renderTabs(); renderPane(); });
  }
}

function renderPane() {
  const p = $('#pane');
  Principle.active = false;
  if (Teach.lesson == null) { highlight([]); clearBox(); }
  ({ lessons: renderLessons, tasks: renderTasks, principle: renderPrinciple, quiz: renderQuiz, records: renderRecords, photos: renderPhotos, diag: renderDiag, notes: renderNotes }[Teach.tab] || renderLessons)(p);
}

/* ---------------- 课程 ---------------- */

function renderLessons(p) {
  if (Teach.lesson != null) return renderStep(p);
  highlight([]); clearBox();
  p.innerHTML = `<div class="eyebrow">教学模式</div><h3>跟着做一遍，上实验课心里就有底</h3>
    <p class="muted small">按教材"实验内容"的顺序排。每一课会先把面板摆到起始状态，然后一步步告诉你拧哪个、为什么。卡住了可以点"帮我做这一步"。</p>
    ${Teach.resume ? `<button class="tbtn primary" id="resume" type="button" style="width:100%;margin-bottom:10px">继续：第 ${Teach.resume.i} 课「${LESSONS[Teach.resume.i].title}」第 ${Teach.resume.k + 1} 步（面板保持现在的样子）</button>` : ''}
    <div class="lessons" id="lessonList"></div>`;
  if ($('#resume')) $('#resume').onclick = () => { const r = Teach.resume; Teach.resume = null; Teach.lesson = r.i; Teach.done = r.done; Teach.step = r.k; Teach.f = { t0: now() }; renderPane(); };
  const list = $('#lessonList');
  LESSONS.forEach((L, i) => {
    const b = el('button', 'lesson-item' + (Teach.finished[L.id] ? ' done' : ''), list); b.type = 'button';
    b.innerHTML = `<span class="no">${i}</span><span><div class="t">${L.title}</div><div class="d">${L.sub}</div></span><span class="st">${Teach.finished[L.id] ? '已完成' : L.steps.length + ' 步'}${Teach.fails[L.id] ? `<br><span style="color:var(--bad)">失误 ${Teach.fails[L.id]} 次</span>` : ''}</span>`;
    b.addEventListener('click', () => startLesson(i));
  });
}

function startLesson(i) {
  const L = LESSONS[i];
  Teach.lesson = i; Teach.step = 0; Teach.done = []; Teach.f = { t0: now() }; Teach.formMsg = {}; Teach.resume = null;
  for (const key in Teach.forms) if (key.startsWith(L.id + ':')) delete Teach.forms[key];   // 重新开始这一课，旧读数作废
  store.set('forms', Teach.forms);
  L.setup(); hideTip();
  Teach.stepSnap = {}; Teach.gbase = {}; Teach.fail = null;
  changed('lesson');
  histReset(); enterStep(0);
  renderPane();
  if (i > 0) toast('已把面板摆到这一课的起始状态。');
}

function curStep() { return Teach.lesson == null ? null : LESSONS[Teach.lesson].steps[Teach.step]; }

function gotoStep(k) {
  const L = LESSONS[Teach.lesson];
  if (k >= L.steps.length) { Teach.finished[L.id] = true; store.set('finished', Teach.finished); Teach.lesson = null; renderPane(); toast(`「${L.title}」完成。`); return; }
  Teach.step = Math.max(0, k); Teach.f = { t0: now() }; enterStep(Teach.step); renderPane();
}

function renderStep(p) {
  const L = LESSONS[Teach.lesson], st = curStep(), k = Teach.step, done = !!Teach.done[k];
  const manual = !st.check && !st.form;
  p.innerHTML = `
    <div class="step-head"><button class="tbtn" id="backList" type="button">← 课程</button><div class="dots">${L.steps.map((_, j) => `<i class="${Teach.fail && j === k ? 'fail' : Teach.done[j] ? 'done' : j === k ? 'cur' : ''}"></i>`).join('')}</div></div>
    <div class="eyebrow">第 ${Teach.lesson} 课 · ${L.title} · 第 ${k + 1}/${L.steps.length} 步</div>
    ${Teach.fail ? `<div class="fail"><h4>这一步失败了：${Teach.fail.what}</h4><p>${Teach.fail.why}</p>
      <div class="row"><button class="tbtn primary" id="failRestart" type="button">从第 ${Teach.fail.back + 1} 步重新做</button>
      <button class="tbtn ghost" id="failUndo" type="button">撤回这一下，接着练（现实里没有这个按钮）</button></div>
      <p class="small muted" style="margin:6px 0 0">这次失误已经自动写进「我的记录」。</p></div>` : ''}
    <div class="step-card"><div class="do">${st.do}</div>
      ${activeGuards(k).length ? `<div class="lock"><b>这一步别动：</b>${activeGuards(k).map(g => g.label).join('；')}</div>` : ''}
      ${st.list ? `<ul class="checklist" id="chk">${st.list.map(x => `<li>${x[0]}</li>`).join('')}</ul>` : ''}
      ${st.form ? `<div class="pv-host" id="pvHost"></div><div class="row" style="margin-top:10px">${st.form.map(([key, lab]) => `<label class="inp">${lab}<input id="f_${key}" inputmode="decimal" autocomplete="off"></label>`).join('')}<button class="tbtn primary" id="fCheck" type="button">核对</button></div><div class="saved-tip">填的数会自动保存，翻照片、切页面、刷新都不会丢。</div><div id="fRes"></div>` : ''}
      ${manual ? '' : `<div class="state" id="stState"></div>`}
    </div>
    <div id="whyBox"></div>
    <div class="row">
      ${k > 0 ? '<button class="tbtn" id="prevStep" type="button">上一步</button>' : ''}
      ${st.auto || st.solve ? `<button class="tbtn" id="autoStep" type="button">${st.solve ? '帮我填（看答案）' : '帮我做这一步'}</button>` : ''}
      <button class="tbtn qbtn" id="qStep" type="button" title="把现在的面板、屏幕和这一步记下来，之后在「我的记录」里看、导出">有疑问：记录一下</button>
      <button class="tbtn" id="redoStep" type="button" title="面板回到这一步刚开始时的样子，这一步填的数清空">重做这一步</button>
      <button class="tbtn ${manual || done ? 'primary' : ''}" id="nextStep" type="button" ${Teach.fail ? 'disabled' : ''}>${manual || done ? (k === L.steps.length - 1 ? '完成这一课' : '下一步') : '跳过'}</button>
    </div>`;
  $('#backList').onclick = () => { Teach.resume = { i: Teach.lesson, k, done: Teach.done.slice() }; Teach.lesson = null; renderPane(); };
  $('#nextStep').onclick = () => { Teach.done[k] = Teach.done[k] || manual; gotoStep(k + 1); };
  if ($('#prevStep')) $('#prevStep').onclick = () => { Teach.fail = null; gotoStep(k - 1); };
  $('#redoStep').onclick = () => restartAt(k, '已回到这一步开始时的样子。');
  $('#qStep').onclick = () => openNote();
  if ($('#failRestart')) $('#failRestart').onclick = () => restartAt(Teach.fail.back, `已回到第 ${Teach.fail.back + 1} 步开始时的样子，之后填的数作废了。`);
  if ($('#failUndo')) $('#failUndo').onclick = () => { const f = Teach.fail; Teach.fail = null; applyState(f.before); changed('undo'); histReset(); refreshGuardBase(); renderPane(); toast('撤回了这一下。记住：真实实验里没有撤回。'); };
  if (Teach.fail && $('#autoStep')) $('#autoStep').disabled = true;
  if ($('#autoStep')) $('#autoStep').onclick = () => {
    if (st.solve) {
      const v = st.solve(); changed('auto');
      for (const key in v) { const i = $('#f_' + key); if (i) i.value = v[key]; }
      saveForm();
      $('#fCheck').click();
    } else { st.auto(); changed('auto'); }
    stepTick();
  };
  if (st.form) {
    const fk = L.id + ':' + k, saved = Teach.forms[fk];
    if (saved) {
      for (const key in saved.raw || {}) { const i = $('#f_' + key); if (i) i.value = saved.raw[key]; }
      if (saved.res) { showFormResult(saved.res); if (saved.res.ok) markDone(); }
    }
    p.querySelectorAll('.inp input').forEach(i => i.addEventListener('input', saveForm));
    photoViewer($('#pvHost'));
    $('#fCheck').onclick = () => {
      const v = {};
      for (const [key] of st.form) { v[key] = parseFloat(($('#f_' + key).value || '').replace('−', '-').replace(',', '.')); }
      if (Object.values(v).some(x => !isFinite(x))) { showFormResult({ ok: false, html: '<div class="bad-t">每一格都要填数字。</div>' }); return; }
      const res = st.verify(v);
      Teach.formMsg[k] = { v, res };
      saveForm(res);
      showFormResult(res);
      if (res.ok) markDone();
    };
    p.querySelectorAll('.inp input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') $('#fCheck').click(); }));
  }
  if (done || manual) showWhy();
  highlight(st.ids || []);
  if (st.box) showBox(st.box); else clearBox();
  stepTick();
}

function saveForm(res) {
  if (Teach.lesson == null) return;
  const st = curStep(); if (!st || !st.form) return;
  const fk = LESSONS[Teach.lesson].id + ':' + Teach.step;
  const old = Teach.forms[fk] || {};
  const raw = {};
  for (const [key] of st.form) { const i = $('#f_' + key); if (i) raw[key] = i.value; }
  Teach.forms[fk] = { raw, res: res && res.html ? res : (res === undefined ? old.res : null) };
  if (res === undefined && old.raw && JSON.stringify(old.raw) !== JSON.stringify(raw)) Teach.forms[fk].res = null;   // 改了数，旧的核对结果作废
  store.set('forms', Teach.forms);
}

/* 照片查看器：填数的时候不用切页面 */
function photoViewer(host) {
  if (!host) return;
  const n = Teach.photos.length;
  if (!n) {
    host.innerHTML = '<div class="pv-empty"><span>还没有照片。要从照片上读数，先拍一张。</span><button class="tbtn" type="button" data-shot>拍一张</button></div>';
    host.querySelector('[data-shot]').onclick = () => takePhoto();
    return;
  }
  if (Teach.pv == null || Teach.pv >= n || Teach.pv < 0) Teach.pv = n - 1;
  const ph = Teach.photos[Teach.pv];
  host.innerHTML = `<div class="pv"><img src="${ph.url}" alt="${ph.label}" title="点击放大"><div class="pv-bar">
    <button type="button" data-d="-1" ${Teach.pv === 0 ? 'disabled' : ''} aria-label="上一张">‹</button>
    <span>第 ${Teach.pv + 1}/${n} 张 · ${ph.when} · ${ph.label}</span>
    <button type="button" data-d="1" ${Teach.pv === n - 1 ? 'disabled' : ''} aria-label="下一张">›</button>
    <button type="button" data-shot>拍一张</button></div></div>`;
  host.querySelector('img').onclick = () => openPhoto(ph);
  host.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { Teach.pv += +b.dataset.d; photoViewer(host); }; });
  host.querySelector('[data-shot]').onclick = () => takePhoto();
}

function showFormResult(res) { const r = $('#fRes'); if (r) { r.className = 'result ' + (res.ok ? 'good' : 'bad'); r.innerHTML = (res.ok ? '<div class="good-t">对了。</div>' : '') + res.html; } }
function showWhy() { const st = curStep(); const w = $('#whyBox'); if (w && st.why) w.innerHTML = `<div class="why"><b>为什么：</b>${st.why}</div>`; }
function markDone() {
  const k = Teach.step; if (Teach.done[k]) return;
  Teach.done[k] = true;
  const n = $('#nextStep'); if (n) { n.classList.add('primary'); n.textContent = k === LESSONS[Teach.lesson].steps.length - 1 ? '完成这一课' : '下一步'; }
  const dots = document.querySelectorAll('.dots i'); if (dots[k]) dots[k].className = 'done';
  showWhy();
}

function stepTick() {
  if (Teach.mode !== 'teach' || Teach.lesson == null || Teach.tab !== 'lessons') return;
  const st = curStep(); if (!st) return;
  if (guardCheck() || Teach.fail) return;
  if (st.watch) st.watch(Teach.f);
  if (st.list) { const lis = document.querySelectorAll('#chk li'); st.list.forEach((x, j) => lis[j] && lis[j].classList.toggle('ok', !!x[1]())); }
  const s = $('#stState');
  if (st.check) {
    const ok = !!st.check(Teach.f);
    if (ok) markDone();
    if (s) s.innerHTML = Teach.done[Teach.step] ? '<span class="pill ok">做到了</span>' : '<span class="pill wait">等你操作</span><span class="muted">做对了这里会自动变绿</span>';
  } else if (st.form && s) s.innerHTML = Teach.done[Teach.step] ? '<span class="pill ok">核对通过</span>' : '<span class="pill wait">填好数字后点"核对"</span>';
}
setInterval(stepTick, 300);

function showBox(b) {
  clearBox();
  const d = el('div', 'hlbox', $('#stage'), { left: (b[0] - 6) + 'px', top: (b[1] - 6) + 'px', width: (b[2] + 12) + 'px', height: (b[3] + 12) + 'px' });
  d.id = 'hlbox';
}
function clearBox() { const d = $('#hlbox'); if (d) d.remove(); }

/* ---------------- 仿真模式：实验任务 ---------------- */

const TASKS = [
  '开机，调出细而居中的扫描线',
  '1 kHz 正弦波：调稳，读 a、b、c、d、e，大小屏一起拍照',
  '1 kHz 三角波、100 Hz 正弦波、100 Hz 三角波：同样各读一遍（凑齐表 1）',
  '标准方波：档位不动接 CAL，读 f、g；看清 CAL 旁边印的电压',
  '直流分量：GND 定零线，AC、DC 各记一次波谷（三角波、正弦波）',
  '李萨如：调出 1:1、2:3、1:3 并拍照，记 fx',
  '相位差：同频椭圆拍照',
  '拍频：CH1、CH2、ADD 三张照片；记 X₁、f₁、X₂、f₂ 和 TIME/DIV',
  '关电源，整理仪器',
];

function renderTasks(p) {
  const done = store.get('tasks', []);
  p.innerHTML = `<div class="eyebrow">仿真模式</div><h3>自己从头做一遍</h3>
    <p class="muted small">这里不提示下一步，鼠标停在部件上（平板上按住）只显示名字和读数，和上课时一样。卡住了点顶上的"屏幕为什么是这样？"。</p>
    <div class="row" style="margin-bottom:12px">
      <button class="tbtn" id="mess" type="button">打乱面板</button>
      <button class="tbtn" id="reset" type="button">全部复位</button>
      <button class="tbtn" id="newB" type="button">换一个待测信号 B</button>
    </div>
    <p class="small muted" style="margin-top:-4px">"打乱面板"模拟上一组同学没复位：亮度、位移、触发、VAR 都可能在奇怪的位置。</p>
    <h4>任务清单（勾选只是给自己看）</h4>
    <ul class="checklist" id="tasklist" style="gap:6px">${TASKS.map((t, i) => `<li style="list-style:none"><label style="display:flex;gap:8px;cursor:pointer"><input type="checkbox" data-i="${i}" ${done[i] ? 'checked' : ''}>${t}</label></li>`).join('')}</ul>`;
  p.querySelectorAll('#tasklist input').forEach(c => c.addEventListener('change', () => { const d = store.get('tasks', []); d[c.dataset.i] = c.checked; store.set('tasks', d); }));
  $('#mess').onclick = () => { messUp(); changed('mess'); toast('面板被打乱了。先按开机前的起始位置摆好。'); };
  $('#reset').onclick = () => { resetBench(); changed('reset'); toast('已全部复位：电源关、旋钮在起始位置、线都拔了。'); };
  $('#newB').onclick = () => { randomB(300, 1900); S.B.peek = false; changed('newB'); toast('信号源 B 换了一个新的未知频率。'); };
}
function messUp() {
  resetBench();
  const pick = a => a[Math.floor(Math.random() * a.length)];
  Object.assign(S, { inten: rand(0, 0.25), focus: rand(0.1, 0.95), hpos: rand(-1, 1), swpvar: rand(0.3, 1), tpos: Math.floor(rand(1, 21)),
    trigMode: pick(['AUTO', 'NORM', 'NORM', 'TV-V']), source: pick(['CH1', 'CH2', 'LINE']), level: rand(-1, 1), slope: pick(['+', '-']),
    vmode: pick(['CH1', 'CH2', 'DUAL', 'ADD']), chop: Math.random() < 0.5, inv: Math.random() < 0.4, mag: Math.random() < 0.4, rot: rand(-0.5, 0.5) });
  for (const c of S.ch) Object.assign(c, { vi: Math.floor(rand(0, 12)), vvar: rand(0.2, 1), pos: rand(-1, 1), cpl: pick(['AC', 'GND', 'DC']) });
  Object.assign(S.A, { wave: pick(['sine', 'tri', 'square']), amp: r2(rand(0.5, 8)), offset: r2(rand(-1, 1)) }); setAFreq(Math.round(rand(50, 5000)));
  randomB(300, 1900);
}

/* ---------------- 思考题 ---------------- */

function renderQuiz(p) {
  const qa = ([q, a]) => `<details class="qa"><summary>${q}</summary><div>${a}</div></details>`;
  p.innerHTML = `<div class="eyebrow">课前 · 教材第 92 页</div><h3>预习思考题</h3>
    <p class="muted small">教材第 92 页的 10 道预习思考题，加第 100 页的 3 道课后思考题。老师课上具体问什么，以老师为准；这些是教材给的题，预习测试、报告里的思考题都跟它们有关。先自己想，再点开看答案。</p>${QUIZ.map(qa).join('')}
    <h4>课后思考题（教材第 100 页）</h4>${QUIZ_AFTER.map(qa).join('')}`;
}

/* ---------------- 原理 ---------------- */

function renderPrinciple(p) {
  p.innerHTML = `<div class="eyebrow">慢动作</div><h3>示波器是怎么画出波形的</h3>
    <div class="principle"><canvas id="prin" width="712" height="640"></canvas></div>
    <p class="small muted" id="prinCap" style="margin-top:6px"></p>
    <p class="small">上面这幅图跟着面板实时变：拧 TIME/DIV、LEVEL，或者切到 X-Y 模式，看它怎么变。下面是文字版。</p>
    <h4>1. 示波管：光点被两对偏转板拉着走</h4>
    <p>电子枪射出电子束，打到荧光屏上是一个亮点。电子束先后穿过 Y 偏转板（上下一对）和 X 偏转板（左右一对），板上加了电压，电子束就被拉偏。<b>光点偏离中心的距离和偏转板上的电压成正比</b>，所以"测电压"就变成了"数格子"。</p>
    ${crtSVG()}
    <h4>2. 扫描：为什么 X 板要加锯齿波</h4>
    <p>锯齿波电压随时间均匀上升，光点就从左往右匀速走，水平位置正比于时间；走到右边，电压突然掉回去，光点瞬间回到左边（回扫，这时电子束是关掉的）。同时 Y 板上加被测信号，光点一边往右走一边上下动，画出来的就是信号随时间变化的波形。TIME/DIV 改的就是锯齿波上升的快慢。</p>
    <h4>3. 触发和同步：为什么波形能稳住</h4>
    <p>屏上的波形其实是一次次扫描叠在一起的。每次扫描都必须从波形的同一点开始，叠起来才重合。触发电路盯着信号，信号涨到 LEVEL 设定的电平、方向又符合 SLOPE 时，才放行一次扫描。LEVEL 超出波形的范围，就永远等不到这一点，AUTO 模式只好自己乱扫，波形就跑起来了。</p>
    <div class="formula">稳定条件：扫描周期 T<sub>x</sub> = n · 信号周期 T<sub>y</sub></div>
    <h4>4. 测量公式</h4>
    <div class="formula">U<sub>pp</sub> = a · b　　U = U<sub>pp</sub> / (2√2)</div>
    <div class="formula">T = d · e / c　　f = 1 / T</div>
    <p class="small muted">a：峰-峰值格数；b：VOLTS/DIV；c：周期个数；d：c 个周期的格数；e：TIME/DIV。读之前两个 VAR 都要在 CAL。</p>
    <h4>5. 用标准方波修正</h4>
    <p>元件会老化、受温度影响，示波器的灵敏度和扫描速度会有百分之几的偏差（这台模拟器也故意做了 2～3% 的偏差）。用同样的档位量一个已知的标准方波，峰峰值占 f 格、一个周期占 g 格，就能把偏差除掉：</p>
    <div class="formula">U = a / f × U<sub>CAL</sub>　　T = 0.001 · d / (c · g)</div>
    <h4>6. 直流分量：AC 和 DC 的区别</h4>
    <p>AC 耦合在输入端串了一个电容，电容不让直流通过，所以 AC 档只显示交流部分，波形以零线为中心；DC 档交流直流一起显示，整个波形被直流抬高或压低。两次波谷的位置差就是直流电压占的格数。</p>
    <h4>7. 李萨如图形</h4>
    <p>X-Y 模式下不再扫描，CH1 的信号拉 X 方向，CH2 的信号拉 Y 方向。两个频率成整数比，光点走一圈回到原处，图形就封闭稳定。</p>
    <div class="formula">N<sub>x</sub> / N<sub>y</sub> = f<sub>y</sub> / f<sub>x</sub>　　φ = arcsin(a / b)</div>
    <h4>8. 拍</h4>
    <p>两个频率很接近的正弦波相加，有时波峰对波峰，合起来变大；有时波峰对波谷，互相抵消变小。合成波的大小就一鼓一缩，这叫拍。</p>
    <div class="formula">f<sub>3</sub> = |f<sub>2</sub> − f<sub>1</sub>| = 1 / (X × TIME/DIV)</div>`;
  Principle.init($('#prin'));
}

function crtSVG() {
  return `<div style="overflow-x:auto"><svg viewBox="0 0 340 120" width="100%" style="max-width:340px;display:block;margin:4px 0 10px" role="img" aria-label="示波管结构示意图">
    <path d="M10 45 H120 L190 20 H300 V100 H190 L120 75 H10 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <rect x="18" y="50" width="44" height="20" rx="2" fill="none" stroke="currentColor"/>
    <text x="40" y="63" font-size="9" text-anchor="middle" fill="currentColor">电子枪</text>
    <line x1="80" y1="49" x2="104" y2="49" stroke="#c8372d" stroke-width="3"/><line x1="80" y1="71" x2="104" y2="71" stroke="#c8372d" stroke-width="3"/>
    <text x="92" y="42" font-size="9" text-anchor="middle" fill="currentColor">Y 板</text>
    <rect x="128" y="50" width="22" height="20" fill="none" stroke="#2c64b8" stroke-width="2.5" stroke-dasharray="3 2"/>
    <text x="139" y="88" font-size="9" text-anchor="middle" fill="currentColor">X 板</text>
    <path d="M62 60 L92 60 Q140 56 300 38" fill="none" stroke="#17a35f" stroke-width="1.6"/>
    <circle cx="300" cy="38" r="3.5" fill="#17a35f"/>
    <line x1="300" y1="20" x2="300" y2="100" stroke="currentColor" stroke-width="3"/>
    <text x="300" y="114" font-size="9" text-anchor="middle" fill="currentColor">荧光屏</text>
    <text x="210" y="62" font-size="9" fill="currentColor">电子束被 Y 板拉偏</text>
  </svg></div>`;
}

const Principle = {
  active: false, cvs: null, ctx: null, tau: 0, last: 0, sweeps: [], ready: 0, trail: [],
  init(c) {
    this.cvs = c; this.ctx = c.getContext('2d'); this.active = true; this.tau = 0; this.last = now(); this.sweeps = []; this.ready = 0;
  },
  params() {
    if (isXY()) {
      const s0 = chanSig(0), s1 = chanSig(1);
      return { xy: true, fx: s0 ? s0.s.f : 0, fy: s1 ? s1.s.f : 0 };
    }
    const vm = S.vmode === 'CH2' ? 1 : 0;
    const idx = S.vmode === 'CH1' || S.vmode === 'CH2' ? vm : trigChannel(-1);
    const sig = chanSig(idx);
    const f = sig ? sig.s.f : 0;
    const L = f ? clamp(10 * tdivEff() * f, 0.25, 8) : 1.5;
    const tr = (S.trigMode === 'AUTO' || S.trigMode === 'NORM') ? trigFor(-1) : null;
    let r = null;
    if (sig) { const g = gainDiv(idx); r = (S.level * 4.4 - sig.d * g) / (sig.a * g); }
    const wave = sig ? sig.s.wave : 'sine';
    return { xy: false, has: !!sig, L, tr, r, wave, slow: f && 10 * tdivEff() * f > 8, fast: f && 10 * tdivEff() * f < 0.25, norm: S.trigMode === 'NORM' };
  },
  tick(t) {
    if (!this.active || !this.cvs || !document.body.contains(this.cvs)) { this.active = false; return; }
    const dt = Math.min(0.1, t - this.last); this.last = t;
    const P = this.params(), ctx = this.ctx, W = 712, H = 640;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1410'; ctx.fillRect(0, 0, W, H);
    ctx.font = '22px "Noto Sans SC",sans-serif'; ctx.fillStyle = '#9fb5a8';
    const cap = $('#prinCap');
    if (!S.power) { ctx.fillText('先开机（POWER）', 30, 60); if (cap) cap.textContent = ''; return; }
    if (P.xy) return this.drawXY(P, dt, cap);
    // 时间单位：信号周期 = 1。一次扫描长 L，回扫 0.25L
    const L = P.L, Hd = 0.25 * L, speed = L / 2.4;
    this.tau += dt * speed;
    const tau = this.tau;
    const sigV = ph => P.has ? waveVal(P.wave, ph) : 0;
    // 安排扫描
    while (this.ready <= tau) {
      let st;
      if (P.tr && P.has) {
        const phc = P.tr.phc, ph = TWO_PI * this.ready + P.tr.phOff;
        st = this.ready + (((phc - ph) % TWO_PI + TWO_PI) % TWO_PI) / TWO_PI;
      } else if (P.norm) { st = null; } else st = this.ready;
      if (st == null) { this.ready = tau + 0.01; break; }
      this.sweeps.push(st); this.ready = st + L + Hd;
    }
    while (this.sweeps.length > 6) this.sweeps.shift();
    const win = Math.max(2.5 * (L + Hd), 2.2), t0 = tau - win;
    const X0 = 40, X1 = 690, tx = v => X0 + (v - t0) / win * (X1 - X0);
    // 图 1：Y 板电压
    const y1c = 110, y1a = 60;
    ctx.strokeStyle = '#2b3d34'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X0, y1c); ctx.lineTo(X1, y1c); ctx.stroke();
    ctx.fillStyle = '#9fb5a8'; ctx.fillText('Y 偏转板：被测信号', X0, 36);
    if (P.r != null) {
      const ly = y1c - clamp(P.r, -1.25, 1.25) * y1a;
      ctx.setLineDash([8, 6]); ctx.strokeStyle = Math.abs(P.r) < 1 ? '#ffb347' : '#ff6b5e'; ctx.beginPath(); ctx.moveTo(X0, ly); ctx.lineTo(X1, ly); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = '18px "Noto Sans SC",sans-serif';
      ctx.fillText(Math.abs(P.r) < 1 ? 'LEVEL 触发电平' : 'LEVEL 超出波形范围', X1 - 200, ly - 8);
    }
    ctx.strokeStyle = '#7ef2b5'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let k = 0; k <= 400; k++) { const v = t0 + win * k / 400; const y = y1c - sigV(TWO_PI * v) * y1a; k ? ctx.lineTo(tx(v), y) : ctx.moveTo(tx(v), y); }
    ctx.stroke();
    for (const st of this.sweeps) if (st > t0) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(tx(st), y1c - sigV(TWO_PI * st) * y1a, 6, 0, TWO_PI); ctx.fill(); }
    // 图 2：X 板锯齿波
    const y2b = 300, y2h = 90;
    ctx.font = '22px "Noto Sans SC",sans-serif'; ctx.fillStyle = '#9fb5a8'; ctx.fillText('X 偏转板：锯齿波扫描', X0, 196);
    ctx.strokeStyle = '#2b3d34'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X0, y2b); ctx.lineTo(X1, y2b); ctx.stroke();
    ctx.strokeStyle = '#8ab4ff'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let k = 0; k <= 500; k++) {
      const v = t0 + win * k / 500; let u = 0;
      for (const st of this.sweeps) if (v >= st && v <= st + L) u = (v - st) / L;
      const y = y2b - u * y2h; k ? ctx.lineTo(tx(v), y) : ctx.moveTo(tx(v), y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#ffffff55'; ctx.beginPath(); ctx.moveTo(tx(tau), 20); ctx.lineTo(tx(tau), y2b + 6); ctx.stroke();
    // 图 3：荧光屏
    const sx = 186, sy = 340, sw = 340, sh = 272;
    ctx.fillStyle = '#9fb5a8'; ctx.fillText('荧光屏', 40, 370);
    ctx.fillStyle = '#050c08'; ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#2b3d34'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(sx + i * sw / 10, sy); ctx.lineTo(sx + i * sw / 10, sy + sh); ctx.stroke(); }
    for (let j = 0; j <= 8; j++) { ctx.beginPath(); ctx.moveTo(sx, sy + j * sh / 8); ctx.lineTo(sx + sw, sy + j * sh / 8); ctx.stroke(); }
    const ys = v => sy + sh / 2 - v * sh * 0.36;
    this.sweeps.forEach((st, n) => {
      if (st > tau) return;
      const end = Math.min(tau, st + L), age = this.sweeps.length - 1 - n;
      ctx.strokeStyle = `rgba(126,242,181,${end < st + L ? 1 : Math.max(0.12, 0.7 - age * 0.15)})`; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let k = 0; k <= 160; k++) { const v = st + (end - st) * k / 160; const x = sx + (v - st) / L * sw, y = ys(sigV(TWO_PI * v)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      if (end < st + L) { ctx.fillStyle = '#e8fff2'; ctx.beginPath(); ctx.arc(sx + (end - st) / L * sw, ys(sigV(TWO_PI * end)), 6, 0, TWO_PI); ctx.fill(); }
    });
    if (cap) cap.textContent = !P.has ? '没有信号：光点只在一条水平线上来回扫。' :
      P.norm && !P.tr ? 'NORM 模式又触发不了：不扫描，屏上什么都没有。' :
      P.tr ? `已触发：每次扫描都从橙色点（信号穿过 LEVEL 的地方）开始，几次扫描画的线完全重合，所以波形稳定。${P.slow ? '扫描太慢，一屏挤了很多周期。' : P.fast ? '扫描太快，一屏不到一个周期。' : ''}` :
      '没触发：每次扫描从波形的不同位置开始，画出来的线互相错开，屏上看就是波形在跑。拧 LEVEL 让橙色虚线落到波形范围以内。';
  },
  drawXY(P, dt, cap) {
    const ctx = this.ctx;
    ctx.fillStyle = '#9fb5a8'; ctx.fillText('X-Y 模式：CH1 拉 X 方向，CH2 拉 Y 方向', 40, 40);
    if (!P.fx || !P.fy) { ctx.fillText('有一路没有信号。', 40, 80); if (cap) cap.textContent = '两路都要有信号才能合成李萨如图形。'; return; }
    const ratio = clamp(P.fy / P.fx, 0.2, 5);
    const fx = ratio >= 1 ? 1 : 1 / ratio, fy = fx * ratio;
    this.tau += dt * 0.35;
    const ph0 = TWO_PI * ((genPhase(S.B, now()) - genPhase(S.A, now())) / TWO_PI % 1);
    const cx = 356, cy = 340, R = 220;
    ctx.strokeStyle = '#2b3d34';
    ctx.strokeRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.strokeStyle = '#7ef2b5'; ctx.lineWidth = 2.5; ctx.beginPath();
    const span = 1 / Math.min(fx, fy) * (Number.isInteger(Math.round(ratio * 6) / 6) ? 1 : 1) * 3;
    const tEnd = this.tau % span;
    for (let k = 0; k <= 900; k++) {
      const v = tEnd * k / 900;
      const x = cx + R * 0.9 * Math.sin(TWO_PI * fx * v), y = cy - R * 0.9 * Math.sin(TWO_PI * fy * v + ph0);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    const v = tEnd; ctx.fillStyle = '#e8fff2'; ctx.beginPath(); ctx.arc(cx + R * 0.9 * Math.sin(TWO_PI * fx * v), cy - R * 0.9 * Math.sin(TWO_PI * fy * v + ph0), 7, 0, TWO_PI); ctx.fill();
    if (cap) cap.textContent = `光点同时被两个方向的振动拉着走。现在 fy / fx ≈ ${fnum(P.fy / P.fx, 4)}。比值是整数比时，光点走一圈回到原处，图形封闭；不是整数比，图形就一直变。`;
  },
};
E.hooks.push(t => Principle.tick(t));

/* ---------------- 记录表 ---------------- */

const REC_ROWS = [['1 kHz', '三角波'], ['1 kHz', '正弦波'], ['100 Hz', '三角波'], ['100 Hz', '正弦波']];
function renderRecords(p) {
  const R = store.get('rec', {});
  const inp = k => `<input id="r_${k}" data-k="${k}" value="${R[k] ?? ''}" inputmode="decimal" aria-label="${k}">`;
  p.innerHTML = `<div class="eyebrow">练习用</div><h3>实验数据记录表</h3>
    <p class="muted small">和报告纸上的表格一样（教材表 2-11-1 加了原始读数列）。填原始读数，绿色的格子自动算。填的数自动保存在这个浏览器里。</p>
    <details open><summary class="small" style="cursor:pointer">边看照片边填</summary><div class="pv-host" id="pvRec"></div></details>
    <h4>表 1　峰-峰值、周期、直流分量</h4>
    <div class="rec-table"><table><thead><tr><th>频率</th><th>波形</th><th>a 格</th><th>b V/格</th><th>U<sub>pp</sub> V</th><th>U V</th><th>c</th><th>d 格</th><th>e ms/格</th><th>T ms</th><th>f Hz</th><th>AC 波谷</th><th>DC 波谷</th><th>直流 mV</th></tr></thead><tbody>
    ${REC_ROWS.map((r, i) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${inp('a' + i)}</td><td>${inp('b' + i)}</td><td class="calc" id="upp${i}"></td><td class="calc" id="u${i}"></td><td>${inp('c' + i)}</td><td>${inp('d' + i)}</td><td>${inp('e' + i)}</td><td class="calc" id="T${i}"></td><td class="calc" id="f${i}"></td><td>${inp('ac' + i)}</td><td>${inp('dc' + i)}</td><td class="calc" id="dcv${i}"></td></tr>`).join('')}
    </tbody></table></div>
    <div class="row small"><label class="inp">标准方波 f（格）${inp('calf')}</label><label class="inp">g（格）${inp('calg')}</label><label class="inp">CAL 电压（V）${inp('calv')}</label></div>
    <div class="rec-table"><table><thead><tr><th>行</th><th>修正后 U<sub>pp</sub> = a/f × U<sub>CAL</sub></th><th>修正后 T = 0.001·d/(c·g)</th></tr></thead><tbody>
    ${REC_ROWS.map((r, i) => `<tr><td>${r[0]} ${r[1]}</td><td class="calc" id="cu${i}"></td><td class="calc" id="ct${i}"></td></tr>`).join('')}</tbody></table></div>
    <h4>表 2　李萨如图形测频率</h4>
    <div class="rec-table"><table><thead><tr><th>f<sub>x</sub> : f<sub>y</sub></th><th>N<sub>x</sub></th><th>N<sub>y</sub></th><th>f<sub>x</sub> Hz</th><th>f<sub>y</sub> = f<sub>x</sub>N<sub>x</sub>/N<sub>y</sub></th></tr></thead><tbody>
    ${['1 : 1', '2 : 3', '1 : 3', '', ''].map((r, i) => `<tr><td>${r || inp('lr' + i)}</td><td>${inp('nx' + i)}</td><td>${inp('ny' + i)}</td><td>${inp('fx' + i)}</td><td class="calc" id="fy${i}"></td></tr>`).join('')}
    <tr><td colspan="4">平均</td><td class="calc" id="fyavg"></td></tr></tbody></table></div>
    <h4>表 3　相位差</h4>
    <div class="rec-table"><table><thead><tr><th>a 格</th><th>b 格</th><th>φ = arcsin(a/b)</th></tr></thead><tbody><tr><td>${inp('pa')}</td><td>${inp('pb')}</td><td class="calc" id="phi"></td></tr></tbody></table></div>
    <h4>表 4　拍频法</h4>
    <div class="rec-table"><table><thead><tr><th>次</th><th>X 格</th><th>TIME/DIV ms</th><th>f₁ Hz</th><th>f₃ Hz</th><th>f₁ + f₃</th><th>f₁ − f₃</th></tr></thead><tbody>
    ${[0, 1].map(i => `<tr><td>${i + 1}</td><td>${inp('bx' + i)}</td><td>${inp('be' + i)}</td><td>${inp('bf' + i)}</td><td class="calc" id="f3${i}"></td><td class="calc" id="fp${i}"></td><td class="calc" id="fm${i}"></td></tr>`).join('')}</tbody></table></div>
    <button class="tbtn" id="recClear" type="button">清空记录表</button> <span class="small muted" id="recClearMsg"></span>`;
  const calc = () => {
    const v = k => { const x = parseFloat(R[k]); return isFinite(x) ? x : NaN; };
    const put = (id, x, n = 4) => { const e = $('#' + id); if (e) e.textContent = isFinite(x) ? fnum(x, n) : ''; };
    const cv = isFinite(v('calv')) ? v('calv') : 2;
    REC_ROWS.forEach((r, i) => {
      const upp = v('a' + i) * v('b' + i); put('upp' + i, upp);
      put('u' + i, r[1] === '正弦波' ? upp / (2 * Math.SQRT2) : NaN);
      const T = v('d' + i) * v('e' + i) / v('c' + i); put('T' + i, T); put('f' + i, 1000 / T);
      put('dcv' + i, (v('dc' + i) - v('ac' + i)) * v('b' + i) * 1000);
      put('cu' + i, v('a' + i) / v('calf') * cv); put('ct' + i, 0.001 * v('d' + i) / (v('c' + i) * v('calg')) * 1000);
    });
    const fys = [];
    for (let i = 0; i < 5; i++) { const fy = v('fx' + i) * v('nx' + i) / v('ny' + i); put('fy' + i, fy, 5); if (isFinite(fy)) fys.push(fy); }
    put('fyavg', fys.length ? fys.reduce((a, b) => a + b) / fys.length : NaN, 5);
    const phi = Math.asin(v('pa') / v('pb')) * 180 / Math.PI; const pe = $('#phi'); if (pe) pe.textContent = isFinite(phi) ? fnum(phi) + '°' : '';
    for (let i = 0; i < 2; i++) { const f3 = 1000 / (v('bx' + i) * v('be' + i)); put('f3' + i, f3); put('fp' + i, v('bf' + i) + f3, 5); put('fm' + i, v('bf' + i) - f3, 5); }
  };
  p.querySelectorAll('.rec-table input, .row input').forEach(i => i.addEventListener('input', () => { R[i.dataset.k] = i.value; store.set('rec', R); calc(); }));
  let armed = false;
  $('#recClear').onclick = () => {
    if (!armed) { armed = true; $('#recClear').textContent = '确定清空？再点一次'; $('#recClearMsg').textContent = ''; return; }
    store.set('rec', {}); renderRecords(p); $('#recClearMsg').textContent = '已清空。';
  };
  photoViewer($('#pvRec'));
  calc();
}

/* ---------------- 拍照 ---------------- */

function takePhoto() {
  const url = composeShot(2, 0.9);
  const t = now();
  const fA = S.A.freq, fB = genFreqAt(S.B, t);
  const photo = {
    t, url, xy: isXY(), when: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    label: isXY() ? 'X-Y 图形' : S.vmode + ' 波形',
    truth: { fA, fB, phase: Truth.xyPhaseDeg(t), tdiv: isXY() ? 0 : tdivNominal(), beatDiv: isXY() ? 0 : (1 / Math.abs(fA - fB)) / tdivEff() * (S.mag ? 10 : 1), conn: { ...S.conn } },
  };
  Teach.photos.push(photo);
  if (Teach.photos.length > 24) Teach.photos.shift();
  Teach.pv = Teach.photos.length - 1;
  const fl = el('div', '', $('#glass'), { position: 'absolute', inset: '0', background: '#fff', opacity: '.7', transition: 'opacity .4s', pointerEvents: 'none' });
  setTimeout(() => { fl.style.opacity = '0'; setTimeout(() => fl.remove(), 450); }, 30);
  toast('拍好了。填数的步骤里直接能看，也可以去侧栏「照片」。');
  renderTabs();
  if (Teach.tab === 'photos') renderPane();
  document.querySelectorAll('.pv-host').forEach(photoViewer);
  stepTick();
}

function composeShot(sc, quality) {
  const W = 460, Hs = 380, Hl = 70;
  const c = document.createElement('canvas'); c.width = W * sc; c.height = (Hs + Hl) * sc;
  const x = c.getContext('2d'); x.scale(sc, sc);
  const g = x.createRadialGradient(W / 2, Hs * 0.45, 20, W / 2, Hs / 2, W * 0.7); g.addColorStop(0, '#0d1c14'); g.addColorStop(1, '#07100b');
  x.fillStyle = g; x.fillRect(0, 0, W, Hs);
  try { if (E.blur > 0.05) x.filter = `blur(${E.blur}px)`; } catch (e) { /* 旧浏览器不支持就不模糊 */ }
  x.drawImage(E.cvs, 0, 0, W, Hs); x.filter = 'none';
  x.strokeStyle = 'rgba(159,181,168,.35)'; x.lineWidth = 1;
  const x0 = CX - 5 * DIV, y0 = CY - 4 * DIV;
  for (let i = 0; i <= 10; i++) { x.beginPath(); x.moveTo(x0 + i * DIV + .5, y0); x.lineTo(x0 + i * DIV + .5, y0 + 8 * DIV); x.stroke(); }
  for (let j = 0; j <= 8; j++) { x.beginPath(); x.moveTo(x0, y0 + j * DIV + .5); x.lineTo(x0 + 10 * DIV, y0 + j * DIV + .5); x.stroke(); }
  x.strokeStyle = 'rgba(159,181,168,.55)';
  for (let k = 0; k <= 50; k++) { const xx = x0 + k * DIV / 5; x.beginPath(); x.moveTo(xx, CY - 3); x.lineTo(xx, CY + 3); x.stroke(); }
  for (let k = 0; k <= 40; k++) { const yy = y0 + k * DIV / 5; x.beginPath(); x.moveTo(CX - 3, yy); x.lineTo(CX + 3, yy); x.stroke(); }
  x.fillStyle = S.power ? '#aebb98' : '#8f9881'; x.fillRect(0, Hs, W, Hl);
  x.fillStyle = '#1c2618'; x.font = '20px "Share Tech Mono",monospace';
  if (S.power) {
    x.fillText(LCD.tl.textContent + (S.mag && !isXY() ? ' x10' : ''), 16, Hs + 28); x.textAlign = 'right'; x.fillText(LCD.tr.textContent, W - 16, Hs + 28);
    x.textAlign = 'left'; x.fillText(LCD.bl.textContent, 16, Hs + 56); x.textAlign = 'right'; x.fillText(LCD.br.textContent, W - 16, Hs + 56); x.textAlign = 'left';
  }
  return c.toDataURL('image/jpeg', quality);
}
function renderPhotos(p) {
  if (!Teach.photos.length) {
    p.innerHTML = `<div class="eyebrow">照片</div><h3>还没有照片</h3><p class="muted">点页面顶上的"拍照"，大屏和 LCD 读数会拍在同一张里，和上课时要求的一样。照片可以放大，用格子量 a、b、X 这些长度。</p>`;
    return;
  }
  p.innerHTML = `<div class="eyebrow">照片 · 刷新页面就没了</div><h3>${Teach.photos.length} 张照片</h3><p class="small muted">点开放大，可以数格子。</p><div class="gallery" id="gal"></div>`;
  const gal = $('#gal');
  Teach.photos.slice().reverse().forEach(ph => {
    const f = el('figure', '', gal); f.innerHTML = `<img src="${ph.url}" alt="${ph.label}"><figcaption>${ph.when} · ${ph.label}</figcaption>`;
    f.addEventListener('click', () => openPhoto(ph));
  });
}

function openPhoto(ph) {
  const m = $('#modal');
  const tr = ph.truth || { conn: {} };
  const conn = Object.entries(tr.conn).filter(([, v]) => v).map(([k, v]) => `${k === 'EXT' ? 'TRIG IN' : k} ← ${SRC_CN[v]}`).join('，') || '没接线';
  m.innerHTML = `<div class="box"><img src="${ph.url}" alt="${ph.label}"><p class="small" style="margin:10px 0 4px">${ph.when} · ${ph.label}${ph.truth ? ' · ' + conn : ''}</p>
    <details class="small" ${ph.truth ? '' : 'hidden'}><summary style="cursor:pointer">偷看真实值（模拟器知道的）</summary><p style="margin:6px 0 0">信号源 A：${fnum(tr.fA, 6)} Hz；信号源 B：${fnum(tr.fB, 6)} Hz${tr.phase != null && ph.xy ? `；X、Y 相位差：${fnum(tr.phase)}°` : ''}${!ph.xy && isFinite(tr.beatDiv) && tr.beatDiv < 40 ? `；若是拍，一个拍长 ${fnum(tr.beatDiv, 3)} 格` : ''}</p></details>
    <div class="row" style="margin-top:12px"><button class="tbtn primary" id="mClose" type="button">关闭</button><span class="small muted">要存图：在图片上右键（手机长按）另存。</span></div></div>`;
  m.hidden = false;
  $('#mClose').onclick = () => { m.hidden = true; };
  m.onclick = e => { if (e.target === m) m.hidden = true; };
}

/* ---------------- 诊断：屏幕为什么是这样 ---------------- */

function diagnose() {
  const out = [], warn = [];
  if (!S.power) return ['电源没开：按大屏右下方的 POWER。'];
  if (warm() < 1) out.push('刚开机，示波管还在预热，等一两秒亮线才出来。');
  if (S.inten < 0.12) out.push('INTEN（亮度）太低，几乎看不见。往右拧。');
  if (Math.abs(S.focus - FOCUS_BEST) > 0.08) warn.push('线发虚：FOCUS 没调好，拧到线最细。');
  if (S.inten > 0.85) warn.push('亮度太高，线会发毛；光点停在一处久了会烧屏。');
  if (Math.abs(S.rot) > 0.05) warn.push('扫描线是歪的：TRACE ROTATION（一字螺丝孔）转平它。');
  if (isXY()) {
    out.push('现在是 X-Y 模式（TIME/DIV 逆时针拧到头了）：不扫描，CH1 管 X、CH2 管 Y。想看普通波形就把 TIME/DIV 往右拧一格以上。');
    const s0 = chanSig(0), s1 = chanSig(1);
    if (!s0 && !s1) out.push('两路都没有信号，屏上只有一个光点。光点停在一处不要太亮，会烧屏。');
    else if (!s0 || !s1) out.push(`${!s0 ? 'CH1' : 'CH2'} 没有信号，所以只是一条${!s0 ? '竖' : '横'}线。`);
    else if (Math.abs(S.ch[1].pos * VPOS_RANGE) > 4 || Math.abs(S.hpos * HPOS_RANGE) > 4) out.push('图形被位移旋钮挪出屏幕了：X 方向用水平 POSITION，Y 方向用 CH2 POSITION。');
    return out.concat(warn);
  }
  const shown = { CH1: [0], CH2: [1], DUAL: [0, 1], ADD: [0, 1] }[S.vmode];
  for (const i of shown) {
    const n = 'CH' + (i + 1), src = S.conn[n], c = S.ch[i];
    if (!src) out.push(`${n} 没接信号，所以只有一条直线。点 ${n} 插座选择接哪根线。`);
    else if (src === 'A' && !S.A.on) out.push(`${n} 接的是信号源 A，但 A 的 OUTPUT 没开（灯不亮）。`);
    else if (c.cpl === 'GND') out.push(`${n} 的耦合在 GND：信号被隔开了，只显示 0 V 那条线。`);
    else if (S.vmode !== 'ADD') {
      const pp = Truth.ppDiv(i);
      if (pp < 0.3) out.push(`${n} 的波形太小（不到 0.3 格）：顺时针拧 ${n} 的 VOLTS/DIV。`);
      else if (pp > 8.5) out.push(`${n} 的波形比屏幕还高（${fnum(pp, 2)} 格）：逆时针拧 ${n} 的 VOLTS/DIV。`);
    }
    if (S.vmode !== 'ADD') {
      const lo = Truth.troughDiv(i), hi = Truth.peakDiv(i);
      if (lo > 4.6 || hi < -4.6) out.push(`${n} 的波形跑到屏幕${lo > 4.6 ? '上' : '下'}面去了：拧 ${n} 的 POSITION。`);
    }
    if (c.vvar < 1) warn.push(`${n} 的 VAR 不在 CAL：波形高度和 LCD 读数对不上，测量前顺时针拧到头。`);
  }
  if (Math.abs(S.hpos * HPOS_RANGE) > 4.5) out.push('水平 POSITION 拧得太偏，波形被挪出屏幕了。');
  const anySig = shown.some(i => chanSig(i));
  if (S.trigMode === 'NORM' && !trigFor(-1)) out.push('触发模式在 NORM，而且现在触发不了，所以根本不扫描，屏上什么都没有。拨到 AUTO。');
  else if (S.trigMode === 'TV-V' || S.trigMode === 'TV-H') out.push('触发模式在 TV-V/TV-H（看电视信号用的），普通信号锁不住。拨到 AUTO。');
  else if (anySig && !isTriggered()) {
    const idx = trigChannel(-1), ts = chanSig(idx);
    if (S.source === 'LINE') out.push('SOURCE 在 LINE：按 50 Hz 电源触发，和你的信号没关系，波形会跑。拨到 CH1。');
    else if (S.source === 'EXT' && !S.conn.EXT) out.push('SOURCE 在 EXT，可 TRIG IN 没接东西，触发不了。拨到 CH1。');
    else if (!ts) out.push(`触发用的是 CH${idx + 1}，可它没有信号。SOURCE 拨到有信号的那一路。`);
    else if (ts.a * gainDiv(idx) < 0.2) out.push('触发用的那一路信号太小，触发不了：把它的 VOLTS/DIV 调灵敏一些。');
    else if (1 / ts.s.f > AUTO_TO) out.push('信号频率太低（低于约 25 Hz），AUTO 模式会自己扫描，波形不稳。可以改用 NORM 看低频信号。');
    else out.push('波形没触发住，在左右跑：LEVEL 超出了波形的上下范围。拧 LEVEL 让它停住（先用 TIME/DIV 让屏上有两三个周期）。');
  }
  if (anySig && S.vmode !== 'ADD') {
    const i = shown.find(j => chanSig(j));
    const cyc = Truth.cycles(i);
    if (cyc > 25) out.push(`扫描太慢：一屏挤了约 ${Math.round(cyc)} 个周期，连成一片。顺时针拧 TIME/DIV。`);
    else if (cyc > 0 && cyc < 0.6) out.push('扫描太快：一屏还不到一个周期。逆时针拧 TIME/DIV。');
  }
  if (S.vmode === 'DUAL' && !S.chop && tdivEff() >= 5e-3) warn.push('扫描慢的时候 ALT 方式会让两条线轮流闪：按下 ALT/CHOP 改成 CHOP。');
  if (S.swpvar < 1) warn.push('SWP.VAR 不在 CAL：横向读数不准，测周期前顺时针拧到头。');
  if (S.mag) warn.push('×10 MAG 按下了：1 格代表的时间是 LCD 读数的 1/10。');
  if (S.inv && S.vmode !== 'CH1') warn.push('CH2 INV 按下了：CH2 上下颠倒，ADD 时显示的是 CH1 − CH2。');
  if (!out.length && !warn.length) return ['看起来一切正常。'];
  return out.concat(warn);
}

function renderDiag(p) {
  p.innerHTML = `<div class="eyebrow">诊断</div><h3>屏幕为什么是这样？</h3><ul class="diag" id="diagList"></ul>
    <p class="small muted">这个列表跟着面板实时更新。看完点上面的标签回去。</p>`;
  const upd = () => { const l = $('#diagList'); if (!l) return false; l.innerHTML = diagnose().map(s => `<li>${s}</li>`).join(''); return true; };
  upd();
  const iv = setInterval(() => { if (Teach.tab !== 'diag' || !upd()) clearInterval(iv); }, 400);
}


/* ---------------- 记录：标记不会的地方，之后导出 ---------------- */

const NOTE_TAGS = { no: '这一步不会', q: '有疑问', x: '仪器表现奇怪', o: '其他', f: '操作失误（自动记录）' };
const pct = v => Math.round(v * 100) + '%';
const sgnF = (v, n = 2) => (v >= 0 ? '+' : '') + v.toFixed(n);
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

function panelLines() {
  const ch = i => {
    const c = S.ch[i], n = 'CH' + (i + 1), src = S.conn[n];
    return `${n}：${src ? '接 ' + SRC_CN[src] : '没接线'}；耦合 ${c.cpl}；VOLTS/DIV ${fmtVolt(VDIV[c.vi])}（VAR ${c.vvar >= 1 ? 'CAL' : '未校准 ' + pct(c.vvar)}）；位移 ${sgnF(c.pos * VPOS_RANGE)} 格`;
  };
  const t = now();
  const L = [
    `电源：${S.power ? '开' : '关'}；INTEN ${pct(S.inten)}；FOCUS ${pct(S.focus)}（最清楚在 ${pct(FOCUS_BEST)}）`,
    `TIME/DIV：${isXY() ? 'X-Y 模式' : fmtTime(tdivNominal())}（SWP.VAR ${S.swpvar >= 1 ? 'CAL' : '未校准 ' + pct(S.swpvar)}）；×10 MAG ${S.mag ? '按下' : '弹起'}；水平位移 ${sgnF(S.hpos * HPOS_RANGE)} 格`,
    `触发：MODE ${S.trigMode}，SOURCE ${S.source}，LEVEL ${sgnF(S.level * 4.4)} 格，SLOPE ${S.slope}；现在${isTriggered() ? '已触发（波形稳）' : '没触发'}`,
    `垂直 MODE：${S.vmode}；ALT/CHOP：${S.chop ? 'CHOP' : 'ALT'}；CH2 INV：${S.inv ? '按下' : '弹起'}`,
    ch(0), ch(1),
    `信号源 A：${WAVE_CN[S.A.wave]}波 ${S.A.freq.toFixed(2)} Hz，${S.A.amp.toFixed(2)} Vpp，偏置 ${sgnF(S.A.offset)} V，输出${S.A.on ? '开' : '关'}`,
    `信号源 B：${WAVE_CN[S.B.wave]}波，真实频率 ${fnum(genFreqAt(S.B, t), 6)} Hz，${S.B.amp.toFixed(2)} Vpp`,
  ];
  if (S.power && !isXY()) for (const i of [0, 1]) if (chanSig(i)) L.push(`屏幕上 CH${i + 1}：峰-峰 ${fnum(Truth.ppDiv(i), 3)} 格，一个周期 ${fnum(Truth.periodDiv(i), 3)} 格，波谷在 ${fnum(Truth.troughDiv(i), 3)} 格`);
  return L;
}

function snapshot() {
  const s = { time: new Date().toLocaleString('zh-CN', { hour12: false }), mode: Teach.mode === 'teach' ? '教学模式' : '仿真模式' };
  if (Teach.mode === 'teach' && Teach.lesson != null) {
    const L = LESSONS[Teach.lesson], st = curStep();
    s.where = `第 ${Teach.lesson} 课「${L.title}」第 ${Teach.step + 1}/${L.steps.length} 步`;
    s.step = strip(st.do);
    s.stepDone = !!Teach.done[Teach.step];
    if (st.form) {
      const f = Teach.forms[L.id + ':' + Teach.step];
      s.form = st.form.map(([k, lab]) => `${strip(lab)} = ${(f && f.raw && f.raw[k]) || '（没填）'}`).join('；');
      if (f && f.res) s.formRes = (f.res.ok ? '核对通过：' : '核对没通过：') + strip(f.res.html);
    }
  } else s.where = Teach.mode === 'teach' ? '没在课程里（' + (Teach.tab || '') + ' 页）' : '仿真模式自由操作';
  s.panel = panelLines();
  s.diag = diagnose();
  return s;
}

function openNote() {
  const snap = snapshot();
  const img = composeShot(1, 0.72);
  const m = $('#modal');
  const preview = [snap.where, snap.step ? '这一步要做：' + snap.step : ''].filter(Boolean).join('\n');
  m.innerHTML = `<div class="box note-form" style="width:min(560px,100%)"><h3 style="margin:0 0 6px">记录这一刻</h3>
    <p class="small muted" style="margin:0 0 8px">现在的面板、信号、屏幕截图和所在步骤已经抓下来了。选一下是什么情况，想写就写一句。</p>
    <div>${Object.entries(NOTE_TAGS).filter(([k]) => k !== 'f').map(([k, v], i) => `<label class="tag"><input type="radio" name="ntag" value="${k}" ${i === 0 ? 'checked' : ''}>${v}</label>`).join('')}</div>
    <textarea id="noteTxt" placeholder="哪里不会、卡在哪、想问什么（可以不写）"></textarea>
    <pre>${preview}</pre>
    <img src="${img}" alt="当前屏幕" style="max-width:240px;border-radius:6px">
    <div class="row" style="margin-top:12px"><button class="tbtn primary" id="noteSave" type="button">保存记录</button><button class="tbtn" id="noteCancel" type="button">取消</button><span class="small muted" id="noteMsg"></span></div></div>`;
  m.hidden = false;
  setTimeout(() => $('#noteTxt').focus(), 30);
  $('#noteCancel').onclick = () => { m.hidden = true; };
  m.onclick = e => { if (e.target === m) m.hidden = true; };
  $('#noteSave').onclick = () => {
    const tag = (m.querySelector('input[name=ntag]:checked') || {}).value || 'no';
    Teach.notes.push({ id: Date.now(), tag, note: $('#noteTxt').value.trim(), snap, img, lid: Teach.mode === 'teach' && Teach.lesson != null ? LESSONS[Teach.lesson].id : null });
    saveNotes();
    m.hidden = true;
    renderTabs(); if (Teach.tab === 'notes') renderPane();
    toast('记下了。侧栏「我的记录」里能看、能导出。');
  };
}

function saveNotes() {
  for (;;) {
    try { localStorage.setItem('osc-sim-notes', JSON.stringify(Teach.notes)); return; }
    catch (e) {
      const withImg = Teach.notes.find(n => n.img);
      if (!withImg) return;          // 浏览器不让存，只能留在这次打开的页面里
      withImg.img = null;            // 空间满了：先丢最早一条的截图，文字保留
    }
  }
}

function noteText(n, i) {
  const s = n.snap;
  return [
    `## ${i + 1}. ${NOTE_TAGS[n.tag]} · ${s.time}`,
    `- 位置：${s.mode} · ${s.where}`,
    s.step ? `- 这一步要做：${s.step}${s.stepDone ? '（当时已经做到了）' : '（当时还没做到）'}` : '',
    n.tag === 'f' ? `- 系统判定：${n.note}` : n.note ? `- 我的话：${n.note}` : '- 我的话：（没写）',
    s.form ? `- 填的数：${s.form}` : '',
    s.formRes ? `- ${s.formRes}` : '',
    `- 面板状态：`, ...s.panel.map(l => `  - ${l}`),
    `- 屏幕诊断：`, ...s.diag.map(l => `  - ${l}`),
  ].filter(Boolean).join('\n');
}
// 导出给别的 AI 看的学习记录：只用文字，面板状态写成数字，AI 能据此还原当时屏幕上的样子
function notesMarkdown() {
  const now_ = new Date().toLocaleString('zh-CN', { hour12: false });
  const L = [];
  L.push('# 示波器学习记录（交给 AI 老师）', '');
  L.push('> **给 AI 的说明**：下面是一名大一学生在「GOS-630FC 示波器模拟台」上练习时导出的记录。这是一个网页模拟器，照固纬 GOS-630FC 双踪示波器和《大学物理实验教程》实验十一「示波器原理及使用」复刻，配两台信号源（A 频率已知，B 当作待测信号）。学生是零基础，正在为示波器实验课做准备。');
  L.push('> 请你：① 先看「失误与疑问」，找出学生没掌握的概念或操作；② 用通俗的话讲清原理和正确做法，讲"为什么"；③ 必要时出一两道小题，确认学生真懂了；④ 记录里的面板状态都是当时的真实设置，可以据此判断学生屏幕上看到的是什么、错在哪。');
  L.push('>', '> **读数约定**：屏幕横 10 格、竖 8 格（1 格 = 1 div，中线上 1 小格 = 0.2 格）。"位移"是把波形挪了多少格。模拟器故意让垂直增益偏大约 2.8%、扫描偏慢约 2%（模拟仪器误差，所以实验要用标准方波修正），按格子算出的结果和信号源真实值差 2～3% 是正常的。CAL 标准方波按 1 kHz、2 Vp-p 模拟（教材第 98 页；第 99 页写的是 1 V）。截图没有导出，面板状态已经用文字写全。', '');
  L.push(`导出时间：${now_}`, '');
  // 一、进度
  L.push('## 一、学习进度', '', '| 课 | 内容 | 状态 | 失误次数 | 记录条数 |', '|---|---|---|---|---|');
  LESSONS.forEach((les, i) => {
    const cnt = Teach.notes.filter(n => n.lid === les.id).length;
    L.push(`| ${i} | ${les.title}（${les.sub}） | ${Teach.finished[les.id] ? '完成' : '没完成'} | ${Teach.fails[les.id] || 0} | ${cnt} |`);
  });
  L.push('');
  // 二、失误与疑问
  L.push(`## 二、失误与疑问（${Teach.notes.length} 条，按时间先后）`, '');
  if (Teach.notes.length) L.push(Teach.notes.map(noteText).join('\n\n').replace(/^## /gm, '### ')); else L.push('（没有记录）');
  L.push('');
  // 三、课程里填过的读数
  L.push('## 三、课程里填过的读数', '');
  let any = false;
  LESSONS.forEach((les, i) => les.steps.forEach((st, k) => {
    const f = Teach.forms[les.id + ':' + k]; if (!st.form || !f || !f.raw) return;
    const vals = st.form.map(([key, lab]) => `${strip(lab)} = ${f.raw[key] || '（空）'}`).join('，');
    if (!Object.values(f.raw).some(v => v)) return;
    any = true;
    L.push(`- 第 ${i} 课「${les.title}」第 ${k + 1} 步：${strip(st.do).slice(0, 60)}…`, `  - 填的数：${vals}`, `  - ${f.res ? (f.res.ok ? '核对通过：' : '核对没通过：') + strip(f.res.html) : '还没点"核对"'}`);
  }));
  if (!any) L.push('（没有填过）');
  L.push('');
  // 四、记录表
  const R = store.get('rec', {}), has = k => R[k] != null && R[k] !== '';
  L.push('## 四、记录表里的数据', '');
  const rows = [];
  REC_ROWS.forEach((r, i) => {
    const ks = ['a', 'b', 'c', 'd', 'e', 'ac', 'dc'].map(x => x + i).filter(has);
    if (ks.length) rows.push(`- 表 1 ${r[0]} ${r[1]}：` + ks.map(k => `${k.replace(/\d$/, '')}=${R[k]}`).join('，'));
  });
  if (['calf', 'calg', 'calv'].some(has)) rows.push(`- 标准方波：f=${R.calf || '空'} 格，g=${R.calg || '空'} 格，CAL 电压=${R.calv || '按 2 V'}`);
  for (let i = 0; i < 5; i++) if (['nx', 'ny', 'fx'].some(x => has(x + i))) rows.push(`- 表 2 第 ${i + 1} 行（${['1:1', '2:3', '1:3', R['lr3'] || '自选', R['lr4'] || '自选'][i]}）：Nx=${R['nx' + i] || '空'}，Ny=${R['ny' + i] || '空'}，fx=${R['fx' + i] || '空'} Hz`);
  if (has('pa') || has('pb')) rows.push(`- 表 3 相位差：a=${R.pa || '空'} 格，b=${R.pb || '空'} 格`);
  for (let i = 0; i < 2; i++) if (['bx', 'be', 'bf'].some(x => has(x + i))) rows.push(`- 表 4 第 ${i + 1} 次：X=${R['bx' + i] || '空'} 格，TIME/DIV=${R['be' + i] || '空'} ms，f₁=${R['bf' + i] || '空'} Hz`);
  L.push(rows.length ? rows.join('\n') : '（没有填过）', '');
  // 五、课程内容速查
  L.push('## 五、模拟器里的课程和"禁区"（给 AI 参考）', '');
  LESSONS.forEach((les, i) => {
    L.push(`- 第 ${i} 课 ${les.title}：${les.steps.length} 步。` + ((les.guards || []).length ? '禁止动：' + les.guards.map(g => `${g.from === g.to ? `第 ${g.from + 1} 步` : `第 ${g.from + 1}～${g.to + 1} 步`}不能动 ${g.label}`).join('；') + '。' : ''));
  });
  return L.join('\n');
}

function renderNotes(p) {
  const n = Teach.notes;
  p.innerHTML = `<div class="eyebrow">我的记录</div><h3>${n.length ? `${n.length} 条记录` : '还没有记录'}</h3>
    <p class="small muted">教学模式里每一步下面有红色的「有疑问：记录一下」，仿真模式按顶上的「记录」。每条会带上当时的面板状态和屏幕截图。导出的文字可以直接发给 Claude，让它看你卡在哪。</p>
    <div class="row" style="margin-bottom:6px"><button class="tbtn primary" id="nCopy" type="button">复制学习记录（给 AI）</button><button class="tbtn" id="nDown" type="button">下载 Markdown 文件</button>${n.length ? '<button class="tbtn" id="nClear" type="button">清空记录</button>' : ''}</div>
    <p class="small muted" style="margin:0 0 10px">导出的是一份给别的 AI 看的"交接单"：学习进度、每次失误和疑问、当时的面板状态和读数、你填过的数据。粘贴给任何 AI，它就知道你卡在哪，可以接着教你。不带图片，面板状态都写成了文字。</p><div id="nExport"></div>
    <div id="nList"></div>`;
  p.insertAdjacentHTML('beforeend', `<h4 style="margin-top:22px">备份和恢复</h4>
    <p class="small muted">所有数据（填的数、记录表、我的记录、课程进度）只存在这个浏览器里。备份会下载一个文件，换电脑、换浏览器或清了浏览器数据后，用它恢复。</p>
    <div class="row"><button class="tbtn" id="bkSave" type="button">备份全部数据</button><label class="tbtn" for="bkFile" style="cursor:pointer">从备份恢复</label><input type="file" id="bkFile" accept=".json,application/json" hidden></div><div id="bkMsg" class="small" style="margin-top:6px"></div>`);
  $('#bkSave').onclick = backupData;
  $('#bkFile').onchange = e => { const f = e.target.files[0]; if (f) restoreData(f); };
  const list = $('#nList');
  n.slice().reverse().forEach(item => {
    const i = n.indexOf(item), s = item.snap;
    const c = el('div', 'note-card', list);
    c.innerHTML = `<div class="head"><span class="pill tag-${item.tag === 'no' || item.tag === 'f' ? 'no' : item.tag === 'q' ? 'q' : 'x'}">${NOTE_TAGS[item.tag]}</span><span>${s.time}</span><span>${s.where}</span></div>
      <div class="txt">${item.note ? item.note.replace(/</g, '&lt;') : '<span class="muted">（没写说明）</span>'}</div>
      ${s.step ? `<div class="small muted">这一步：${s.step}</div>` : ''}
      <details class="small"><summary style="cursor:pointer;margin-top:6px">当时的面板和屏幕</summary><pre>${s.panel.concat(['—— 诊断 ——'], s.diag).join('\n')}</pre>${item.img ? `<img src="${item.img}" alt="当时的屏幕">` : ''}</details>
      <div class="row" style="margin-top:6px"><button class="tbtn" type="button" data-del>删除这条</button></div>`;
    const im = c.querySelector('img'); if (im) im.onclick = () => openPhoto({ url: item.img, label: '记录时的屏幕', when: s.time, xy: false, truth: null });
    const del = c.querySelector('[data-del]');
    del.onclick = () => {
      if (del.dataset.arm) { Teach.notes.splice(i, 1); saveNotes(); renderTabs(); renderPane(); }
      else { del.dataset.arm = 1; del.textContent = '确定删除？再点一次'; }
    };
  });
  const showText = () => { $('#nExport').innerHTML = '<div class="export-box"><p class="small muted">复制不了的话，全选下面的文字自己复制：</p><textarea readonly></textarea></div>'; const ta = $('#nExport textarea'); ta.value = notesMarkdown(); ta.focus(); ta.select(); };
  $('#nCopy').onclick = () => {
    const txt = notesMarkdown();
    try { navigator.clipboard.writeText(txt).then(() => toast('已复制，可以直接粘贴给 AI。'), showText); } catch (e) { showText(); }
  };
  $('#nDown').onclick = () => {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([notesMarkdown()], { type: 'text/markdown' }));
      a.download = '示波器-学习记录-' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.md';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(showText, 400);
    } catch (e) { showText(); }
  };
  const clr = $('#nClear');
  if (clr) clr.onclick = () => {
    if (clr.dataset.arm) { Teach.notes = []; saveNotes(); renderTabs(); renderPane(); }
    else { clr.dataset.arm = 1; clr.textContent = '确定清空全部？再点一次'; }
  };
}


/* ---------------- 撤回：记下每一次操作前的面板 ---------------- */

const SNAP_KEYS = ['power', 'inten', 'focus', 'rot', 'hpos', 'swpvar', 'mag', 'tpos', 'trigAlt', 'trigMode', 'source', 'level', 'slope', 'vmode', 'chop', 'inv'];
function snapState() {
  const o = {};
  for (const k of SNAP_KEYS) o[k] = S[k];
  o.ch = S.ch.map(c => ({ ...c }));
  o.conn = { ...S.conn };
  o.A = { wave: S.A.wave, freq: S.A.freq, amp: S.A.amp, offset: S.A.offset, on: S.A.on, cur: S.A.cur };
  o.B = { wave: S.B.wave, range: S.B.range, coarse: S.B.coarse, fine: S.B.fine, amp: S.B.amp };
  return JSON.stringify(o);
}
function applyState(str) {
  const o = JSON.parse(str), wasOn = S.power;
  for (const k of SNAP_KEYS) S[k] = o[k];
  if (S.power && !wasOn) { S.powerT = now(); LCD.testUntil = now() + 0.7; }
  S.ch = o.ch.map(c => ({ ...c }));
  S.conn = { ...o.conn };
  const f = o.A.freq; delete o.A.freq;
  Object.assign(S.A, o.A, { entry: '' }); setAFreq(f);
  Object.assign(S.B, o.B); updateBFreq();
}

const Hist = { cur: null, undo: [], redo: [], timer: 0 };
function histReset() { clearTimeout(Hist.timer); Hist.cur = snapState(); Hist.undo = []; Hist.redo = []; updUndo(); }
function histTouch() { clearTimeout(Hist.timer); Hist.timer = setTimeout(histCommit, 350); }
function histCommit() {
  clearTimeout(Hist.timer);
  if (document.body.classList.contains('knob-drag')) { Hist.timer = setTimeout(histCommit, 200); return; }   // 一次拖动只算一步
  const s = snapState(); if (s === Hist.cur) return;
  Hist.undo.push(Hist.cur); if (Hist.undo.length > 150) Hist.undo.shift();
  Hist.redo = []; Hist.cur = s; updUndo();
}
function histUndo() {
  histCommit();
  const prev = Hist.undo.pop();
  if (!prev) { toast('没有可以撤回的操作了。'); return; }
  Hist.redo.push(Hist.cur); Hist.cur = prev;
  applyState(prev); changed('undo'); updUndo();
  toast(`撤回了一步（还能撤回 ${Hist.undo.length} 步）。`);
}
function histRedo() {
  histCommit();
  const nxt = Hist.redo.pop(); if (!nxt) return;
  Hist.undo.push(Hist.cur); Hist.cur = nxt;
  applyState(nxt); changed('undo'); updUndo();
}
function updUndo() { const b = $('#btnUndo'); if (b) b.disabled = !Hist.undo.length && Hist.cur === snapState(); }

/* ---------------- 每一步的起点、禁区 ---------------- */

function enterStep(k) {
  histCommit();
  Teach.stepSnap[k] = snapState();
  refreshGuardBase();
}
function activeGuards(k) {
  if (Teach.lesson == null) return [];
  return (LESSONS[Teach.lesson].guards || []).filter(g => k >= g.from && k <= g.to);
}
// 禁区的基准：进入它生效的第一步时的面板；离开范围就作废
function refreshGuardBase() {
  if (Teach.lesson == null) return;
  const k = Teach.step;
  for (const g of LESSONS[Teach.lesson].guards || []) {
    if (k < g.from || k > g.to) { delete Teach.gbase[g.id]; continue; }
    if (k === g.from || !Teach.gbase[g.id]) Teach.gbase[g.id] = Teach.stepSnap[g.from] || snapState();
  }
}
function guardCheck() {
  if (Teach.mode !== 'teach' || Teach.lesson == null || Teach.fail) return false;
  for (const g of activeGuards(Teach.step)) {
    const base = Teach.gbase[g.id]; if (!base) continue;
    const what = g.test(JSON.parse(base));
    if (what) { failStep(g, what); return true; }
  }
  return false;
}
function failStep(g, what) {
  const L = LESSONS[Teach.lesson];
  Teach.fail = { what, why: g.why, back: g.back, before: Hist.cur, step: Teach.step };
  Teach.fails[L.id] = (Teach.fails[L.id] || 0) + 1; store.set('fails', Teach.fails);
  try { if (typeof Snd !== 'undefined') { Snd.play('plug'); setTimeout(() => Snd.play('plug'), 120); } } catch (e) { /* 没声音就算了 */ }
  toast(`失误：${what}。这一步失败了。`, true);
  const snap = snapshot();
  Teach.notes.push({ id: Date.now(), tag: 'f', note: `${what}。${g.why}`, snap, img: composeShot(1, 0.72), lid: L.id });
  saveNotes(); renderTabs();
  highlight(g.ids || []);
  if (Teach.tab === 'lessons') renderPane();
  else { Teach.tab = 'lessons'; renderTabs(); renderPane(); }
}
// 回到第 k 步开始时：面板恢复、那之后填的数和完成标记作废
function restartAt(k, msg) {
  const L = LESSONS[Teach.lesson];
  Teach.fail = null;
  for (const g of L.guards || []) delete Teach.gbase[g.id];
  const snap = Teach.stepSnap[k];
  if (snap) { applyState(snap); changed('undo'); }
  for (let j = k; j < L.steps.length; j++) { Teach.done[j] = false; delete Teach.forms[L.id + ':' + j]; delete Teach.formMsg[j]; }
  store.set('forms', Teach.forms);
  histReset();
  Teach.step = k; Teach.f = { t0: now() };
  refreshGuardBase();
  renderPane();
  toast(msg);
}


/* ---------------- 备份和恢复：把浏览器里存的东西导成一个文件 ---------------- */

function backupData() {
  const data = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('osc-sim-')) data[k] = localStorage.getItem(k); } }
  catch (e) { $('#bkMsg').textContent = '这个浏览器不让读存储，备份不了。'; return; }
  const blob = new Blob([JSON.stringify({ app: 'physlab-oscilloscope', saved: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '示波器模拟台-备份-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  $('#bkMsg').textContent = '备份文件已下载，存好它。';
}
function restoreData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (o.app !== 'physlab-oscilloscope' || !o.data) throw new Error('不是这个模拟台的备份文件');
      for (const k in o.data) if (k.startsWith('osc-sim-')) localStorage.setItem(k, o.data[k]);
      $('#bkMsg').textContent = '恢复好了，马上刷新页面…';
      setTimeout(() => location.reload(), 800);
    } catch (e) { $('#bkMsg').textContent = '恢复失败：' + e.message + '。'; }
  };
  r.readAsText(file);
}

/* ---------------- 说明书：这个网页怎么用（不是示波器怎么用） ---------------- */

const HELP = `
<p>这是一个网页版的示波器实验台：一台照固纬 GOS-630FC 面板做的双踪示波器，加两台信号源，内容按《大学物理实验教程》实验十一「示波器原理及使用」排。用来课前练手，不是官方软件；有出入的地方以教材和老师为准。</p>
<div class="help-toc"><a href="#h-layout">页面布局</a><a href="#h-mode">两种模式</a><a href="#h-op">怎么操作仪器</a><a href="#h-teach">教学模式怎么走</a><a href="#h-undo">撤回</a><a href="#h-photo">拍照和读数</a><a href="#h-side">侧栏各页</a><a href="#h-export">导出学习记录</a><a href="#h-data">数据存在哪</a></div>

<h4 id="h-layout">页面布局</h4>
<ul>
<li><b>左边是实验台</b>：上面是示波器，下面两台信号源。<b>信号源 A</b> 频率能直接读，当"已知信号"；<b>信号源 B</b> 的读数被遮住，当"待测信号"。</li>
<li><b>右边是侧栏</b>：课程、原理、思考题、记录表、照片、我的记录，点上面的标签切换。窄屏时侧栏在实验台下面。</li>
<li><b>顶栏按钮</b>：<span class="k">教学模式 / 仿真模式</span> 切模式；<span class="k">视角</span> 在 立体 → 正面 → 2D 之间切换（只换外观，数据不受影响）；<span class="k">声音</span> 开关按键声；<span class="k">屏幕为什么是这样？</span> 帮你诊断屏幕现象；<span class="k">撤回</span>；<span class="k">拍照</span>；仿真模式下还有 <span class="k">记录</span>。</li>
</ul>

<h4 id="h-mode">两种模式</h4>
<ul>
<li><b>教学模式</b>：按教材"实验内容"的顺序分成 10 课，一步步告诉你拧哪个、为什么。新手从这里开始，第 0 课是认识面板。</li>
<li><b>仿真模式</b>：没有提示，和上课一样自己做。<span class="k">打乱面板</span> 模拟上一组同学没复位；<span class="k">换一个待测信号 B</span> 换个新的未知频率。</li>
</ul>

<h4 id="h-op">怎么操作仪器</h4>
<ul>
<li><b>旋钮</b>：<b>按住</b>后往右（或往上）拖是顺时针，往左（或往下）是逆时针，松开就停。档位旋钮（TIME/DIV、VOLTS/DIV）一格一格地走。按住 <kbd>Shift</kbd> 拖是微调。点一下旋钮再按方向键也能拧。鼠标只是停在上面不会动它。</li>
<li><b>拨动开关</b>（TRIGGER MODE、SOURCE、垂直 MODE、AC-GND-DC）：按住拨杆上下拖，或点旁边的字直接选，或点一下拨杆往下切一档。</li>
<li><b>按键</b>（POWER、×10 MAG、SLOPE、CH2 INV 等）：点一下按下，再点弹起。</li>
<li><b>接线</b>：点示波器的 CH1 / CH2 插座，或点信号源的 OUTPUT 插座，在弹出的菜单里选接到哪。CAL 端子也一样。</li>
<li><b>信号源 A</b>：按数字再按 <span class="k">Hz</span> 或 <span class="k">kHz</span> 设频率；<span class="k">◀ ▶</span> 选调节位（显示屏上带下划线的那一位），拧 FREQUENCY 连续调；记得按 <span class="k">OUTPUT ON</span>，灯亮才有输出。</li>
<li><b>信号源 B</b>：选频段，拧粗调、细调。点它的显示屏可以揭开看真实频率（对答案用）。</li>
<li><b>不认识的部件</b>：鼠标停在上面（平板上按住它），会显示名字和当前读数；教学模式下还会解释它是干什么的。</li>
<li><b>平板</b>：用手指操作，和鼠标一样：按住旋钮拖、按住拨杆拖、点按键和插座。建议横屏用，教学卡片会在右边。</li>
</ul>

<h4 id="h-teach">教学模式怎么走</h4>
<ul>
<li>右边卡片写着这一步要做什么。做对了状态会自动变绿，下面出现"为什么"。</li>
<li>需要读数的步骤：在框里填数，点 <span class="k">核对</span>。框上方直接显示你拍的照片，可以 ‹ › 翻、点开放大，不用切页面。填的数会自动保存。</li>
<li>按钮：<span class="k">上一步</span>；<span class="k">帮我做这一步</span>（读数步骤里是 <span class="k">帮我填（看答案）</span>）；红色的 <span class="k">有疑问：记录一下</span>；<span class="k">重做这一步</span> 把面板恢复到这一步刚开始的样子；<span class="k">下一步</span>（没做完时显示 <span class="k">跳过</span>）。</li>
<li><b>禁区</b>：有些步骤会用橙色写"这一步别动：……"，都是教材叮嘱过不能动的。动了这一步就判失败，卡片变红，并给两个选择：<span class="k">从第 N 步重新做</span>（和真实实验一样回去重来），或 <span class="k">撤回这一下，接着练</span>（现实里没有这个按钮）。失误会自动写进"我的记录"。</li>
<li>点 <span class="k">← 课程</span> 回到课程列表，列表顶上有 <span class="k">继续</span>，可以回到刚才那一步。重新点开一课会把面板摆到这一课的起始状态。</li>
</ul>

<h4 id="h-undo">撤回</h4>
<ul><li>顶栏 <span class="k">撤回</span>，或按 <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd>；重做按 <kbd>⌘⇧Z</kbd> / <kbd>Ctrl+Shift+Z</kbd>。拖一次旋钮算一步，最多撤回 150 步。</li></ul>

<h4 id="h-photo">拍照和读数</h4>
<ul><li><span class="k">拍照</span> 会把大屏和 LCD 读数拍在同一张里，和上课要求一样。照片在侧栏"照片"页，点开放大后数格子。照片只在这次打开的页面里，刷新就没了。</li></ul>

<h4 id="h-side">侧栏各页</h4>
<ul>
<li><b>课程 / 实验任务</b>：教学模式是 10 课；仿真模式是任务清单。</li>
<li><b>原理</b>：慢动作动画演示扫描、触发、李萨如图形，跟着面板实时变；下面是文字讲解和公式。</li>
<li><b>思考题</b>：教材第 92 页预习思考题和第 100 页课后思考题，点开看答案。</li>
<li><b>记录表</b>：和报告纸上的表格一样，填原始读数，自动算出峰峰值、周期、频率、直流分量等。</li>
<li><b>照片</b>：拍过的照片。</li>
<li><b>我的记录</b>：你标记的疑问和自动记下的失误，每条带当时的面板状态和截图。</li>
</ul>

<h4 id="h-export">导出学习记录</h4>
<ul><li>在"我的记录"页点 <span class="k">复制学习记录（给 AI）</span> 或 <span class="k">下载 Markdown 文件</span>。导出的是一份写给 AI 看的交接单：学习进度、失误和疑问、当时的面板和读数、你填过的数据。粘贴给任何 AI，它就知道你哪里不会，可以接着教你。在线版不能下载文件，会弹出文字框让你复制。</li></ul>

<h4 id="h-data">数据存在哪</h4>
<ul>
<li>填的数、记录表、我的记录、完成了哪些课，都存在<b>你自己的浏览器</b>里，不上传。换浏览器、换电脑、清除浏览器数据就没了。</li>
<li>本地文件版和在线版各存各的，不互通。照片不保存，刷新就没。</li>
<li>怕丢就备份：「我的记录」页最下面有 <span class="k">备份全部数据</span>，会下载一个文件；换电脑或清了浏览器后，用 <span class="k">从备份恢复</span> 导回来。</li>
<li>模拟器故意让示波器带 2～3% 的仪器误差，这样"用标准方波修正"才有意义；CAL 标准方波按 2 Vp-p 模拟，上课以端子旁边印的为准。</li>
</ul>`;

function openHelp() {
  const m = $('#modal');
  m.innerHTML = `<div class="box help"><div class="help-head"><h3>使用说明</h3><button class="tbtn primary" id="helpClose" type="button">知道了</button></div><div class="help-body">${HELP}</div></div>`;
  m.hidden = false;
  $('#helpClose').onclick = () => { m.hidden = true; };
  m.onclick = e => { if (e.target === m) m.hidden = true; };
  m.querySelectorAll('.help-toc a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = m.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  store.set('seenHelp', true);
}

/* ---------------- 启动 ---------------- */

function boot() {
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.documentElement.classList.add('touch');
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* 浏览器不支持就算了 */ }
  buildPanel();
  Teach.finished = store.get('finished', {});
  Teach.forms = store.get('forms', {});
  Teach.notes = store.get('notes', []);
  $('#btnNote').onclick = () => openNote();
  $('#btnHelp').onclick = () => openHelp();
  if (!store.get('seenHelp', false)) setTimeout(openHelp, 700);   // 第一次打开时自动弹出
  Panel.listeners.push(id => { if (id !== 'undo' && id !== 'lesson') histTouch(); updUndo(); guardCheck(); stepTick(); });
  $('#btnUndo').onclick = () => histUndo();
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest && e.target.closest('input,textarea')) return;
    e.preventDefault();
    if (e.shiftKey) histRedo(); else histUndo();
  });
  Teach.fails = store.get('fails', {});
  $('#modeTeach').onclick = () => setMode('teach');
  $('#modeSim').onclick = () => setMode('sim');
  $('#btnPhoto').onclick = () => takePhoto();
  // 三种视角只换外观：立体（有实验台）、正面（同样的质感，不倾斜）、2D（简洁平面）
  const VIEWS = ['3d', 'front', '2d'], VIEW_CN = { '3d': '立体', front: '正面', '2d': '2D' };
  const applyView = v => {
    const st = $('#stage');
    st.classList.toggle('flat', v !== '3d'); st.classList.toggle('skin2d', v === '2d');
    $('#btnView').textContent = '视角：' + VIEW_CN[v]; store.set('view', v);
    fitStage(); Panel.refresh();
  };
  $('#btnView').onclick = () => applyView(VIEWS[(VIEWS.indexOf(store.get('view', 'front')) + 1) % 3]);
  $('#btnView').title = '在 立体 → 正面 → 2D 之间切换；只换外观，数据和面板状态都不变';
  applyView(store.get('view', 'front'));   // 默认正面
  $('#stage').classList.add('intro'); setTimeout(() => $('#stage').classList.remove('intro'), 350);
  const applySound = on => { Snd.on = on; $('#btnSound').textContent = '声音：' + (on ? '开' : '关'); store.set('sound', on); };
  $('#btnSound').onclick = () => applySound(!Snd.on);
  applySound(store.get('sound', true));
  $('#btnDiag').onclick = () => {
    Teach.tab = 'diag'; renderTabs(); renderPane();
    if (innerWidth <= 1180) $('#side').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  resetBench(); Panel.refresh(); histReset();
  setMode(store.get('mode', 'teach'));
}
boot();
