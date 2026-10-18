window.__ModuleLoader__.load({
  id: 'dsh-neural-startup',
  factory: function (require) {
    var React = require('react'), h = React.createElement
    /* —— 防「先露出客户端界面」：浏览器半侧自举时同步盖黑幕 ——
       Host 的首页注入没生效时（桌面端可能如此），开屏只能等客户端插件加载完才拉起，
       期间 DSH 主界面会先露一下。这里在 apply() 里同步盖一层黑幕，再异步拉配置和资源。
       「播不播」先用上次缓存的配置同步判定，拉到最新配置后再校正。 */
    var CACHE_KEY = 'dsh-neural-startup:cfg'
    function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch (e) { return null } }
    function writeCache(config) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(config)) } catch (e) {} }
    function shouldPlay(config) {
      if (!config || config.enabled === false) return false
      try {
        if (config.mode === 'session' && sessionStorage.getItem('dsh-neural-startup:shown') === '1') return false
        if (config.mode === 'daily' && localStorage.getItem('dsh-neural-startup:day') === new Date().toISOString().slice(0, 10)) return false
      } catch (e) {}
      return true
    }
    function cover() {
      if (document.getElementById('dsh-neural-root')) return
      var root = document.createElement('div')
      root.id = 'dsh-neural-root'; root.className = 'dnb-boot'
      root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#020309'
      ;(document.body || document.documentElement).appendChild(root)
      document.documentElement.classList.add('dnb-lock')
      /* 兜底：9 秒内运行时没接管就放行，绝不把人锁在黑屏里 */
      setTimeout(uncover, 9000)
    }
    function uncover() {
      var root = document.getElementById('dsh-neural-root')
      if (root && root.classList.contains('dnb-boot')) { if (root.parentNode) root.parentNode.removeChild(root); document.documentElement.classList.remove('dnb-lock') }
    }
    function request(value) {
      return fetch('/dsh-neural/config', value ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) } : {})
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() })
        .then(function (data) { if (!data.ok) throw new Error('配置操作失败'); return data })
    }
    var labels = { enabled: '启用开机动画', mode: '播放频率', speed: '播放速度', allowSkip: '允许 Esc 跳过', sound: '声音', soundVolume: '音效音量', soundButton: '显示声音开关', voice: '英文语音播报', voiceName: '音色名称（留空自动选择）', voiceVolume: '语音音量', voiceRate: '语速', voicePitch: '音调', line1: '第一句台词', line2: '第二句台词', title1: '主标题第一行', title2: '主标题第二行', subtitle: '中文副标题', badge: '身份说明' }
    var ranges = { speed: [.3, 3], soundVolume: [0, 1], voiceVolume: [0, 1], voiceRate: [.5, 2], voicePitch: [0, 2] }
    function Panel() {
      var state = React.useState(null), draft = state[0], setDraft = state[1]
      var message = React.useState(''), notice = message[0], setNotice = message[1]
      var pending = React.useState(false), busy = pending[0], setBusy = pending[1]
      React.useEffect(function () { var disposed = false; request().then(function (data) { if (!disposed) setDraft(data.config) }).catch(function (err) { if (!disposed) setNotice('读取失败：' + err.message) }); return function () { disposed = true } }, [])
      function set(key, value) { setDraft(function (old) { return Object.assign({}, old, { [key]: value }) }); setNotice('') }
      function save(reset) {
        setBusy(true)
        request(reset ? { action: 'reset' } : { patch: draft }).then(function (data) { setDraft(data.config); window.__DSH_NEURAL__ = data.config; writeCache(data.config); setNotice('已保存') }).catch(function (err) { setNotice(err.message) }).finally(function () { setBusy(false) })
      }
      return h('div', { style: { maxWidth: '620px', fontSize: '13px' } },
        h('p', null, 'Neural Startup · 神经核心开机动画'),
        !draft ? h('p', null, notice || '读取配置中…') : h('div', null,
          Object.keys(labels).map(function (key) {
            var input
            if (key === 'mode') input = h('select', { value: draft.mode, onChange: function (e) { set(key, e.target.value) } }, h('option', { value: 'session' }, '每个页面会话一次'), h('option', { value: 'always' }, '每次打开'), h('option', { value: 'daily' }, '每天一次'))
            else if (typeof draft[key] === 'boolean') input = h('input', { type: 'checkbox', checked: draft[key], onChange: function (e) { set(key, e.target.checked) } })
            else if (ranges[key]) input = h('input', { type: 'number', min: ranges[key][0], max: ranges[key][1], step: .01, value: draft[key], onChange: function (e) { set(key, Number(e.target.value)) } })
            else input = h('input', { type: 'text', maxLength: 160, value: draft[key] || '', onChange: function (e) { set(key, e.target.value) } })
            return h('label', { key: key, style: { display: 'flex', justifyContent: 'space-between', gap: '20px', margin: '14px 0' } }, labels[key], input)
          }),
          h('div', { style: { display: 'flex', gap: '10px' } },
            h('button', { disabled: busy, onClick: function () { save(false) } }, '保存'),
            h('button', { disabled: busy, onClick: function () { save(true) } }, '恢复默认'),
            h('button', { onClick: function () { var api = window.__DSH_NEURAL_API__; if (api) api.replay(draft); else setNotice('资源尚未加载，请重启 DSH 后重试。') } }, '预览当前配置')),
          h('p', { role: 'status' }, notice),
          h('p', { style: { opacity: .7, fontSize: '11px' } }, '声音受浏览器自动播放策略限制；首次点击鼠标或键盘后可能才开始出声。')))
    }
    return {
      inject: ['slots'],
      apply: function (ctx) {
        if (window.__DSH_NEURAL_HOST__) {
          if (window.__DSH_NEURAL__) writeCache(window.__DSH_NEURAL__)
        } else if (!window.__DSH_NEURAL_LAUNCH__) {
          window.__DSH_NEURAL_BOOT__ = 'client'
          if (shouldPlay(readCache() || { enabled: true, mode: 'session' })) cover()
          request().then(function (data) {
            writeCache(data.config)
            window.__DSH_NEURAL__ = data.config
            if (!shouldPlay(data.config)) { uncover(); return }
            cover()
            var script = document.createElement('script'); script.src = '/dsh-neural/launch.js'; document.head.appendChild(script)
          }).catch(uncover)
        }
        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register({ name: 'settings.section', id: 'neural-startup', order: 26, label: '神经核心开机动画' }, function () { return h(Panel, {}) })
        })
      }
    }
  }
})
