# 部署文档 — 学校官网新闻 CMS

南阳市第二完全学校高级中学 — Cloudflare 全栈部署指南

---

## 架构概览

```
Cloudflare Pages (官网静态) ←→ Cloudflare Worker (API)
                                    ↓
                              Cloudflare D1 (SQLite)
                              Cloudflare R2 (图片存储)
```

**技术栈：**
- **官网**：原生 HTML/CSS/JS（新闻通过 API 动态加载）
- **管理后台**：Vue3 + Element Plus + Vite（SPA）
- **后端**：Cloudflare Workers + Hono 框架（零额外 ORM，直接使用 D1 SQL）
- **存储**：D1（数据库）+ R2（图片文件）
- **认证**：PBKDF2 密码哈希 + HS256 JWT
- **安全**：SQL 参数化查询、XSS 转义、CORS、文件类型/大小校验

---

## 一、前置条件

1. [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)：
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. Node.js 18+

---

## 二、创建 Cloudflare 资源

### 2.1 D1 数据库

```bash
cd worker
wrangler d1 create school-cms-db
```

复制输出的 `DATABASE_ID`（UUID），填入 `worker/wrangler.toml`。

### 2.2 R2 存储桶

```bash
wrangler r2 bucket create school-cms-images
```

或在 Dashboard → R2 → Create Bucket → 名称 `school-cms-images`。

### 2.3 绑定资源

编辑 `worker/wrangler.toml`，确保：

```toml
[d1_databases]
binding = "DB"
database_name = "school-cms-db"
database_id = "YOUR_D1_UUID_HERE"          # ← 替换

[r2_buckets]
binding = "IMAGE_BUCKET"
bucket_name = "school-cms-images"
preview_bucket_name = "school-cms-images-preview"
```

---

## 三、环境变量

在 `worker/wrangler.toml` 的 `[vars]` 中配置：

```toml
[vars]
JWT_SECRET = "此处填写至少32位的随机字符串"           # 生成方式见下方
ADMIN_DEFAULT_PASSWORD = "nysdewq142857"            # 初始管理员密码
CORS_ORIGIN = "*"
```

生成 JWT_SECRET：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

R2 公开 URL：搜索 `your-r2-subdomain.r2.cloudflarestorage.com`，替换为你的实际 R2 域名。

---

## 四、部署 Worker API

```bash
cd worker
npm install hono     # 唯一运行时依赖
npx wrangler deploy
```

首次部署时 Worker 会自动执行建表 + 初始化 admin 用户。

验证：
```bash
curl https://your-worker.workers.dev/api/health
# {"ok":true}
```

---

## 五、部署官网（Cloudflare Pages）

官网是纯静态文件，直接上传即可：

```bash
npx wrangler pages deploy . --project-name school-site-website
```

**注意事项：**
- 不要设置 Functions 路由（API 已独立部署在 Worker）
- `/api/*` 请求需要通过 DNS CNAME 或 Workers Routes 转发到 Worker

**推荐：Workers Routes**
在 Cloudflare DNS 面板 → Workers → Add route：
- Pattern: `yourschool.com/api/*`
- Worker: `school-site-cms`

---

## 六、部署管理后台

### 6.1 构建

```bash
cd admin
npm install
npm run build
```

### 6.2 部署到 Pages

```bash
npx wrangler pages deploy dist --project-name school-site-admin
```

或在 Dashboard → Pages → Direct Upload → 上传 `admin/dist/` 所有内容。

### 6.3 SPA 路由重定向

Dashboard → Settings → Rewrites and redirects：

| Source pattern | Destination | Status |
|---|---|---|
| `/*` | `/index.html` | 200 |

这样所有路由（`/news`、`/login`、`/news/edit/1`）都会正确渲染 SPA。

### 6.4 API 代理配置

如果后台和官网不在同一域名，需要在 vite.config.ts 中设置 API 代理，或在 production 中使用反向代理（Caddy/Nginx）。

当前默认：后台直接请求 `/api/*`，需要通过 Workers Routes 将流量转发到 Worker。

---

## 七、首次访问

1. 打开管理后台 URL（如 `https://admin.yourschool.com`）
2. 登录：`admin` / `nysdewq142857`（或你在 wrangler.toml 中设置的密码）
3. 发布首条新闻测试
4. 打开官网首页，确认新闻动态加载

---

## 八、安全建议

1. **更改默认密码** — 首次登录后在代码或数据库层修改
2. **JWT_SECRET** — 使用足够随机的长字符串
3. **限制 CORS** — 生产环境建议改为具体域名
4. **启用 HTTPS** — Cloudflare 默认提供
5. **定期备份**：
   ```bash
   wrangler d1 execute school-cms-db --export > dump.sql
   ```

---

## 九、常见问题

**Q: 登录返回 401？**
- 检查 Worker 是否成功部署并绑定 D1
- 查看 Worker 日志确认 `[seed] Default admin user created.`
- 确认 wrangler.toml 中 DATABASE_ID 已正确填写

**Q: 图片上传失败？**
- 确认 R2 bucket 正确绑定
- 确认 bucket 名称与 wrangler.toml 一致

**Q: 跨域错误？**
- Worker 已内置 CORS 中间件
- 确保请求路径正确（`/api/admin/login` 等）

**Q: 如何重置 admin 密码？**
通过 D1 SQL 直接操作：
```bash
wrangler d1 execute school-cms-db --command="SELECT * FROM users WHERE username='admin'"
```
然后手动更新 password_hash 字段（需重新生成 PBKDF2 哈希）。
