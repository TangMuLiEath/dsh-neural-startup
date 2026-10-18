/* 最小 DOM / Canvas / 存储桩：够把 lib/boot.js 与 lib/client.js 在 Node 里真跑起来。
 * 不追求完整，只覆盖运行时实际用到的接口；没覆盖到的调用会直接抛错，正好暴露问题。 */

export function makeEl(tag = 'div') {
  const attrs = new Map()
  const classes = new Set()
  const listeners = {}
  const el = {
    tagName: tag.toUpperCase(), style: { setProperty(k, v) { this[k] = v } }, children: [], parentNode: null, hidden: false, textContent: '', dataset: {},
    _html: '', _q: new Map(),
    get innerHTML() { return this._html }, set innerHTML(v) { this._html = String(v) },
    get className() { return [...classes].join(' ') },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c)) },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c), toggle: (c, on) => { const v = on === undefined ? !classes.has(c) : on; v ? classes.add(c) : classes.delete(c); return v }
    },
    setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    hasAttribute: (k) => attrs.has(k), removeAttribute: (k) => attrs.delete(k),
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn) }, removeEventListener() {},
    dispatch(t, ev = {}) { (listeners[t] || []).forEach((fn) => fn({ stopPropagation() {}, preventDefault() {}, ...ev })) },
    appendChild(c) { c.parentNode = el; el.children.push(c); return c },
    removeChild(c) { el.children = el.children.filter((x) => x !== c); c.parentNode = null; return c },
    querySelector(sel) {
      if (!el._q.has(sel)) el._q.set(sel, sel.includes('cv') && globalThis.__makeCanvas ? globalThis.__makeCanvas() : makeEl())
      return el._q.get(sel)
    },
    querySelectorAll: (sel) => (sel === '.dnb-cn' ? [makeEl(), makeEl(), makeEl(), makeEl()] : []),
    getContext: () => stubCtx()
  }
  return el
}

export function stubCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k]
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} })
      if (k === 'measureText') return (s) => ({ width: String(s).length * 7.2 })
      return () => {}
    },
    set(t, k, v) { t[k] = v; return true }
  })
}

export function makeStore() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }
}

/** 装一套全局环境；返回控制柄（推进时钟、跑帧、读元素）。 */
export function installDom({ width = 1600, height = 900, search = '' } = {}) {
  const byId = new Map()
  const head = makeEl('head'), body = makeEl('body'), html = makeEl('html')
  const winListeners = {}
  const doc = {
    head, body, documentElement: html,
    getElementById: (id) => byId.get(id) || [...body.children, ...head.children].find((c) => c.id === id) || null,
    createElement: (tag) => (tag === 'canvas' && globalThis.__makeCanvas ? globalThis.__makeCanvas() : makeEl(tag)),
    querySelector: () => null, querySelectorAll: () => []
  }
  let clock = 0
  let rafs = []
  const g = globalThis
  g.window = g; g.document = doc
  g.location = { search, reload() { g.__reloaded = true } }
  g.innerWidth = width; g.innerHeight = height; g.devicePixelRatio = 1
  g.addEventListener = (t, fn) => { (winListeners[t] ||= []).push(fn) }
  g.removeEventListener = () => {}
  g.dispatchEvent = (ev) => { (winListeners[ev.type] || []).forEach((fn) => fn(ev)) }
  g.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail } }
  g.requestAnimationFrame = (fn) => { rafs.push(fn); return rafs.length }
  g.cancelAnimationFrame = () => {}
  g.performance = { now: () => clock }
  g.sessionStorage = makeStore(); g.localStorage = makeStore()
  return {
    doc, body, html, byId, winListeners,
    fire(type, ev = {}) { (winListeners[type] || []).forEach((fn) => fn({ type, ...ev })) },
    /** 推进 ms 毫秒，按 60fps 跑完期间的所有帧 */
    run(ms) { const end = clock + ms; while (clock < end) { clock += 16.7; const q = rafs; rafs = []; q.forEach((f) => f()) } },
    get clock() { return clock }
  }
}
