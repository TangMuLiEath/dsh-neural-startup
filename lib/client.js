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
    var ranges = { speed: [.3, 3], soundVolume: [0, 1], voiceVolume: [0, 1], voiceRate: [.5, 2], voicePitch: [0, 2] }
    /* —— 设置面板 —— */
    var CSS = [
      '.__dnb_root{max-width:640px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__dnb_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:12px}',
      '.__dnb_title{font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--dsw-alias-label-tertiary)}',
      '.__dnb_row{display:flex;align-items:center;justify-content:space-between;gap:16px}',
      '.__dnb_label{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.__dnb_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__dnb_ctrl{display:flex;align-items:center;gap:8px;flex:0 0 auto}',
      '.__dnb_input,.__dnb_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;outline:none}',
      '.__dnb_input{width:300px}.__dnb_select{max-width:300px}',
      '.__dnb_input:focus,.__dnb_select:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.__dnb_range{width:180px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__dnb_val{min-width:46px;text-align:right;font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__dnb_check{accent-color:var(--dsw-alias-state-business-primary);width:16px;height:16px}',
      '.__dnb_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__dnb_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}.__dnb_btn:disabled{opacity:.5;cursor:default}',
      '.__dnb_primary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__dnb_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.__dnb_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__dnb_dim{opacity:.45;pointer-events:none}'
    ].join('')
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-neural-startup"]')) {
      var tag = document.createElement('style'); tag.setAttribute('data-plugin-css', 'dsh-neural-startup'); tag.textContent = CSS
      ;(document.head || document.documentElement).appendChild(tag)
    }

    /* 本机可用的英文音色：Online (Natural) 的神经网络音色排前面 */
    function englishVoices() {
      try {
        var list = (window.speechSynthesis && window.speechSynthesis.getVoices()) || []
        return list.filter(function (v) { return String(v.lang || '').toLowerCase().indexOf('en') === 0 })
          .sort(function (a, b) { var na = /natural|online/i.test(a.name) ? 0 : 1, nb = /natural|online/i.test(b.name) ? 0 : 1; return na - nb || a.name.localeCompare(b.name) })
      } catch (e) { return [] }
    }
    function useVoices() {
      var st = React.useState(englishVoices), list = st[0], setList = st[1]
      React.useEffect(function () {
        var s = window.speechSynthesis; if (!s) return
        var on = function () { setList(englishVoices()) }
        try { s.addEventListener('voiceschanged', on) } catch (e) {}
        var t = setTimeout(on, 500)
        return function () { try { s.removeEventListener('voiceschanged', on) } catch (e) {} clearTimeout(t) }
      }, [])
      return list
    }
    /* 试听：用草稿里的音色/语速/音调/音量念第一句，不依赖开机动画是否已加载 */
    function speakSample(draft, list) {
      try {
        var s = window.speechSynthesis; if (!s) return false
        s.cancel()
        var u = new window.SpeechSynthesisUtterance(String(draft.line1 || '').trim() || 'Identity confirmed. Prime authority.')
        var v = null; list.forEach(function (x) { if (x.name === draft.voiceName) v = x })
        if (v) { u.voice = v; u.lang = v.lang } else u.lang = 'en-US'
        u.rate = Number(draft.voiceRate) || 0.86; u.pitch = Number(draft.voicePitch); u.volume = Number(draft.voiceVolume)
        s.speak(u); return true
      } catch (e) { return false }
    }

    function Row(props) {
      return h('div', { className: '__dnb_row' + (props.dim ? ' __dnb_dim' : '') },
        h('div', { className: '__dnb_label' }, h('span', null, props.label), props.hint ? h('span', { className: '__dnb_hint' }, props.hint) : null),
        h('div', { className: '__dnb_ctrl' }, props.children))
    }
    function Check(props) { return h('input', { type: 'checkbox', className: '__dnb_check', checked: !!props.value, 'aria-label': props.label, onChange: function (e) { props.onChange(e.target.checked) } }) }
    function Text(props) { return h('input', { type: 'text', className: '__dnb_input', maxLength: 160, value: props.value || '', placeholder: props.placeholder || '', 'aria-label': props.label, spellCheck: false, onChange: function (e) { props.onChange(e.target.value) } }) }
    function Range(props) {
      var r = ranges[props.k], v = Number(props.value)
      return [
        h('input', { key: 'r', type: 'range', className: '__dnb_range', min: r[0], max: r[1], step: props.step || 0.01, value: v, 'aria-label': props.label, onChange: function (e) { props.onChange(Number(e.target.value)) } }),
        h('span', { key: 'v', className: '__dnb_val' }, props.fmt ? props.fmt(v) : v.toFixed(2))
      ]
    }
    var pct = function (v) { return Math.round(v * 100) + '%' }, times = function (v) { return v.toFixed(2) + '×' }

    function Panel() {
      var state = React.useState(null), draft = state[0], setDraft = state[1]
      var message = React.useState(''), notice = message[0], setNotice = message[1]
      var pending = React.useState(false), busy = pending[0], setBusy = pending[1]
      var voices = useVoices()
      React.useEffect(function () { var disposed = false; request().then(function (data) { if (!disposed) setDraft(data.config) }).catch(function (err) { if (!disposed) setNotice('读取失败：' + err.message) }); return function () { disposed = true } }, [])
      function set(key, value) { setDraft(function (old) { return Object.assign({}, old, { [key]: value }) }); setNotice('') }
      function save(reset) {
        setBusy(true)
        request(reset ? { action: 'reset' } : { patch: draft }).then(function (data) { setDraft(data.config); window.__DSH_NEURAL__ = data.config; writeCache(data.config); setNotice(reset ? '已恢复默认' : '已保存，下次打开 DSH 生效') }).catch(function (err) { setNotice(err.message) }).finally(function () { setBusy(false) })
      }
      if (!draft) return h('div', { className: '__dnb_root' }, h('p', { className: '__dnb_status' }, notice || '读取配置中…'))
      var f = function (key) { return function (v) { set(key, v) } }

      /* 音色下拉：已保存的名字在本机找不到时也列出来，标明「未找到」，免得静默回落 */
      var names = voices.map(function (v) { return v.name })
      var voiceOptions = [h('option', { key: '', value: '' }, '自动（优先 Sonia / Aria 等神经网络女声）')]
      if (draft.voiceName && names.indexOf(draft.voiceName) === -1) voiceOptions.push(h('option', { key: '?', value: draft.voiceName }, '本机未找到：' + draft.voiceName))
      voices.forEach(function (v) { voiceOptions.push(h('option', { key: v.name, value: v.name }, (/natural|online/i.test(v.name) ? '★ ' : '') + v.name + ' · ' + v.lang)) })

      return h('div', { className: '__dnb_root' },
        h('div', { className: '__dnb_group' },
          h('div', { className: '__dnb_title' }, '播放'),
          h(Row, { label: '启用开机动画', hint: '关闭后打开 DSH 直接进主界面。' }, h(Check, { label: '启用开机动画', value: draft.enabled, onChange: f('enabled') })),
          h(Row, { label: '播放频率' }, h('select', { className: '__dnb_select', value: draft.mode, 'aria-label': '播放频率', onChange: function (e) { set('mode', e.target.value) } },
            h('option', { value: 'session' }, '每次打开 DSH 播一次'), h('option', { value: 'daily' }, '每天第一次打开时播'), h('option', { value: 'always' }, '每次刷新都播'))),
          h(Row, { label: '播放速度', hint: '整段约 16 秒，2× 约 8 秒。' }, h(Range, { k: 'speed', label: '播放速度', value: draft.speed, step: 0.05, fmt: times, onChange: f('speed') })),
          h(Row, { label: '允许 Esc 跳过', hint: '按 Esc 直接跳到结束动画。' }, h(Check, { label: '允许 Esc 跳过', value: draft.allowSkip, onChange: f('allowSkip') }))
        ),
        h('div', { className: '__dnb_group' },
          h('div', { className: '__dnb_title' }, '声音'),
          h(Row, { label: '默认开启声音', hint: '右上角声音开关点过之后，以你在开关上的选择为准。' }, h(Check, { label: '默认开启声音', value: draft.sound, onChange: f('sound') })),
          h(Row, { label: '音效音量', dim: !draft.sound }, h(Range, { k: 'soundVolume', label: '音效音量', value: draft.soundVolume, fmt: pct, onChange: f('soundVolume') })),
          h(Row, { label: '显示右上角声音开关' }, h(Check, { label: '显示右上角声音开关', value: draft.soundButton, onChange: f('soundButton') }))
        ),
        h('div', { className: '__dnb_group' },
          h('div', { className: '__dnb_title' }, '语音播报'),
          h(Row, { label: '英文语音播报', hint: '角色绘制前念第一句，绘制完成后念第二句。' }, h(Check, { label: '英文语音播报', value: draft.voice, onChange: f('voice') })),
          h(Row, { label: '音色', dim: !draft.voice, hint: voices.length ? '列出本机全部英文音色，★ 为神经网络音色（最自然）。' : '暂时读不到系统音色，稍等片刻会自动刷新。' },
            h('select', { className: '__dnb_select', value: draft.voiceName || '', 'aria-label': '音色', onChange: function (e) { set('voiceName', e.target.value) } }, voiceOptions),
            h('button', { className: '__dnb_btn', type: 'button', onClick: function () { if (!speakSample(draft, voices)) setNotice('当前环境不支持语音合成') } }, '试听')),
          h(Row, { label: '语音音量', dim: !draft.voice }, h(Range, { k: 'voiceVolume', label: '语音音量', value: draft.voiceVolume, fmt: pct, onChange: f('voiceVolume') })),
          h(Row, { label: '语速', dim: !draft.voice, hint: '越慢越沉稳。' }, h(Range, { k: 'voiceRate', label: '语速', value: draft.voiceRate, step: 0.02, fmt: times, onChange: f('voiceRate') })),
          h(Row, { label: '音调', dim: !draft.voice, hint: '调低更有「主脑」感，1.0 是原声。' }, h(Range, { k: 'voicePitch', label: '音调', value: draft.voicePitch, step: 0.02, onChange: f('voicePitch') })),
          h(Row, { label: '第一句台词', dim: !draft.voice }, h(Text, { label: '第一句台词', value: draft.line1, onChange: f('line1') })),
          h(Row, { label: '第二句台词', dim: !draft.voice }, h(Text, { label: '第二句台词', value: draft.line2, onChange: f('line2') }))
        ),
        h('div', { className: '__dnb_group' },
          h('div', { className: '__dnb_title' }, '文案'),
          h(Row, { label: '主标题第一行' }, h(Text, { label: '主标题第一行', value: draft.title1, onChange: f('title1') })),
          h(Row, { label: '主标题第二行' }, h(Text, { label: '主标题第二行', value: draft.title2, onChange: f('title2') })),
          h(Row, { label: '中文副标题' }, h(Text, { label: '中文副标题', value: draft.subtitle, onChange: f('subtitle') })),
          h(Row, { label: '身份说明' }, h(Text, { label: '身份说明', value: draft.badge, onChange: f('badge') }))
        ),
        h('div', { className: '__dnb_actions' },
          h('button', { className: '__dnb_btn __dnb_primary', disabled: busy, onClick: function () { save(false) } }, busy ? '处理中…' : '保存'),
          h('button', { className: '__dnb_btn', disabled: busy, onClick: function () { save(true) } }, '恢复默认'),
          h('button', { className: '__dnb_btn', onClick: function () { var api = window.__DSH_NEURAL_API__; if (api) api.replay(Object.assign({}, draft, { mode: 'always' })); else setNotice('动画资源尚未加载，请重启 DSH 后重试。') } }, '用当前设置预览'),
          h('span', { className: '__dnb_status', role: 'status' }, notice)),
        h('div', { className: '__dnb_hint' }, '预览使用的是还没保存的设置；满意后记得点保存。声音受浏览器自动播放策略限制，首次点击或按键后才会出声。')
      )
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
