# HTTP 与网络协议面试知识点

## HTTP/1.1 vs HTTP/2 vs HTTP/3

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| 传输协议 | TCP | TCP | QUIC(UDP) |
| 多路复用 | ❌ 队头阻塞 | ✅ 二进制帧 | ✅ 流独立 |
| 头部压缩 | ❌ | HPACK | QPACK |
| 服务器推送 | ❌ | ✅ | ✅ |

## HTTP 状态码

- 2xx：成功（200 OK、201 Created、204 No Content）
- 3xx：重定向（301 永久、302 临时、304 Not Modified）
- 4xx：客户端错误（400 Bad Request、401 未认证、403 禁止、404 Not Found）
- 5xx：服务端错误（500 Internal Server Error、502 Bad Gateway、503 Service Unavailable）

## HTTPS 握手过程（TLS 1.3）

1. Client Hello（支持的加密套件、随机数）
2. Server Hello（选定套件、证书、随机数）
3. 客户端验证证书，生成预主密钥（用服务器公钥加密）
4. 双方各自生成会话密钥，后续使用对称加密通信

## TCP 三次握手 / 四次挥手

握手：SYN → SYN-ACK → ACK（建立连接）
挥手：FIN → ACK → FIN → ACK（关闭连接，TIME_WAIT 等待 2MSL）

TIME_WAIT 作用：确保最后一个 ACK 送达对方；防止旧报文干扰新连接。

## 跨域（CORS）

浏览器同源策略限制跨域请求。解决方案：
- 简单请求：服务端返回 `Access-Control-Allow-Origin`
- 预检请求（OPTIONS）：非简单请求先发 preflight
- 代理：Nginx 代理或 Vite devServer proxy

## Cookie / Session / JWT

| 特性 | Cookie+Session | JWT |
|------|---------------|-----|
| 存储 | 服务端 Session | 客户端 token |
| 扩展性 | 分布式需共享 Session | 无状态，易扩展 |
| 安全性 | CSRF 风险 | XSS 风险，需 HttpOnly |
| 撤销 | 删除 Session | 需黑名单或短期 token |

## DNS 解析过程

浏览器缓存 → OS 缓存 → 本地 DNS 服务器 → 根域名服务器 → 顶级域名服务器 → 权威域名服务器

## WebSocket

全双工通信，在 HTTP 握手后升级协议（Upgrade: websocket）。
适合：实时聊天、游戏、股票行情、协同编辑。
与 SSE 区别：WebSocket 双向；SSE 单向（服务器推客户端），基于 HTTP。
