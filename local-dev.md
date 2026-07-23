# 本地运行指南（快速上手）

## 一、Worker API — 启动并验证

```bash
cd worker
npm install              # 安装 hono
npx wrangler dev         # 启动在 http://localhost:8787
```

首次启动日志预期：
```
[db] No D1 binding — using in-memory fallback.
[seed] Default admin user created (memory).
 ⎈ Listening on http://127.0.0.1:8787
```

测试：
```bash
curl http://localhost:8787/api/health
# {"ok":true}

curl -X POST http://localhost:8787/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"nysdewq142857"}'
# 返回 {ok:true, token:"eyJhb..."} ← 复制 token
```

## 二、管理后台 — 启动并登录

新终端窗口：
```bash
cd admin
npm install
npm run dev              # 启动在 http://localhost:5173
```

浏览器打开 **http://localhost:5173**：
- 用户名：`admin`
- 密码：`nysdewq142857`

登录后，Vite 会把 `/api/*` 请求自动代理到 `localhost:8787`（worker）。

## 三、功能测试完整流程

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 登录 | 成功进入新闻列表页，列表为空 |
| 2 | 点「新增新闻」 | 弹窗表单出现 |
| 3 | 填写标题、摘要、正文、分类 | 必填项都填上 |
| 4 | 点「发布」 | 提示「发布成功」，列表中出现该新闻 |
| 5 | 点「编辑」 | 表单预填当前数据 |
| 6 | 修改后保存 | 提示「更新成功」 |
| 7 | 点「删除」 | 弹窗确认后新闻消失 |
| 8 | 搜索/筛选 | 按关键词、分类、状态过滤 |

## 四、官网预览（可选）

网站是纯静态文件，直接双击 `index.html` 打开即可看到样式页面。

新闻功能需要 Worker 在运行——如果 `fetch('/api/news')` 不通，新闻区域会显示「暂无新闻」，但这不影响官网其他部分的使用。

---

## 五、常见问题速查

| 问题 | 原因 | 解决 |
|------|------|------|
| Worker 报 `[db] Init failed` | D1 未绑定 | 这是正常的——本地使用内存 DB |
| 登录返回 401 | Worker 没跑起来 | 确认终端 8787 端口正在监听 |
| 发布新闻后列表不刷新 | Token 过期或丢失 | 重新登录，检查 DevTools → Local Storage |
| 上传图片失败 | R2 未配置 | 正常，本地跳过上传不影响其他功能 |
| `npm install` 卡住 | Windows 权限问题 | 以管理员身份打开终端重试 |
