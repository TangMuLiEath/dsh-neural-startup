# Neural Startup · 神经核心开机动画

为 DeepSeek Harness（DSH）添加深空神经核心开屏动画，支持自定义标题和台词、播放频率、速度、合成音效及可选语音播报。

画面使用 Canvas 2D 绘制，音效使用 Web Audio 合成，语音使用系统 Web Speech 音色。线稿数据已内嵌到插件，无需另行下载视频或音频。这是社区插件，与 DeepSeek 官方没有隶属关系。

## 从 GitHub 安装

仓库公开并推送文件后，打开 DSH Desktop 侧栏的 **插件 → 添加插件**（部分版本需从旁边箭头选择 **安装第三方插件**），将下面的完整 Git URL 粘贴到安装来源输入框：

~~~text
git+https://github.com/TangMuLiEath/dsh-neural-startup.git
~~~

确认识别出的包名为 dsh-neural-startup，安装并保持启用，按提示重启 Desktop。在 **设置 → 神经核心开机动画** 中调整配置或预览。

- 安装运行文件已包含在 lib/ 中，用户不需要 Python，不需要自行构建，也不需要运行安装脚本。
- Git 来源需要 DSH 的包管理进程能够调用 Git，并能访问 GitHub。
- 仅输入包名会查询 npm；本项目尚未发布到 npm，请使用完整 Git URL。
- 上传 GitHub 不会自动加入 DSH 插件市场，也不意味着获得官方认证。
- package.json 中的 private: true 只防止误发布 npm，不影响公开 Git 仓库或本地目录安装。

仓库地址：[TangMuLiEath/dsh-neural-startup](https://github.com/TangMuLiEath/dsh-neural-startup)。上述 URL 以该仓库为发布目标；在创建并推送前不可用。发布版本标签后，可在 URL 后加上实际存在的标签（例如 #v0.1.0）固定版本；未创建标签时不要使用。

## 本地安装与命令行

GitHub 拉取失败时，可下载仓库 ZIP 并解压，在同一安装对话框中输入**包含 package.json 的目录绝对路径**，例如：

~~~text
C:\Plugins\dsh-neural-startup
~~~

不要直接输入 ZIP 或上一层目录。本地安装会链接项目目录，安装后应保留其位置。维护者也可以用 npm pack 生成 .tgz，通过 GitHub Release 分发；官方管理器支持 tarball 安装来源。

如需命令行，从 Desktop 应用菜单 **管理 dsh 命令…** 注册自带命令并重新打开终端。先启动一次 Desktop 初始化 profile，再完全退出 Desktop，执行：

~~~powershell
dsh plugin --profile desktop add "C:\Plugins\dsh-neural-startup"
~~~

重新打开 Desktop 生效。必须使用 Desktop 自带的 dsh；独立 npm 安装的 CLI、npx 或 npm exec 不能管理 Desktop profile。无需手工编辑 profile 文件。

## 兼容性与验证范围

- 面向 Desktop 及提供 webServer、connection 和设置插槽的 Web 载体；纯终端界面不显示动画。
- DSH 声明范围为 >=0.2.1-rc.2 <0.3.0，接口核对基准为官方 dsh-v0.2.1-rc.2；其他版本仍可能出现接口变化。
- 本地测试与归档校验不等于公开 GitHub 安装或真实宿主画面验证。发布前应执行下方的发布检查。

## 配置和卸载

设置页可修改启用状态、频率、速度、Esc 跳过、音效、语音音色与音量，以及标题和台词。保存后可点击 **预览当前配置**。

| 频率 | 行为 |
| --- | --- |
| session | 每个页面会话播放一次 |
| always | 每次页面启动播放 |
| daily | 按 UTC 日期每天一次 |

配置保存在 $DSH_HOME/dsh-neural.json，默认位于用户主目录的 .dsh 下。同一 DSH home 的 Web 和 Desktop 可能共享该配置；播放记录保存在界面的浏览器存储中。

可在插件页关闭或卸载；命令行卸载需退出 Desktop，再使用其自带命令：

~~~powershell
dsh plugin --profile desktop remove dsh-neural-startup
~~~

## 已知限制与排查

- 浏览器自动播放策略可能限制声音；系统音色不同，语音效果也会不同。
- 不建议同时启用多个覆盖整个页面的开屏插件。
- Desktop 原生窗口、欢迎页和插件尚未加载时的启动画面由 DSH 控制，此插件不能保证覆盖这些阶段。
- Web 首页支持注入时会提前挂载黑幕；Desktop 未使用该首页时，由 Client 插件加载后自举，可能先看到 DSH 本身的加载画面。
- 动画资源未成功加载时，启动黑幕有 9 秒放行兜底。
- 没有播放时先在设置页预览，核对启用状态、会话播放记录和重启提示。
- 安装失败时保留插件页错误信息，核对完整 URL、网络、Git 可用性与 DSH 版本。

## 开发

| 文件 | 用途 |
| --- | --- |
| src/ | 动画和预览模板源码 |
| lib/ | Host、Client、配置和已构建动画，分发必需 |
| cordis.patch.yml | DSH 插件注册 |
| locale/、icon.svg | 中英文插件元信息与原创图标 |
| tools/build.py | 将源码及线稿数据构建为 lib/boot.* 和离线预览 |
| tools/art.json、tools/whale.txt | 构建输入数据 |
| preview/index.html | 离线动画预览，不是 DSH 应用 |
| test/ | 动画、Host 和 Client 测试 |

开发验证使用 Node.js 22.19+；重建动画另需 Python 3：

~~~powershell
python tools/build.py
npm test
npm pack --dry-run
npm pack
~~~

tools/pack.py 和 tools/trace.py 是线稿处理工具，不是插件打包命令。普通安装不需要执行它们。

## 维护者发布检查

1. 修改动画后重新构建，提交最新 lib/，Git 安装不会替用户运行 Python。
2. 执行测试和归档检查，确保 Host、Client、动画、patch、locale、图标和说明均存在。
3. 将本项目根目录作为 GitHub 仓库根目录，根目录必须包含 package.json。
4. 公开并推送仓库；实际创建版本标签后，再提供带标签的 URL。
5. 用干净 DSH profile 从公开 Git URL 安装，检查识别、启用、重启、画面、设置保存和卸载。
6. 如需市场展示，另行将插件加入市场索引。

参考项目说明及原有 MIT 声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目整体许可证及线稿素材来源，仍需维护者在公开分发前确认。

## 官方规范

- [对应版本的 UI 插件样例](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/packages/preset/agent-preset/skills/cordis-plugin-development/templates/decoration/package.json)
- [Bundle、元信息与图标规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/packages/preset/agent-preset/skills/cordis-plugin-development/references/host-plugin.md)
- [插件安装界面](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/packages/client/ui-plugin-manager/README.zh.md)
- [Desktop 自带命令](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/apps/desktop/README.zh.md#bundled-command-runtime)
