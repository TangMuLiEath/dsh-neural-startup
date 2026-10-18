/* 运行时（lib/boot.js）测试：在最小 DOM 桩里真跑一遍时间线。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installDom, makeEl } from './_dom.mjs'

const SRC = fs.readFileSync(new URL('../lib/boot.js', import.meta.url), 'utf8')

function boot(cfg = {}, opts = {}) {
  const env = installDom(opts)
  delete globalThis.__DSH_NEURAL_LOADED__
  delete globalThis.__DSH_NEURAL_API__
  delete globalThis.__FREEZE__
  delete globalThis.AudioContext
  delete globalThis.speechSynthesis
  const app = makeEl('div'); app.id = 'root'; env.body.appendChild(app)
  const root = makeEl('div'); root.id = 'dsh-neural-root'; root.className = 'dnb-root dnb-boot'; env.body.appendChild(root)
  globalThis.__DSH_NEURAL__ = cfg
  if (opts.before) opts.before(env)
  new Function(SRC)()
  return { env, app, root, api: globalThis.__DSH_NEURAL_API__ }
}

test('接管根节点、锁住宿主、播完放行并记下本会话已播', () => {
  const { env, app, root, api } = boot({ mode: 'session' })
  assert.ok(!root.classList.contains('dnb-boot'), '运行时接管后要摘掉 dnb-boot（Host 的 9 秒兜底靠它判断）')
  assert.ok(env.html.classList.contains('dnb-lock'))
  assert.ok(app.hasAttribute('inert'), '播放期间宿主页面应为 inert')
  assert.equal(api.running, true)
  env.run(17000)
  assert.equal(api.running, false)
  assert.ok(root.classList.contains('dnb-gone'))
  assert.ok(!env.html.classList.contains('dnb-lock'))
  assert.ok(!app.hasAttribute('inert'))
  assert.equal(sessionStorage.getItem('dsh-neural-startup:shown'), '1')
})

test('daily 模式写今天的日期', () => {
  const { env } = boot({ mode: 'daily' })
  env.run(17000)
  assert.equal(localStorage.getItem('dsh-neural-startup:day'), new Date().toISOString().slice(0, 10))
})

test('Esc 跳到神经回收，约 2.7 秒内结束；关闭允许跳过后 Esc 无效', () => {
  let r = boot({})
  r.env.run(3000)
  r.env.fire('keydown', { key: 'Escape' })
  r.env.run(2900)
  assert.equal(r.api.running, false)

  r = boot({ allowSkip: false })
  r.env.run(3000)
  r.env.fire('keydown', { key: 'Escape' })
  r.env.run(2900)
  assert.equal(r.api.running, true)
})

test('速度倍率整体缩放时长', () => {
  const { env, api } = boot({ speed: 2 })
  env.run(8300)
  assert.equal(api.running, false, '2× 时 16.15 秒的动画应在 8.1 秒左右结束')
})

test('replay 可带草稿配置，标题文字跟着变', () => {
  const { env, root, api } = boot({})
  env.run(17000)
  api.replay({ title1: 'NEURAL', subtitle: '测试副标题' })
  assert.equal(api.running, true)
  assert.ok(!root.classList.contains('dnb-gone'))
  env.run(12500)
  assert.equal(root.querySelector('.dnb-t1').textContent, 'NEURAL')
  assert.equal(root.querySelector('.dnb-t3').textContent, '测试副标题')
})

test('非预览模式不响应 R 键重播', () => {
  const { env, api } = boot({})
  env.run(17000)
  env.fire('keydown', { key: 'r' })
  assert.equal(api.running, false)
})

test('声音开关：点击后写入 localStorage，下次启动沿用', () => {
  let r = boot({})
  const btn = r.root.querySelector('.dnb-snd')
  assert.equal(btn.getAttribute('aria-pressed'), 'true')
  btn.dispatch('click')
  assert.equal(localStorage.getItem('dsh-neural-startup:sound'), '0')
  assert.equal(btn.getAttribute('aria-pressed'), 'false')

  /* 模拟下次打开：同一份 localStorage */
  const saved = localStorage
  r = boot({}, { before: () => { globalThis.localStorage = saved } })
  assert.equal(r.root.querySelector('.dnb-snd').getAttribute('aria-pressed'), 'false')
})

test('设置里关掉声音按钮时按钮隐藏', () => {
  const { root } = boot({ soundButton: false })
  assert.equal(root.querySelector('.dnb-snd').hidden, true)
})

test('有 AudioContext 与语音时：音效排程、两句台词按顺序念出；关掉语音则不念', () => {
  const said = []
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} })
  const node = () => new Proxy({ connect: (n) => n, start() {}, stop() {} }, {
    get(t, k) { if (k in t) return t[k]; if (['gain', 'frequency', 'Q', 'detune', 'delayTime', 'pan', 'threshold', 'ratio'].includes(k)) return (t[k] = param()); return undefined },
    set(t, k, v) { t[k] = v; return true }
  })
  let nodes = 0
  class AC {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = node() }
    createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) } }
    resume() {}
  }
  for (const m of ['createGain', 'createOscillator', 'createBiquadFilter', 'createDynamicsCompressor', 'createConvolver', 'createDelay', 'createStereoPanner', 'createBufferSource']) {
    AC.prototype[m] = function () { nodes++; return node() }
  }
  const install = () => {
    globalThis.AudioContext = AC
    globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
    globalThis.speechSynthesis = {
      getVoices: () => [{ name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB' }, { name: 'Microsoft Guy Online', lang: 'en-US' }],
      speak: (u) => said.push([u.text, u.voice && u.voice.name, u.volume]), cancel() {}, addEventListener() {}
    }
  }
  let r = boot({ voiceVolume: 0.4 }, { before: install })
  r.env.run(17000)
  assert.ok(nodes > 200, '应排程大量音效节点，实际 ' + nodes)
  assert.deepEqual(said.map((s) => s[0]), ['Identity confirmed. Prime authority.', 'Welcome back.'])
  assert.ok(said.every((s) => /Sonia/.test(s[1])), '默认优先 Sonia 女声')
  assert.equal(said[0][2], 0.4)

  said.length = 0
  r = boot({ voice: false }, { before: install })
  r.env.run(17000)
  assert.equal(said.length, 0)
})

test('源码不引用任何外部媒体文件', () => {
  assert.ok(!/\.(mp3|wav|ogg|m4a|mp4|png|jpe?g|webp)\b/i.test(SRC))
})

test('桌面端窗口按钮避让：WCO API 优先，Electron 无边框窗口回落 40px，普通浏览器为 0', () => {
  const nav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true })
  const orig = globalThis.navigator
  try {
    let r = boot({}, { before: () => nav({ userAgent: 'Mozilla/5.0 Chrome/130' }) })
    assert.equal(r.root.style['--dnb-wco'], '0px')

    r = boot({}, { before: () => { nav({ userAgent: 'Mozilla/5.0 dsh-desktop Electron/33.0.0' }); globalThis.outerHeight = 900 } })
    assert.equal(r.root.style['--dnb-wco'], '40px')

    r = boot({}, { before: () => nav({ userAgent: 'Electron/33', windowControlsOverlay: { visible: true, addEventListener() {}, getTitlebarAreaRect: () => ({ x: 0, y: 0, width: 1460, height: 33 }) } }) })
    assert.equal(r.root.style['--dnb-wco'], '33px')
  } finally { nav(orig); delete globalThis.outerHeight }
})
