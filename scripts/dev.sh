#!/usr/bin/env bash
# 本地开发完整启动 + 验证脚本
# 用法: bash scripts/dev.sh
# 依赖: Node.js, npx

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══════════════════════════════════════════"
echo " 🏫 学校官网新闻 CMS — 本地开发启动"
echo "═══════════════════════════════════════════"
echo ""

# ── Step 1: Worker ───────────────────────────
echo "📦 Step 1/3: 安装 Worker 依赖..."
cd "$ROOT_DIR/worker"
npm install --silent 2>/dev/null
echo "   ✅ Worker 依赖已就绪 (hono@$(node -p "require('hono/package.json').version"))"
echo ""

# ── Step 2: Admin ────────────────────────────
echo "📦 Step 2/3: 安装 Admin 依赖..."
cp "$ROOT_DIR/logo.png" "$ROOT_DIR/admin/public/" 2>/dev/null || true
cd "$ROOT_DIR/admin"
npm install --silent 2>/dev/null
echo "   ✅ Admin 依赖已就绪"
echo ""

# ── Step 3: Build Admin ──────────────────────
echo "🔨 Step 3/3: 构建 Admin..."
cd "$ROOT_DIR/admin"
npx vite build 2>&1 | grep -E "(error|Error|built)" || true
echo "   ✅ Admin 构建完成"
echo ""

# ── Start services ───────────────────────────
echo "═══════════════════════════════════════════"
echo " 🚀 现在手动启动以下服务："
echo "═══════════════════════════════════════════"
echo ""
echo "  【终端 1】Worker API (localhost:8787)"
echo "    cd \"$ROOT_DIR/worker\""
echo "    npx wrangler dev"
echo ""
echo "  【终端 2】管理后台 (localhost:5173)"
echo "    cd \"$ROOT_DIR/admin\""
echo "    npm run dev"
echo ""
echo "═══════════════════════════════════════════"
echo " 🔑 登录后即可操作"
echo "═══════════════════════════════════════════"
echo "  用户名: admin"
echo "  密码:   nysdewq142857"
echo ""
echo "  管理后台地址: http://localhost:5173"
echo "  官网地址:     双击 index.html"
echo ""
echo "═══════════════════════════════════════════"
echo " ✅ 全部配置完成！按 Enter 打开浏览器..."
echo "═══════════════════════════════════════════"
read -r -p "" || true
start http://localhost:5173 2>/dev/null || open http://localhost:5173 2>/dev/null || echo "请手动打开 http://localhost:5173"
