import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import vm from 'node:vm'
import { defaults, normalize } from '../lib/config.js'

test('Host installs routes, safely injects the real runtime and persists isolated settings', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-neural-test-'))
  const previous = process.env.DSH_HOME; process.env.DSH_HOME = temporary
  const { apply } = await import('../lib/index.js')
  const routes = [], taps = [], cleanup = []; let rejection, missing = false
  apply({
    webServer: { register(route) { routes.push(route); return () => {} }, tapIndex(fn) { taps.push(fn); return () => {} } },
    get(name) { return name === 'connection' && !missing ? { requestRejection: () => rejection } : undefined },
    effect(fn) { cleanup.push(fn()) }
  })
  const server = http.createServer((req, res) => {
    const route = routes.find(r => r.path === req.url)
    if (route) route.handler(req, res); else { res.statusCode = 404; res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = 'http://127.0.0.1:' + server.address().port
  try {
    assert.equal(routes.length, 4)
    for (const file of ['boot.js', 'boot.css', 'launch.js']) assert.equal((await fetch(url + '/dsh-neural/' + file)).status, 200)
    const sample = '<html><head></head><body class="app"><div id="root"></div></body></html>'
    const html = taps[0](sample)
    assert.ok(html.includes('<body class="app"><div id="dsh-neural-root"'))
    assert.ok(html.includes('<div id="root"></div>')); assert.ok(html.includes('9000'))
    assert.equal(taps[0](html), html)
    const saved = await (await fetch(url + '/dsh-neural/config', { method: 'POST', body: JSON.stringify({ patch: { title1: '</script><img>', speed: 100, preview: true } }) })).json()
    assert.equal(saved.config.speed, 3); assert.equal(saved.config.preview, undefined)
    assert.equal(JSON.parse(await fs.readFile(path.join(temporary, 'dsh-neural.json'), 'utf8')).title1, '</script><img>')
    assert.ok(!taps[0](sample).includes('</script><img>'))
    const payload = /window\.__DSH_NEURAL__=(.*?);window/.exec(taps[0](sample))[1]
    assert.equal(JSON.parse(payload).title1, '</script><img>')
    assert.equal((await fetch(url + '/dsh-neural/config', { method: 'POST', body: '{' })).status, 400)
    rejection = 401; assert.equal((await fetch(url + '/dsh-neural/config')).status, 401)
    missing = true; assert.equal((await fetch(url + '/dsh-neural/config')).status, 503)
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); cleanup.forEach(fn => fn())
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir())); assert.ok(path.basename(temporary).startsWith('dsh-neural-test-'))
    await fs.rm(temporary, { recursive: true, force: true })
  }
})

test('Host defaults match the existing animation; client bundle id matches package', async () => {
  const code = await fs.readFile(new URL('../src/runtime.js', import.meta.url), 'utf8')
  const block = /var DEFAULTS = (\{[\s\S]*?\n  \})/.exec(code)[1]
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext('(' + block + ')'))), defaults)
  assert.equal(normalize({ mode: 'bad', speed: -2 }).mode, 'session')
  assert.equal(normalize({ speed: -2 }).speed, .3)
  let entry
  vm.runInNewContext(await fs.readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load(value) { entry = value } } } })
  const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(entry.id, pkg.name)
  const mod = entry.factory(name => { assert.equal(name, 'react'); return { createElement() {} } })
  assert.equal(typeof mod.apply, 'function')
})
