// 初始化基础配置树
        let configState = {
            listen: "80",
            server_name: "yourdomain.com",
            root: "/www/wwwroot/your_project",
            index: "index.html index.htm default.html",
            ssl: false,
            ssl_certificate: "/etc/nginx/ssl/yourdomain.crt",
            ssl_certificate_key: "/etc/nginx/ssl/yourdomain.key",
            force_https: false,
            gzip: true,
            static_cache: true,
            hide_nginx_version: true,
            
            // 一键套餐状态
            blockIpDirect: false, // 是否屏蔽IP直接访问
            spaRouting: false,    // 是否开启单页重定向
            corsEnable: false,    // 是否开启跨域支持
            securityHeaders: false, // 是否增加安全防御头
            modernSsl: false,
            phpSecurity: false,
            websocketHardening: false,
            hotlinkProtection: false,
            ccRateLimit: false,
            reverseProxy: false,
            corsWhitelist: false,
            rateLimitZone: "aegis_cc",
            rateLimitRate: "10r/s",
            rateLimitBurst: 20,
            proxyPath: "/api/",
            proxyTarget: "http://127.0.0.1:3000",
            upstreamName: "aegis_backend",
            corsAllowedOrigin: "*",
            hotlinkDomains: "",

            importMode: false,
            importedServerBlock: "",
            importedHttpDirectives: "",
            importedIncludes: [],
            importedLocations: [],
            exportScope: "server",
            siteType: "static"
        };

        let importedSource = "";
        let lastGeneratedConfig = "";
        let importAnalysis = null;
        let codeBlockHost = null;

        const recipeMeta = {
            blockIpDirect: "IP 直连拦截",
            spaRouting: "SPA 路由回退",
            corsEnable: "CORS 跨域",
            securityHeaders: "安全响应头",
            modernSsl: "现代 SSL",
            phpSecurity: "PHP 安全",
            websocketHardening: "WebSocket 加固",
            hotlinkProtection: "防盗链",
            ccRateLimit: "防 CC 频率限流",
            reverseProxy: "反向代理"
        };

        function installCodeBlock() {
            if (window.JquanUI && window.JquanUIComponents?.codeBlock) {
                window.JquanUI.use(window.JquanUIComponents.codeBlock);
            }
        }

        function renderCodeBlock(codeText) {
            const host = document.querySelector('[jq-code-host]');
            if (!host) return;

            host.innerHTML = '<pre id="nginxCodeBlock" class="m-0"><code id="codeOutput" class="language-nginx"></code></pre>';
            const freshCode = host.querySelector('#codeOutput');
            freshCode.textContent = codeText;

            if (window.JquanUIComponents?.codeBlockApi) {
                window.JquanUIComponents.codeBlockApi.mount(freshCode, {
                    lineNumbers: true,
                    copyButton: true,
                    langLabel: true,
                    maxHeight: 580,
                    smartIndent: false,
                    autoDetect: true
                }).then(handle => {
                    codeBlockHost = handle;
                });
            }
        }

        // 挂载加载
        document.addEventListener('DOMContentLoaded', () => {
            installCodeBlock();
            syncStateToForm();
            generateNginxConf();
        });

        // 将状态树完全映射至左侧输入组件
        function syncStateToForm() {
            document.getElementById('cfgListenPort').value = configState.listen;
            document.getElementById('cfgServerName').value = configState.server_name;
            document.getElementById('cfgRootPath').value = configState.root;
            document.getElementById('cfgIndexFiles').value = configState.index;
            document.getElementById('cfgSslCheck').checked = configState.ssl;
            document.getElementById('cfgSslCert').value = configState.ssl_certificate;
            document.getElementById('cfgSslKey').value = configState.ssl_certificate_key;
            document.getElementById('cfgForceHttps').checked = configState.force_https;
            document.getElementById('cfgGzip').checked = configState.gzip;
            document.getElementById('cfgStaticCache').checked = configState.static_cache;
            document.getElementById('cfgHideVersion').checked = configState.hide_nginx_version;

            // 一键防护开关同步
            document.getElementById('blockIpDirect').checked = configState.blockIpDirect;
            document.getElementById('spaRouting').checked = configState.spaRouting;
            document.getElementById('corsEnable').checked = configState.corsEnable;
            document.getElementById('securityHeaders').checked = configState.securityHeaders;
            document.getElementById('modernSsl').checked = configState.modernSsl;
            document.getElementById('phpSecurity').checked = configState.phpSecurity;
            document.getElementById('websocketHardening').checked = configState.websocketHardening;
            document.getElementById('hotlinkProtection').checked = configState.hotlinkProtection;
            document.getElementById('ccRateLimit').checked = configState.ccRateLimit;
            document.getElementById('reverseProxy').checked = configState.reverseProxy;
            document.getElementById('cfgProxyPath').value = configState.proxyPath;
            document.getElementById('cfgProxyTarget').value = configState.proxyTarget;
            document.getElementById('cfgUpstreamName').value = configState.upstreamName;
            document.getElementById('cfgCorsOrigin').value = configState.corsAllowedOrigin;
            document.getElementById('cfgRateLimitZone').value = configState.rateLimitZone;
            document.getElementById('cfgRateLimitRate').value = configState.rateLimitRate;
            document.getElementById('cfgRateLimitBurst').value = configState.rateLimitBurst;
            document.getElementById('cfgHotlinkDomains').value = configState.hotlinkDomains;

            updateAdvancedRecipePanels();
            updateToggleStatusLabels();
            toggleSsl(configState.ssl, true, true);
        }

        // 修改普通输入框或开关，触发编译重新渲染
        function updateConfigField(field, value) {
            importedSource = "";
            configState[field] = value;
            updateToggleStatusLabels();
            generateNginxConf();
        }

        // 切换SSL独立属性与安全监听端口调整
        function toggleSsl(checked, keepImportedSource = false, silent = false) {
            if (!keepImportedSource) importedSource = "";
            configState.ssl = checked;
            const sslPanel = document.getElementById('sslSection');
            if (checked) {
                sslPanel.classList.remove('hidden');
                if (configState.listen === "80") {
                    configState.listen = "443 ssl";
                    document.getElementById('cfgListenPort').value = "443 ssl";
                }
            } else {
                sslPanel.classList.add('hidden');
                configState.force_https = false;
                document.getElementById('cfgForceHttps').checked = false;
                if (configState.listen === "443 ssl") {
                    configState.listen = "80";
                    document.getElementById('cfgListenPort').value = "80";
                }
            }
            if (!silent) generateNginxConf();
        }

        // 一键应用场景套餐
        function toggleRecipe(recipeId) {
            importedSource = "";
            configState[recipeId] = document.getElementById(recipeId).checked;
            if (recipeId === "corsEnable" && configState.corsEnable && !configState.corsAllowedOrigin) {
                configState.corsAllowedOrigin = "*";
            }
            if (recipeId === "hotlinkProtection" && configState.hotlinkProtection && !configState.hotlinkDomains) {
                configState.hotlinkDomains = `${configState.server_name} *.${configState.server_name}`;
            }
            updateAdvancedRecipePanels();
            updateToggleStatusLabels();
            generateNginxConf();
        }

        function updateAdvancedRecipePanels() {
            const showProxy = configState.reverseProxy || configState.corsEnable;
            const showRateLimit = configState.ccRateLimit;
            const showHotlink = configState.hotlinkProtection;
            const wrapper = document.getElementById('advancedRecipeSettings');
            const proxyPanel = document.getElementById('proxySettingsPanel');
            const ratePanel = document.getElementById('rateLimitSettingsPanel');
            const hotlinkPanel = document.getElementById('hotlinkSettingsPanel');

            if (wrapper) wrapper.classList.toggle('hidden', !(showProxy || showRateLimit || showHotlink));
            if (proxyPanel) proxyPanel.classList.toggle('hidden', !showProxy);
            if (ratePanel) ratePanel.classList.toggle('hidden', !showRateLimit);
            if (hotlinkPanel) hotlinkPanel.classList.toggle('hidden', !showHotlink);
        }

        function updateToggleStatusLabels() {
            const labelMap = [
                ['gzipStatus', configState.gzip],
                ['cacheStatus', configState.static_cache],
                ['hideVersionStatus', configState.hide_nginx_version]
            ];
            labelMap.forEach(([id, enabled]) => {
                const node = document.getElementById(id);
                if (!node) return;
                node.innerText = enabled ? "启用" : "关闭";
                node.className = enabled
                    ? "text-[10px] font-bold text-emerald-500"
                    : "text-[10px] font-bold text-slate-400";
            });
        }

        function updateDeployGuide() {
            const node = document.getElementById('deployGuideText');
            if (!node) return;

            if (configState.importMode && configState.exportScope === "server") {
                node.innerHTML = '当前为宝塔站点级配置：请整体替换该站点的 vhost 配置文件，不要粘贴到已有 <code class="bg-white/80 px-1 py-0.2 rounded border border-blue-200">server { ... }</code> 内部。保存后先执行 <code class="bg-slate-950 text-white font-mono px-1 rounded text-[10px]">nginx -t</code>，通过后再 reload。';
            } else {
                node.innerHTML = '当前为完整 Nginx 主配置：适合替换主 <code class="bg-white/80 px-1 py-0.2 rounded border border-blue-200">nginx.conf</code>。保存后先执行 <code class="bg-slate-950 text-white font-mono px-1 rounded text-[10px]">nginx -t</code>，通过后再 reload。';
            }
        }

        function setExportScope(scope) {
            configState.exportScope = scope === "full" ? "full" : "server";
            importedSource = "";
            generateNginxConf();
        }

        function buildChangeSummary() {
            const items = [];
            if (configState.importMode) items.push("已保留导入的业务 server、include、location 和日志配置");
            if (configState.blockIpDirect) items.push("新增 IP 直连拦截 server");
            if (configState.force_https) items.push("新增 HTTP 到 HTTPS 的 301 跳转");
            if (configState.securityHeaders) items.push("新增 X-Frame-Options / nosniff / Referrer-Policy 安全头");
            if (configState.modernSsl) items.push("启用现代 SSL 加固，移除弱协议和旧密码套件");
            if (configState.phpSecurity) items.push("新增 PHP 上传目录禁执行规则");
            if (configState.websocketHardening) items.push("增强 WebSocket 反代头和超时设置");
            if (configState.hotlinkProtection) items.push("新增图片/资源防盗链规则");
            if (configState.ccRateLimit) items.push("新增 CC/恶意频率限流规则");
            if (configState.reverseProxy) items.push(`新增 ${configState.proxyPath} 到 ${configState.proxyTarget} 的反向代理映射`);
            if (configState.corsEnable) items.push(`新增 CORS 规则，允许来源：${buildCorsOrigin()}`);
            if (!items.length) items.push("当前仅生成基础 Nginx 配置");
            return items;
        }

        function buildRiskSummary() {
            const items = [];
            if (configState.importMode && configState.exportScope === "server") {
                items.push("部署位置：宝塔站点 vhost 配置，整体替换原文件");
            } else {
                items.push("部署位置：主 nginx.conf，不适合粘进宝塔站点 server 内部");
            }
            if (configState.blockIpDirect) items.push("default_server 全站只能有一组，冲突时需取消其他默认站点");
            if (configState.siteType === "php" && configState.spaRouting) items.push("PHP/rewrite 站点已阻止 SPA 回退注入，避免伪静态冲突");
            if (configState.corsEnable && !configState.corsWhitelist) items.push("CORS 当前为 *，生产环境建议切换白名单");
            if (configState.ccRateLimit && configState.importMode && configState.exportScope === "server") items.push("宝塔片段中 CC 限流默认注释，需先把 limit_req_zone 添加到主 nginx.conf 的 http 块后再取消注释");
            if (configState.reverseProxy && configState.siteType === "php") items.push("PHP/rewrite 站点新增反代默认走 /api/，避免覆盖主站伪静态");
            items.push("保存后先执行 nginx -t，通过后再 reload");
            return items;
        }

        function countMatches(text, pattern) {
            return (text.match(pattern) || []).length;
        }

        function validateGeneratedConfig(codeText) {
            const checks = [];
            const isServerSnippet = configState.importMode && configState.exportScope === "server";

            function push(level, text, fixId = "") {
                checks.push({ level, text, fixId });
            }

            if (isServerSnippet && /^\s*(user|events|http)\b/m.test(codeText)) {
                push("error", "站点片段中检测到 user/events/http 主配置指令，粘回宝塔站点会报错。");
            }

            if (!isServerSnippet && !/^\s*http\s*\{/m.test(codeText)) {
                push("error", "完整配置模式下未检测到 http { ... } 主配置块。");
            }

            if (countMatches(codeText, /default_server/g) >= 2 && !/server_name\s+_/i.test(codeText)) {
                push("warning", "检测到 default_server，但没有 server_name _ 兜底块，请确认默认站点逻辑。");
            }

            if (/default_server/i.test(codeText)) {
                push("warning", "default_server 在同一端口全站只能有一组；若 nginx -t 报 duplicate default server，请取消其他默认站点。");
            }

            if (configState.ssl && (/yourdomain|\/etc\/nginx\/ssl\/yourdomain/i.test(codeText) || !/ssl_certificate\s+\S+;/i.test(codeText))) {
                push("error", "SSL 证书路径仍是占位值或缺失，请替换为真实证书路径。");
            }

            if (/ssl_protocols\s+[^;]*(TLSv1(\s|;)|TLSv1\.1)/i.test(codeText)) {
                push("error", "仍检测到 TLSv1/TLSv1.1，请启用现代 SSL 或手动移除。", "modernSsl");
            }

            if (/Access-Control-Allow-Origin['"]?\s+['"]?\*/i.test(codeText)) {
                push("warning", "CORS 仍为 *，生产环境建议改为白名单。", "corsWhitelist");
            }

            if (configState.reverseProxy) {
                if (!/^\/[^\s{};]*$/.test(configState.proxyPath || "")) {
                    push("error", "反向代理访问路径必须以 / 开头，且不能包含空格或分号。", "reverseProxy");
                }
                if (!/^https?:\/\/[a-z0-9._:-]+\/?$/i.test(configState.proxyTarget || "")) {
                    push("error", "反向代理后端地址需要填写真实 http(s)://IP或域名:端口，例如 http://127.0.0.1:3000。", "reverseProxy");
                } else if (/^https?:\/\/127\.0\.0\.1:3000\/?$/i.test(configState.proxyTarget || "")) {
                    push("warning", "反向代理仍是示例后端 127.0.0.1:3000，请确认这就是你的真实服务端口。", "reverseProxy");
                }
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(configState.upstreamName || "")) {
                    push("error", "Upstream 名称只能使用字母、数字和下划线，且不能以数字开头。", "reverseProxy");
                }
            }

            if (/limit_req\s+zone=([a-z0-9_:-]+)/i.test(codeText) && !/limit_req_zone\s+\$binary_remote_addr/i.test(codeText) && !isServerSnippet) {
                push("error", "检测到 limit_req，但完整配置里缺少 http 级 limit_req_zone。", "ccRateLimit");
            }

            if (configState.ccRateLimit && isServerSnippet) {
                push("info", "当前是宝塔站点片段：CC 限流的 limit_req 已安全注释；把 limit_req_zone 加入主 nginx.conf 后再取消注释启用。", "ccRateLimit");
            }

            if (configState.ccRateLimit) {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(configState.rateLimitZone || "")) {
                    push("error", "限流区名称只能使用字母、数字和下划线，且不能以数字开头。", "ccRateLimit");
                }
                if (!/^\d+r\/[smh]$/.test(configState.rateLimitRate || "")) {
                    push("error", "限流频率格式应为 10r/s、300r/m 或 1000r/h。", "ccRateLimit");
                }
                if (!/^\d+$/.test(String(configState.rateLimitBurst)) || Number(configState.rateLimitBurst) < 0) {
                    push("error", "burst 必须是大于等于 0 的整数。", "ccRateLimit");
                }
            }

            if (configState.siteType === "php" && /try_files\s+\$uri\s+\$uri\/\s+\/index\.html/i.test(codeText)) {
                push("error", "PHP/rewrite 站点中出现 SPA 回退规则，可能导致伪静态异常。");
            }

            if (/include\s+\/www\/server\/panel\//i.test(codeText)) {
                push("info", "检测到宝塔专属 include 路径，仅适合宝塔环境，裸机/1Panel 可能不存在。");
            }

            if (/location\s+\^~\s+\/wss/i.test(codeText) && !/X-Forwarded-Proto/i.test(codeText)) {
                push("info", "WebSocket 代理未包含 X-Forwarded-Proto，可启用 WebSocket 加固。", "websocketHardening");
            }

            if (!checks.length) {
                push("info", "未发现明显结构性风险；部署前仍需执行 nginx -t。");
            }

            return checks;
        }

        function parseNginxErrorLocation(text) {
            const match = text.match(/\s+in\s+(.+?):(\d+)/i);
            return match ? `定位文件：${match[1]}，第 ${match[2]} 行。` : "";
        }

        function explainNginxTestOutput(rawText) {
            const text = rawText.trim();
            const lower = text.toLowerCase();
            const location = parseNginxErrorLocation(text);
            const results = [];

            function add(level, title, reason, fix) {
                results.push({ level, title, reason, fix, location });
            }

            if (!text) {
                add("info", "等待粘贴 nginx -t 输出", "你还没有粘贴报错内容。", "在服务器执行 nginx -t，把完整输出粘贴到这里。");
                return results;
            }

            if (/syntax is ok/i.test(text) && /test is successful/i.test(text)) {
                add("success", "Nginx 配置测试通过", "nginx -t 已确认语法正确。", "可以执行 nginx -s reload 或通过宝塔面板重载。");
                return results;
            }

            if (/duplicate default server/i.test(lower)) {
                add("error", "default_server 冲突", "同一个 listen 地址和端口只能有一个 default_server。", "取消其他站点里的 default_server，或关闭本工具的 IP 直连拦截套餐。");
            }

            if (/conflicting server name \"_\"/i.test(lower)) {
                add("warning", "server_name _ 兜底站点重复", "服务器里已经存在 server_name _ 的默认/兜底站点，本工具新增的 IP 直连拦截可能被 Nginx 忽略。", "如果已有默认站点能拦截 IP 直连，可关闭本工具的 IP 直连拦截；否则保留全站唯一一个 server_name _。");
            }

            if (/zero size shared memory zone/i.test(lower)) {
                add("error", "CC 限流缺少 http 级共享内存区", "server 内启用了 limit_req，但主 nginx.conf 的 http 块没有生效的 limit_req_zone，Nginx 因此无法创建 aegis_cc 限流区。", "先注释或删除站点配置里的 limit_req 行；如需启用 CC 限流，把 limit_req_zone $binary_remote_addr zone=aegis_cc:10m rate=10r/s; 加到主 nginx.conf 的 http { ... } 内，再取消站点 limit_req 注释。");
            }

            if (/directive .* is not allowed here/i.test(lower) || /\"(user|events|http)\" directive is not allowed here/i.test(lower)) {
                add("error", "配置放错层级", "你可能把完整 nginx.conf 粘进了宝塔站点 server 配置里。", "切换为“站点片段”导出，或把完整配置放到主 nginx.conf。");
            }

            if (/unknown directive/i.test(lower)) {
                add("error", "未知指令", "Nginx 不认识某个指令，常见原因是版本太旧、模块未安装、指令拼写错误。", "检查报错行的指令名称；例如 http2 on 需要较新版本，旧版通常写 listen 443 ssl http2。");
            }

            if (/no such file or directory/i.test(lower) && /ssl_certificate|certificate|pem|key/i.test(lower)) {
                add("error", "证书文件不存在", "ssl_certificate 或 ssl_certificate_key 指向的文件路径不存在。", "在宝塔证书目录确认 fullchain.pem / privkey.pem 是否存在，或重新申请证书。");
            } else if (/no such file or directory/i.test(lower) && /include/i.test(lower)) {
                add("error", "include 文件不存在", "配置引用了不存在的 include 文件。", "确认这是宝塔环境；裸机或 1Panel 不能直接使用 /www/server/panel 路径。");
            } else if (/no such file or directory/i.test(lower)) {
                add("error", "文件路径不存在", "Nginx 读取某个文件失败。", "根据报错路径检查文件是否存在、路径是否拼错、权限是否允许 Nginx 读取。");
            }

            if (/bind\(\).*failed/i.test(lower) || /address already in use/i.test(lower)) {
                add("error", "端口被占用", "Nginx 要监听的端口已经被其他进程占用，常见于 80/443。", "检查是否已有 Nginx/Apache/Caddy 占用端口，或重复启动了多个 Nginx。");
            }

            if (/unexpected \"}\"|unexpected end of file|expecting \";\"/i.test(lower)) {
                add("error", "括号或分号语法错误", "配置中可能少了分号、少了右大括号，或多了一个右大括号。", "查看报错行附近的 server/location/if 块，确认每条指令以 ; 结束。");
            }

            if (/invalid number of arguments/i.test(lower)) {
                add("error", "指令参数数量错误", "某条 Nginx 指令给了过多或过少参数。", "查看报错行，按 Nginx 文档或宝塔默认写法修正参数数量。");
            }

            if (/host not found in upstream/i.test(lower)) {
                add("error", "上游域名无法解析", "proxy_pass 或 upstream 中的域名在服务器上无法 DNS 解析。", "改用 IP:端口，或检查服务器 DNS 和上游域名是否正确。");
            }

            if (/rewrite or internal redirection cycle/i.test(lower)) {
                add("warning", "rewrite/try_files 循环", "伪静态或 SPA 回退规则可能互相跳转形成死循环。", "PHP/宝塔 rewrite 站点不要启用 SPA 回退；检查 try_files 和 rewrite include。");
            }

            if (!results.length) {
                add("info", "未命中特定规则", "这条报错暂时不在内置规则库中。", "把完整 nginx -t 输出、对应配置片段和部署环境一起检查；优先看报错最后的文件路径和行号。");
            }

            return results;
        }

        function explainNginxError() {
            const input = document.getElementById('nginxErrorInput');
            const list = document.getElementById('nginxErrorExplainList');
            if (!input || !list) return;

            const items = explainNginxTestOutput(input.value);
            const iconMap = {
                success: 'fa-circle-check text-emerald-500',
                error: 'fa-circle-xmark text-rose-500',
                warning: 'fa-triangle-exclamation text-amber-500',
                info: 'fa-circle-info text-sky-500'
            };

            list.innerHTML = items.map(item => `
                <li class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div class="flex items-start gap-2">
                        <i class="fa-solid ${iconMap[item.level] || iconMap.info} mt-0.5"></i>
                        <div>
                            <h5 class="font-bold text-slate-800">${item.title}</h5>
                            <p class="mt-1 text-slate-500 leading-relaxed">${item.reason}</p>
                            ${item.location ? `<p class="mt-1 text-[10px] font-mono text-slate-400">${item.location}</p>` : ''}
                            <p class="mt-2 text-emerald-700 leading-relaxed"><span class="font-bold">建议：</span>${item.fix}</p>
                        </div>
                    </div>
                </li>
            `).join("");
        }

        function renderList(node, items, iconClass) {
            if (!node) return;
            node.innerHTML = items.map(item => `
                <li class="flex items-start gap-1.5">
                    <i class="fa-solid ${iconClass} text-[10px] mt-0.5"></i>
                    <span>${item}</span>
                </li>
            `).join("");
        }

        function renderValidationList(node, checks) {
            if (!node) return;
            const iconMap = {
                error: 'fa-circle-xmark text-rose-500',
                warning: 'fa-triangle-exclamation text-amber-500',
                info: 'fa-circle-info text-sky-500'
            };
            node.innerHTML = checks.map(item => `
                <li class="flex items-start justify-between gap-2">
                    <div class="flex items-start gap-1.5">
                        <i class="fa-solid ${iconMap[item.level] || iconMap.info} text-[10px] mt-0.5"></i>
                        <span>${item.text}</span>
                    </div>
                    ${item.fixId ? `<button onclick="quickFix('${item.fixId}')" class="shrink-0 text-[10px] font-bold text-emerald-600 hover:text-emerald-700">修复</button>` : ''}
                </li>
            `).join("");
        }

        function updateExportInsights() {
            const control = document.getElementById('exportScopeControl');
            const serverBtn = document.getElementById('scopeServerBtn');
            const fullBtn = document.getElementById('scopeFullBtn');
            const modeBadge = document.getElementById('exportModeBadge');

            if (control) {
                control.classList.toggle('hidden', !configState.importMode);
                control.classList.toggle('flex', configState.importMode);
            }

            if (serverBtn && fullBtn) {
                const isServer = configState.exportScope === "server";
                serverBtn.className = isServer
                    ? "text-[10px] px-2 py-1 rounded font-bold text-white bg-slate-900"
                    : "text-[10px] px-2 py-1 rounded font-bold text-slate-500 hover:text-slate-800";
                fullBtn.className = !isServer
                    ? "text-[10px] px-2 py-1 rounded font-bold text-white bg-slate-900"
                    : "text-[10px] px-2 py-1 rounded font-bold text-slate-500 hover:text-slate-800";
            }

            if (modeBadge) {
                const label = configState.importMode && configState.exportScope === "server" ? "宝塔站点片段" : "完整 nginx.conf";
                modeBadge.innerText = label;
                modeBadge.className = configState.importMode && configState.exportScope === "server"
                    ? "text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600"
                    : "text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600";
            }

            renderList(document.getElementById('changeSummaryList'), buildChangeSummary(), 'fa-circle-plus text-emerald-500');
            renderValidationList(document.getElementById('riskSummaryList'), validateGeneratedConfig(lastGeneratedConfig || ""));
        }

        function indentBlock(block, spaces = 4) {
            const pad = " ".repeat(spaces);
            return block.trim().split("\n").map(line => `${pad}${line}`).join("\n");
        }

        function insertBeforeFinalBrace(block, text) {
            const index = block.lastIndexOf("}");
            if (index === -1) return `${block}\n${text}`;
            const before = block.slice(0, index).replace(/\s*$/, "");
            const after = block.slice(index);
            const indented = text.split("\n").map(line => line ? `    ${line}` : "").join("\n");
            return `${before}\n${indented}\n${after}`;
        }

        function replaceDirective(block, name, value) {
            const pattern = new RegExp(`\\b${name}\\s+[^;]+;`, "i");
            if (pattern.test(block)) {
                return block.replace(pattern, `${name} ${value};`);
            }
            return insertBeforeFinalBrace(block, `${name} ${value};`);
        }

        function ensureDirective(block, name, line) {
            const pattern = new RegExp(`\\b${name}\\b`, "i");
            if (pattern.test(block)) return block;
            return insertBeforeFinalBrace(block, line);
        }

        function ensureLine(block, matcher, line) {
            if (matcher.test(block)) return block;
            return insertBeforeFinalBrace(block, line);
        }

        function stripInsecureCiphers(value) {
            return value
                .split(":")
                .filter(item => item && !/3DES|DES|RC4|MD5/i.test(item))
                .join(":") || "HIGH:!aNULL:!MD5";
        }

        function buildRateLimitZoneLine(indent = "") {
            return `${indent}limit_req_zone $binary_remote_addr zone=${configState.rateLimitZone}:10m rate=${configState.rateLimitRate};`;
        }

        function buildRateLimitLine(indent = "") {
            return `${indent}limit_req zone=${configState.rateLimitZone} burst=${configState.rateLimitBurst} nodelay;`;
        }

        function buildCommentedRateLimitServerHint() {
            return [
                "# Nginx-Aegis: CC/恶意频率限流 server 级规则",
                "# 安全默认: 宝塔站点片段中先注释，避免未配置 http 级 limit_req_zone 时保存失败。",
                "# 完成主 nginx.conf 的 http { ... } 配置后，再取消下一行注释：",
                `# ${buildRateLimitLine()}`
            ].join("\n");
        }

        function buildCorsOrigin() {
            const value = (configState.corsAllowedOrigin || "").trim();
            if (value) return value;
            return configState.corsWhitelist ? `https://${configState.server_name}` : "*";
        }

        function buildHotlinkDomains() {
            const value = (configState.hotlinkDomains || "").trim();
            return value || `${configState.server_name} *.${configState.server_name}`;
        }

        function buildProxyLocationBlock(indent = "") {
            const path = configState.proxyPath || "/api/";
            const target = configState.proxyTarget || "http://127.0.0.1:3000";
            const lines = [
                `${indent}# Nginx-Aegis: 标准反向代理映射`,
                `${indent}location ${path} {`,
                `${indent}    proxy_pass ${target};`,
                `${indent}    proxy_http_version 1.1;`,
                `${indent}    proxy_set_header Host $host;`,
                `${indent}    proxy_set_header X-Real-IP $remote_addr;`,
                `${indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
                `${indent}    proxy_set_header X-Forwarded-Proto $scheme;`,
                `${indent}    proxy_set_header Upgrade $http_upgrade;`,
                `${indent}    proxy_set_header Connection "upgrade";`,
                `${indent}    proxy_read_timeout 300s;`,
                `${indent}    proxy_send_timeout 300s;`
            ];

            if (configState.corsEnable) {
                lines.push(`${indent}    if ($request_method = 'OPTIONS') {`);
                lines.push(`${indent}        add_header 'Access-Control-Allow-Origin' '${buildCorsOrigin()}';`);
                lines.push(`${indent}        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';`);
                lines.push(`${indent}        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';`);
                lines.push(`${indent}        add_header 'Access-Control-Max-Age' 1728000;`);
                lines.push(`${indent}        return 204;`);
                lines.push(`${indent}    }`);
                lines.push(`${indent}    add_header 'Access-Control-Allow-Origin' '${buildCorsOrigin()}' always;`);
                lines.push(`${indent}    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;`);
                lines.push(`${indent}    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;`);
            }

            lines.push(`${indent}}`);
            return lines.join("\n");
        }

        function buildUpstreamBlock(indent = "") {
            const target = (configState.proxyTarget || "http://127.0.0.1:3000").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
            return [
                `${indent}# Nginx-Aegis: 可扩展负载均衡上游，可继续追加 server 节点`,
                `${indent}upstream ${configState.upstreamName} {`,
                `${indent}    server ${target};`,
                `${indent}    keepalive 32;`,
                `${indent}}`
            ].join("\n");
        }

        function buildConnectionUpgradeMap(indent = "") {
            return [
                `${indent}map $http_upgrade $connection_upgrade {`,
                `${indent}    default upgrade;`,
                `${indent}    '' close;`,
                `${indent}}`
            ].join("\n");
        }

        function readFirstMatch(text, pattern, fallback = "") {
            const match = text.match(pattern);
            return match ? match[1].trim() : fallback;
        }

        function normalizeImportedServerBlock(block) {
            let output = block.trim();
            const isPhpLikeSite = configState.siteType === "php" || /index\.php|enable-php|rewrite\/.+\.conf/i.test(output);

            if (configState.ssl && configState.force_https) {
                output = output
                    .split("\n")
                    .filter(line => !/^\s*listen\s+80\s*;?\s*$/i.test(line))
                    .join("\n");
            }

            output = replaceDirective(output, "server_name", configState.server_name || "_");
            output = replaceDirective(output, "root", configState.root || "/usr/share/nginx/html");
            output = replaceDirective(output, "index", configState.index || "index.html index.htm");

            if (configState.ssl) {
                output = ensureLine(output, /\blisten\s+443\b/i, "listen 443 ssl;");
                output = replaceDirective(output, "ssl_certificate", configState.ssl_certificate || "/etc/nginx/ssl/yourdomain.crt");
                output = replaceDirective(output, "ssl_certificate_key", configState.ssl_certificate_key || "/etc/nginx/ssl/yourdomain.key");
                output = replaceDirective(output, "ssl_protocols", "TLSv1.2 TLSv1.3");
                output = ensureLine(output, /\bssl_prefer_server_ciphers\b/i, "ssl_prefer_server_ciphers on;");
                output = ensureLine(output, /\bssl_ciphers\b/i, "ssl_ciphers HIGH:!aNULL:!MD5;");
            }

            if (configState.modernSsl && configState.ssl) {
                const cipher = readDirective(output, "ssl_ciphers");
                output = replaceDirective(output, "ssl_ciphers", stripInsecureCiphers(cipher));
                output = replaceDirective(output, "ssl_session_tickets", "off");
                output = ensureLine(output, /\bssl_session_cache\b/i, "ssl_session_cache shared:SSL:10m;");
                output = ensureLine(output, /\bssl_session_timeout\b/i, "ssl_session_timeout 10m;");
            }

            if (configState.securityHeaders) {
                output = ensureLine(output, /add_header\s+X-Frame-Options/i, 'add_header X-Frame-Options "SAMEORIGIN" always;');
                output = ensureLine(output, /add_header\s+X-Content-Type-Options/i, 'add_header X-Content-Type-Options "nosniff" always;');
                output = ensureLine(output, /add_header\s+Referrer-Policy/i, 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
            }

            if (configState.ccRateLimit && configState.exportScope !== "server" && !/limit_req\s+zone=/i.test(output)) {
                output = ensureLine(output, /limit_req\s+zone=/i, buildRateLimitLine());
            } else if (configState.ccRateLimit && configState.exportScope === "server" && !/Nginx-Aegis: CC\/恶意频率限流 server 级规则/i.test(output)) {
                output = insertBeforeFinalBrace(output, buildCommentedRateLimitServerHint());
            }

            if (configState.spaRouting && !isPhpLikeSite && !/try_files\s+\$uri\s+\$uri\/\s+\/index\.html/i.test(output)) {
                output = output.replace(/location\s+\/\s*\{[\s\S]*?\n\s*\}/i, [
                    "location / {",
                    "    try_files $uri $uri/ /index.html;",
                    "}"
                ].join("\n"));
                if (!/try_files\s+\$uri\s+\$uri\/\s+\/index\.html/i.test(output)) {
                    output = insertBeforeFinalBrace(output, "location / {\n        try_files $uri $uri/ /index.html;\n    }");
                }
            }

            if (configState.corsEnable && !configState.reverseProxy && !/Access-Control-Allow-Origin/i.test(output)) {
                output = insertBeforeFinalBrace(output, [
                    "# Nginx-Aegis: API 跨域预检与响应头",
                    "location /api/ {",
                    "    if ($request_method = 'OPTIONS') {",
                    `        add_header 'Access-Control-Allow-Origin' '${buildCorsOrigin()}';`,
                    "        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';",
                    "        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';",
                    "        add_header 'Access-Control-Max-Age' 1728000;",
                    "        return 204;",
                    "    }",
                    `    add_header 'Access-Control-Allow-Origin' '${buildCorsOrigin()}' always;`,
                    "    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;",
                    "    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;",
                    "    # proxy_pass http://127.0.0.1:8080/;",
                    "}",
                ].join("\n"));
            }

            if (configState.phpSecurity && !/location\s+~\*\s+\^\(uploads\|upload|Nginx-Aegis: PHP 上传目录禁执行/i.test(output)) {
                output = insertBeforeFinalBrace(output, [
                    "# Nginx-Aegis: PHP 上传目录禁执行",
                    "location ~* ^/(uploads|upload|runtime|storage|cache|tmp)/.*\\.php$ {",
                    "    return 403;",
                    "}"
                ].join("\n"));
            }

            if (configState.websocketHardening && /location\s+\^~\s+\/wss/i.test(output)) {
                output = output.replace(/location\s+\^~\s+\/wss\s*\{([\s\S]*?)\n\s*\}/i, function (match, body) {
                    let enhanced = match;
                    enhanced = ensureLine(enhanced, /proxy_http_version\s+1\.1/i, "proxy_http_version 1.1;");
                    enhanced = ensureLine(enhanced, /proxy_set_header\s+Upgrade/i, "proxy_set_header Upgrade $http_upgrade;");
                    enhanced = ensureLine(enhanced, /proxy_set_header\s+Connection/i, 'proxy_set_header Connection "Upgrade";');
                    enhanced = ensureLine(enhanced, /proxy_set_header\s+X-Forwarded-Proto/i, "proxy_set_header X-Forwarded-Proto $scheme;");
                    enhanced = ensureLine(enhanced, /proxy_read_timeout/i, "proxy_read_timeout 600s;");
                    enhanced = ensureLine(enhanced, /proxy_send_timeout/i, "proxy_send_timeout 600s;");
                    enhanced = ensureLine(enhanced, /proxy_buffering\s+off/i, "proxy_buffering off;");
                    return enhanced;
                });
            }

            if (configState.hotlinkProtection && !/Nginx-Aegis: 防盗链/i.test(output)) {
                output = insertBeforeFinalBrace(output, [
                    "# Nginx-Aegis: 防盗链，允许本站和空 Referer",
                    "location ~* \\.(jpg|jpeg|png|gif|webp|svg|mp4|zip|rar)$ {",
                    `    valid_referers none blocked ${buildHotlinkDomains()};`,
                    "    if ($invalid_referer) {",
                    "        return 403;",
                    "    }",
                    "    expires 30d;",
                    "    access_log off;",
                    "}"
                ].join("\n"));
            }

            if (configState.reverseProxy && !/Nginx-Aegis: 标准反向代理映射|proxy_pass\s+http:\/\/127\.0\.0\.1:3000/i.test(output)) {
                let proxyBlock = buildProxyLocationBlock();
                if (configState.exportScope === "full") {
                    proxyBlock = proxyBlock
                        .replace(configState.proxyTarget, `http://${configState.upstreamName}`)
                        .replace('proxy_set_header Connection "upgrade";', 'proxy_set_header Connection $connection_upgrade;');
                }
                output = insertBeforeFinalBrace(output, proxyBlock);
            }

            return output;
        }

        function buildGlobalEnhancementNotes() {
            const notes = [];

            if (configState.hide_nginx_version) {
                notes.push("server_tokens off;");
            }
            if (configState.gzip) {
                notes.push("gzip on;");
                notes.push("gzip_vary on;");
                notes.push("gzip_proxied any;");
                notes.push("gzip_comp_level 6;");
                notes.push("gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;");
            }
            if (configState.ccRateLimit) {
                notes.push(buildRateLimitZoneLine());
            }
            if (configState.reverseProxy) {
                notes.push(`# 反向代理当前使用直连上游 ${configState.proxyTarget}，如需负载均衡请在主 nginx.conf 的 http 块配置 upstream。`);
            }

            return notes;
        }

        function generateImportedServerSnippet() {
            const confLines = [];

            confLines.push("# ========================================================================");
            confLines.push("# Nginx-Aegis 宝塔站点配置增强片段");
            confLines.push("# 用途: 粘贴回宝塔站点配置 / vhost/nginx/*.conf");
            confLines.push("# 注意: 这里只输出 server 级配置，不包含 user/events/http 全局块");
            confLines.push("# 使用: 请整体替换原站点配置，不要粘贴到已有 server { ... } 内部");
            confLines.push("# 提醒: default_server 在全站只能有一组，如宝塔已有默认站点，请先取消旧默认站点");
            confLines.push("# 开源地址: https://junquanzhong.github.io/Nginx-Aegis/");
            confLines.push("# 增强版本: v1.4.5");
            confLines.push("# ========================================================================");
            confLines.push("");

            const globalNotes = buildGlobalEnhancementNotes();
            if (globalNotes.length) {
                confLines.push("# 以下属于 nginx.conf 的 http 级全局优化，不能直接放进宝塔站点 server 配置。");
                confLines.push("# 如需启用，请添加到主 nginx.conf 的 http { ... } 内：");
                globalNotes.forEach(line => confLines.push(`#   ${line}`));
                if (configState.ccRateLimit) {
                    confLines.push("# 重要: 站点片段中的 limit_req 已默认注释，先添加 limit_req_zone 后再取消注释启用。");
                }
                if (configState.reverseProxy) {
                    confLines.push("# 重要: 如需 WebSocket 动态 Connection 头，可在 http { ... } 内添加 map。");
                }
                confLines.push("");
            }

            if (configState.blockIpDirect) {
                confLines.push("# Nginx-Aegis: 禁止 IP 直连访问，可作为独立 server 块保留在同一个 vhost 文件中");
                confLines.push("# 注意: 如 nginx -t 提示 duplicate default server，请删除其他站点中的 default_server");
                confLines.push("server {");
                confLines.push("    listen 80 default_server;");
                confLines.push("    listen [::]:80 default_server;");
                if (configState.ssl) {
                    confLines.push("    listen 443 default_server ssl;");
                    confLines.push("    listen [::]:443 default_server ssl;");
                    confLines.push(`    ssl_certificate ${configState.ssl_certificate};`);
                    confLines.push(`    ssl_certificate_key ${configState.ssl_certificate_key};`);
                }
                confLines.push("    server_name _;");
                confLines.push("    return 444;");
                confLines.push("}");
                confLines.push("");
            }

            if (configState.ssl && configState.force_https) {
                confLines.push("# Nginx-Aegis: HTTP 强制跳转 HTTPS");
                confLines.push("server {");
                confLines.push("    listen 80;");
                confLines.push(`    server_name ${configState.server_name};`);
                confLines.push("    return 301 https://$host$request_uri;");
                confLines.push("}");
                confLines.push("");
            }

            confLines.push(normalizeImportedServerBlock(configState.importedServerBlock));

            return confLines.join("\n");
        }

        function generateImportedNginxConf() {
            if (configState.exportScope === "server") {
                return generateImportedServerSnippet();
            }

            const confLines = [];

            confLines.push("# ========================================================================");
            confLines.push("# Nginx-Aegis 导入增强配置文件");
            confLines.push("# 来源: 宝塔/现有 Nginx server 配置 | 增强版本: v1.4.5");
            confLines.push("# 开源地址: https://junquanzhong.github.io/Nginx-Aegis/");
            confLines.push("# ========================================================================");
            confLines.push("");
            confLines.push("user nginx;");
            confLines.push("worker_processes auto;");
            confLines.push("error_log /var/log/nginx/error.log warn;");
            confLines.push("pid /var/run/nginx.pid;");
            confLines.push("");
            confLines.push("events {");
            confLines.push("    worker_connections 1024;");
            confLines.push("}");
            confLines.push("");
            confLines.push("http {");
            confLines.push("    include /etc/nginx/mime.types;");
            confLines.push("    default_type application/octet-stream;");
            confLines.push("    sendfile on;");
            confLines.push("    keepalive_timeout 65;");
            confLines.push("");

            if (configState.hide_nginx_version) {
                confLines.push("    # Nginx-Aegis: 隐藏 Nginx 版本号");
                confLines.push("    server_tokens off;");
                confLines.push("");
            }

            if (configState.gzip) {
                confLines.push("    # Nginx-Aegis: 开启 Gzip 压缩");
                confLines.push("    gzip on;");
                confLines.push("    gzip_vary on;");
                confLines.push("    gzip_proxied any;");
                confLines.push("    gzip_comp_level 6;");
                confLines.push("    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;");
                confLines.push("");
            }

            if (configState.ccRateLimit) {
                confLines.push("    # Nginx-Aegis: CC/恶意频率限流共享内存区");
                confLines.push(buildRateLimitZoneLine("    "));
                confLines.push("");
            }

            if (configState.reverseProxy) {
                confLines.push(buildConnectionUpgradeMap("    "));
                confLines.push("");
                confLines.push(buildUpstreamBlock("    "));
                confLines.push("");
            }

            if (configState.blockIpDirect) {
                confLines.push("    # Nginx-Aegis: 禁止 IP 直连访问");
                confLines.push("    server {");
                confLines.push("        listen 80 default_server;");
                confLines.push("        listen [::]:80 default_server;");
                if (configState.ssl) {
                    confLines.push("        listen 443 default_server ssl;");
                    confLines.push("        listen [::]:443 default_server ssl;");
                    confLines.push(`        ssl_certificate ${configState.ssl_certificate};`);
                    confLines.push(`        ssl_certificate_key ${configState.ssl_certificate_key};`);
                }
                confLines.push("        server_name _;");
                confLines.push("        return 444;");
                confLines.push("    }");
                confLines.push("");
            }

            if (configState.ssl && configState.force_https) {
                confLines.push("    # Nginx-Aegis: HTTP 强制跳转 HTTPS");
                confLines.push("    server {");
                confLines.push("        listen 80;");
                confLines.push(`        server_name ${configState.server_name};`);
                confLines.push("        return 301 https://$host$request_uri;");
                confLines.push("    }");
                confLines.push("");
            }

            confLines.push(indentBlock(normalizeImportedServerBlock(configState.importedServerBlock), 4));
            confLines.push("}");

            return confLines.join("\n");
        }

        // 清空并彻底退回最简骨架，便于极客自由配置
        function resetToEmpty() {
            if(confirm("确定要清空当前的智能设置，退回最原始极简 Nginx 配置吗？")) {
                importedSource = "";
                importAnalysis = null;
                configState = {
                    listen: "80",
                    server_name: "_",
                    root: "/usr/share/nginx/html",
                    index: "index.html index.htm",
                    ssl: false,
                    ssl_certificate: "",
                    ssl_certificate_key: "",
                    force_https: false,
                    gzip: false,
                    static_cache: false,
                    hide_nginx_version: false,
                    blockIpDirect: false,
                    spaRouting: false,
                    corsEnable: false,
                    securityHeaders: false,
                    modernSsl: false,
                    phpSecurity: false,
                    websocketHardening: false,
                    hotlinkProtection: false,
                    ccRateLimit: false,
                    reverseProxy: false,
                    corsWhitelist: false,
                    rateLimitZone: "aegis_cc",
                    rateLimitRate: "10r/s",
                    rateLimitBurst: 20,
                    proxyPath: "/api/",
                    proxyTarget: "http://127.0.0.1:3000",
                    upstreamName: "aegis_backend",
                    corsAllowedOrigin: "*",
                    hotlinkDomains: "",
                    importMode: false,
                    importedServerBlock: "",
                    importedHttpDirectives: "",
                    importedIncludes: [],
                    importedLocations: [],
                    exportScope: "server",
                    siteType: "static"
                };
                syncStateToForm();
                generateNginxConf();
                showToast("配置已回归最原始基础骨架！");
            }
        }

        // ==========================================================
        // 核心编译器：根据响应式配置树，生成标准化、零故障 Nginx 代码
        // ==========================================================
        function generateNginxConf() {
            if (configState.importMode && configState.importedServerBlock) {
                const importedText = generateImportedNginxConf();
                lastGeneratedConfig = importedText;
                renderCodeBlock(importedText);
                updateDeployGuide();
                updateExportInsights();
                diagnoseAndScore(importedText);
                return;
            }

            let confLines = [];

            confLines.push("# ==========================================================================");
            confLines.push("# 智能防护与 Nginx-Aegis 安全网盾标准配置文件");
            confLines.push("# 深度加固版本: v1.4.5 | 设计师 Jquan 倾情打造 - 「我爱编程」");
            confLines.push("# 开源地址: https://junquanzhong.github.io/Nginx-Aegis/");
            confLines.push("# ==========================================================================");
            confLines.push("");

            confLines.push("user nginx;");
            confLines.push("worker_processes auto;");
            confLines.push("error_log /var/log/nginx/error.log warn;");
            confLines.push("pid /var/run/nginx.pid;");
            confLines.push("");

            confLines.push("events {");
            confLines.push("    worker_connections 1024;");
            confLines.push("}");
            confLines.push("");

            confLines.push("http {");
            confLines.push("    include /etc/nginx/mime.types;");
            confLines.push("    default_type application/octet-stream;");
            confLines.push("");
            confLines.push("    log_format main '$remote_addr - $remote_user [$time_local] \"$request\" '");
            confLines.push("                    '$status $body_bytes_sent \"$http_referer\" '");
            confLines.push("                    '\"$http_user_agent\" \"$http_x_forwarded_for\"';");
            confLines.push("    access_log /var/log/nginx/access.log main;");
            confLines.push("");
            confLines.push("    sendfile on;");
            confLines.push("    keepalive_timeout 65;");
            confLines.push("");

            // 安全隐藏版本号
            if (configState.hide_nginx_version) {
                confLines.push("    # 屏蔽 Nginx 具体版本号，防止黑客对特定版本漏洞实施精准定点探测");
                confLines.push("    server_tokens off;");
                confLines.push("");
            }

            // Gzip 网络智能收缩
            if (configState.gzip) {
                confLines.push("    # 开启静态资源高比例压缩传输，全面降低网络吞吐负载");
                confLines.push("    gzip on;");
                confLines.push("    gzip_disable \"msie6\";");
                confLines.push("    gzip_vary on;");
                confLines.push("    gzip_proxied any;");
                confLines.push("    gzip_comp_level 6;");
                confLines.push("    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;");
                confLines.push("");
            }

            // 【重磅功能】一键防御并封禁任何 HTTPS/HTTP IP直连
            if (configState.blockIpDirect) {
                confLines.push("    # ----------------------------------------------------------------------");
                confLines.push("    # [安全核心盾] 绝杀 IP 恶意扫站直连：禁止任何直接通过 IP 访问的请求");
                confLines.push("    # ----------------------------------------------------------------------");
                confLines.push("    server {");
                confLines.push("        listen 80 default_server;");
                confLines.push("        listen [::]:80 default_server;");
                if (configState.ssl) {
                    confLines.push("        listen 443 default_server ssl;");
                    confLines.push("        listen [::]:443 default_server ssl;");
                    confLines.push(`        ssl_certificate ${configState.ssl_certificate};`);
                    confLines.push(`        ssl_certificate_key ${configState.ssl_certificate_key};`);
                }
                confLines.push("        server_name _;");
                confLines.push("        # 返回 444 (Nginx专有无响应状态码)，直接静默断开连接，不浪费一字节流量");
                confLines.push("        return 444;");
                confLines.push("    }");
                confLines.push("");
            }

            // 强制 HTTP 跳转 HTTPS 重定向
            if (configState.ssl && configState.force_https) {
                confLines.push("    # 强制将所有 HTTP 非安全明文访问，安全重定向至 443 密文端口");
                confLines.push("    server {");
                confLines.push("        listen 80;");
                confLines.push(`        server_name ${configState.server_name};`);
                confLines.push(`        return 301 https://$host$request_uri;`);
                confLines.push("    }");
                confLines.push("");
            }

            // 主业务 Server 节点
            confLines.push("    # 主站点核心业务分发");
            confLines.push("    server {");
            
            // 是否启用了 HTTPS 阻断重定向
            if (configState.ssl && configState.force_https) {
                confLines.push(`        listen ${configState.listen.includes('ssl') ? configState.listen : configState.listen + ' ssl'};`);
            } else {
                confLines.push(`        listen ${configState.listen};`);
            }
            confLines.push(`        server_name ${configState.server_name};`);
            confLines.push(`        root ${configState.root};`);
            confLines.push(`        index ${configState.index};`);
            confLines.push("");

            // HTTPS 证书部署
            if (configState.ssl) {
                confLines.push("        # HTTPS 密钥及高安全标准协议套件");
                confLines.push(`        ssl_certificate ${configState.ssl_certificate};`);
                confLines.push(`        ssl_certificate_key ${configState.ssl_certificate_key};`);
                confLines.push("        ssl_protocols TLSv1.2 TLSv1.3; # 禁用并废弃高危的 TLS 1.0、1.1 版本");
                confLines.push("        ssl_prefer_server_ciphers on;");
                confLines.push(`        ssl_ciphers ${configState.modernSsl ? "HIGH:!aNULL:!MD5:!3DES:!DES:!RC4" : "HIGH:!aNULL:!MD5"};`);
                if (configState.modernSsl) {
                    confLines.push("        ssl_session_tickets off;");
                    confLines.push("        ssl_session_cache shared:SSL:10m;");
                    confLines.push("        ssl_session_timeout 10m;");
                }
                confLines.push("");
            }

            if (configState.ccRateLimit) {
                confLines.push("    # CC/恶意频率限流共享内存区：每个 IP 默认 10r/s，可按业务承载微调");
                confLines.push(buildRateLimitZoneLine("    "));
                confLines.push("");
            }

            if (configState.reverseProxy) {
                confLines.push("    # WebSocket/长连接升级映射，避免 Connection 头写死导致普通 HTTP 异常");
                confLines.push(buildConnectionUpgradeMap("    "));
                confLines.push("");
                confLines.push(buildUpstreamBlock("    "));
                confLines.push("");
            }

            // 安全防御 Header
            if (configState.securityHeaders) {
                confLines.push("        # 安全固化防护响应头");
                confLines.push("        add_header X-Frame-Options \"SAMEORIGIN\" always; # 防外站iframe点击劫持");
                confLines.push("        add_header X-XSS-Protection \"1; mode=block\" always; # 强力开启跨站脚本阻断模式");
                confLines.push("        add_header X-Content-Type-Options \"nosniff\" always; # 严防MIME类型混淆漏洞");
                confLines.push("");
            }

            if (configState.ccRateLimit) {
                confLines.push("        # 防 CC 与恶意高频请求，超过阈值会返回 503");
                confLines.push(buildRateLimitLine("        "));
                confLines.push("");
            }

            // 默认 / 路由映射
            if (configState.reverseProxy && configState.proxyPath === "/") {
                confLines.push(buildProxyLocationBlock("        ").replace(configState.proxyTarget, `http://${configState.upstreamName}`).replace('proxy_set_header Connection "upgrade";', 'proxy_set_header Connection $connection_upgrade;'));
            } else {
                confLines.push("        location / {");
                if (configState.spaRouting) {
                confLines.push("            # SPA 单页面系统专属规则：一键根治前端路由刷新 404 痛点");
                confLines.push("            try_files $uri $uri/ /index.html;");
                } else {
                confLines.push("            try_files $uri $uri/ =404;");
                }
                confLines.push("        }");
            }

            if (configState.reverseProxy && configState.proxyPath !== "/") {
                confLines.push("");
                confLines.push(buildProxyLocationBlock("        ").replace(configState.proxyTarget, `http://${configState.upstreamName}`).replace('proxy_set_header Connection "upgrade";', 'proxy_set_header Connection $connection_upgrade;'));
            }

            // 联调跨域全解代理
            if (configState.corsEnable && !configState.reverseProxy) {
                confLines.push("");
                confLines.push("        # 跨域拦截反代全开 (CORS)");
                confLines.push("        location /api/ {");
                confLines.push("            if ($request_method = 'OPTIONS') {");
                confLines.push(`                add_header 'Access-Control-Allow-Origin' '${buildCorsOrigin()}';`);
                confLines.push("                add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';");
                confLines.push("                add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';");
                confLines.push("                add_header 'Access-Control-Max-Age' 1728000;");
                confLines.push("                add_header 'Content-Type' 'text/plain; charset=utf-8';");
                confLines.push("                add_header 'Content-Length' 0;");
                confLines.push("                return 204;");
                confLines.push("            }");
                confLines.push(`            add_header 'Access-Control-Allow-Origin' '${buildCorsOrigin()}' always;`);
                confLines.push("            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;");
                confLines.push("            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;");
                confLines.push("            ");
                confLines.push("            # 反向代理上游：");
                confLines.push("            # proxy_pass http://127.0.0.1:8080/;");
                confLines.push("        }");
            }

            // 静态强缓存配置
            if (configState.static_cache) {
                confLines.push("");
                confLines.push("        # 静态图像/多媒体文件 30 天本地持久化极速缓存方案");
                confLines.push("        location ~* \\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|svg)$ {");
                confLines.push("            expires 30d;");
                confLines.push("            access_log off;");
                confLines.push("            add_header Cache-Control \"public, no-transform\";");
                confLines.push("        }");
            }

            if (configState.phpSecurity) {
                confLines.push("");
                confLines.push("        # PHP 上传目录禁执行，防止木马落地后直接运行");
                confLines.push("        location ~* ^/(uploads|upload|runtime|storage|cache|tmp)/.*\\.php$ {");
                confLines.push("            return 403;");
                confLines.push("        }");
            }

            if (configState.hotlinkProtection) {
                confLines.push("");
                confLines.push("        # 图片/压缩包防盗链，允许本站和空 Referer");
                confLines.push("        location ~* \\.(jpg|jpeg|png|gif|webp|svg|mp4|zip|rar)$ {");
                confLines.push(`            valid_referers none blocked ${buildHotlinkDomains()};`);
                confLines.push("            if ($invalid_referer) {");
                confLines.push("                return 403;");
                confLines.push("            }");
                confLines.push("            expires 30d;");
                confLines.push("            access_log off;");
                confLines.push("        }");
            }

            confLines.push("    }");
            confLines.push("}");

            const fullText = confLines.join("\n");
            lastGeneratedConfig = fullText;
            
            // 交由 JquanUI CodeBlock 官方组件渲染，统一行号、复制与代码排版
            renderCodeBlock(fullText);
            updateDeployGuide();
            updateExportInsights();

            // 立即驱动智能诊断
            diagnoseAndScore(fullText);
        }

        // ==========================================
        // 智能诊断评测中心
        // ==========================================
        function diagnoseAndScore(codeText) {
            let diagnostics = [];
            let score = 100;
            const source = importedSource || codeText;
            const lowerSource = source.toLowerCase();
            const hasIpBlock = /default_server/i.test(source) && /server_name\s+_/i.test(source) && /return\s+(444|403)\s*;/i.test(source);
            const hasWeakTls = /ssl_protocols\s+[^;]*(TLSv1(\s|;)|TLSv1\.1)/i.test(source);
            const hasSafeTls = /ssl_protocols\s+[^;]*(TLSv1\.2|TLSv1\.3)/i.test(source);

            // 扫描点1：防御IP直连劫持检测
            if (!hasIpBlock) {
                diagnostics.push({
                    type: 'danger',
                    icon: 'fa-skull-crossbones text-rose-500',
                    title: '严重安全隐患：未拦截 IP 恶意直连访问',
                    desc: '检测到您的配置目前暴露在全网。任何人与漏洞扫描机器人都可以直接通过 HTTPS://IP 直连您主站绑定的物理服务器，极易被扫描出端口后台，引发流量倾泻攻击。',
                    fixId: 'blockIpDirect'
                });
                score -= 35;
            }

            // 扫描点2：SSL 旧版本协议劫持检测
            if (configState.ssl && (hasWeakTls || !hasSafeTls)) {
                diagnostics.push({
                    type: 'warning',
                    icon: 'fa-shield-heart text-amber-500',
                    title: '协议安全风险：支持了存在重大设计漏洞的 TLS 1.0/1.1 协议',
                    desc: '您的网站已经启用了 HTTPS，但允许已经被行业淘汰并宣布不安全的 TLS 1.0、TLS 1.1 老版本协议，极可能无法通过等保评测。',
                    fixId: 'cfgSslCheck'
                });
                score -= 15;
            }

            // 扫描点3：点击劫持与XSS响应头注入检查
            if (!/add_header\s+X-Frame-Options/i.test(source)) {
                diagnostics.push({
                    type: 'warning',
                    icon: 'fa-fingerprint text-indigo-500',
                    title: '合规度不达标：未注入 XSS 与 iframe 劫持保护头',
                    desc: '系统检测到您并未声明 X-Frame-Options。恶意第三方网站可以用 iframe 方式直接劫持嵌入您的站点页面，诱骗您的用户进行盲签授权。',
                    fixId: 'securityHeaders'
                });
                score -= 15;
            }

            // 扫描点4：Gzip 调优
            if (!/\bgzip\s+on\s*;/i.test(source)) {
                diagnostics.push({
                    type: 'info',
                    icon: 'fa-gauge-high text-cyan-500',
                    title: '性能负荷偏高：未开启静态资源 Gzip 网络智能压缩',
                    desc: '您的 Nginx.conf 没有包含核心的 gzip 选项。页面直连传输由于数据未压缩，将会极大增加宽带开销，并显著降低小白首屏加载体验。',
                    fixId: 'cfgGzip'
                });
                score -= 15;
            }

            // 扫描点5：静态缓存
            if (!/(expires\s+\d+d\s*;|Cache-Control)/i.test(source)) {
                diagnostics.push({
                    type: 'info',
                    icon: 'fa-clock text-amber-600',
                    title: '性能负荷偏高：静态文件未应用浏览器强缓存',
                    desc: 'CSS、JS、woff字体以及高体积静态图片若未附加 Expires 首部信息，极易导致高并发请求，拖垮后端源服务器。',
                    fixId: 'cfgStaticCache'
                });
                score -= 15;
            }

            if (configState.ssl && !configState.force_https && !/return\s+301\s+https:\/\/\$host\$request_uri/i.test(source)) {
                diagnostics.push({
                    type: 'warning',
                    icon: 'fa-lock text-sky-500',
                    title: '体验与安全缺口：HTTP 未强制跳转 HTTPS',
                    desc: '用户仍可能通过 http:// 访问明文页面。建议开启 301 跳转，让访客和搜索引擎统一进入 HTTPS 版本。',
                    fixId: 'cfgForceHttps'
                });
                score -= 10;
            }

            if (/Access-Control-Allow-Origin['"]?\s+['"]?\*/i.test(source)) {
                diagnostics.push({
                    type: 'info',
                    icon: 'fa-triangle-exclamation text-amber-500',
                    title: '跨域策略偏宽：生产环境不建议长期使用 *',
                    desc: '检测到 CORS 对所有来源开放。联调时很方便，但正式站点建议限定可信域名，避免接口被任意站点调用。',
                    fixId: 'corsWhitelist'
                });
                score -= 5;
            }

            if (configState.ssl && (/3DES|RC4|DES/i.test(source) || /ssl_session_tickets\s+on\s*;/i.test(source))) {
                diagnostics.push({
                    type: 'warning',
                    icon: 'fa-lock text-amber-500',
                    title: 'SSL 可继续加固：存在旧密码套件或 Session Tickets',
                    desc: '检测到 3DES/DES/RC4 等旧套件或 ssl_session_tickets on。建议启用现代 SSL 套餐，减少降级和会话票据风险。',
                    fixId: 'modernSsl'
                });
                score -= 10;
            }

            if (configState.siteType === "php" && !/uploads\|upload|上传目录禁执行/i.test(source)) {
                diagnostics.push({
                    type: 'warning',
                    icon: 'fa-code text-purple-500',
                    title: 'PHP 站点建议禁止上传目录执行脚本',
                    desc: 'PHP 站点若允许 uploads/runtime/cache 等目录执行 .php，上传漏洞会被直接放大为代码执行风险。',
                    fixId: 'phpSecurity'
                });
                score -= 10;
            }

            if (/location\s+\^~\s+\/wss/i.test(source) && !/X-Forwarded-Proto/i.test(source)) {
                diagnostics.push({
                    type: 'info',
                    icon: 'fa-plug-circle-bolt text-cyan-500',
                    title: 'WebSocket 代理可补齐转发协议头',
                    desc: '检测到 /wss 反向代理。建议补充 X-Forwarded-Proto 等头，提升上游服务识别 HTTPS/WSS 的稳定性。',
                    fixId: 'websocketHardening'
                });
                score -= 5;
            }

            if (!/limit_req\s+zone=/i.test(source)) {
                diagnostics.push({
                    type: 'warning',
                    icon: 'fa-shield-halved text-rose-500',
                    title: '抗压能力不足：未配置 CC/恶意高频请求限流',
                    desc: '小型站点最常见的压力来源是同一 IP 高频刷新页面或接口。建议启用限流套餐，为访问频率设置可控阈值。',
                    fixId: 'ccRateLimit'
                });
                score -= 10;
            } else if (/limit_req\s+zone=/i.test(source) && !/limit_req_zone\s+\$binary_remote_addr/i.test(source) && !configState.importMode) {
                diagnostics.push({
                    type: 'danger',
                    icon: 'fa-triangle-exclamation text-rose-500',
                    title: '限流配置不完整：缺少 http 级 limit_req_zone',
                    desc: '检测到 server 内使用了 limit_req，但没有看到共享内存区声明。nginx -t 可能提示 unknown limit_req_zone。',
                    fixId: 'ccRateLimit'
                });
                score -= 15;
            }

            if (/proxy_pass\s+http/i.test(source) && !/X-Forwarded-Proto/i.test(source)) {
                diagnostics.push({
                    type: 'info',
                    icon: 'fa-route text-teal-500',
                    title: '反向代理可继续标准化：缺少完整转发头',
                    desc: '后端服务通常需要 Host、真实 IP、转发协议等头来正确记录日志、生成 HTTPS 链接和识别用户来源。',
                    fixId: 'reverseProxy'
                });
                score -= 5;
            }

            // 设定打分下限
            if (score < 0) score = 0;

            // 刷新仪表盘分数及诊断明细
            renderScoreRing(score);
            renderDiagnostics(diagnostics);
        }

        // 驱动 SVG 圆环
        function renderScoreRing(score) {
            const ring = document.getElementById('scoreRing');
            const scoreText = document.getElementById('scoreText');
            const badge = document.getElementById('scoreBadge');
            
            const strokeOffset = 351.8 - (score / 100) * 351.8;
            ring.style.strokeDashoffset = strokeOffset;
            scoreText.innerText = score;

            if (score >= 90) {
                badge.innerText = "固若金汤";
                badge.className = "text-xs px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-600 border border-emerald-100";
            } else if (score >= 60) {
                badge.innerText = "轻度隐患";
                badge.className = "text-xs px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-600 border border-amber-100";
            } else {
                badge.innerText = "漏洞百出";
                badge.className = "text-xs px-2 py-0.5 rounded-md font-bold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse";
            }
        }

        // 渲染生成诊断详情条目
        function renderDiagnostics(list) {
            const container = document.getElementById('diagnosticsList');
            const issueCount = document.getElementById('issueCount');
            
            if (list.length === 0) {
                issueCount.innerText = "完美无瑕";
                issueCount.className = "text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold";
                container.innerHTML = `
                    <div class="p-6 bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200 text-center">
                        <i class="fa-solid fa-medal text-emerald-500 text-3xl mb-2"></i>
                        <h4 class="font-bold text-slate-800 text-sm">恭喜！已加载全部顶级安全防护套餐</h4>
                        <p class="text-xs text-gray-400 mt-1">目前诊断安全分达到满分状态，无任何已知可利用的恶意漏洞暴露在外。</p>
                    </div>
                `;
                return;
            }

            issueCount.innerText = `${list.length} 个缺陷发现`;
            issueCount.className = "text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded font-bold";

            let html = "";
            list.forEach((item) => {
                html += `
                    <div class="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl transition-all hover:bg-slate-100/80">
                        <div class="mt-0.5 flex-shrink-0">
                            <i class="fa-solid ${item.icon} text-lg"></i>
                        </div>
                        <div class="flex-1">
                            <h4 class="text-xs font-bold text-slate-800">${item.title}</h4>
                            <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">${item.desc}</p>
                            <div class="mt-3 flex items-center justify-between">
                                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">评测判定: ${item.type === 'danger' ? '🔥 极高危' : '⚠️ 建议加固'}</span>
                                <button onclick="quickFix('${item.fixId}')" class="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1">
                                    <i class="fa-solid fa-wrench text-emerald-400"></i> 一键无痛修复
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        // 无痛一键极速修复组件
        function quickFix(fixId) {
            importedSource = "";

            const fixActions = {
                blockIpDirect: () => { configState.blockIpDirect = true; },
                securityHeaders: () => { configState.securityHeaders = true; },
                corsEnable: () => { configState.corsEnable = true; },
                corsWhitelist: () => {
                    configState.corsEnable = true;
                    configState.corsWhitelist = true;
                    configState.corsAllowedOrigin = `https://${configState.server_name}`;
                },
                spaRouting: () => { configState.spaRouting = true; },
                modernSsl: () => { configState.modernSsl = true; },
                phpSecurity: () => { configState.phpSecurity = true; },
                websocketHardening: () => { configState.websocketHardening = true; },
                hotlinkProtection: () => { configState.hotlinkProtection = true; },
                ccRateLimit: () => { configState.ccRateLimit = true; },
                reverseProxy: () => { configState.reverseProxy = true; },
                cfgGzip: () => { configState.gzip = true; },
                cfgStaticCache: () => { configState.static_cache = true; },
                cfgHideVersion: () => { configState.hide_nginx_version = true; },
                cfgSslCheck: () => { configState.ssl = true; },
                cfgForceHttps: () => {
                    configState.ssl = true;
                    configState.force_https = true;
                }
            };

            if (fixActions[fixId]) {
                fixActions[fixId]();
            }
            syncStateToForm();
            updateToggleStatusLabels();
            generateNginxConf();
            showToast("安全漏洞完美修复成功！配置已更新。");
        }

        // ==========================================
        // 智能 Nginx 文件逆向解析 AST 解析引擎 (BT、标准多层 Nginx conf 解包)
        // ==========================================
        function stripComments(text) {
            return text.replace(/^\s*#.*$/gm, "");
        }

        function extractBlocks(text, blockName) {
            const blocks = [];
            const regex = new RegExp(`\\b${blockName}\\b[^\\{]*\\{`, "gi");
            let match;
            while ((match = regex.exec(text))) {
                let depth = 1;
                let index = regex.lastIndex;
                while (index < text.length && depth > 0) {
                    if (text[index] === "{") depth++;
                    if (text[index] === "}") depth--;
                    index++;
                }
                if (depth === 0) {
                    blocks.push(text.slice(match.index, index));
                    regex.lastIndex = index;
                }
            }
            return blocks;
        }

        function readDirective(block, name) {
            const match = block.match(new RegExp(`\\b${name}\\s+([^;]+);`, "i"));
            return match ? match[1].trim() : "";
        }

        function scoreBusinessServer(block) {
            let score = 0;
            if (readDirective(block, "server_name") && !/server_name\s+_/i.test(block)) score += 10;
            if (!/default_server/i.test(block)) score += 10;
            if (/\broot\s+[^;]+;/i.test(block)) score += 40;
            if (/\bindex\s+[^;]+;/i.test(block)) score += 10;
            if (/\blocation\b/i.test(block)) score += 4 * (block.match(/\blocation\b/gi) || []).length;
            if (/\binclude\b/i.test(block)) score += 2 * (block.match(/\binclude\b/gi) || []).length;
            if (/\breturn\s+301\s+https:\/\//i.test(block)) score -= 30;
            if (/server_name\s+_/i.test(block)) score -= 50;
            return score;
        }

        function analyzeNginxConfig(rawText) {
            const clean = stripComments(rawText);
            const serverBlocks = extractBlocks(clean, "server");
            const businessServer = serverBlocks
                .slice()
                .sort((a, b) => scoreBusinessServer(b) - scoreBusinessServer(a))[0] || clean;

            const listenList = [...businessServer.matchAll(/\blisten\s+([^;]+);/gi)].map(item => item[1].trim());
            const sslEnabled = listenList.some(item => /443|ssl/i.test(item)) || /\bssl_certificate\s+/i.test(businessServer);
            const hasIpBlock = serverBlocks.some(block => /default_server/i.test(block) && /server_name\s+_/i.test(block) && /return\s+(444|403)\s*;/i.test(block));
            const includes = [...businessServer.matchAll(/^\s*include\s+([^;]+);/gmi)].map(item => item[1].trim());
            const locations = extractBlocks(businessServer, "location").map(block => {
                const head = block.match(/location\s+([^\{]+)/i);
                return {
                    path: head ? head[1].trim() : "",
                    body: block
                };
            });
            const siteType = /index\.php|enable-php|rewrite\/.+\.conf/i.test(businessServer)
                ? "php"
                : /try_files\s+\$uri\s+\$uri\/\s+\/index\.html/i.test(businessServer)
                    ? "spa"
                    : "static";

            return {
                clean,
                serverBlocks,
                businessServer,
                includes,
                locations,
                siteType,
                listen: listenList[0] || readDirective(clean, "listen"),
                serverName: readDirective(businessServer, "server_name"),
                root: readDirective(businessServer, "root"),
                index: readDirective(businessServer, "index"),
                sslCertificate: readDirective(businessServer, "ssl_certificate"),
                sslCertificateKey: readDirective(businessServer, "ssl_certificate_key"),
                sslEnabled,
                forceHttps: /return\s+301\s+https:\/\/\$host\$request_uri/i.test(clean),
                blockIpDirect: hasIpBlock,
                spaRouting: siteType === "spa",
                corsEnable: /Access-Control-Allow-Origin/i.test(businessServer),
                securityHeaders: /add_header\s+X-Frame-Options/i.test(businessServer),
                gzip: /\bgzip\s+on\s*;/i.test(clean),
                staticCache: /(expires\s+\d+d\s*;|Cache-Control)/i.test(businessServer),
                hideVersion: /server_tokens\s+off\s*;/i.test(clean),
                weakTls: /ssl_protocols\s+[^;]*(TLSv1(\s|;)|TLSv1\.1)/i.test(clean),
                modernSsl: !/3DES|RC4|DES/i.test(readDirective(businessServer, "ssl_ciphers")) && /ssl_session_tickets\s+off\s*;/i.test(businessServer),
                phpSecurity: /上传目录禁执行|uploads\|upload/i.test(businessServer),
                websocketHardening: /location\s+\^~\s+\/wss/i.test(businessServer) && /X-Forwarded-Proto/i.test(businessServer),
                hotlinkProtection: /valid_referers/i.test(businessServer),
                ccRateLimit: /limit_req\s+zone=/i.test(businessServer),
                reverseProxy: /proxy_pass\s+http/i.test(businessServer),
                corsWhitelist: /Access-Control-Allow-Origin['"]?\s+['"]?https?:\/\//i.test(businessServer),
                corsAllowedOrigin: readFirstMatch(businessServer, /Access-Control-Allow-Origin['"]?\s+['"]?([^'";\s]+)/i, "*"),
                hotlinkDomains: readFirstMatch(businessServer, /valid_referers\s+none\s+blocked\s+([^;]+);/i, ""),
                proxyPath: readFirstMatch(businessServer, /location\s+([^\s{]+)\s*\{[\s\S]*?proxy_pass\s+http/i, "/api/"),
                proxyTarget: readFirstMatch(businessServer, /proxy_pass\s+(https?:\/\/[^;\s]+)\s*;/i, "http://127.0.0.1:3000"),
                rateLimitZone: readFirstMatch(businessServer, /limit_req\s+zone=([a-zA-Z0-9_]+)/i, "aegis_cc"),
                rateLimitBurst: readFirstMatch(businessServer, /limit_req\s+zone=[a-zA-Z0-9_]+\s+burst=(\d+)/i, "20"),
                rateLimitRate: readFirstMatch(clean, /limit_req_zone\s+\$binary_remote_addr\s+zone=[a-zA-Z0-9_]+:\d+m\s+rate=([^;]+);/i, "10r/s")
            };
        }

        function buildImportRecommendations(analysis) {
            const missing = [];
            if (!analysis.blockIpDirect) missing.push(recipeMeta.blockIpDirect);
            if (!analysis.securityHeaders) missing.push(recipeMeta.securityHeaders);
            if (!analysis.gzip) missing.push("Gzip 压缩");
            if (!analysis.staticCache) missing.push("静态资源缓存");
            if (analysis.sslEnabled && analysis.weakTls) missing.push("TLS 1.2/1.3 安全协议");
            if (analysis.sslEnabled && !analysis.modernSsl) missing.push("现代 SSL 加固");
            if (analysis.siteType === "php" && !analysis.phpSecurity) missing.push("PHP 上传目录禁执行");
            if (analysis.locations.some(item => item.path.includes('/wss')) && !analysis.websocketHardening) missing.push("WebSocket 转发头加固");
            if (!analysis.ccRateLimit) missing.push("防 CC 频率限流");
            if (analysis.reverseProxy && !analysis.websocketHardening) missing.push("反向代理转发头标准化");
            if (analysis.sslEnabled && !analysis.forceHttps) missing.push("HTTP 强制跳转 HTTPS");
            if (analysis.spaRouting) missing.push("已识别 SPA 路由，可保留");
            if (analysis.corsEnable) missing.push("已识别 CORS，可继续精调");
            return missing;
        }

        function importNginxConf() {
            const inputVal = document.getElementById('importArea').value.trim();
            if (!inputVal) {
                alert("请输入或粘贴一段需要解析诊断的 Nginx.conf 内容。");
                return;
            }

            let parsedState = { ...configState };
            const analysis = analyzeNginxConfig(inputVal);

            parsedState.server_name = analysis.serverName || parsedState.server_name;
            parsedState.listen = analysis.listen || parsedState.listen;
            parsedState.root = analysis.root || parsedState.root;
            parsedState.index = analysis.index || parsedState.index;
            parsedState.ssl = analysis.sslEnabled;
            parsedState.ssl_certificate = analysis.sslCertificate || parsedState.ssl_certificate;
            parsedState.ssl_certificate_key = analysis.sslCertificateKey || parsedState.ssl_certificate_key;
            parsedState.force_https = analysis.forceHttps;
            parsedState.gzip = analysis.gzip;
            parsedState.static_cache = analysis.staticCache;
            parsedState.hide_nginx_version = analysis.hideVersion;
            parsedState.blockIpDirect = analysis.blockIpDirect;
            parsedState.spaRouting = analysis.spaRouting;
            parsedState.corsEnable = analysis.corsEnable;
            parsedState.securityHeaders = analysis.securityHeaders;
            parsedState.modernSsl = analysis.modernSsl;
            parsedState.phpSecurity = analysis.phpSecurity;
            parsedState.websocketHardening = analysis.websocketHardening;
            parsedState.hotlinkProtection = analysis.hotlinkProtection;
            parsedState.ccRateLimit = analysis.ccRateLimit;
            parsedState.reverseProxy = analysis.reverseProxy;
            parsedState.corsWhitelist = analysis.corsWhitelist;
            parsedState.corsAllowedOrigin = analysis.corsAllowedOrigin || parsedState.corsAllowedOrigin;
            parsedState.hotlinkDomains = analysis.hotlinkDomains || parsedState.hotlinkDomains;
            parsedState.proxyPath = analysis.proxyPath || parsedState.proxyPath;
            parsedState.proxyTarget = analysis.proxyTarget || parsedState.proxyTarget;
            parsedState.rateLimitZone = analysis.rateLimitZone || parsedState.rateLimitZone;
            parsedState.rateLimitRate = analysis.rateLimitRate || parsedState.rateLimitRate;
            parsedState.rateLimitBurst = analysis.rateLimitBurst || parsedState.rateLimitBurst;
            parsedState.importMode = true;
            parsedState.importedServerBlock = analysis.businessServer;
            parsedState.importedIncludes = analysis.includes;
            parsedState.importedLocations = analysis.locations;
            parsedState.exportScope = "server";
            parsedState.siteType = analysis.siteType;

            // 应用逆向解析状态，重刷视图
            configState = parsedState;
            importedSource = inputVal;
            importAnalysis = analysis;
            syncStateToForm();
            generateNginxConf();
            
            const suggestions = buildImportRecommendations(analysis);
            showToast(`导入成功：识别 ${analysis.serverBlocks.length || 1} 个 server 块，建议补强 ${suggestions.slice(0, 3).join("、") || "暂无"}。`);
            document.getElementById('importArea').value = "";
        }

        // ==========================================
        // 核心交互：一键复制代码 (像素级复刻 codeBlock 体验与图标动效)
        // ==========================================
        function copyToClipboard() {
            const rawText = lastGeneratedConfig || document.getElementById('codeOutput').innerText;
            const errors = validateGeneratedConfig(rawText).filter(item => item.level === "error");
            if (errors.length && !confirm(`检测到 ${errors.length} 个高风险配置问题，仍然复制吗？`)) {
                return;
            }

            navigator.clipboard.writeText(rawText).then(() => {
                showToast("Nginx 配置已被一键优雅复制！");
            }).catch(() => {
                alert("复制操作异常，请直接手动选中右侧代码进行复制。");
            });
        }

        // ==========================================
        // 核心交互：一键下载 .conf 配置文件
        // ==========================================
        function downloadConfFile() {
            const rawText = lastGeneratedConfig || document.getElementById('codeOutput').innerText;
            const errors = validateGeneratedConfig(rawText).filter(item => item.level === "error");
            if (errors.length && !confirm(`检测到 ${errors.length} 个高风险配置问题，仍然导出吗？`)) {
                return;
            }
            const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "nginx.conf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("nginx.conf 成功下载，快去服务器上覆盖使用吧！");
        }

        // 底部 Toast 通知
        function showToast(message) {
            const toast = document.getElementById('toast');
            const toastMsg = document.getElementById('toastMsg');
            toastMsg.innerText = message;
            
            toast.classList.remove('opacity-0', 'translate-y-20');
            toast.classList.add('opacity-100', 'translate-y-0');

            setTimeout(() => {
                toast.classList.remove('opacity-100', 'translate-y-0');
                toast.classList.add('opacity-0', 'translate-y-20');
            }, 3000);
        }

        // 外部手动调用诊断
        function diagnoseCurrentConfig() {
            const rawText = importedSource || lastGeneratedConfig || document.getElementById('codeOutput').innerText;
            diagnoseAndScore(rawText);
            showToast("诊断引擎重新扫描完成！");
        }
