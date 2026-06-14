# Nginx-Aegis

面向小白、独立开发者和前端开发者的智能 Nginx 可视化诊断配置器。

Nginx-Aegis 不是单纯的配置生成器，而是一个可以导入现有配置、识别风险、给出方案并生成可部署配置的前端工具。它特别适合宝塔站点配置场景，也支持从零生成完整 `nginx.conf`。

> 本项目前端由 [JquanUI V3.2](https://cssui.jquan.win/) 驱动。  
> 开源地址预设为：[https://junquanzhong.github.io/Nginx-Aegis/](https://junquanzhong.github.io/Nginx-Aegis/)

## 当前版本

`v1.4.5`

## 核心能力

- 从零生成 Nginx 配置
- 导入宝塔或现有 `server { ... }` 配置
- 自动识别站点域名、端口、根目录、SSL、include、location、PHP/rewrite、WebSocket 等信息
- 输出宝塔站点片段或完整 `nginx.conf`
- 实时安全评分与诊断
- 复制前结构校验
- `nginx -t` 报错解释器
- JquanUI CodeBlock 代码高亮、行号与复制体验

## 内置增强套餐

- IP 直连拦截：拦截 `https://ip:443` 或 `http://ip` 直接访问
- HTTP 强制跳转 HTTPS
- 现代 SSL 加固：移除 TLSv1/TLSv1.1 与弱密码套件
- 安全响应头：`X-Frame-Options`、`nosniff`、`Referrer-Policy`
- SPA 路由回退：修复 React/Vue 刷新 404
- CORS 跨域配置：支持自定义允许来源
- PHP 上传目录禁执行
- WebSocket 代理加固
- 图片/资源防盗链
- CC/恶意频率限流
- 反向代理与 upstream 映射

## 快速使用

直接打开 `index.html` 即可使用。

如果浏览器因本地安全策略限制部分资源，可以用任意静态服务启动：

```bash
python -m http.server 4179
```

然后访问：

```text
http://127.0.0.1:4179/
```

## 宝塔用户建议流程

1. 在宝塔中打开站点的 Nginx 配置。
2. 复制整个 `server { ... }` 配置。
3. 粘贴到 Nginx-Aegis 的“导入已有配置”。
4. 点击“开始解析并诊断”。
5. 按需启用增强套餐。
6. 右侧默认选择“站点片段”。
7. 复制生成结果，整体替换原站点配置。
8. 保存前或保存后执行：

```bash
nginx -t
```

9. 测试通过后再 reload。

## 两种导出模式

### 宝塔站点片段

适合粘贴回：

```text
/www/server/panel/vhost/nginx/your-site.conf
```

该模式只输出站点级配置，不包含：

- `user`
- `events`
- `http`
- 主 `nginx.conf` 全局块

### 完整 nginx.conf

适合替换或参考主配置：

```text
/www/server/nginx/conf/nginx.conf
```

该模式会包含：

- `user`
- `events`
- `http`
- `server`
- `upstream`
- `limit_req_zone`
- gzip 等全局配置

## 重要注意事项

### CC 限流

`limit_req_zone` 只能放在主 `nginx.conf` 的 `http { ... }` 内。

宝塔站点片段模式下，工具会把站点内的 `limit_req` 默认注释，避免保存时报错：

```nginx
# limit_req zone=aegis_cc burst=20 nodelay;
```

如果要真正启用 CC 限流，需要先把下面这行添加到主 `nginx.conf` 的 `http { ... }` 内：

```nginx
limit_req_zone $binary_remote_addr zone=aegis_cc:10m rate=10r/s;
```

然后再取消站点配置中的 `limit_req` 注释。

### IP 直连拦截

`default_server` 和 `server_name _` 在同一端口下应保持全站唯一。

如果 `nginx -t` 出现：

```text
conflicting server name "_" on 0.0.0.0:80, ignored
```

说明服务器里已经存在兜底站点。此时应只保留一个 IP 直连拦截 server，或者关闭本工具的“屏蔽 IP 恶意访问”套餐。

### 反向代理

反向代理不是只开开关就能部署，必须确认后端服务地址。

例如：

```text
http://127.0.0.1:3000
http://127.0.0.1:8080
http://10.0.0.5:9000
```

如果工具中仍是默认 `http://127.0.0.1:3000`，复制前校验会提醒你确认它是否为真实服务端口。

## 常见 nginx -t 报错

### zero size shared memory zone "aegis_cc"

原因：站点配置中启用了 `limit_req`，但主 `nginx.conf` 的 `http { ... }` 内没有对应的 `limit_req_zone`。

解决：先注释站点内的 `limit_req`，或在主配置 `http` 块中添加：

```nginx
limit_req_zone $binary_remote_addr zone=aegis_cc:10m rate=10r/s;
```

### duplicate default server

原因：同一个端口存在多个 `default_server`。

解决：只保留一个默认站点，或关闭 IP 直连拦截套餐。

### directive is not allowed here

原因：把完整 `nginx.conf` 粘进了宝塔站点配置。

解决：宝塔站点配置请选择“站点片段”；完整配置只能放到主 `nginx.conf`。

## 项目结构

```text
Nginx Aegis/
├─ index.html
├─ README.md
├─ css/
│  └─ app.css
├─ js/
│  ├─ app.js
│  └─ jquan-config.js
├─ dist/
│  ├─ core/
│  │  └─ JquanUI@Core.js
│  └─ components/
│     └─ JquanUI@components.js
└─ 📖 智能 Nginx 可视化诊断配置器开发文档 (V1.0).md
```

## 技术栈

- HTML
- CSS
- JavaScript
- JquanUI V3.2
- JquanUI CodeBlock 组件

## 设计目标

Nginx-Aegis 的目标不是让用户背 Nginx 指令，而是让用户用“我想解决什么问题”的方式完成配置。

例如：

- 我不想别人通过 IP 访问我的网站
- 我的 Vue/React 刷新 404
- 我的接口跨域报错
- 我的站点经常被刷
- 我要把请求转发到 Node/Java/Go/Python 服务
- 我不知道 `nginx -t` 报错是什么意思

工具会把这些需求转成可读、可复制、可诊断的 Nginx 配置。

## 开源理念

开源让互联网持续伟大。

欢迎继续改进这个项目，让 Nginx 配置对小白更友好、更安全、更可解释。
