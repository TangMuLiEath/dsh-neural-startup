/* Host bootstrap: playback frequency, safe loading, and lazy replay when suppressed. */
(function () {
  if (window.__DSH_NEURAL_LAUNCH__) return
  window.__DSH_NEURAL_LAUNCH__ = true
  var pending = false
  function release() {
    var root = document.getElementById('dsh-neural-root')
    if (root && root.parentNode) root.parentNode.removeChild(root)
    document.documentElement.classList.remove('dnb-lock')
  }
  function start(config) {
    if (config) window.__DSH_NEURAL__ = config
    if (window.__DSH_NEURAL_LOADED__ && window.__DSH_NEURAL_API__) { window.__DSH_NEURAL_API__.replay(config); return }
    if (pending) return
    pending = true
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/dsh-neural/boot.css'
    var failed = false
    var timer = setTimeout(function () { var root = document.getElementById('dsh-neural-root'); if (!window.__DSH_NEURAL_LOADED__ || root && root.classList.contains('dnb-boot')) fail() }, 9000)
    function fail() { failed = true; clearTimeout(timer); pending = false; release() }
    css.onerror = fail
    css.onload = function () {
      if (failed) return
      var script = document.createElement('script'); script.src = '/dsh-neural/boot.js'
      script.onerror = fail; script.onload = function () { pending = false }
      document.head.appendChild(script)
    }
    document.head.appendChild(css)
  }
  window.__DSH_NEURAL_API__ = { replay: start }
  var config = window.__DSH_NEURAL__ || {}, off = config.enabled === false
  try {
    if (config.mode === 'session' && sessionStorage.getItem('dsh-neural-startup:shown') === '1') off = true
    if (config.mode === 'daily' && localStorage.getItem('dsh-neural-startup:day') === new Date().toISOString().slice(0, 10)) off = true
  } catch (_) {}
  if (off) release(); else start()
})()
