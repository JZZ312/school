const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../db');

// ── 检查登录状态 ──
router.get('/check', (req, res) => {
  res.json({ loggedIn: !!req.session?.adminLoggedIn });
});

// ── 登录 ──
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = verifyAdmin(username, password);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  req.session.adminLoggedIn = true;
  req.session.adminUsername = user.username;
  req.session.adminUserId = user.id;
  res.json({ ok: true });
});

// ── 登出 ──
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('school_cms_sid');
    res.json({ ok: true });
  });
});

// ── 鉴权中间件 ──
function requireAuth(req, res, next) {
  if (req.session?.adminLoggedIn) {
    return next();
  }
  return res.status(401).json({ error: '请先登录' });
}

module.exports = { router, requireAuth };
