# SlimPix 轻量 Web Push 后端

让「喝水提醒」**即使关闭 App 也能像闹钟一样弹系统通知**。

原理：纯前端 PWA 无法在 App 关闭后自己发通知，必须由一个常驻后端在到点时通过 **Web Push** 协议推送。本目录就是一个最小后端：在饮水时段（07:00 / 09:00 / … / 21:30）向所有订阅者推送系统通知。

---

## 一、本地跑通（先验证）

```bash
cd push-server
npm install
node server.js          # 默认 http://localhost:3000
```

- `vapid-keys.json` 已自带一对 VAPID 密钥（也可自己换，见下）。
- 浏览器打开网页版 → 设置里开启「饮水提醒」并授权通知 → 后端日志会出现一条 `已推送…`（在整点后 30 分钟内触发）。
- 本地测试时把 `web/js/app.js` 顶部的 `PUSH_SERVER_URL` 改成 `http://localhost:3000`。

---

## 二、换成你自己的 VAPID 密钥（推荐）

VAPID 是一对密钥：公钥进前端、私钥留后端。两个文件要**配对**：

```bash
npx web-push generate-vapid-keys
```

- 把 `publicKey` 粘到 `web/js/app.js` 的 `VAPID_PUBLIC_KEY`（已填好一对示例，可替换）。
- 把 `privateKey` 与 `publicKey` 一起填进 `push-server/vapid-keys.json`（已填好示例）。
- 不换也能用，但换密钥更安全、避免和别人的站点撞车。

---

## 三、部署到免费主机（让手机真正随时收到）

GitHub Pages 只能放静态文件、不能跑后端，所以要单独部署这个 Node 服务。任选其一（都有免费额度）：

**方式 A · 一键 Blueprint（推荐，最少点击）**
1. 注册 [Render](https://render.com) 并授权你的 GitHub。
2. 控制台 → **New** → **Blueprint** → 选本仓库（含 `push-server/render.yaml`）。
3. Render 会按 `render.yaml` 自动建好服务（Root Directory=`push-server`、build=`npm install`、start=`npm start`、时区/来源已设好）。点 **Apply** 即可。
4. 部署完成后，Render 给一个 `https://slimpix-push.onrender.com` 之类的地址 → 跳到「四」填进前端。

**方式 B · 手动 New Web Service**
- **Render**：New → Web Service → 连这个仓库，Root Directory 填 `push-server`，Build `npm install`、Start `node server.js`。
- **Railway / Fly.io**：同样指向 `push-server` 目录即可。

部署后设置环境变量（非必须，但建议）：

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 端口（主机通常会自动给，不用管） | 3000 |
| `ALLOWED_ORIGIN` | 网页版来源，必须和你的 Pages 完全一致 | `https://liziqi-0501.github.io` |
| `TZ` | 时区，确保整点对应你本地时间 | `Asia/Shanghai` |
| `VAPID_PUBLIC` / `VAPID_PRIVATE` | 若用环境变量提供密钥，就不读 `vapid-keys.json` | — |
| `LLM_API_KEY` | 饮食页「自由输入识别」用的大模型 Key。**不设这个变量也能跑推送**；只有识别食物时才需要。优先用前端设置里用户自己填的 Key | — |
| `LLM_BASE_URL` | 大模型兼容接口地址（OpenAI 格式 `/chat/completions`） | `https://api.deepseek.com` |
| `LLM_MODEL` | 模型名 | `deepseek-chat` |

> ⚠️ **Render 免费版会休眠**：15 分钟无请求就暂停，导致到点不推送。
> 解决：用免费服务 [cron-job.org](https://cron-job.org) 每 **5 分钟** 调用一次你的 `https://<你的后端域名>/tick`（同时也保持进程唤醒）。`/tick` 本身就会检查并补发到期未发的饮水提醒。
>
> ⚠️ **免费版文件系统重启会清空订阅**：Render 免费实例重启/重新部署后 `subs.json` 会被重置为空。若某天收不到提醒，进 App 里把「饮水提醒」关掉再开启一次即可重新订阅（重新走一遍授权流程）。

---

## 四、把前端指到你的后端

部署拿到后端地址（如 `https://slimpix-push.onrender.com`）后：

1. 打开 `web/js/app.js`，把顶部
   ```js
   var PUSH_SERVER_URL = 'REPLACE_WITH_YOUR_PUSH_SERVER_URL'
   ```
   改成你的后端地址（**必须 https**）。
2. 重新把 `web/` 推到 GitHub Pages。

---

## 五、iPhone / Android 注意事项

- **iPhone**：必须 **iOS 16.4 及以上**，且先把网页版 **「添加到主屏幕」** 变成独立 App；在**这个已安装的 App 内**打开设置、开启饮水提醒并授权通知，才能收到 Web Push。
  关闭 App 后仍能收到（像闹钟），但前提是该 App 至少被打开过、且未被系统清理。
- **Android**：用 Chrome 把网页版「安装应用 / 添加到主屏幕」后，行为同上，最稳。
- 若**没**部署后端、或没装成 App，提醒退化为「App 打开/后台时」才弹（原有逻辑），不会关 App 推送。

---

## 接口一览（可接自有前端）

- `POST /subscribe`  body: `{ "subscription": <PushSubscription> }` — 新增订阅
- `POST /unsubscribe` body: `{ "endpoint": "..." }` — 取消订阅
- `GET /tick` — 手动触发一次到点检查（供外部 cron 调用）
- `POST /recognize` body: `{ "text": "中午吃了红烧肉和半碗米饭", "apiKey": "可选，用户自己的大模型Key" }` — 返回 `{ "ok": true, "items": [{"name","grams","kcal","protein","carb","fat","fiber"}] }`。无 Key 返回 503，空文本/坏 JSON 返回 400。
- `GET /health` — 健康检查
