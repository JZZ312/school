const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 静态资源 ──
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── 中间件 ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'nx29fK8mQz7RpLw5Yt3Jh6Vb4Dc1Gs0A',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' },
  name: 'school_cms_sid',
}));

// ── 路由 ──
app.use('/api/admin', require('./routes/admin').router);
app.use('/api/news', require('./routes/news'));

// ── 后台管理页 ──
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── 启动 ──
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  学校官网后台已启动`);
  console.log(`  前台访问: http://localhost:${PORT}`);
  console.log(`  后台管理: http://localhost:${PORT}/admin`);
  console.log(`  默认管理员: admin / admin123`);
  console.log(`========================================\n`);
});
