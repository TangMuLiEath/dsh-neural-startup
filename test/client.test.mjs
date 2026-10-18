/* 浏览器半侧（lib/client.js）：Host 注入没生效时，apply() 要同步盖上黑幕，避免先露出客户端界面。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installDom } from './_dom.mjs'

const SRC = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function load(env, fetchResult) {
  let entry
  globalThis.__ModuleLoader__ = { load(v) { entry = v } }
  let resolveFetch
  globalThis.fetch = () => new Promise((r) => { resolveFetch = r })
  new Function(SRC)()
  const mod = entry.factory(() => ({ createElement() {}, useState: (v) => [v, () => {}], useEffect() {} }))
  const settle = async (config) => { resolveFetch({ ok: true, json: async () => ({ ok: true, config }) }); for (let i = 0; i < 5; i++) await Promise.resolve() }
  return { mod, settle }
}
const ctx = { slots: { inject() {}, register() {} } }
const root = (env) => env.body.children.find((c) => c.id === 'dsh-neural-root')

test('没有 Host 注入：apply() 同步盖黑幕，拉到配置后挂 launch.js', async () => {
  const env = installDom()
  delete globalThis.__DSH_NEURAL_HOST__; delete globalThis.__DSH_NEURAL_LAUNCH__
  const { mod, settle } = load(env)
  mod.apply(ctx)
  const r = root(env)
  assert.ok(r, 'apply 返回前就应有黑幕')
  assert.ok(r.classList.contains('dnb-boot'))
  assert.match(r.style.cssText, /position:fixed/)
  await settle({ enabled: true, mode: 'session' })
  assert.ok(env.doc.head.children.some((c) => /\/dsh-neural\/launch\.js$/.test(c.src || '')))
  assert.equal(JSON.parse(localStorage.getItem('dsh-neural-startup:cfg')).enabled, true, '配置要缓存给下次同步判定')
})

test('最新配置是关闭：先盖的黑幕要撤掉', async () => {
  const env = installDom()
  delete globalThis.__DSH_NEURAL_HOST__; delete globalThis.__DSH_NEURAL_LAUNCH__
  const { mod, settle } = load(env)
  mod.apply(ctx)
  assert.ok(root(env))
  await settle({ enabled: false, mode: 'session' })
  assert.equal(root(env), undefined)
  assert.ok(!env.html.classList.contains('dnb-lock'))
})

test('缓存显示本会话已播 / 已关闭：一开始就不盖黑幕', () => {
  let env = installDom()
  delete globalThis.__DSH_NEURAL_HOST__; delete globalThis.__DSH_NEURAL_LAUNCH__
  localStorage.setItem('dsh-neural-startup:cfg', JSON.stringify({ enabled: true, mode: 'session' }))
  sessionStorage.setItem('dsh-neural-startup:shown', '1')
  load(env).mod.apply(ctx)
  assert.equal(root(env), undefined)

  env = installDom()
  localStorage.setItem('dsh-neural-startup:cfg', JSON.stringify({ enabled: false }))
  load(env).mod.apply(ctx)
  assert.equal(root(env), undefined)
})

test('Host 已注入：浏览器半侧不重复自举，只缓存配置', () => {
  const env = installDom()
  globalThis.__DSH_NEURAL_HOST__ = true; globalThis.__DSH_NEURAL__ = { enabled: true, mode: 'always' }
  load(env).mod.apply(ctx)
  assert.equal(root(env), undefined)
  assert.equal(JSON.parse(localStorage.getItem('dsh-neural-startup:cfg')).mode, 'always')
  delete globalThis.__DSH_NEURAL_HOST__
})
