"""把 src/ 下的运行时 + tools/ 下的线稿数据拼成三份产物：
  lib/boot.js        插件运行时（内嵌线稿与鲸鱼路径）
  lib/boot.css       插件样式
  preview/index.html 单文件离线预览（双击即可看）
用法：python tools/build.py"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
T, S = ROOT / 'tools', ROOT / 'src'
art = (T / 'art.json').read_text(encoding='utf-8')
whale = (T / 'whale.txt').read_text(encoding='utf-8').strip()
js = (S / 'runtime.js').read_text(encoding='utf-8').replace('/*__ART__*/null', art).replace('/*__WHALE__*/', whale)
css = (S / 'runtime.css').read_text(encoding='utf-8')
(ROOT / 'lib').mkdir(exist_ok=True)
(ROOT / 'lib' / 'boot.js').write_text(js, encoding='utf-8')
(ROOT / 'lib' / 'boot.css').write_text(css, encoding='utf-8')
html = (S / 'preview.html').read_text(encoding='utf-8').replace('/*__CSS__*/', css).replace('/*__SCRIPT__*/', js)
(ROOT / 'preview').mkdir(exist_ok=True)
(ROOT / 'preview' / 'index.html').write_text(html, encoding='utf-8')
print('lib/boot.js', len(js), '| lib/boot.css', len(css), '| preview/index.html', len(html))
