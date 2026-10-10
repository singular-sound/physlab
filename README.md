# PhysLab · 大学物理实验模拟台

在网页上练大学物理实验：照教材复刻仪器面板，旋钮、开关、接线都能真的操作。教学模式一步步带你做完教材上的实验内容，仿真模式像上课一样自己从头来。

网址：https://physlab.lennox8888.top　·　源码：https://github.com/singular-sound/physlab

这不是官方软件。内容按《大学物理实验教程》编排，和教材或老师说法有出入的地方，以教材和老师为准。

## 现在有的实验

| 实验 | 版本 | 内容 |
|---|---|---|
| 实验十一 示波器原理及使用 | v1.0 | GOS-630FC 双踪示波器 + 两台信号源；10 课，覆盖教材实验内容 1～8 |

## 用什么设备

电脑或平板（建议横屏）。平板用手指操作，和鼠标一样：按住旋钮拖、按住拨杆拖。手机屏幕太小，不支持。

## 数据存在哪

不需要注册，所有数据（填的数、记录、进度）只存在使用者自己的浏览器里，不上传。实验里「我的记录」页可以备份和恢复。网站支持"添加到主屏幕"，离线也能打开。

## 目录

| 位置 | 是什么 |
|---|---|
| `site/` | 引导页、离线缓存（`sw.js`）、图标、`manifest.webmanifest`、Cloudflare 响应头（`_headers`） |
| `experiments/oscilloscope/cheatsheet.html` | 示波器「上课小抄」：现场步骤和可能被问的题，手机看 |
| `experiments/oscilloscope/src/` | 示波器模拟台的源码（`page.html` 页面和样式，`engine.js` 示波器物理，`panel.js` 面板部件，`lessons.js` 课程，`teach.js` 侧栏与教学） |
| `build.py` | 把上面拼成 `dist/`，每个实验是一个单文件网页 |

## 构建和部署

```bash
python3 build.py
```

生成的 `dist/` 整个目录就是网站，部署在 Cloudflare Pages（项目名 `physlab`，挂在 physlab.lennox8888.top）。

部署：设置环境变量 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 后运行 `./deploy.sh`（构建 + 上传）。也可以把这两个变量写进 `deploy.local.sh`，这个文件不会进 git。想部署自己的一份，再设一个 `PAGES_PROJECT` 换成你的项目名。

不想部署也行：`dist/` 里都是静态文件，任何静态网站托管都能放，或者直接双击 `dist/oscilloscope/index.html` 在本机打开（离线缓存只在 https 网址下生效）。

## 加一个新实验

1. 在 `experiments/<实验名>/src/` 放源码（可以参照示波器的结构）。
2. 在 `build.py` 里加一段，把它拼到 `dist/<实验名>/index.html`。
3. 在 `site/index.html` 的实验列表里加一张卡片，把 `sw.js` 的 `CORE` 列表加上新页面。

## 参与

欢迎同学一起补实验、改错。

- 发现内容错误（原理、步骤、数值）：在 Issues 里写清楚是哪个实验、哪一课哪一步，最好附上教材页码。
- 想加一个实验：按上面「加一个新实验」的步骤做，提 Pull Request。代码不依赖任何框架，会写 HTML、CSS、JavaScript 就能改。
- 改完先运行 `python3 build.py`，在浏览器里把每一课走一遍再提交。

## 声明

- 这是学生自己做的练习工具，与《大学物理实验教程》的作者和出版方、与固纬电子（GW Instek）都没有关系。仪器型号只用来说明面板照哪台仪器复刻。
- 项目里没有放教材的原文和图片；课程、讲解和题目答案都是按教材内容自己写的。
- 模拟器为了教学做了简化，也故意加了 2～3% 的仪器误差，结果不能当作真实实验数据。

## 许可证

[MIT](LICENSE)：可以自由使用、修改、再发布，保留版权声明即可。
