/**
 * Cloudflare Worker — 学校官网后端（零依赖单文件版）
 * 包含静态文件服务 + API 路由 + 内存存储（零配置即可运行）
 *
 * 部署方式：
 *   1. GitHub 集成（此文件无需任何 npm install）
 *   2. 或 Cloudflare Dashboard Workers Editor 粘贴
 */

// ═══════════════════════════════════════════════════════════
// Hashing — SHA-256 with fixed salt (zero dependency)
// ═══════════════════════════════════════════════════════════

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode('school_site_salt_' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════
// Seed Data
// ═══════════════════════════════════════════════════════════

const DEFAULT_ADMIN = { username: 'admin', password: 'nysdewq142857' };
const NS = 'sw_';

const SEED_NEWS = [
  {
    id: 1,
    title: '首届高考取得"开门红"',
    content: '2022年，学校首届高考成绩斐然，多名学生被重点大学录取，受到市委市政府和区委区政府通令嘉奖，开创了宛城区基础教育的新篇章。',
    summary: '首届高考成绩斐然，受到市委市政府和区委区政府通令嘉奖。',
    year: '2022',
    category: '高考',
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: '深化校际合作共谋发展',
    content: '学校依托与南阳师范学院、南阳市一中的共享共建机制，持续汇聚优质教育资源，推动教育教学质量全面提升。双方在教育科研、师资培训、课程建设等方面展开深度合作。',
    summary: '深化校际合作，持续汇聚优质教育资源。',
    year: '2023',
    category: '合作',
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: '数字化校园建设成效显著',
    content: '学校建成内含50余台标准计算机的学生微机房2个，中心云机房、录播教室、标准化考场等信息化项目全部完工并投入使用，为智慧教学奠定了坚实基础。',
    summary: '数字化校园建设成效显著，信息化项目全面完工。',
    year: '2024',
    category: '建设',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ═══════════════════════════════════════════════════════════
// In-Memory Storage (fallback when no KV binding available)
// ═══════════════════════════════════════════════════════════

let _memData = null;

async function ensureMemoryDB() {
  if (_memData) return _memData;
  const now = new Date().toISOString();
  const hash = await hashPassword(DEFAULT_ADMIN.password);
  _memData = {
    news: SEED_NEWS.map(n => ({ ...n })),
    adminUsers: [{ id: 1, username: DEFAULT_ADMIN.username, password_hash: hash, role: 'admin' }],
    nextId: 4,
  };
  return _memData;
}

// ── Memory DB helpers ──

function memGetNews() {
  const data = _memData?.news || [];
  return [...data].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || b.id - a.id);
}

function memGetNewsDetail(id) {
  return (_memData?.news || []).find(n => n.id === id) || null;
}

function memCreateNews(fields) {
  const now = new Date().toISOString();
  const item = {
    id: _memData.nextId++,
    title: fields.title,
    content: fields.content,
    summary: fields.summary || '',
    year: fields.year,
    category: fields.category,
    image: fields.image || null,
    sortOrder: parseInt(fields.sortOrder) || 0,
    createdAt: now,
    updatedAt: now,
  };
  _memData.news.push(item);
  return item;
}

function memUpdateNews(id, fields) {
  const now = new Date().toISOString();
  const idx = _memData.news.findIndex(n => n.id === id);
  if (idx === -1) return null;
  if (fields.title !== undefined) _memData.news[idx].title = fields.title;
  if (fields.content !== undefined) _memData.news[idx].content = fields.content;
  if (fields.summary !== undefined) _memData.news[idx].summary = fields.summary;
  if (fields.year !== undefined) _memData.news[idx].year = fields.year;
  if (fields.category !== undefined) _memData.news[idx].category = fields.category;
  if (fields.image !== undefined) _memData.news[idx].image = fields.image;
  if (fields.sortOrder !== undefined) _memData.news[idx].sortOrder = parseInt(fields.sortOrder) || 0;
  _memData.news[idx].updatedAt = now;
  return _memData.news[idx];
}

function memDeleteNews(id) {
  const idx = _memData.news.findIndex(n => n.id === id);
  if (idx === -1) return false;
  _memData.news.splice(idx, 1);
  return true;
}

// ── KV-backed helpers (wrap KV binding in same interface) ──

function kvWrap(kv) {
  return {
    getNews: () => {
      const raw = kv.get(NS + 'news', { type: 'json' });
      if (!raw) return [];
      return [...raw].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || b.id - a.id);
    },
    getNewsDetail(id) {
      const raw = kv.get(NS + 'news', { type: 'json' });
      if (!raw) return null;
      return raw.find(n => n.id === id) || null;
    },
    async createNews(fields) {
      let data = kv.get(NS + 'news', { type: 'json' }) || [];
      let nextId = parseInt(kv.get(NS + 'nextId') || '1');
      const now = new Date().toISOString();
      const item = {
        id: nextId++,
        title: fields.title, content: fields.content,
        summary: fields.summary || '', year: fields.year,
        category: fields.category, image: fields.image || null,
        sortOrder: parseInt(fields.sortOrder) || 0,
        createdAt: now, updatedAt: now,
      };
      data.push(item);
      kv.put(NS + 'news', JSON.stringify(data));
      kv.put(NS + 'nextId', String(nextId));
      return item;
    },
    async updateNews(id, fields) {
      let data = kv.get(NS + 'news', { type: 'json' }) || [];
      const idx = data.findIndex(n => n.id === id);
      if (idx === -1) return null;
      const now = new Date().toISOString();
      if (fields.title !== undefined) data[idx].title = fields.title;
      if (fields.content !== undefined) data[idx].content = fields.content;
      if (fields.summary !== undefined) data[idx].summary = fields.summary;
      if (fields.year !== undefined) data[idx].year = fields.year;
      if (fields.category !== undefined) data[idx].category = fields.category;
      if (fields.image !== undefined) data[idx].image = fields.image;
      if (fields.sortOrder !== undefined) data[idx].sortOrder = parseInt(fields.sortOrder) || 0;
      data[idx].updatedAt = now;
      kv.put(NS + 'news', JSON.stringify(data));
      return data[idx];
    },
    async deleteNews(id) {
      let data = kv.get(NS + 'news', { type: 'json' }) || [];
      const idx = data.findIndex(n => n.id === id);
      if (idx === -1) return false;
      data.splice(idx, 1);
      kv.put(NS + 'news', JSON.stringify(data));
      return true;
    },
    async verifyAdmin(username, password) {
      const users = kv.get(NS + 'adminUsers', { type: 'json' });
      if (!users) return null;
      const user = users.find(u => u.username === username);
      if (!user) return null;
      if (!(await hashPassword(password) === user.password_hash)) return null;
      return { id: user.id, username: user.username, role: user.role };
    },
  };
}

// ═══════════════════════════════════════════════════════════
// Response Helpers
// ═══════════════════════════════════════════════════════════

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
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

// ═══════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Decide storage backend: KV if bound, otherwise memory
    const useKv = !!(env.DB && typeof env.DB.put === 'function');
    const db = useKv ? kvWrap(env.DB) : null;

    // ── POST Routes ──

    if (method === 'POST') {
      // POST /api/admin/login
      if (path === '/api/admin/login') {
        const { username, password } = await request.json();
        if (!username || !password) return json({ error: '请输入用户名和密码' }, 400);

        let user;
        if (db) {
          user = await db.verifyAdmin(username, password);
        } else {
          await ensureMemoryDB();
          const u = _memData.adminUsers.find(u => u.username === username);
          if (!u) return json({ error: '用户名或密码错误' }, 401);
          const expectedHash = await hashPassword(password);
          if (expectedHash !== u.password_hash) return json({ error: '用户名或密码错误' }, 401);
          user = { id: u.id, username: u.username, role: u.role };
        }

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
      if (path === '/api/admin/logout') {
        const resp = json({ ok: true });
        resp.headers.set('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
        return resp;
      }

      // POST /api/news — create
      if (path === '/api/news') {
        if (!checkAuth(request)) return json({ error: '请先登录' }, 401);
        const body = await request.json();
        const { title, content, summary, year, category, sortOrder } = body;
        if (!title || !content || !year || !category) return json({ error: '请填写必填字段' }, 400);

        let item;
        if (db) {
          item = await db.createNews({ title, content, summary, year, category, sortOrder });
        } else {
          await ensureMemoryDB();
          item = memCreateNews({ title, content, summary, year, category, sortOrder });
        }
        return json({ ok: true, id: item.id }, 201);
      }

      return json({ error: 'Not Found' }, 404);
    }

    // ── PUT Routes ──

    if (method === 'PUT') {
      const updateMatch = path.match(/^\/api\/news\/(\d+)$/);
      if (updateMatch) {
        if (!checkAuth(request)) return json({ error: '请先登录' }, 401);
        const body = await request.json();
        const { title, content, summary, year, category, sortOrder } = body;
        if (!title || !content || !year || !category) return json({ error: '请填写必填字段' }, 400);

        if (db) {
          const existing = db.getNewsDetail(parseInt(updateMatch[1]));
          if (!existing) return json({ error: '新闻不存在' }, 404);
          await db.updateNews(parseInt(updateMatch[1]), {
            title, content, summary, year, category,
            sortOrder: sortOrder ?? existing.sortOrder,
          });
        } else {
          await ensureMemoryDB();
          const existing = memGetNewsDetail(parseInt(updateMatch[1]));
          if (!existing) return json({ error: '新闻不存在' }, 404);
          memUpdateNews(parseInt(updateMatch[1]), {
            title, content, summary, year, category,
            sortOrder: sortOrder ?? existing.sortOrder,
          });
        }
        return json({ ok: true });
      }
      return json({ error: 'Not Found' }, 404);
    }

    // ── DELETE Routes ──

    if (method === 'DELETE') {
      const delMatch = path.match(/^\/api\/news\/(\d+)$/);
      if (delMatch) {
        if (!checkAuth(request)) return json({ error: '请先登录' }, 401);

        if (db) {
          const existing = db.getNewsDetail(parseInt(delMatch[1]));
          if (!existing) return json({ error: '新闻不存在' }, 404);
          await db.deleteNews(parseInt(delMatch[1]));
        } else {
          await ensureMemoryDB();
          const existing = memGetNewsDetail(parseInt(delMatch[1]));
          if (!existing) return json({ error: '新闻不存在' }, 404);
          memDeleteNews(parseInt(delMatch[1]));
        }
        return json({ ok: true });
      }
      return json({ error: 'Not Found' }, 404);
    }

    // ── GET Routes ──

    // GET /api/admin — check login
    if (path === '/api/admin') {
      const token = parseCookie(request, 'admin_token');
      let loggedIn = false;
      if (token) {
        try { loggedIn = JSON.parse(atob(token.split('.')[1])).exp > Date.now(); } catch {}
      }
      return json({ loggedIn });
    }

    // GET /api/news — list
    if (path === '/api/news') {
      let allNews;
      if (db) {
        allNews = db.getNews();
      } else {
        await ensureMemoryDB();
        allNews = memGetNews();
      }
      const summaries = allNews.map(n => ({
        id: n.id, title: n.title, summary: n.summary, year: n.year,
        category: n.category, image: n.image, sortOrder: n.sortOrder, createdAt: n.createdAt,
      }));
      return json(summaries);
    }

    // GET /api/news/:id
    const detailMatch = path.match(/^\/api\/news\/(\d+)$/);
    if (detailMatch) {
      let item;
      if (db) {
        item = db.getNewsDetail(parseInt(detailMatch[1]));
      } else {
        await ensureMemoryDB();
        item = memGetNewsDetail(parseInt(detailMatch[1]));
      }
      if (!item) return json({ error: '新闻不存在' }, 404);
      return json(item);
    }

    // ── Static Files ──
    // Delegate to ASSETS binding for static files
    if (env.ASSETS) {
      return await env.ASSETS.fetch(request);
    }

    return json({ error: 'Not Found' }, 404);
  },
};
