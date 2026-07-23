# 部署步骤（网页端操作，一步一步来）

---

## 前提条件

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
2. 添加你的域名（如 youschool.com），把 DNS 托管到 Cloudflare
3. 在终端运行 `npx wrangler login` 完成登录授权

---

## 第一步：创建 D1 数据库

1. 打开终端（或 Git Bash），进入 worker 目录：
   ```bash
   cd worker
   ```

2. 运行创建命令：
   ```bash
   npx wrangler d1 create school-cms-db
   ```

3. 会输出一个 UUID，复制它，例如：
   ```
   uuid = abc1234-5678-def9-0abc-1234567890ab
   ```

4. 编辑 `worker/wrangler.toml` 文件，把下面这行替换成你复制的 UUID：
   ```toml
   database_id = "abc1234-5678-def9-0abc-1234567890ab"
   ```

5. 保存文件。

---

## 第二步：生成 JWT 密钥

1. 在终端运行：
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. 会输出一串随机字符，复制它，例如：
   ```
   a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
   ```

3. 编辑 `worker/wrangler.toml` 文件，把下面这行替换成你复制的字符串：
   ```toml
   JWT_SECRET = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
   ```

4. 保存文件。

---

## 第三步：创建 R2 存储桶（图片上传用）

1. 在终端运行：
   ```bash
   npx wrangler r2 bucket create school-cms-images
   ```

2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)，左侧找到 **R2** → **Overview**

3. 你会看到刚创建的 `school-cms-images` 存储桶

4. 点进去 → 找到 **Endpoint**（在设置里），类似：
   ```
   https://school-cms-images.r2.cloudflarestorage.com
   ```
   记下里面的域名部分：`school-cms-images`

5. 编辑 `worker/src/index.ts` 第 479 行，搜索 `your-r2-subdomain`，替换为你记下的名字：
   ```typescript
   const publicUrl = `https://school-cms-images.r2.cloudflarestorage.com/${key}`;
   ```

6. 编辑 `worker/wrangler.toml`，找到 `[r2_buckets]` 部分，取消注释并确保配置正确：
   ```toml
   [r2_buckets]
   binding = "IMAGE_BUCKET"
   bucket_name = "school-cms-images"
   preview_bucket_name = "school-cms-images-preview"
   ```

7. 保存所有文件。

---

## 第四步：部署 Worker API

1. 在终端进入 worker 目录：
   ```bash
   cd worker
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 部署：
   ```bash
   npx wrangler deploy
   ```

4. 成功后会看到类似：
   ```
   Published xxx.xxxxxx.workers.dev
   ```

5. 验证 API 是否正常：
   ```bash
   curl https://xxx.xxxxxx.workers.dev/api/health
   ```
   返回 `{"ok":true}` 就说明成功了。

6. **记住这个域名**（如 `xxx.xxxxxx.workers.dev`），后面会用到。

---

## 第五步：构建管理后台

1. 在终端进入 admin 目录：
   ```bash
   cd ../admin
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 构建：
   ```bash
   npm run build
   ```

4. 成功后会在 `dist/` 文件夹看到构建产物。

---

## 第六步：部署管理后台到 Pages

1. 还在 admin 目录下，运行：
   ```bash
   npx wrangler pages deploy dist
   ```

2. 系统会让你输入项目名称，输入 `school-site-admin` 或直接回车（它会提示输入）。

3. 成功后会返回两个 URL：
   - 预览地址：`https://school-site-admin.pages.dev`
   - 生产地址：`https://school-site-admin.pages.dev`

4. 打开上面的链接，你会看到登录页面。

5. 用默认账号登录：
   - 用户名：`admin`
   - 密码：`nysdewq142857`

---

## 第七步：配置管理后台 SPA 路由

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)

2. 左侧找到 **Workers & Pages**

3. 找到刚才部署的管理后台项目

4. 点击 **设置**（Settings）

5. 向下滚动到 **Rewrites and redirects** 区域

6. 在 **Rewrite** 那里确保是这样填的：
   | Source pattern | Destination | Status |
   |---|---|---|
   | `/*` | `/index.html` | 200 |

7. 点击 **保存**。

---

## 第八步：部署官网

1. 在终端回到根目录：
   ```bash
   cd ..
   ```

2. 执行部署命令：
   ```bash
   npx wrangler pages deploy .
   ```

3. 它会上传 `index.html`、`style.css`、`script.js` 和所有图片。

4. 成功后返回官网的访问地址。

5. 打开官网首页，导航到「新闻资讯」，应该会显示新闻列表了。

---

## 第九步：配置 API 转发

现在官网和后台都部署好了，但官网请求 `/api/*` 需要转到 Worker。有两种方式：

### 方式 A：直接用 Worker 域名（最简单）

在 `admin/vite.config.ts` 中，把代理目标改成你的 Worker 域名：

```typescript
proxy: {
  '/api': {
    target: 'https://你的-worker-domain.workers.dev',
    changeOrigin: true,
  },
},
```

然后刷新管理后台就能用了。

### 方式 B：通过 Workers Routes 转发（推荐）

1. 打开 Cloudflare Dashboard → 你的域名
2. 左侧找到 **Workers & Routes**
3. 点击 **Add route**
4. 填写：
   - Route: `yourschool.com/api/*`
   - Worker: `school-site-cms`（选择你刚才创建的 Worker）
5. 点击 **Save**

这样所有 `yourschool.com/api/*` 的请求都会自动转发到你的 Worker。

---

## 完成！你现在有三个网址：

| 用途 | 地址 | 账号 |
|------|------|------|
| 管理后台 | `https://school-site-admin.pages.dev` | admin / nysdewq142857 |
| 官网首页 | `https://你的-workers.pages.dev` | 公开访问 |
| API | `https://你的-worker.workers.dev` | 公开（除登录外的接口需认证） |

---

## 首次使用

1. 打开管理后台，用 `admin` / `nysdewq142857` 登录
2. 点击「新增新闻」发布一条测试新闻
3. 打开官网首页，滚动到「新闻资讯」区域
4. 就能看到刚刚发布的新闻了

---

## 常见问题

**Q: 登录后新闻列表是空的？**  
正常，你还没有发布过新闻。去「新增新闻」发布第一条即可。

**Q: 上传图片失败？**  
Worker 日志显示 `文件存储服务未配置`，检查第三步的 R2 配置是否正确。

**Q: 官网不显示新闻？**  
确认 `script.js` 中的 `/api/news` 请求能正常响应。打开浏览器 DevTools → Network 标签页看是否有报错。

**Q: 想修改管理员密码？**  
登录后台后，在终端运行：
```bash
cd worker
npx wrangler d1 execute school-cms-db --command="SELECT * FROM users WHERE username='admin'"
```
查看当前用户，然后在代码里重新初始化 admin 密码（修改 `wrangler.toml` 中的 `ADMIN_DEFAULT_PASSWORD`，然后删除数据库中 admin 记录重新 seed）。
