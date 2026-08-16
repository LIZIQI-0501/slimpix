# SlimPix 部署与手机安装指南

本项目是**纯静态站点**（HTML/CSS/JS + PWA），不需要任何构建步骤。
所有数据都保存在手机/浏览器本地的 `localStorage`，无需后端、无需数据库、无需账号也能自己用。

下面给你两条路：
- **A. 零账号，现在就用（局域网）** —— 不用注册任何东西，手机连同一 Wi-Fi 即可"安装"当 App。
- **B. 一键发布到公网（免费托管）** —— 拿到一个谁都能打开的链接，换手机/换网络也能用。

---

## A. 局域网安装（推荐先试，30 秒搞定）

适合"只我自己用"的场景。电脑当服务器，手机连同一 Wi-Fi 访问。

1. 在电脑上启动本地服务器（已配好，会自动打印手机访问地址）：
   ```bash
   cd web
   node serve.js            # 默认端口 8080，可加端口： node serve.js 9000
   ```
2. 终端会打印类似：
   ```
   手机访问:  http://192.168.1.23:8080   （手机需连同一 Wi-Fi）
   ```
3. 手机（连同一 Wi-Fi）用浏览器打开这个地址。
4. **安卓**：浏览器右上角菜单 →「添加到主屏幕」→ 完成。之后桌面就有图标，体验等同 App。
   **苹果**：Safari 打开 → 底部分享按钮 →「添加到主屏幕」。

> 注意：电脑关机/关掉服务器，手机就打不开了。长期自用建议走下面的公网发布。

---

## B. 一键发布到免费公网托管

### 方式 1：Netlify Drop（最简单，真正"拖一下就上线"）
1. 打开 https://app.netlify.com/drop
2. **把 `web/` 整个文件夹拖进去**（不是项目根目录，是里面的 web 文件夹）。
3. 几秒后给你一个 `https://xxxx.netlify.app` 的公网地址。
4. 手机浏览器打开 →「添加到主屏幕」即可当 App。
5. 想换自定义域名（免费子域也行）：在 Netlify 后台 Site settings → Domain management 里改。
6. 之后每次改了代码，重新拖一次即可（或连 Git 自动部署，见方式 2）。

> `web/netlify.toml` 已配好：发布目录 = 当前文件夹、无需构建、PWA 缓存头已设。

### 方式 2：连 Git 仓库（改代码自动上线，推荐长期）
1. 把项目推到 GitHub（仓库里包含 `web/` 文件夹）。
2. Netlify 后台「Add new site → Import an existing project」连 GitHub。
3. 设置：
   - Base directory：`web`
   - Build command：留空（或填 `echo no-build`）
   - Publish directory：`web`
   （`netlify.toml` 已自动声明这些，基本不用手填）
4. 部署完成后拿到公网链接；以后 `git push` 会自动重新发布。

### 方式 3：Vercel
1. 打开 https://vercel.com/new ，导入你的 GitHub 仓库。
2. 在 "Build and Output Settings"：
   - Framework Preset：选 **Other**
   - Build Command：`echo no-build`
   - Output Directory：`web`
   （`web/vercel.json` 也已写好，可省略手动填）
3. Deploy → 拿到 `https://xxxx.vercel.app`。

### 方式 4：GitHub Pages（免费，清单已兼容）
1. 仓库 Settings → Pages → Source 选 "Deploy from a branch"。
2. 把 `web/` 的内容推到 `gh-pages` 分支（或用 `/docs` 目录）。
   - 推荐：用 `gh-pages` 分支，只放 web 内的文件。
   - 也可在本机 `web/` 目录 `git init` 后直接推 `main` 分支并把 Pages 源设为 `main` 分支的 `/（root）` 或 `/docs`。
3. 访问 `https://<你的用户名>.github.io/<仓库名>/`。
4. 清单已用 `manifest.json`（GitHub Pages 以 `application/json` 提供，Chrome 安装提示正常），无需额外处理 MIME。

---

## 拿到公网链接后，怎么"安装"到手机

无论用哪种托管，最终你都得到一个 `https://xxx` 链接：
- **安卓 Chrome/Edge**：打开链接 → 右上角 ⋮ →「安装应用 / 添加到主屏幕」。
- **iPhone Safari**：打开链接 → 底部 ↑ 分享 →「添加到主屏幕」。
装好后桌面有图标，全屏打开、无浏览器地址栏，就是个 App。

---

## 文件清单（web/ 内的发布物）
```
web/
├── index.html            # 入口
├── styles.css            # 样式
├── manifest.json         # PWA 清单（图标/全屏，已兼容 GitHub Pages）
├── sw.js                 # 服务工人（离线缓存）
├── icon.svg              # 应用图标
├── serve.js              # 本地/局域网预览服务器
├── netlify.toml          # Netlify 部署配置
├── vercel.json           # Vercel 部署配置
└── js/
    ├── sprite-data.js    # 三态小精灵 SVG（与小程序一致）
    ├── algo.js           # 营养/体重算法（与小程序逐行一致）
    ├── store.js          # 本地存储
    └── app.js            # 主程序（含可拖拽浮窗小精灵）
```

## 本地验证（不用手机也能测）
```bash
cd web
node parity-test.js     # 算法与小程序逐行对齐，应 18/18 通过
node dom-smoke.js       # 真实 DOM 冒烟，应 9 步 0 错误
```
