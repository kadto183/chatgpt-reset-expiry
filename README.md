# ChatGPT Reset Expiry｜ChatGPT 重置额度有效期查询插件

[中文说明](#中文说明) · [English](#english)

**一个用于查询 ChatGPT 重置额度（Reset Credits）准确失效时间的油猴插件，可显示精确到秒的有效期，并自动转换为浏览器当前本地时区。**

**View the exact expiration time of ChatGPT reset credits in your browser's local timezone.**

> 如果 ChatGPT 只告诉你“某天到期”，这个插件会进一步显示具体几点几分几秒失效。轻量、开源、仅本地运行，不上传账号数据，也不主动重放 ChatGPT 的受保护请求。

## 中文说明

### 这个插件是做什么的？

ChatGPT 的重置额度界面有时只显示到期日期，不显示具体时间。本插件会读取页面已经返回的重置额度数据，帮你查询每个额度准确到秒的失效时间，并按浏览器当前时区显示。

### 功能

- 查询 ChatGPT 重置额度的准确有效期与失效时间
- 读取 ChatGPT 页面本身返回的重置额度信息
- 显示精确到秒的失效时间
- 自动使用浏览器当前时区换算
- 中国大陆时区自动使用简体中文界面
- 中国香港、中国澳门、中国台湾时区自动使用繁体中文界面
- 其他时区默认使用英文界面
- 自动处理 UTC 偏移与夏令时
- 默认保持最小化，仅在确认检测到重置额度后自动展开一次
- 自动去重并按失效时间排序
- 标记最近到期的额度
- 支持一键复制全部时间
- 其他候选字段默认折叠，避免干扰主结果

### 安装

需要先安装 Userscript 管理器，例如 Tampermonkey 或 Violentmonkey。

然后打开：

**[安装 ChatGPT 重置额度有效期查询插件](https://raw.githubusercontent.com/kadto183/chatgpt-reset-expiry/main/chatgpt-reset-expiry.user.js)**

Userscript 管理器应会自动打开安装页面。

### 使用

1. 安装脚本并打开 ChatGPT。
2. 脚本默认只显示一个小型“重置额度”条。
3. 正常浏览 ChatGPT 或进入 Usage / 使用情况相关页面。
4. 如果页面返回有效的 Reset Credits 数据，脚本会自动展开一次并显示精确失效时间。
5. 手动收起后，同一页面中的重复请求不会反复弹出。

### 隐私与安全

本脚本：

- 不上传账号数据
- 不保存 Cookie、Token 或登录凭据
- 不主动重放 ChatGPT 的受保护请求
- 不修改 ChatGPT 账号设置
- 仅在本地监听并读取 ChatGPT 页面自身已经收到的响应数据

脚本依赖 ChatGPT 当前网页内部接口。若 OpenAI 调整前端或接口结构，脚本可能需要更新。

### 时区

脚本使用浏览器提供的 IANA 时区：

```javascript
Intl.DateTimeFormat().resolvedOptions().timeZone
```

因此显示的是浏览器/操作系统当前使用的本地时区，而不是根据 IP 地址或 VPN 位置推断。

### 当前主要数据源

```text
/backend-api/wham/rate-limit-reset-credits
```

脚本优先读取该响应中的 `expires_at` 数据作为主结果。

### 适合搜索的名称

本项目也可通过这些关键词理解或查找：

`ChatGPT 重置额度` · `ChatGPT 重置额度有效期` · `ChatGPT 重置时间` · `ChatGPT 到期时间` · `ChatGPT 有效期查询` · `ChatGPT 油猴插件` · `ChatGPT Reset Credits` · `ChatGPT Reset Expiry`

---

## English

### Features

- Reads reset-credit data already returned to the ChatGPT page
- Shows expiration timestamps down to the second
- Converts timestamps to the browser's local timezone
- Automatically handles UTC offsets and daylight saving time
- Starts collapsed and auto-opens only after valid reset-credit data is detected
- Deduplicates and sorts expiration times
- Highlights the next credit to expire
- Copies all expiration times with one click
- Keeps unrelated detected timestamps in a collapsed secondary section

### Installation

Install a userscript manager such as Tampermonkey or Violentmonkey, then open:

**[Install ChatGPT Reset Expiry](https://raw.githubusercontent.com/kadto183/chatgpt-reset-expiry/main/chatgpt-reset-expiry.user.js)**

Your userscript manager should offer to install it automatically.

### Privacy

This script:

- does not upload account data
- does not store cookies, tokens, or login credentials
- does not replay protected ChatGPT requests
- does not modify account settings
- only inspects response data that the ChatGPT page has already received

This project relies on ChatGPT's current web implementation and internal response structure, which may change without notice.

## License

[MIT](./LICENSE)

## Disclaimer

This is an independent community project and is not affiliated with or endorsed by OpenAI.
