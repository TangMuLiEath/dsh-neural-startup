/* DSH Neural Boot —— 深空神经网络开机动画（dsh-neural-startup 运行时）
 * 全部画面由 Canvas 2D 实时绘制，全部声音由 Web Audio 实时合成；无图片/音频素材，播放过程不需要任何操作。
 * 时间线是 t（秒）的纯函数，所以速度可整体缩放，也可冻结到任意时刻截图核对。
 *
 * 宿主约定：
 *   #dsh-neural-root           Host 注入的根节点（class 带 dnb-boot = 还没被运行时接管）
 *   window.__DSH_NEURAL__      配置（Host 注入 / 浏览器半侧自举时写入）
 *   window.__DSH_NEURAL_API__  运行时对外接口：replay(cfg?) / englishVoices() / say(text?)
 */
(function () {
  'use strict'
  if (window.__DSH_NEURAL_LOADED__) return
  window.__DSH_NEURAL_LOADED__ = true
  var ART = /*__ART__*/null
  var WHALE = '/*__WHALE__*/'
  var ROOT_ID = 'dsh-neural-root'

  /* —— 配置：字段与 lib/index.js 的 DEFAULTS 一一对应 —— */
  var DEFAULTS = {
    enabled: true, mode: 'session', speed: 1, allowSkip: true,
    sound: true, soundVolume: 0.9, soundButton: true,
    voice: true, voiceName: '', voiceVolume: 0.5, voiceRate: 0.86, voicePitch: 0.72,
    line1: 'Identity confirmed. Prime authority.', line2: 'Welcome back.',
    title1: 'DEEPSEEK', title2: 'HARNESS', subtitle: '深度求索 · 神经核心已同步', badge: '高授权者 · PRIME AUTHORITY · 已识别'
  }
  var CFG = {}, SPEED = 1, MUTE = false, FREEZE = null, PREVIEW = false
  function num(v, d, lo, hi) { var n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
  function applyConfig(over) {
    CFG = Object.assign({}, DEFAULTS, window.__DSH_NEURAL__ || {}, over || {})
    PREVIEW = CFG.preview === true
    /* 预览页可以用查询串临时覆盖：?speed= ?t= ?mute=1 ?voice=0 ?vn=音色名 */
    var Q = null
    try { Q = PREVIEW ? new URLSearchParams(location.search) : null } catch (e) { Q = null }
    SPEED = num(Q && Q.get('speed') ? Q.get('speed') : CFG.speed, 1, 0.3, 3)
    MUTE = !!(Q && Q.get('mute') === '1')
    if (Q && Q.get('voice') === '0') CFG.voice = false
    if (Q && Q.get('vn')) CFG.voiceName = Q.get('vn')
    FREEZE = window.__FREEZE__ != null ? Number(window.__FREEZE__) : (Q && Q.has('t') ? Number(Q.get('t')) : null)
  }
  applyConfig()

  /* —— 根节点与 DOM：运行时自己搭，Host 只给一个空根 —— */
  var nb = document.getElementById(ROOT_ID)
  if (!nb) { nb = document.createElement('div'); nb.id = ROOT_ID; (document.body || document.documentElement).appendChild(nb) }
  function escHtml(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  nb.innerHTML =
    '<canvas class="dnb-cv" aria-hidden="true"></canvas>' +
    '<button class="dnb-snd" type="button" aria-pressed="true">' +
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
      '<path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5z" fill="currentColor" stroke="none"/>' +
      '<path class="dnb-w" d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.2 3.8a6 6 0 0 1 0 8.4"/>' +
      '<path class="dnb-x" d="M10.5 6l4 4M14.5 6l-4 4"/></svg><span>SOUND ON</span></button>' +
    '<div class="dnb-cn dnb-a" aria-hidden="true"></div><div class="dnb-cn dnb-b" aria-hidden="true"></div>' +
    '<div class="dnb-cn dnb-c" aria-hidden="true"></div><div class="dnb-cn dnb-d" aria-hidden="true"></div>' +
    '<div class="dnb-hud dnb-tl" aria-hidden="true"></div><div class="dnb-hud dnb-tr" aria-hidden="true"></div>' +
    '<div class="dnb-hud dnb-log" aria-hidden="true"></div>' +
    '<div class="dnb-hud dnb-bar" aria-hidden="true"><i></i><span></span></div>' +
    '<div class="dnb-hud dnb-skip" role="status"></div>' +
    '<div class="dnb-title" aria-hidden="true"><div class="dnb-row">' +
      '<svg class="dnb-whale" viewBox="0 5 50 40"><path pathLength="1" d="' + WHALE + '"/></svg>' +
      '<div><div class="dnb-t1"></div><div class="dnb-t2"></div></div></div>' +
      '<div class="dnb-t3"></div><div class="dnb-t4"><i></i><span></span></div></div>'
  function $q(sel) { return nb.querySelector(sel) }

  /* —— 时间线（1× 速度，秒）—— */
  /* PRE：前置「黑屏冷启动」时长；主时间线 T 里的时刻都相对 PRE 之后 */
  var PRE = 2.8
  var T = { bloom: 0.9, condense: 3.3, dots: 3.4, lines: 4.0, scan: 7.6, eyes: 8.05, title: 8.5,
    exit: 10.7, core: 11.6, burst: 12.35, end: 13.35 }

  /* —— 小工具 —— */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v }
  function sm(a, b, t) { var x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x) }
  function ease(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
  function lerp(a, b, k) { return a + (b - a) * k }
  function rnd(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h ^ (h >>> 16)) >>> 0 }
  var R = rnd(20261018)

  var AW = ART.W, AH = ART.H
  var FACE = { x: 660, y: 330 }
  var EYES = [{ x: 570, y: 303 }, { x: 749, y: 300 }]
  var EYE_BOX = [[562, 302, 78, 44], [775, 302, 78, 44]]

  /* —— 颜色：左青 → 右紫，暗部偏深青，亮部偏冰白，裙摆暗部带一点品红 —— */
  var C_CY = [56, 214, 255], C_VI = [155, 123, 255], C_MG = [255, 79, 216], C_WH = [232, 248, 255]
  function mix(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)] }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')' }

  /* —— 解码线稿 —— */
  var strokes = []
  ART.S.forEach(function (arr) {
    var tone = arr[0], xs = [], ys = [], x = 0, y = 0
    for (var i = 1; i < arr.length; i += 2) { x += arr[i]; y += arr[i + 1]; xs.push(x); ys.push(y) }
    var cum = [0], L = 0, cx = 0, cy = 0
    for (var j = 1; j < xs.length; j++) { L += Math.hypot(xs[j] - xs[j - 1], ys[j] - ys[j - 1]); cum.push(L) }
    for (j = 0; j < xs.length; j++) { cx += xs[j]; cy += ys[j] }
    cx /= xs.length; cy /= xs.length
    var inEye = EYE_BOX.some(function (b) { return Math.pow((cx - b[0]) / b[2], 2) + Math.pow((cy - b[1]) / b[3], 2) < 1 })
    var d = Math.hypot(cx - FACE.x, (cy - FACE.y) * 1.25)
    var start = inEye ? T.lines + R() * 0.35 : T.lines + 0.25 + 3.0 * Math.pow(clamp(d / 980, 0, 1), 0.85) + R() * 0.45
    var dur = clamp(L / 520, 0.18, 1.1)
    var col = mix(C_CY, C_VI, sm(380, 1500, cx))
    if (tone <= 3 && cy > 560) col = mix(col, C_MG, 0.32)
    if (tone >= 6) col = mix(col, C_WH, 0.55)
    if (inEye) col = mix(C_WH, C_VI, 0.25)
    strokes.push({ xs: xs, ys: ys, cum: cum, L: L, cx: cx, cy: cy, start: start, dur: dur, col: col,
      css: rgba(col, inEye ? 1 : 0.92), glow: rgba(col, 0.5), drawn: 0, eye: inEye })
  })
  var order = strokes.slice().sort(function (a, b) { return a.start - b.start })

  function ptAt(s, l) {
    var c = s.cum, n = c.length
    if (n < 2 || l <= 0) return [s.xs[0], s.ys[0]]
    if (l >= s.L) return [s.xs[n - 1], s.ys[n - 1]]
    var i = 1; while (i < n - 1 && c[i] < l) i++
    var k = (l - c[i - 1]) / ((c[i] - c[i - 1]) || 1)
    return [lerp(s.xs[i - 1], s.xs[i], k), lerp(s.ys[i - 1], s.ys[i], k)]
  }
  function strokeProg(s, t) { return ease((t - s.start) / s.dur) }

  /* —— 半调点云（角色体积）—— */
  var dots = []
  for (var di = 0; di < ART.D.length; di += 3) {
    var dx = ART.D[di], dy = ART.D[di + 1], lv = ART.D[di + 2]
    var dd = Math.hypot(dx - FACE.x, dy - FACE.y)
    var ang = Math.atan2(dy - AH / 2, dx - AW / 2) + (R() - 0.5) * 0.9
    dots.push({ x: dx, y: dy, lv: lv, born: T.dots + clamp(dd / 900, 0, 1) * 2.4 + R() * 0.8,
      ang: ang, far: 0.75 + R() * 0.5, tw: R() * 6.28 })
  }

  /* —— 出场粒子：沿线稿按长度采样 —— */
  var totalL = strokes.reduce(function (a, s) { return a + s.L }, 0)
  var motes = []
  for (var mi = 0; mi < 3200; mi++) {
    var pick = R() * totalL, si = 0
    while (si < strokes.length - 1 && pick > strokes[si].L) { pick -= strokes[si].L; si++ }
    var sp = ptAt(strokes[si], pick)
    var far = clamp(Math.hypot(sp[0] - AW / 2, sp[1] - AH / 2) / 900, 0, 1)
    motes.push({ x: sp[0], y: sp[1], col: strokes[si].col, css: rgba(strokes[si].col, 1),
      dl: (1 - far) * 0.22 + R() * 0.16, dur: 0.4 + R() * 0.15, spin: 1.1 + R() * 1.2 })
  }

  /* —— 神经网络：三维球壳上的节点 + 近邻连接，从中心种子按 BFS 层级生长 —— */
  var NODES = 150, nodes = [], edges = []
  nodes.push({ x: 0, y: 0, z: 0 })
  for (var ni = 1; ni < NODES; ni++) {
    var u = R() * 2 - 1, th = R() * Math.PI * 2, rr = 0.45 + Math.pow(R(), 0.6) * 0.65, q = Math.sqrt(1 - u * u)
    nodes.push({ x: q * Math.cos(th) * rr, y: u * rr * 0.78, z: q * Math.sin(th) * rr })
  }
  var adj = nodes.map(function () { return [] })
  nodes.forEach(function (a, i) {
    var near = nodes.map(function (b, j) { return [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2] })
      .filter(function (p) { return p[0] !== i }).sort(function (p, q2) { return p[1] - q2[1] }).slice(0, i === 0 ? 6 : 3)
    near.forEach(function (p) {
      var j = p[0]
      if (adj[i].indexOf(j) === -1) { adj[i].push(j); adj[j].push(i); edges.push([i, j]) }
    })
  })
  var depth = nodes.map(function () { return -1 }); depth[0] = 0
  var bfs = [0]
  while (bfs.length) { var cur = bfs.shift(); adj[cur].forEach(function (j) { if (depth[j] < 0) { depth[j] = depth[cur] + 1; bfs.push(j) } }) }
  var maxD = Math.max.apply(null, depth)
  nodes.forEach(function (n, i) {
    if (depth[i] < 0) depth[i] = maxD + 1
    n.birth = i === 0 ? 0.15 : T.bloom + depth[i] * 0.27 + R() * 0.18
    n.flash = -9
  })
  /* 凝聚锚点：按节点在凝聚时刻的投影位置，就近认领一条早期线条的起笔点（不重复），
     这样网络收拢到脸上时拓扑仍是局部的，不会拉出满屏长线 */
  ;(function () {
    var cand = order.slice(0, 460).map(function (s) { return [s.xs[0], s.ys[0]] }), used = []
    var a = T.condense * 0.24 + 0.6, b = 0.38, ca = Math.cos(a), sa = Math.sin(a)
    nodes.forEach(function (n) {
      var x = n.x * ca + n.z * sa, z = -n.x * sa + n.z * ca
      var y = n.y * Math.cos(b) - z * Math.sin(b), z2 = n.y * Math.sin(b) + z * Math.cos(b), k = 2.8 / (2.8 + z2)
      var tx = FACE.x + x * k * 430, ty = FACE.y + 40 + y * k * 380, best = -1, bd = 1e18
      for (var c = 0; c < cand.length; c++) {
        if (used[c]) continue
        var dd = (cand[c][0] - tx) * (cand[c][0] - tx) + (cand[c][1] - ty) * (cand[c][1] - ty)
        if (dd < bd) { bd = dd; best = c }
      }
      used[best] = 1; n.ax = cand[best][0]; n.ay = cand[best][1]
    })
  })()
  edges.forEach(function (e) {
    var a = e[0], b = e[1]
    if (nodes[a].birth > nodes[b].birth) { e[0] = b; e[1] = a }
  })

  /* —— 星空 —— */
  var stars = []
  for (var st = 0; st < 380; st++) stars.push({ x: R() * 2 - 1, y: R() * 2 - 1, z: R(), c: R() < 0.2 ? C_VI : C_CY })

  /* —— 画布 —— */
  var cv = $q('.dnb-cv'), ctx = cv.getContext('2d')
  var ink = document.createElement('canvas'), ictx = ink.getContext('2d')
  var blo = document.createElement('canvas'), bctx = blo.getContext('2d')
  var bg = document.createElement('canvas'), gctx = bg.getContext('2d')
  var vig = document.createElement('canvas'), vctx = vig.getContext('2d')
  var W = 0, H = 0, DPR = 1, FIT = 1, IS = 1

  function sprite(c, r) {
    var s = document.createElement('canvas'); s.width = s.height = r * 2
    var g = s.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, rgba(c, 0.85))
    gr.addColorStop(0.45, rgba(c, 0.22)); gr.addColorStop(1, rgba(c, 0))
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return s
  }
  var SP_CY = sprite(C_CY, 32), SP_VI = sprite(C_VI, 32), SP_MG = sprite(C_MG, 32), SP_WH = sprite(C_WH, 32)

  /* 窗口控制按钮避让：DSH 桌面端（Electron 无边框窗口 + titleBarOverlay）会把系统的
     最小化/最大化/关闭按钮画在网页内容之上，网页无法覆盖或改色，只能把右上角的元素挪开。
     优先用 Window Controls Overlay API 拿到准确的标题栏高度；拿不到而又是 Electron 时按 Windows 默认 40px 避让。 */
  function controlsInset() {
    try {
      var wco = navigator.windowControlsOverlay
      if (wco && wco.visible && typeof wco.getTitlebarAreaRect === 'function') {
        var r = wco.getTitlebarAreaRect()
        if (r && r.height > 0 && r.x + r.width < innerWidth - 4) return Math.ceil(r.height)
      }
      if (/Electron/i.test(navigator.userAgent || '') && Math.abs((window.outerHeight || 0) - innerHeight) < 2) return 40
    } catch (e) {}
    return 0
  }
  function applyInset() { nb.style.setProperty('--dnb-wco', controlsInset() + 'px') }
  try { if (navigator.windowControlsOverlay) navigator.windowControlsOverlay.addEventListener('geometrychange', applyInset) } catch (e) {}

  function resize() {
    applyInset()
    W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1)
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR)
    FIT = Math.min(W / AW, H / AH); IS = FIT * DPR
    ink.width = Math.ceil(AW * IS); ink.height = Math.ceil(AH * IS)
    blo.width = Math.ceil(AW * IS / 4); blo.height = Math.ceil(AH * IS / 4)
    /* 背景星云 */
    bg.width = vig.width = cv.width; bg.height = vig.height = cv.height
    var mx = Math.max(cv.width, cv.height)
    gctx.fillStyle = '#020309'; gctx.fillRect(0, 0, bg.width, bg.height)
    ;[[0.22, 0.28, 0.75, C_CY, 0.10], [0.82, 0.78, 0.8, C_MG, 0.07], [0.6, 0.35, 0.6, C_VI, 0.08], [0.5, 0.5, 0.35, C_CY, 0.05]].forEach(function (n) {
      var g = gctx.createRadialGradient(n[0] * bg.width, n[1] * bg.height, 0, n[0] * bg.width, n[1] * bg.height, n[2] * mx)
      g.addColorStop(0, rgba(n[3], n[4])); g.addColorStop(1, rgba(n[3], 0))
      gctx.fillStyle = g; gctx.fillRect(0, 0, bg.width, bg.height)
    })
    var vg = vctx.createRadialGradient(vig.width / 2, vig.height / 2, mx * 0.28, vig.width / 2, vig.height / 2, mx * 0.75)
    vg.addColorStop(0, 'rgba(2,3,9,0)'); vg.addColorStop(1, 'rgba(2,3,9,.92)')
    vctx.clearRect(0, 0, vig.width, vig.height); vctx.fillStyle = vg; vctx.fillRect(0, 0, vig.width, vig.height)
    resetInk()
  }

  /* —— 线稿墨层：只增不减，增量画；尺寸变化/冻结时整体重画 —— */
  function resetInk() {
    ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height)
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, blo.width, blo.height)
    ictx.setTransform(IS, 0, 0, IS, 0, 0); bctx.setTransform(IS / 4, 0, 0, IS / 4, 0, 0)
    ;[ictx, bctx].forEach(function (c) { c.lineCap = 'round'; c.lineJoin = 'round' })
    strokes.forEach(function (s) { s.drawn = 0 })
  }
  function pathRange(c, s, a, b) {
    var p = ptAt(s, a); c.moveTo(p[0], p[1])
    for (var i = 1; i < s.cum.length; i++) if (s.cum[i] > a && s.cum[i] < b) c.lineTo(s.xs[i], s.ys[i])
    p = ptAt(s, b); c.lineTo(p[0], p[1])
  }
  function growInk(t) {
    var lw = 1.25 / FIT, bw = 3.4 / FIT
    for (var i = 0; i < order.length; i++) {
      var s = order[i]; if (s.start > t) break
      var target = strokeProg(s, t) * s.L
      if (target <= s.drawn + 0.01) continue
      ictx.strokeStyle = s.css; ictx.lineWidth = s.eye ? lw * 1.15 : lw
      ictx.beginPath(); pathRange(ictx, s, Math.max(0, s.drawn - 0.5), target); ictx.stroke()
      bctx.strokeStyle = s.glow; bctx.lineWidth = bw
      bctx.beginPath(); pathRange(bctx, s, Math.max(0, s.drawn - 0.5), target); bctx.stroke()
      s.drawn = target
    }
  }

  /* —— 镜头：标题出现时人物右移、略缩，让出左侧给标题 —— */
  function camera(t) {
    var wide = W / H > 1.15 ? 1 : 0
    var k = ease((t - (T.title - 0.25)) / 1.3)
    var ex = 0
    return { x: W / 2 + k * W * 0.13 * wide, y: H / 2 - (wide ? 0 : k * H * 0.08), s: FIT * (1 - 0.06 * k + 0.05 * ex) }
  }
  function toScr(cam, ax, ay) { return [cam.x + (ax - AW / 2) * cam.s, cam.y + (ay - AH / 2) * cam.s] }

  function proj(n, t) {
    var a = t * 0.24 + 0.6, b = 0.38, ca = Math.cos(a), sa = Math.sin(a)
    var x = n.x * ca + n.z * sa, z = -n.x * sa + n.z * ca
    var y = n.y * Math.cos(b) - z * Math.sin(b), z2 = n.y * Math.sin(b) + z * Math.cos(b)
    var k = 2.8 / (2.8 + z2), RR = Math.min(W, H) * 0.42
    return [W / 2 + x * RR * k, H / 2 + y * RR * k, k]
  }

  /* —— 每帧渲染 —— */
  var pulses = [], lastSpawn = 0, P = []
  var events = { blips: 0 }

  function renderMain(t, live) {
    var cam = camera(t)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1
    ctx.fillStyle = '#020309'; ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.globalAlpha = sm(0.2, 2.6, t) * (1 - 0.6 * sm(T.exit, T.core, t)); ctx.drawImage(bg, 0, 0)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    ctx.globalCompositeOperation = 'lighter'

    /* 星空：缓慢迎面漂来，生长期加速一下 */
    var warp = t * 0.05 + sm(T.bloom, T.condense, t) * 0.12 + sm(T.exit, T.core, t) * -0.1 + sm(T.burst, T.end, t) * 0.4
    var sa = sm(0.1, 1.6, t)
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], z = ((s.z - warp) % 1 + 1) % 1 + 0.04
      var x = W / 2 + s.x / z * W * 0.22, y = H / 2 + s.y / z * H * 0.22
      if (x < 0 || y < 0 || x > W || y > H) continue
      var b = (1 - z) * sa
      ctx.globalAlpha = b * 0.85; ctx.fillStyle = rgba(s.c, 1)
      var r = 0.4 + (1 - z) * 1.5; ctx.fillRect(x - r / 2, y - r / 2, r, r)
    }

    /* 种子神经元 + 冲击波 */
    var seedA = sm(0.0, 0.5, t) * (1 - sm(T.condense, T.condense + 0.8, t))
    if (seedA > 0) {
      var pulse = 1 + 0.25 * Math.sin(t * 9)
      ctx.globalAlpha = seedA; var sz = (40 + 60 * sm(0.6, 0.95, t)) * pulse
      ctx.drawImage(SP_CY, W / 2 - sz / 2, H / 2 - sz / 2, sz, sz)
      ctx.drawImage(SP_WH, W / 2 - sz / 6, H / 2 - sz / 6, sz / 3, sz / 3)
    }
    if (t > T.bloom && t < T.bloom + 1.4) {
      var w = (t - T.bloom) / 1.4
      ctx.globalAlpha = (1 - w) * 0.8; ctx.strokeStyle = rgba(C_CY, 1); ctx.lineWidth = 1.5 * (1 - w) + 0.3
      ctx.beginPath(); ctx.arc(W / 2, H / 2, ease(w) * Math.max(W, H) * 0.6, 0, 6.283); ctx.stroke()
      ctx.globalAlpha = (1 - w) * 0.35; ctx.beginPath(); ctx.arc(W / 2, H / 2, ease(w) * Math.max(W, H) * 0.42, 0, 6.283); ctx.stroke()
    }

    /* 神经网络 */
    var netA = (1 - 0.8 * sm(T.lines + 0.4, T.lines + 2.6, t)) * (1 - sm(T.exit - 0.6, T.exit + 0.2, t))
    var m = ease((t - T.condense) / 1.35)
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i], p = proj(n, t), an = toScr(cam, n.ax, n.ay)
      P[i] = [lerp(p[0], an[0], m), lerp(p[1], an[1], m), lerp(p[2], 1, m), sm(n.birth - 0.05, n.birth + 0.25, t)]
    }
    if (netA > 0.01) {
      ctx.lineWidth = 0.8
      for (i = 0; i < edges.length; i++) {
        var e = edges[i], A = P[e[0]], B = P[e[1]]
        var g = sm(nodes[e[1]].birth - 0.3, nodes[e[1]].birth, t) * A[3]
        if (g <= 0) continue
        ctx.globalAlpha = netA * 0.32 * (A[2] + B[2]) * 0.5 * (0.6 + 0.4 * m)
        ctx.strokeStyle = i % 5 === 0 ? 'rgb(155,123,255)' : 'rgb(56,214,255)'
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(lerp(A[0], B[0], g), lerp(A[1], B[1], g)); ctx.stroke()
      }
      for (i = 0; i < nodes.length; i++) {
        var Pn = P[i]; if (Pn[3] <= 0) continue
        var fl = Math.max(0, 1 - (t - nodes[i].flash) / 0.35)
        var size = (6 + 10 * Pn[2] + 18 * fl) * Pn[3] * (1 - 0.4 * m)
        ctx.globalAlpha = netA * (0.55 + 0.45 * fl)
        ctx.drawImage(i % 7 === 0 ? SP_VI : SP_CY, Pn[0] - size / 2, Pn[1] - size / 2, size, size)
      }
      /* 突触脉冲 */
      if (live && t > T.bloom + 0.4 && t < T.lines + 1.2) {
        var rate = 22 * (1 - sm(T.lines, T.lines + 1.2, t)) + 6
        if (lastSpawn < t - 0.1) lastSpawn = t - 0.1
        while (lastSpawn < t) {
          lastSpawn += 1 / rate
          var ei = (R() * edges.length) | 0, ed = edges[ei]
          if (nodes[ed[1]].birth < t) pulses.push({ e: ed, t0: t, d: 0.35 + R() * 0.3 })
        }
      } else if (!live) pulses.length = 0
      for (i = pulses.length - 1; i >= 0; i--) {
        var pu = pulses[i], k = (t - pu.t0) / pu.d
        if (k >= 1) { nodes[pu.e[1]].flash = t; events.blips++; pulses.splice(i, 1); continue }
        var a0 = P[pu.e[0]], b0 = P[pu.e[1]]
        ctx.globalAlpha = netA * 0.95
        ctx.drawImage(SP_WH, lerp(a0[0], b0[0], k) - 5, lerp(a0[1], b0[1], k) - 5, 10, 10)
      }
    } else pulses.length = 0

    /* 半调点云：从四周汇聚 */
    var dotA = (1 - 0.45 * sm(T.lines + 1, T.scan, t)) * (1 - sm(T.exit, T.exit + 0.45, t))
    if (t > T.dots && dotA > 0.01) {
      var maxR = Math.max(W, H) * 0.75
      for (i = 0; i < dots.length; i++) {
        var d = dots[i]; if (t < d.born) continue
        var f = (t - d.born) / 0.95, tg = toScr(cam, d.x, d.y)
        if (f < 1) {
          var ef = ease(f), sw = (1 - ef) * 0.9
          var ox = W / 2 + Math.cos(d.ang + sw) * maxR * d.far, oy = H / 2 + Math.sin(d.ang + sw) * maxR * d.far
          var px = lerp(ox, tg[0], ef), py = lerp(oy, tg[1], ef)
          ctx.globalAlpha = 0.5 * dotA * f; ctx.fillStyle = d.lv > 2 ? '#bfefff' : '#38d6ff'
          ctx.fillRect(px - 1, py - 1, 2, 2)
        } else {
          var tw = 0.75 + 0.25 * Math.sin(t * 3 + d.tw)
          ctx.globalAlpha = dotA * (0.12 + 0.09 * d.lv) * tw; ctx.fillStyle = d.lv > 2 ? '#7fd8ff' : '#2f8fd8'
          var dz = 0.8 + d.lv * 0.45; ctx.fillRect(tg[0] - dz / 2, tg[1] - dz / 2, dz, dz)
        }
      }
    }

    /* 线稿：墨层 + 1/4 分辨率泛光层 */
    if (t > T.lines - 0.05) {
      growInk(t)
      var inkA = 1 - sm(T.exit + 0.05, T.exit + 0.5, t)
      var ix = cam.x - AW / 2 * cam.s, iy = cam.y - AH / 2 * cam.s, iw = AW * cam.s, ih = AH * cam.s
      ctx.globalAlpha = inkA * 0.95; ctx.drawImage(blo, ix, iy, iw, ih)
      ctx.globalAlpha = inkA; ctx.drawImage(ink, ix, iy, iw, ih)

      /* 笔头：正在生长的线条头部有一颗亮点 */
      for (i = 0; i < order.length; i++) {
        var so = order[i]; if (so.start > t) break
        var pr = (t - so.start) / so.dur; if (pr >= 1 || pr <= 0) continue
        var hp = toScr(cam, ptAt(so, ease(pr) * so.L)[0], ptAt(so, ease(pr) * so.L)[1])
        var hs = 9 + 7 * Math.sin(pr * 3.14)
        ctx.globalAlpha = 0.9 * inkA; ctx.drawImage(so.eye ? SP_WH : (so.cx > 1000 ? SP_VI : SP_CY), hp[0] - hs / 2, hp[1] - hs / 2, hs, hs)
      }

      /* 扫描带：自上而下把线稿再「过一遍电」 */
      if (t > T.scan && t < T.scan + 0.95) {
        var sk = ease((t - T.scan) / 0.95), sy = iy + sk * ih, bandH = 46
        ctx.save(); ctx.beginPath(); ctx.rect(ix, sy - bandH, iw, bandH + 2); ctx.clip()
        ctx.globalAlpha = 0.9 * (1 - sk * 0.3); ctx.drawImage(ink, ix, iy, iw, ih); ctx.drawImage(blo, ix, iy, iw, ih)
        ctx.restore()
        var lg = ctx.createLinearGradient(ix, 0, ix + iw, 0)
        lg.addColorStop(0, 'rgba(56,214,255,0)'); lg.addColorStop(0.5, 'rgba(220,250,255,.9)'); lg.addColorStop(1, 'rgba(155,123,255,0)')
        ctx.globalAlpha = 0.8; ctx.fillStyle = lg; ctx.fillRect(ix, sy - 0.75, iw, 1.5)
      }

      /* 眼睛点亮：紫色菱形瞳光 + 横向变形镜头光 */
      var eyeA = sm(T.eyes, T.eyes + 0.22, t) * (0.78 + 0.22 * Math.sin((t - T.eyes) * 4.2)) * (1 - sm(T.exit, T.exit + 0.35, t))
      var boom = Math.max(0, 1 - Math.abs(t - T.eyes - 0.12) / 0.35)
      if (eyeA > 0.01) {
        EYES.forEach(function (E) {
          var ep = toScr(cam, E.x, E.y), u = cam.s / FIT
          var gsz = (70 + 90 * boom) * u
          ctx.globalAlpha = eyeA * 0.85; ctx.drawImage(SP_VI, ep[0] - gsz / 2, ep[1] - gsz / 2, gsz, gsz)
          ctx.save(); ctx.translate(ep[0], ep[1])
          ctx.globalAlpha = eyeA * (0.35 + 0.5 * boom); ctx.scale(1, 0.035)
          var fw = (240 + 420 * boom) * u; ctx.drawImage(SP_CY, -fw / 2, -fw / 2, fw, fw)
          ctx.restore()
          ctx.save(); ctx.translate(ep[0], ep[1]); ctx.rotate(Math.PI / 4)
          var ds = 4.2 * u * FIT * 1.6 + 1.5
          ctx.globalAlpha = eyeA; ctx.fillStyle = '#efe6ff'; ctx.fillRect(-ds / 2, -ds / 2, ds, ds)
          ctx.restore()
        })
      }
    }

    /* 终幕「神经回收」：线条化成光流，螺旋倒流回中心的一颗神经元 */
    if (t > T.exit && t < T.core + 0.2) {
      var CX = W / 2, CY = H / 2
      ctx.lineWidth = 1.2
      for (i = 0; i < motes.length; i++) {
        var mo = motes[i], lk = (t - T.exit - mo.dl) / mo.dur
        if (lk >= 1 || lk <= 0) continue
        var mp = toScr(cam, mo.x, mo.y)
        var k1 = lk * lk * lk, k0 = Math.max(0, lk - 0.09); k0 = k0 * k0 * k0
        var rx = mp[0] - CX, ry = mp[1] - CY
        var a1 = k1 * mo.spin, a0 = k0 * mo.spin
        var x1 = CX + (rx * Math.cos(a1) - ry * Math.sin(a1)) * (1 - k1), y1 = CY + (rx * Math.sin(a1) + ry * Math.cos(a1)) * (1 - k1)
        var x0 = CX + (rx * Math.cos(a0) - ry * Math.sin(a0)) * (1 - k0), y0 = CY + (rx * Math.sin(a0) + ry * Math.cos(a0)) * (1 - k0)
        ctx.globalAlpha = 0.75 * Math.min(1, lk * 6); ctx.strokeStyle = mo.css
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
      }
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(vig, 0, 0)
    /* 标题衬底：左侧压暗，让标题压得住线稿 */
    var scr = sm(T.title - 0.2, T.title + 0.8, t) * (1 - sm(T.exit, T.exit + 0.8, t))
    if (scr > 0.01) {
      var sg = ctx.createLinearGradient(0, 0, cv.width * 0.5, 0)
      sg.addColorStop(0, 'rgba(2,3,9,.9)'); sg.addColorStop(0.6, 'rgba(2,3,9,.55)'); sg.addColorStop(1, 'rgba(2,3,9,0)')
      ctx.globalAlpha = scr; ctx.fillStyle = sg; ctx.fillRect(0, 0, cv.width * 0.5, cv.height)
    }
    /* 两次闪白：种子爆开、眼睛点亮 */
    var fla = 0.22 * Math.max(0, 1 - Math.abs(t - T.bloom) / 0.18) + 0.1 * boomAt(t)
    if (fla > 0.002) { ctx.globalAlpha = fla; ctx.fillStyle = '#dff6ff'; ctx.fillRect(0, 0, cv.width, cv.height) }
    ctx.globalAlpha = 1
    drawRecallCore(t)
  }

  /* 回收的神经元：吸满 → 收缩蓄力 → 炸开成冲击波；冲击波扫过的地方就是主界面（见 revealMask） */
  function burstR(t) { var x = clamp((t - T.burst) / (T.end - T.burst - 0.05), 0, 1); return (1 - Math.pow(1 - x, 3)) * Math.hypot(W, H) * 0.62 }
  function drawRecallCore(t) {
    if (t < T.exit + 0.1 || t > T.end) return
    var CX = W / 2, CY = H / 2
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'lighter'
    if (t < T.burst + 0.15) {
      var fill = sm(T.exit + 0.15, T.core, t), pinch = sm(T.burst - 0.55, T.burst, t)
      var beatK = t > T.core - 0.1 && t < T.burst - 0.6 ? Math.exp(-(((t - T.core + 0.1) % 0.45) / 0.09)) : 0
      var flick = (0.88 + 0.12 * Math.sin(t * 70)) * (1 + 0.28 * beatK)
      var sz = (24 + 120 * fill) * (1 - 0.72 * pinch) * flick + 260 * Math.max(0, 1 - Math.abs(t - T.burst) / 0.12)
      ctx.globalAlpha = 0.9; ctx.drawImage(SP_CY, CX - sz / 2, CY - sz / 2, sz, sz)
      ctx.globalAlpha = 0.5 + 0.5 * pinch; ctx.drawImage(SP_VI, CX - sz * 0.35, CY - sz * 0.35, sz * 0.7, sz * 0.7)
      ctx.globalAlpha = 1; ctx.drawImage(SP_WH, CX - sz * 0.18, CY - sz * 0.18, sz * 0.36, sz * 0.36)
      /* 核心外的环形刻度：慢转，心跳时外扩一下 */
      var ringA = sm(T.core - 0.3, T.core + 0.2, t) * (1 - pinch)
      if (ringA > 0.01) {
        ctx.lineWidth = 1
        ;[[78, 0.9, 5, 'rgb(56,214,255)'], [104, -0.6, 3, 'rgb(155,123,255)'], [128, 0.35, 8, 'rgb(56,214,255)']].forEach(function (rg, ri) {
          var rad = rg[0] * (1 + 0.06 * beatK) * (0.8 + 0.2 * sm(T.core - 0.3, T.core + 0.4, t))
          ctx.globalAlpha = ringA * (0.55 - ri * 0.12); ctx.strokeStyle = rg[3]
          for (var q = 0; q < rg[2]; q++) {
            var a0 = t * rg[1] + q * 6.283 / rg[2]
            ctx.beginPath(); ctx.arc(CX, CY, rad, a0, a0 + 6.283 / rg[2] * 0.62); ctx.stroke()
          }
        })
      }
      /* 蓄力时的细环收紧 */
      if (pinch > 0 && t < T.burst) {
        ctx.globalAlpha = 0.6 * pinch; ctx.strokeStyle = 'rgb(155,123,255)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(CX, CY, 90 * (1 - pinch) + 8, 0, 6.283); ctx.stroke()
      }
    }
    if (t > T.burst) {
      var r = burstR(t), k = (t - T.burst) / (T.end - T.burst)
      ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = 'rgb(220,250,255)'; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(CX, CY, r + 34, 0, 6.283); ctx.stroke()
      ctx.globalAlpha = 0.35 * (1 - k); ctx.strokeStyle = 'rgb(56,214,255)'; ctx.lineWidth = 14
      ctx.beginPath(); ctx.arc(CX, CY, r + 40, 0, 6.283); ctx.stroke()
      ctx.globalAlpha = 0.25 * (1 - k); ctx.strokeStyle = 'rgb(255,79,216)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(CX, CY, r + 52, 0, 6.283); ctx.stroke()
      var fl2 = 0.35 * Math.max(0, 1 - (t - T.burst) / 0.16)
      if (fl2 > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = fl2; ctx.fillStyle = '#e6f8ff'; ctx.fillRect(0, 0, cv.width, cv.height) }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1
  }
  function revealMask(t) {
    if (t <= T.burst) { if (nb.style.webkitMaskImage) { nb.style.webkitMaskImage = ''; nb.style.maskImage = '' } return }
    var r = burstR(t), m = 'radial-gradient(circle at 50% 50%, transparent ' + r.toFixed(1) + 'px, #000 ' + (r + 30).toFixed(1) + 'px)'
    nb.style.webkitMaskImage = m; nb.style.maskImage = m
  }
  function boomAt(t) { return Math.max(0, 1 - Math.abs(t - T.eyes - 0.08) / 0.2) }

  /* —— 前置「黑屏冷启动」：光标 → 两行自检 → 上电，一道细光线横向拉开、闪两下，再塌缩成种子神经元 —— */
  var PRE_LINES = [[0.3, 'DSH://COLD-START'], [0.72, 'POWER RAIL ··· ENGAGE']]
  var typedPre = 0
  function drawPre(t) {
    var CX = W / 2, CY = H / 2
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'source-over'
    /* 文字 */
    var txtA = 1 - sm(1.55, 2.0, t)
    typedPre = 0
    if (txtA > 0.01) {
      ctx.font = '12px "JetBrains Mono","Cascadia Mono",Consolas,monospace'; ctx.textBaseline = 'middle'
      var lw = 0
      PRE_LINES.forEach(function (l) { lw = Math.max(lw, ctx.measureText(l[1]).width) })
      var x0 = CX - lw / 2, curX = x0, curY = CY + 38, any = false
      PRE_LINES.forEach(function (l, i) {
        if (t < l[0]) return
        var n = Math.min(l[1].length, Math.floor((t - l[0]) * 42)); typedPre += n
        var str = l[1].slice(0, n), y = CY + 38 + i * 20
        ctx.globalAlpha = txtA * 0.8; ctx.fillStyle = i ? '#7dffcf' : 'rgb(165,226,255)'
        ctx.fillText(str, x0, y); curX = x0 + ctx.measureText(str).width + 3; curY = y; any = true
      })
      if (Math.floor(t * 3.2) % 2 === 0 || (t > 0.3 && t < 1.3)) {
        ctx.globalAlpha = txtA * 0.9; ctx.fillStyle = '#38d6ff'; ctx.fillRect(any ? curX : CX - 4, curY - 7, 7, 13)
      }
    }
    ctx.globalCompositeOperation = 'lighter'
    /* 光线：1.1 拉开 → 1.55 稳住闪烁 → 2.0 起塌缩 → 2.65 成点 */
    if (t > 1.08 && t < 2.7) {
      var open = ease((t - 1.08) / 0.45), shut = Math.pow(clamp((t - 2.0) / 0.65, 0, 1), 2.4)
      var lw2 = W * 0.92 * open * (1 - shut)
      var fk = (t > 1.17 && t < 1.22) || (t > 1.31 && t < 1.34) ? 0.2 : 1
      fk *= 0.9 + 0.1 * Math.sin(t * 90)
      var hot = 1 + shut * 1.2
      ctx.globalAlpha = 0.75 * fk; ctx.drawImage(SP_CY, CX - lw2 / 2 - 20, CY - 16 * hot, lw2 + 40, 32 * hot)
      ctx.globalAlpha = 0.95 * fk; ctx.fillStyle = '#e8f8ff'; ctx.fillRect(CX - lw2 / 2, CY - 0.75, lw2, 1.5)
      /* 上电干扰线 */
      if (t < 2.0) {
        var fr = Math.floor(t * 30)
        for (var j = 0; j < 5; j++) {
          var hh = hash(fr, j)
          if (hh % 3) continue
          var yy = CY + ((hh >>> 4) % 400 - 200) * (H / 900), ww = ((hh >>> 12) % 600 + 80) * open
          ctx.globalAlpha = 0.12 * fk; ctx.fillStyle = '#38d6ff'; ctx.fillRect(CX - ww / 2 + ((hh >>> 20) % 200 - 100), yy, ww, 1)
        }
      }
    }
    /* 塌缩后的那颗点，交给主时间线的种子神经元 */
    var dotA = sm(2.35, 2.62, t) * (1 - sm(PRE + 0.3, PRE + 0.7, t))
    if (dotA > 0) {
      var ds = 18 + 26 * sm(2.5, PRE, t) + 8 * Math.sin(t * 14)
      ctx.globalAlpha = dotA; ctx.drawImage(SP_CY, CX - ds, CY - ds, ds * 2, ds * 2)
      ctx.drawImage(SP_WH, CX - ds / 3, CY - ds / 3, ds * 2 / 3, ds * 2 / 3)
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1
  }

  /* 总时间 ta = PRE + 主时间线 */
  function render(ta, live) { renderMain(ta - PRE, live); if (ta < PRE + 0.8) drawPre(ta); revealMask(ta - PRE) }
  var audioHint = ''
  function hud(ta) {
    hudMain(ta - PRE)
    /* 浏览器没放行声音时给一行小提示（不是必须操作，画面照常播） */
    var off = soundOn && !!(AC && AC.state !== 'running')
    var h = off ? '♪ 音效被浏览器拦截 · 按任意键 / 点一下开启' : (CFG.allowSkip ? 'ESC · SKIP' : '')
    if (h !== audioHint) { audioHint = h; elSkip.textContent = h; elSkip.style.color = off ? '#ffd27a' : '' }
    if (off) elSkip.style.opacity = String(Math.max(0.85, Number(elSkip.style.opacity) || 0))
  }
  function audioTick(ta) {
    if (!soundOn) return
    voiceTick(ta)
    if (!live()) return
    PRE_CUES.forEach(function (c) { if (ta >= c[0] && !fired[c[1]]) { fired[c[1]] = 1; if (ta - c[0] < 0.4) SFX[c[1]]() } })
    if (ta < PRE + 0.8 && typedPre !== lastTypedPre) { var n0 = AC.currentTime; if (n0 - lastTick > 0.03) { SFX.tick(); lastTick = n0 } lastTypedPre = typedPre }
    if (ta >= PRE) audioMain(ta - PRE)
  }
  var lastTypedPre = 0

  /* —— HUD（DOM，同样是 t 的纯函数）—— */
  var elTL = $q('.dnb-tl'), elTR = $q('.dnb-tr'), elLog = $q('.dnb-log'), elBar = $q('.dnb-bar'), elTitle = $q('.dnb-title'), elSkip = $q('.dnb-skip')
  var elT1 = $q('.dnb-t1'), elT2 = $q('.dnb-t2'), elT3 = $q('.dnb-t3'), elT4 = $q('.dnb-t4'), whale = $q('.dnb-whale path')
  var corners = Array.prototype.slice.call(nb.querySelectorAll('.dnb-cn'))
  function applyTexts() { elT3.textContent = CFG.subtitle; elT4.querySelector('span').textContent = CFG.badge }
  var SESSION = (hash(Date.now() & 0xffff, 7) >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 8)
  var LOG = [
    [0.30, 'dsh://neural-core', ' cold start', 'dim'],
    [1.00, 'allocating synapse lattice', ' ........ ok', 'ok'],
    [1.75, 'routing experts', ' ··· 256 / 256', 'ok'],
    [2.50, 'attention heads online', ' ··· 128', 'ok'],
    [3.30, 'condensing lattice', ' → operator', 'dim'],
    [4.20, 'rendering avatar', ' :: vector flow', 'dim'],
    [6.10, 'binding identity', ' ··· prime authority', 'ok'],
    [7.95, 'optic link', ' ··· established', 'ok'],
    [8.70, 'harness ready', '', 'ok']
  ]
  var GLYPH = '01<>/\\#$%&*+=ABCDEFXYZ'
  function scramble(str, t, t0, stagger) {
    var out = ''
    for (var i = 0; i < str.length; i++) {
      var lock = t0 + i * stagger + 0.25
      if (t < t0 + i * stagger * 0.5) out += ' '
      else if (t >= lock || str[i] === ' ') out += str[i]
      else out += GLYPH[hash(i, Math.floor(t * 26)) % GLYPH.length]
    }
    return out
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;') }
  var typed = 0
  function hudMain(t) {
    var hudA = sm(0.15, 0.8, t) * (1 - sm(T.exit - 0.1, T.exit + 0.6, t))
    ;[elTL, elTR, elLog, elBar, elSkip].forEach(function (e) { e.style.opacity = hudA })
    elSkip.style.opacity = hudA * 0.5
    corners.forEach(function (c, i) { var k = sm(0.1 + i * 0.08, 0.6 + i * 0.08, t); c.style.opacity = k * (1 - sm(T.exit, T.exit + 0.7, t)); c.style.transform = 'scale(' + (1.6 - 0.6 * k) + ')' })
    elTL.innerHTML = '<span class="dnb-k">DEEPSEEK HARNESS //</span> NEURAL BOOT\n<span class="dnb-k">SESSION</span> 0x' + SESSION + '   <span class="dnb-k">BUILD</span> N-26.10'
    var syn = 0; edges.forEach(function (e) { if (nodes[e[1]].birth < t) syn++ })
    var drawnN = 0; for (var i = 0; i < order.length; i++) if (order[i].start + order[i].dur < t) drawnN++
    var sync = clamp(t / T.title, 0, 1)
    elTR.textContent = 'T+' + t.toFixed(3).padStart(6, '0') + '\nSYNAPSE ' + String(syn * 37 + drawnN * 11).padStart(5, '0') +
      '\nVECTOR  ' + String(drawnN).padStart(4, '0') + '/' + order.length + '\nLINK    ' + (t > T.eyes ? 'OPTIC' : t > T.condense ? 'BIND' : 'SEED')
    var html = '', count = 0, shown = LOG.filter(function (l) { return t >= l[0] }).slice(-6)
    shown.forEach(function (l, idx) {
      var full = l[1] + l[2], n = Math.min(full.length, Math.floor((t - l[0]) * 58))
      count += n
      var a = full.slice(0, Math.min(n, l[1].length)), b = n > l[1].length ? full.slice(l[1].length, n) : ''
      var last = idx === shown.length - 1
      html += '<span class="dnb-dim">› </span>' + esc(a) + '<span class="dnb-' + l[3] + '">' + esc(b) + '</span>' + (last && Math.floor(t * 3) % 2 === 0 ? '<span class="dnb-cur"></span>' : '') + '\n'
    })
    elLog.innerHTML = html
    typed = count + LOG.filter(function (l) { return t >= l[0] }).length * 100
    elBar.querySelector('i').style.width = (sync * 100).toFixed(2) + '%'
    elBar.querySelector('span').textContent = 'SYNC ' + String(Math.round(sync * 100)).padStart(3, '0') + '%'

    /* 标题 */
    var ta = sm(T.title - 0.05, T.title + 0.35, t) * (1 - sm(T.exit - 0.05, T.exit + 0.4, t))
    elTitle.style.opacity = ta
    elTitle.style.filter = 'blur(' + ((1 - sm(T.title, T.title + 0.5, t)) * 6 + sm(T.exit - 0.05, T.exit + 0.4, t) * 8).toFixed(2) + 'px)'
    var wk = ease((t - T.title) / 1.1)
    whale.style.strokeDasharray = '1'; whale.style.strokeDashoffset = String(1 - wk)
    whale.style.fillOpacity = String(sm(T.title + 0.9, T.title + 1.5, t) * 0.92)
    elT1.textContent = scramble(CFG.title1, t, T.title + 0.05, 0.07)
    elT2.textContent = scramble(CFG.title2, t, T.title + 0.35, 0.06)
    elT3.style.opacity = sm(T.title + 0.7, T.title + 1.1, t)
    elT3.style.letterSpacing = (0.42 + 0.4 * (1 - sm(T.title + 0.7, T.title + 1.4, t))) + 'em'
    elT4.style.opacity = sm(T.title + 1.05, T.title + 1.3, t) * (0.85 + 0.15 * Math.sin(t * 8))
  }

  /* —— 声音：全部 Web Audio 现场合成 ——
   * 音色只用正弦/三角波 + 混响 + 延迟，不用噪声和锯齿波：
   * 玻璃钟、八音盒、竖琴式琶音、柔和的长音铺底，全部落在 A 大调五声音阶上，听起来干净、清脆。 */
  var AC = null, OUT = null, REV = null, DLY = null, drone = null
  function audioInit() {
    if (AC || MUTE) return
    try { AC = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { AC = null; return }
    var comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 2.5
    OUT = AC.createGain(); OUT.gain.value = outLevel(); OUT.connect(comp); comp.connect(AC.destination)
    /* 混响：平滑衰减的冲激响应（只作空间感，不直接出声） */
    var len = AC.sampleRate * 3.2, ir = AC.createBuffer(2, len, AC.sampleRate)
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) }
    var revIn = AC.createBiquadFilter(); revIn.type = 'lowpass'; revIn.frequency.value = 5200
    REV = AC.createConvolver(); REV.buffer = ir; revIn.connect(REV); var rg = AC.createGain(); rg.gain.value = 0.5; REV.connect(rg); rg.connect(OUT)
    REV = revIn
    /* 延迟：节拍对齐的回声，让单音有「水晶回响」 */
    DLY = AC.createDelay(1); DLY.delayTime.value = 0.32
    var fb = AC.createGain(); fb.gain.value = 0.34; var dl = AC.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 4200
    DLY.connect(dl); dl.connect(fb); fb.connect(DLY); var dg = AC.createGain(); dg.gain.value = 0.3; dl.connect(dg); dg.connect(OUT)
  }
  function live() { return AC && AC.state === 'running' }
  function sec(x) { return x / SPEED }
  function bus(node, dry, rev, dly, pan) {
    var p = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain()
    if (p.pan) p.pan.value = pan || 0
    node.connect(p)
    var g1 = AC.createGain(); g1.gain.value = dry; p.connect(g1); g1.connect(OUT)
    if (rev) { var g2 = AC.createGain(); g2.gain.value = rev; p.connect(g2); g2.connect(REV) }
    if (dly) { var g3 = AC.createGain(); g3.gain.value = dly; p.connect(g3); g3.connect(DLY) }
  }
  function tone(type, f, peak, a, d, opt) {
    opt = opt || {}
    var t0 = AC.currentTime + (opt.at || 0), o = AC.createOscillator(), g = AC.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t0)
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + a + d)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a)
    if (opt.cut) g.gain.setValueAtTime(peak, t0 + a + d - 0.02), g.gain.linearRampToValueAtTime(0.0001, t0 + a + d)
    else g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d)
    o.connect(g); bus(g, opt.dry == null ? 1 : opt.dry, opt.rev || 0, opt.dly || 0, opt.pan)
    o.start(t0); o.stop(t0 + a + d + 0.05)
  }
  /* 玻璃钟：谐波分音（1、2、3、4 倍）各自衰减，高音先散，尾音干净 */
  function bell(f, peak, dur, opt) {
    opt = opt || {}
    ;[[1, 1, 1], [2, 0.32, 0.55], [3, 0.12, 0.32], [4.01, 0.05, 0.2]].forEach(function (p) {
      tone('sine', f * p[0], peak * p[1], 0.003, dur * p[2], { at: opt.at, rev: opt.rev == null ? 0.55 : opt.rev, dly: opt.dly || 0, pan: opt.pan, dry: opt.dry })
    })
  }
  /* 八音盒拨音：三角波，极短起音 */
  function pluck(f, peak, dur, opt) {
    opt = opt || {}
    tone('triangle', f, peak, 0.002, dur, { at: opt.at, rev: 0.45, dly: opt.dly == null ? 0.35 : opt.dly, pan: opt.pan })
    tone('sine', f * 2, peak * 0.25, 0.002, dur * 0.4, { at: opt.at, rev: 0.4, pan: opt.pan })
  }
  /* A 大调五声音阶 */
  var A4 = 440
  function note(semi) { return A4 * Math.pow(2, semi / 12) }
  var PENTA = [0, 2, 4, 7, 9]
  function penta(i) { var o = Math.floor(i / 5), k = ((i % 5) + 5) % 5; return note(PENTA[k] + o * 12) }

  /* DX 风格 FM 合成：ratio=1 是温暖的电钢琴，ratio=3.5 是清亮的钟。起音亮、尾音干净，是「动听」的主力音色 */
  function fm(f, peak, dur, opt) {
    opt = opt || {}
    var t0 = AC.currentTime + (opt.at || 0)
    var car = AC.createOscillator(), mod = AC.createOscillator(), mg = AC.createGain(), g = AC.createGain()
    car.frequency.value = f; mod.frequency.value = f * (opt.ratio || 1)
    var idx = (opt.index == null ? 2 : opt.index) * f
    mg.gain.setValueAtTime(idx, t0); mg.gain.exponentialRampToValueAtTime(idx * 0.06 + 1, t0 + dur * 0.5)
    mod.connect(mg); mg.connect(car.frequency); car.connect(g)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + (opt.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    bus(g, 1, opt.rev == null ? 0.45 : opt.rev, opt.dly || 0, opt.pan)
    car.start(t0); mod.start(t0); car.stop(t0 + dur + 0.05); mod.stop(t0 + dur + 0.05)
  }
  function epiano(f, peak, dur, opt) { opt = opt || {}; opt.ratio = 1; opt.index = opt.index == null ? 1.6 : opt.index; fm(f, peak, dur, opt) }
  function chime(f, peak, dur, opt) { opt = opt || {}; opt.ratio = 3.5; opt.index = opt.index == null ? 1.3 : opt.index; fm(f, peak, dur, opt) }
  function swell(freqs, peak, a, hold, rel, opt) {
    opt = opt || {}
    freqs.forEach(function (f, i) {
      var t0 = AC.currentTime + (opt.at || 0), o = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain()
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = i % 2 ? 6 : -6
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t0); lp.frequency.exponentialRampToValueAtTime(opt.bright || 2600, t0 + a)
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a)
      g.gain.setValueAtTime(peak, t0 + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + rel)
      o.connect(lp); lp.connect(g); bus(g, 1, 0.6, 0.1, (i / Math.max(1, freqs.length - 1) - 0.5) * 0.9)
      o.start(t0); o.stop(t0 + a + hold + rel + 0.05)
    })
  }

  var SFX = {
    /* 铺底：中音区两层三角波（笔记本扬声器也听得见），低通 + 缓慢呼吸 */
    drone: function (t) {
      if (drone) return
      var t0 = AC.currentTime, g = AC.createGain(), lp = AC.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.7
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.055, t0 + sec(2.5))
      var oscs = []
      ;[[note(-12), 1], [note(-5), 0.7], [note(0), 0.35], [note(4), 0.18]].forEach(function (v, i) {
        var o = AC.createOscillator(), og = AC.createGain(); o.type = 'triangle'; o.frequency.value = v[0]; o.detune.value = i % 2 ? 5 : -5
        og.gain.value = v[1]; o.connect(og); og.connect(lp); o.start(t0); oscs.push(o)
      })
      var lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.2; lg.gain.value = 350; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t0); oscs.push(lfo)
      lp.connect(g); bus(g, 1, 0.55, 0.1, 0)
      drone = { g: g, oscs: oscs }
    },
    droneOff: function () {
      if (!drone) return
      var t0 = AC.currentTime; drone.g.gain.cancelScheduledValues(t0); drone.g.gain.setValueAtTime(Math.max(0.0001, drone.g.gain.value), t0)
      drone.g.gain.exponentialRampToValueAtTime(0.0001, t0 + sec(1.2))
      drone.oscs.forEach(function (o) { o.stop(t0 + sec(1.3)) }); drone = null
    },

    /* —— 冷启动 —— */
    blink: function () { chime(note(24), 0.05, 0.4, { rev: 0.5 }) },
    tick: function () { tone('sine', note(38 + ((Math.random() * 3) | 0) * 2), 0.012, 0.001, 0.025, { rev: 0.15, pan: -0.3 }) },
    power: function () {
      /* 开机主题：A–C#–E–A–C# 电钢琴上行 + 和弦铺开 + 高处一声钟——整段的「签名音」 */
      ;[0, 4, 7, 12, 16].forEach(function (s, i) { epiano(note(s), 0.15, sec(1.8), { at: sec(i * 0.12), dly: 0.25, pan: (i - 2) * 0.22 }) })
      swell([note(-12), note(-5), note(0), note(4)], 0.05, sec(0.7), sec(0.4), sec(1.2), { at: sec(0.45) })
      chime(note(19), 0.07, sec(2.6), { at: sec(0.6), rev: 0.9, dly: 0.35 })
    },
    charge: function () { for (var i = 0; i < 8; i++) chime(penta(12 + i), 0.05, 0.4, { at: sec(i * 0.06), pan: i % 2 ? 0.45 : -0.45, dly: 0.2 }) },

    /* —— 主体 —— */
    seed: function () { chime(note(12), 0.09, sec(2.2), { dly: 0.35 }) },
    bloom: function () {
      tone('sine', note(-24), 0.25, 0.01, sec(1.4), { rev: 0.3 })
      ;[0, 7, 12, 16].forEach(function (s, i) { chime(note(s), 0.09, sec(2.8), { at: i * 0.02, rev: 0.8, pan: (i - 1.5) * 0.35 }) })
    },
    blip: function () { chime(penta(12 + ((Math.random() * 8) | 0)), 0.045, 0.35, { pan: Math.random() * 1.6 - 0.8, dly: 0.45 }) },
    condense: function () { for (var i = 0; i < 12; i++) epiano(penta(4 + i), 0.08, 0.9, { at: sec(i * 0.085), pan: (i / 11 - 0.5) * 1.2, dly: 0.2, index: 1.1 }) },
    spark: function () { chime(penta(16 + ((Math.random() * 6) | 0)), 0.022, 0.25, { pan: Math.random() * 1.8 - 0.9, dly: 0.45 }) },
    scan: function () {
      tone('sine', note(7), 0.07, sec(0.15), sec(0.8), { to: note(19), rev: 0.6, dly: 0.2 })
      tone('triangle', note(14), 0.035, sec(0.15), sec(0.8), { to: note(26), rev: 0.6 })
    },
    eyes: function () {
      tone('sine', note(-17), 0.22, 0.004, sec(1.4), { rev: 0.3 })
      ;[[7, 0.11], [11, 0.08], [14, 0.07], [19, 0.06]].forEach(function (p, i) { chime(note(p[0]), p[1], sec(3.2), { at: i * 0.035, rev: 0.9, dly: 0.3, pan: (i - 1.5) * 0.35 }) })
    },
    pad: function () {
      swell([note(-12), note(-5), note(0), note(4), note(11), note(14)], 0.035, sec(1.2), sec(T.burst - T.title - 1.6), sec(0.6))
      ;[7, 12, 14, 16, 19].forEach(function (s, i) { epiano(note(s), 0.11, sec(1.6), { at: sec(0.12 + i * 0.14), pan: (i - 2) * 0.3, dly: 0.25 }) })
    },

    /* —— 终幕 —— */
    implode: function () {
      ;[12, 16, 19].forEach(function (s) { tone('sine', note(s), 0.07, sec(0.85), sec(0.05), { rev: 0.5, cut: true }) })
      for (var i = 0; i < 10; i++) chime(penta(22 - i), 0.04, 0.25, { at: sec(0.85 * (1 - Math.pow(1 - i / 10, 1.6))), pan: i % 2 ? 0.5 : -0.5, dly: 0.2 })
    },
    beat: function () {
      /* 核心蓄力的心跳：一声软低音 + 一点高处的钟 */
      tone('sine', 82, 0.2, 0.004, sec(0.3), { to: 52, rev: 0.25 })
      chime(note(24), 0.02, 0.3, { rev: 0.5 })
    },
    riser: function () { tone('sine', note(0), 0.06, sec(0.6), 0.03, { to: note(24), rev: 0.5, cut: true }); tone('triangle', note(7), 0.03, sec(0.6), 0.03, { to: note(31), rev: 0.5, cut: true }) },
    burst: function () {
      tone('sine', note(-24), 0.3, 0.004, sec(1.8), { rev: 0.3 })
      ;[-12, 0, 4, 7, 12].forEach(function (s, i) { epiano(note(s), 0.11, sec(3.2), { at: i * 0.01, pan: (i - 2) * 0.3, dly: 0.2 }) })
      ;[16, 19, 24].forEach(function (s, i) { chime(note(s), 0.07, sec(3.6), { at: 0.02 + i * 0.03, rev: 1, dly: 0.3, pan: (i - 1) * 0.5 }) })
      for (var j = 0; j < 14; j++) chime(penta(16 + ((Math.random() * 8) | 0)), 0.03, 0.3, { at: sec(0.1 + j * 0.06 + Math.random() * 0.03), pan: Math.random() * 1.8 - 0.9, dly: 0.4 })
      swell([note(-12), note(-5), note(0), note(4)], 0.04, 0.05, sec(0.3), sec(1.8))
    },
    /* 播报前的「通讯接通」双音 + 托在人声下面的低音，给女声加一点分量 */
    comms: function () {
      chime(note(19), 0.06, 0.3, { rev: 0.4 }); chime(note(12), 0.05, 0.45, { at: 0.09, rev: 0.4 })
      swell([note(-24), note(-17)], 0.07, 0.25, sec(1.1), sec(0.7), { bright: 500 })
    }
  }

  /* —— 机械女声播报（Web Speech API，纯英文）——
   * 只念两句：角色编制前「Identity confirmed. Prime authority.」，编制完成后「Welcome back.」。
   * 低音调 + 慢语速 = 沉稳的「系统主脑」腔。音色可在预览页底部切换（?vn=音色名 也行），?voice=0 关闭。 */
  /* 两句：网络收拢、角色开始编制之前念身份确认；线稿编制完、双眼点亮时念欢迎回来 */
  var VOICE_AT = [PRE + T.condense - 3.2, PRE + T.eyes - 0.75]
  var SYN = window.speechSynthesis || null, voicePick = null
  var PREFER = ['sonia', 'libby', 'aria', 'jenny', 'michelle', 'emma', 'ava', 'natasha', 'clara', 'natural', 'online', 'zira', 'samantha', 'karen', 'female']
  var AVOID = ['guy', 'davis', 'christopher', 'eric', 'ryan', 'david', 'mark', 'brian', 'andrew', 'male']
  function englishVoices() {
    return (SYN ? SYN.getVoices() || [] : []).filter(function (v) { return String(v.lang || '').toLowerCase().indexOf('en') === 0 })
  }
  function pickVoice() {
    var list = englishVoices(), want = window.__DSH_VOICE__ || CFG.voiceName
    voicePick = null
    if (want) list.forEach(function (v) { if (v.name === want) voicePick = v })
    if (voicePick) return
    var bs = -1e9
    list.forEach(function (v) {
      var n = String(v.name || '').toLowerCase(), s = 0
      PREFER.forEach(function (k, i) { if (n.indexOf(k) !== -1) s += 60 - i * 2 })
      AVOID.forEach(function (k) { if (n.indexOf(k) !== -1) s -= 200 })
      if (s > bs) { bs = s; voicePick = v }
    })
  }
  if (SYN) { pickVoice(); try { SYN.addEventListener('voiceschanged', pickVoice) } catch (e) {} }
  var spoken = {}
  function say(text) {
    try {
      pickVoice()
      var u = new SpeechSynthesisUtterance(text)
      if (voicePick) { u.voice = voicePick; u.lang = voicePick.lang } else u.lang = 'en-US'
      u.rate = num(CFG.voiceRate, 0.86, 0.5, 2) * Math.min(1.5, SPEED); u.pitch = num(CFG.voicePitch, 0.72, 0, 2); u.volume = num(CFG.voiceVolume, 0.5, 0, 1)
      SYN.speak(u)
      if (live() && soundOn) {
        SFX.comms()
        var t0 = AC.currentTime; OUT.gain.cancelScheduledValues(t0); OUT.gain.setTargetAtTime(outLevel() * 0.7, t0, 0.08); OUT.gain.setTargetAtTime(outLevel(), t0 + 1.8, 0.4)
      }
    } catch (e) {}
  }
  function voiceTick(ta) {
    if (!SYN || !CFG.voice || MUTE) return
    var texts = [CFG.line1, CFG.line2]
    VOICE_AT.forEach(function (at, i) { if (ta >= at && !spoken[i]) { spoken[i] = 1; if (ta - at < 0.5 && String(texts[i] || '').trim()) say(texts[i]) } })
  }

  var CUES = [[0.05, 'drone'], [0.12, 'seed'], [T.bloom, 'bloom'], [T.condense, 'condense'], [T.scan, 'scan'], [T.eyes, 'eyes'], [T.title, 'pad'], [T.exit, 'implode'], [T.burst - 0.6, 'riser'], [T.burst, 'burst'], [T.burst + 0.02, 'droneOff']]
  var PRE_CUES = [[0.3, 'blink'], [1.08, 'power'], [1.98, 'charge']]
  var lastBeat = -1, fired = {}, lastBlip = 0, lastTick = 0, lastSpark = 0, lastTyped = 0
  function audioMain(t) {
    if (!live()) return
    CUES.forEach(function (c) {
      if (t >= c[0] && !fired[c[1]]) {
        fired[c[1]] = 1
        /* 恢复得晚（比如首帧被浏览器静音）就别补放已过时的单发音，避免一次性炸出来 */
        if (c[1] === 'drone' || c[1] === 'droneOff' || t - c[0] < 0.4) SFX[c[1]](t)
      }
    })
    if (!drone && t > 0.05 && t < T.burst) SFX.drone(t)
    var now = AC.currentTime
    if (events.blips > 0) { if (now - lastBlip > 0.11) { SFX.blip(); lastBlip = now } events.blips = 0 }
    if (typed !== lastTyped) { if (now - lastTick > 0.045) { SFX.tick(); lastTick = now } lastTyped = typed }
    if (t > T.lines && t < T.scan && now - lastSpark > 0.09 + Math.random() * 0.1) { SFX.spark(); lastSpark = now }
    /* 核心蓄力：心跳 */
    if (t > T.core - 0.1 && t < T.burst - 0.65) { var bi = Math.floor((t - T.core + 0.1) / 0.45); if (bi !== lastBeat) { lastBeat = bi; SFX.beat() } }
  }

  /* —— 主循环与生命周期 —— */
  var t0 = 0, raf = 0, running = false
  var inerted = []
  function now() { return performance.now() }
  function markShown() {
    try {
      if (CFG.mode === 'session') window.sessionStorage.setItem('dsh-neural-startup:shown', '1')
      if (CFG.mode === 'daily') window.localStorage.setItem('dsh-neural-startup:day', new Date().toISOString().slice(0, 10))
    } catch (e) { /* 隐私模式下存储可能抛错，忽略 */ }
  }
  /* 播放期间把宿主页面设为 inert：键盘焦点不会跑到底下的输入框里 */
  function lockHost() {
    document.documentElement.classList.add('dnb-lock')
    var kids = document.body ? document.body.children : []
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i]
      if (k === nb || k.tagName === 'SCRIPT' || k.hasAttribute('inert')) continue
      k.setAttribute('inert', ''); inerted.push(k)
    }
  }
  function unlockHost() {
    document.documentElement.classList.remove('dnb-lock')
    inerted.forEach(function (k) { try { k.removeAttribute('inert') } catch (e) {} }); inerted = []
  }
  function finish() {
    running = false; cancelAnimationFrame(raf)
    nb.classList.add('dnb-gone'); nb.style.webkitMaskImage = ''; nb.style.maskImage = ''
    if (AC && drone) SFX.droneOff()
    unlockHost(); markShown()
    try { window.dispatchEvent(new CustomEvent('dsh-neural:done')) } catch (e) {}
  }
  function frame() {
    var t = (now() - t0) / 1000 * SPEED
    if (t >= PRE + T.end) { finish(); return }
    render(t, true); hud(t); audioTick(t)
    raf = requestAnimationFrame(frame)
  }
  function start() {
    cancelAnimationFrame(raf)
    nb.className = 'dnb-root'; nb.style.webkitMaskImage = ''; nb.style.maskImage = ''
    applyTexts(); applySound(); lockHost()
    pulses.length = 0; lastSpawn = 0; lastTypedPre = 0; lastBeat = -1; fired = {}; spoken = {}; if (SYN) { try { SYN.cancel() } catch (e) {} } nodes.forEach(function (n) { n.flash = -9 })
    resize()
    audioInit()
    if (AC && AC.state !== 'running') { try { AC.resume() } catch (e) {} }
    t0 = now(); running = true; raf = requestAnimationFrame(frame)
  }
  function skip() {
    if (!running || !CFG.allowSkip) return
    var t = (now() - t0) / 1000 * SPEED
    if (t < PRE + T.exit) t0 = now() - (PRE + T.exit) / SPEED * 1000
  }

  /* —— 右上角声音开关：选择记在 localStorage，这次关了下次打开还是关，反之亦然；
         没碰过开关时听设置页的「声音」默认值 —— */
  var SOUND_KEY = 'dsh-neural-startup:sound'
  function readSound() {
    try { var v = localStorage.getItem(SOUND_KEY); if (v === '0') return false; if (v === '1') return true } catch (e) {}
    return CFG.sound !== false
  }
  var soundOn = readSound()
  function outLevel() { return soundOn ? num(CFG.soundVolume, 0.9, 0, 1) : 0 }
  var elSnd = $q('.dnb-snd')
  function applySound() {
    soundOn = readSound()
    elSnd.hidden = CFG.soundButton === false
    elSnd.setAttribute('aria-pressed', soundOn ? 'true' : 'false')
    elSnd.setAttribute('aria-label', soundOn ? '关闭开机动画声音' : '开启开机动画声音')
    elSnd.classList.toggle('dnb-off', !soundOn)
    elSnd.querySelector('span').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF'
    if (AC && OUT) { var n = AC.currentTime; OUT.gain.cancelScheduledValues(n); OUT.gain.setTargetAtTime(outLevel(), n, 0.04) }
    if (!soundOn && SYN) { try { SYN.cancel() } catch (e) {} }
  }
  elSnd.addEventListener('click', function (e) {
    e.stopPropagation()
    var next = !soundOn
    try { localStorage.setItem(SOUND_KEY, next ? '1' : '0') } catch (err) {}
    if (next) { audioInit(); wake() }
    applySound()
  })

  /* 浏览器的自动播放策略：没有用户手势时 AudioContext 是挂起的。
     这里不要求任何点击——画面照常播放；用户只要碰一下键盘/鼠标，声音就从当下接上。 */
  function wake() { if (running && AC && AC.state !== 'running') { try { AC.resume() } catch (e) {} } }
  ;['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, wake, { passive: true }) })
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && running) skip()
    if (PREVIEW && (e.key === 'r' || e.key === 'R') && !running) start()
  })
  window.addEventListener('resize', function () {
    if (!running && FREEZE == null) return
    resize()
    if (!running && FREEZE != null) { render(FREEZE, false); hud(FREEZE) }
  })

  window.__DSH_NEURAL_API__ = {
    /* 重播；传入 cfg 可用草稿配置预览（设置页的「立即预览」用这个） */
    replay: function (over) { applyConfig(over); start() },
    skip: skip,
    englishVoices: englishVoices,
    say: function (text) { say(text || CFG.line1) },
    get running() { return running }
  }

  if (FREEZE != null) {
    nb.className = 'dnb-root'; applyTexts(); applySound(); resize(); render(FREEZE, false); hud(FREEZE)
  } else start()
})()
