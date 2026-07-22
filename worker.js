/**
 * Cloudflare Worker — 学校官网后端
 * 包含静态文件服务 + API 路由
 */
import { getNews, getNewsDetail, createNews, updateNews, deleteNews, verifyAdmin, seedIfEmpty } from './db.js';

// ── 静态文件映射 ──
const STATIC_FILES = {
  '/': 'index.html',
  '/admin': 'admin.html',
  '/style.css': 'style.css',
  '/script.js': 'script.js',
  '/admin.js': 'admin.js',
  '/admin.css': 'admin.css',
  '/logo.png': 'logo.png',
  '/hero-bg.jpg': 'hero-bg.jpg',
  '/map.png': 'map.png',
  '/placeholder-about.jpg': 'placeholder-about.jpg',
  '/campus-1.jpg': 'campus-1.jpg',
  '/campus-2.jpg': 'campus-2.jpg',
  '/campus-3.jpg': 'campus-3.jpg',
  '/campus-4.jpg': 'campus-4.jpg',
  '/campus-5.jpg': 'campus-5.jpg',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  // Split on '; ' and find the named cookie to avoid garbage from value+path
  for (const pair of cookie.split('; ')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex < 0) continue;
    const key = pair.slice(0, eqIndex);
    if (key === name) return pair.slice(eqIndex + 1);
  }
  return null;
}

function checkAuth(request) {
  const token = parseCookie(request, 'admin_token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

async function handleStatic(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // API routes
  if (pathname.startsWith('/api/')) {
    return null; // 让 API 路由处理
  }

  // Static file
  const filename = STATIC_FILES[pathname];
  if (filename) {
    const filePath = `./${filename}`;
    const asset = await env.ASSETS.fetch(new Request(`${request.url.replace(url.pathname, '')}${filename}`));
    if (asset.ok) return asset;
  }

  // Fallback: try to read from ASSETS directly
  try {
    const assetUrl = `${request.url}`;
    const asset = await env.ASSETS.fetch(assetUrl);
    if (asset.ok) return asset;
  } catch {}

  // Try index.html for any path (SPA fallback)
  if (!pathname.includes('.')) {
    try {
      const asset = await env.ASSETS.fetch(`${request.url}index.html`);
      if (asset.ok) return asset;
    } catch {}
  }

  return new Response('Not Found', { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    // Seed KV on first request
    seedIfEmpty(env.DB, env.ADMIN_PASSWORD);

    const url = new URL(request.url);

    // ── API Routes ──

    // GET /api/admin — check login
    if (url.pathname === '/api/admin' && request.method === 'GET') {
      const token = parseCookie(request, 'admin_token');
      let loggedIn = false;
      if (token) {
        try { loggedIn = JSON.parse(atob(token.split('.')[1])).exp > Date.now(); } catch {}
      }
      return json({ loggedIn });
    }

    // POST /api/admin/login
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      const { username, password } = await request.json();
      if (!username || !password) return json({ error: '请输入用户名和密码' }, 400);

      const user = verifyAdmin(env.DB, username, password);
      if (!user) return json({ error: '用户名或密码错误' }, 401);

      const header = btoa(JSON.stringify({ alg: 'none' }));
      const payload = btoa(JSON.stringify({
        username: user.username,
        id: user.id,
        exp: Date.now() + 24 * 60 * 60 * 1000,
      }));
      const token = header + '.' + payload;

      const resp = json({ ok: true });
      resp.headers.set('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
      return resp;
    }

    // POST /api/admin/logout
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
      const resp = json({ ok: true });
      resp.headers.set('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return resp;
    }

    // GET /api/news
    if (url.pathname === '/api/news' && request.method === 'GET') {
      const allNews = getNews(env.DB);
      const summaries = allNews.map(n => ({
        id: n.id, title: n.title, summary: n.summary, year: n.year,
        category: n.category, image: n.image, sortOrder: n.sortOrder, createdAt: n.createdAt,
      }));
      return json(summaries);
    }

    // GET /api/news/:id
    const newsDetailMatch = url.pathname.match(/^\/api\/news\/(\d+)$/);
    if (newsDetailMatch && request.method === 'GET') {
      const item = getNewsDetail(env.DB, parseInt(newsDetailMatch[1]));
      if (!item) return json({ error: '新闻不存在' }, 404);
      return json(item);
    }

    // POST /api/news — create
    if (url.pathname === '/api/news' && request.method === 'POST') {
      if (!checkAuth(request)) return json({ error: '请先登录' }, 401);
      const body = await request.json();
      const { title, content, summary, year, category, sortOrder } = body;
      if (!title || !content || !year || !category) return json({ error: '请填写必填字段' }, 400);
      const newsItem = createNews(env.DB, { title, content, summary, year, category, sortOrder });
      return json({ ok: true, id: newsItem.id }, 201);
    }

    // PUT /api/news/:id — update
    const newsUpdateMatch = url.pathname.match(/^\/api\/news\/(\d+)$/);
    if (newsUpdateMatch && request.method === 'PUT') {
      if (!checkAuth(request)) return json({ error: '请先登录' }, 401);
      const existing = getNewsDetail(env.DB, parseInt(newsUpdateMatch[1]));
      if (!existing) return json({ error: '新闻不存在' }, 404);
      const body = await request.json();
      const { title, content, summary, year, category, sortOrder } = body;
      if (!title || !content || !year || !category) return json({ error: '请填写必填字段' }, 400);
      updateNews(env.DB, parseInt(newsUpdateMatch[1]), {
        title, content, summary, year, category,
        sortOrder: sortOrder ?? existing.sortOrder,
      });
      return json({ ok: true });
    }

    // DELETE /api/news/:id — delete
    if (newsDetailMatch && request.method === 'DELETE') {
      if (!checkAuth(request)) return json({ error: '请先登录' }, 401);
      const existing = getNewsDetail(env.DB, parseInt(newsDetailMatch[1]));
      if (!existing) return json({ error: '新闻不存在' }, 404);
      deleteNews(env.DB, parseInt(newsDetailMatch[1]));
      return json({ ok: true });
    }

    // ── Static Files ──
    return env.ASSETS.fetch(request);
  },
};
