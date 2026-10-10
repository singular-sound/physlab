"""把网站拼到 dist/：引导页 + 各个实验（每个实验是一个单文件网页）+ 离线缓存和图标。
用法：python3 build.py        部署：dist/ 整个目录交给 Cloudflare Pages
"""
import shutil
from pathlib import Path

VERSION = '1.0'
root = Path(__file__).parent
site, dist = root / 'site', root / 'dist'

PWA_HEAD = ('<link rel="manifest" href="/manifest.webmanifest">\n'
            '<meta name="theme-color" content="#17734f">\n'
            '<link rel="icon" type="image/png" href="/icon-192.png">\n'
            '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
            '<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-title" content="PhysLab">')
PWA_REGISTER = ("<script>if ('serviceWorker' in navigator && location.protocol === 'https:') "
                "addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));</script>")

def page(html):
    return html.replace('<!--PWA-HEAD-->', PWA_HEAD).replace('<!--PWA-REGISTER-->', PWA_REGISTER)

if dist.exists():
    shutil.rmtree(dist)
dist.mkdir()

# 引导页和静态文件
for f in site.iterdir():
    if f.name == 'index.html':
        (dist / 'index.html').write_text(page(f.read_text(encoding='utf-8')), encoding='utf-8')
    elif f.name == 'sw.js':
        (dist / 'sw.js').write_text(f.read_text(encoding='utf-8').replace('__VERSION__', VERSION), encoding='utf-8')
    else:
        shutil.copy(f, dist / f.name)

# 示波器
src = root / 'experiments/oscilloscope/src'
body = (src / 'page.html').read_text(encoding='utf-8')
body = body.replace('<!--PLATFORM-BACK-->', '<a class="tbtn back-link" href="/">← 实验列表</a>')
js = '\n'.join((src / f'{n}.js').read_text(encoding='utf-8') for n in ['engine', 'panel', 'lessons', 'teach'])
osc = ('<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + PWA_HEAD + '\n</head>\n<body>\n' + body + '\n<script>\n' + js + '\n</script>\n' + PWA_REGISTER + '\n</body>\n</html>\n')
(dist / 'oscilloscope').mkdir()
(dist / 'oscilloscope/index.html').write_text(osc, encoding='utf-8')
(dist / 'oscilloscope/cheatsheet').mkdir()
(dist / 'oscilloscope/cheatsheet/index.html').write_text(page((root / 'experiments/oscilloscope/cheatsheet.html').read_text(encoding='utf-8')), encoding='utf-8')
print('built', sorted(p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file()))
