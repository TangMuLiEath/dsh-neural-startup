import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaults, normalize } from './config.js'

export const name = 'dsh-neural-startup'
export const inject = ['webServer', 'connection']
const directory = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'dsh-neural.json')
function read() { try { return normalize(JSON.parse(fs.readFileSync(file, 'utf8'))) } catch { return { ...defaults } } }
function write(config) {
  const value = normalize(config)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = file + '.' + process.pid + '.tmp'
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8'); fs.renameSync(temporary, file)
  return value
}
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
async function body(req) {
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new Error('body too large'); chunks.push(chunk) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
export function apply(ctx) {
  const server = (typeof ctx.get === 'function' && ctx.get('webServer')) || ctx.webServer
  if (!server?.register || !server?.tapIndex) { ctx.logger?.warn?.('dsh-neural-startup: 当前载体未提供 HTTP 首页注入，跳过开屏。'); return }
  const disposers = []
  function register(route) {
    const handler = route.handler
    disposers.push(server.register({ ...route, handler: async (req, res) => {
      try {
        const connection = (typeof ctx.get === 'function' && ctx.get('connection')) || ctx.connection
        if (!connection?.requestRejection) { res.writeHead(503); res.end(); return }
        const status = connection.requestRejection(req)
        if (status !== undefined && status !== null && status !== false) { res.writeHead(typeof status === 'number' ? status : 403); res.end(); return }
      } catch { res.writeHead(503); res.end(); return }
      try { await handler(req, res) } catch { if (!res.headersSent) json(res, 500, { ok: false, error: 'plugin request failed' }); else res.end() }
    } }))
  }
  for (const [asset, type] of Object.entries({ 'boot.js': 'text/javascript', 'boot.css': 'text/css', 'launch.js': 'text/javascript' })) {
    register({ kind: 'exact', path: '/dsh-neural/' + asset, handler(req, res) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
      const bytes = fs.readFileSync(path.join(directory, asset))
      res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Content-Length': String(bytes.length), 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : bytes)
    } })
  }
  register({ kind: 'exact', path: '/dsh-neural/config', async handler(req, res) {
    if (req.method === 'GET') { json(res, 200, { ok: true, config: read(), defaults }); return }
    if (req.method !== 'POST') { json(res, 405, { ok: false }); return }
    let value
    try { value = await body(req) } catch { json(res, 400, { ok: false, error: 'invalid JSON or oversized body' }); return }
    const config = write(value?.action === 'reset' ? defaults : { ...read(), ...(value?.patch || {}) })
    json(res, 200, { ok: true, config })
  } })
  disposers.push(server.tapIndex(html => {
    if (!html || html.includes('/dsh-neural/launch.js')) return html
    const config = JSON.stringify(read()).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '')
    const head = '<style>#dsh-neural-root.dnb-boot{position:fixed;inset:0;z-index:2147483000;background:#020309}html.dnb-lock,html.dnb-lock body{overflow:hidden!important}</style>'
    const guard = 'setTimeout(function(){var r=document.getElementById("dsh-neural-root");if(r&&r.classList.contains("dnb-boot")){r.remove();document.documentElement.classList.remove("dnb-lock");}},9000);'
    const mount = '<div id="dsh-neural-root" class="dnb-boot"></div><script>window.__DSH_NEURAL__=' + config + ';window.__DSH_NEURAL_HOST__=true;window.__DSH_NEURAL_BOOT__="index";' + guard + '</script><script defer src="/dsh-neural/launch.js"></script>'
    let output = html.includes('</head>') ? html.replace('</head>', head + '</head>') : head + html
    output = /<body\b[^>]*>/i.test(output) ? output.replace(/<body\b[^>]*>/i, match => match + mount) : output + mount
    return output
  }))
  ctx.effect(() => () => { for (const dispose of disposers) { try { dispose() } catch {} } })
}
