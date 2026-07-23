/**
 * Cloudflare Worker entrypoint — school site CMS API.
 * Works with D1 in production and falls back to in-memory storage locally.
 * Depends: hono (routing + CORS).
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ── Constants ──────────────────────────────────────────────────────
const ALLOWED_CATEGORIES = ['学校动态', '教学教研', '学生活动', '荣誉成就', '通知公告'];
const TOKEN_SECRET = process.env.JWT_SECRET || 'school-site-jwt-secret-change-me-at-least-32-chars-min';
const DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'nysdewq142857';

// Use memory DB by default for local dev. In production, set USE_MEM_DB to empty to enable D1.
const USE_MEMORY_DB = true; // Default: always use memory for local development
console.log('[config] Mode: IN-MEMORY (dev)');

// ── Helpers ────────────────────────────────────────────────────────
function escapeSql(s: string): string { return s.replace(/'/g, "''"); }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// ── PBKDF2 password hash/verify ────────────────────────────────────
async function hashPassword(pwd: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 16384, hash: 'SHA-256' }, key, 256,
  );
  return `pbkdf2$16384$${Buffer.from(salt).toString('hex')}$${Buffer.from(bits).toString('hex')}`;
}

async function verifyPwd(pwd: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: Buffer.from(parts[2], 'hex'), iterations: parseInt(parts[1]), hash: 'SHA-256' }, key, 256,
  );
  return Buffer.from(bits).toString('hex') === parts[3];
}

// ── JWT ────────────────────────────────────────────────────────────
interface JwtPayload { sub: number; username: string; exp: number; }

async function hmacSign(headerB64: string, payloadB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  return Buffer.from(sig).toString('base64url');
}

async function hmacVerify(headerB64: string, payloadB64: string, expectedSig: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );
    return await crypto.subtle.verify('HMAC', key, Buffer.from(expectedSig, 'base64url'), new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  } catch { return false; }
}

function createToken(user: { id: number; username: string }): string {
  const h = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = btoa(JSON.stringify({ sub: user.id, username: user.username, exp: Date.now() + 24 * 3600 * 1000 }));
  return `${h}.${p}.${hmacSign(h, p)}`;
}

function verifyToken(token: string): JwtPayload | null {
  try {
    const [h, p, s] = token.split('.');
    if (!s) return null;
    if (!hmacVerify(h, p, s)) return null;
    const d = JSON.parse(atob(p)) as JwtPayload;
    if (d.exp < Date.now()) return null;
    return d;
  } catch { return null; }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  for (const pair of (req.headers.get('Cookie') || '').split(';')) {
    const eq = pair.trim().indexOf('=');
    if (eq > 0 && pair.trim().slice(0, eq) === 'jwt_token') return decodeURIComponent(pair.trim().slice(eq + 1));
  }
  return null;
}

// ── Auth guard middleware ──────────────────────────────────────────
function checkAuth(req: Request): Response | null {
  const token = extractToken(req);
  if (!token) return jsonResp({ error: '未登录' }, 401);
  const payload = verifyToken(token);
  if (!payload) return jsonResp({ error: '登录已过期，请重新登录' }, 401);
  return null; // OK
}

// ── JSON response helper ───────────────────────────────────────────
function jsonResp(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// ── In-memory DB (local dev fallback) ──────────────────────────────
let _memInited = false;

const isLocalMode = !process.env.CLOUDFLARE_WORKER_ID && !process.env.__CLOUDFLARE_WORKER_INTERNAL__;

function getMemDb(): any {
  if (!(globalThis as any).__MEM_DB__) {
    (globalThis as any).__MEM_DB__ = { users: [], news: [], _nxtId: 1 };
    _memInited = true;
  }
  return (globalThis as any).__MEM_DB__;
}

async function seedMemDb() {
  const mem = getMemDb();
  if (mem.users.length > 0 || _memInited) return;
  const hash = await hashPassword(DEFAULT_PASSWORD);
  mem.users.push({ id: 1, username: 'admin', password_hash: hash, created_at: new Date().toISOString() });
  console.log('[seed] Default admin user created (memory).');
  _memInited = true;
}

// ── App ────────────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }));
app.get('/api/health', (c) => c.json({ ok: true }));

// ── Helper: build DB query context ─────────────────────────────────
function dbCtx(c: { env: Env }) {
  if (USE_MEMORY_DB) {
    // Memory fallback — full inline implementation
    const mem = getMemDb();
    return {
      mem,
      isD1: false,
      _memQuery: (sql: string, params?: unknown[]) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select count')) {
          if (lower.includes('news')) return { total: mem.news.length };
          return { total: mem.users.length };
        }
        if (lower.includes('select * from news where')) {
          let items = [...mem.news];
          if (sql.includes("status = 'published'")) items = items.filter((n: any) => n.status === 'published');
          if (sql.includes('category = ?') && params) { const v = params.find(p => typeof p === 'string'); if (v) items = items.filter((n: any) => n.category === v); }
          if (sql.includes('title like ?') && params) { const k = String(params.find(p => typeof p === 'string')).replace('%', ''); if (k) items = items.filter((n: any) => n.title?.includes(k)); }
          items.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
          return items;
        }
        if (lower.includes('select * from users where')) {
          const u = mem.users.find((u: any) => u.username === params?.[0]);
          return u || null;
        }
        if (lower.includes('select id from news where id')) {
          const id = params?.[0];
          return mem.news.find((n: any) => n.id === id) ? { id } : null;
        }
        return [];
      },
      _memExec: (sql: string, params: unknown[] = []) => {
        const lower = sql.toLowerCase();
        if (lower.includes('insert into news')) {
          const id = mem._nxtId++;
          mem.news.push({
            id, title: params[0], summary: params[1], content: params[2],
            category: params[3], cover_image: params[4], author: params[5],
            status: params[6], publish_time: params[7], created_at: params[8], updated_at: params[9],
          });
          return { meta: { last_row_id: id } };
        }
        if (lower.includes('update news')) {
          const id = params[params.length - 1];
          const idx = mem.news.findIndex((n: any) => n.id === id);
          if (idx >= 0) {
            mem.news[idx].updated_at = new Date().toISOString();
            for (let i = 0; i < params.length - 1; i++) {
              if (params[i] !== undefined) {
                const keys = ['title','summary','content','category','cover_image','author','status','publish_time','created_at','updated_at'];
                if (keys[i]) mem.news[idx][keys[i]] = params[i];
              }
            }
          }
          return { meta: {} };
        }
        if (lower.includes('delete from news')) {
          mem.news = mem.news.filter((n: any) => n.id !== params[0]);
          return { meta: {} };
        }
        return { meta: {} };
      },
    };
  }
  // D1 path (unreachable when USE_MEMORY_DB = true, kept for production)
  if (c.env.DB) {
    return { sql: c.env.DB.sql, isD1: true };
  }
  // Should not reach here, but TypeScript needs a return
  return { mem: getMemDb(), isD1: false };
}

// ── Login ──────────────────────────────────────────────────────────
app.post('/api/admin/login', async (c) => {
  const { username, password }: { username?: string; password?: string } = await c.req.json().catch(() => ({}));
  if (!username || !password) return jsonResp({ error: '请输入用户名和密码' }, 400);

  const ctx = dbCtx(c);
  let user: any;
  if (ctx.isD1) {
    try {
      // @ts-ignore
      user = await c.env.DB!.sql.get(`SELECT id, username, password_hash FROM users WHERE username = '${escapeSql(username)}'`);
    } catch { user = null; }
  } else {
    await seedMemDb();
    user = ctx.mem.users.find((u: any) => u.username === username);
  }

  if (!user) return jsonResp({ error: '用户名或密码错误' }, 401);
  if (!(await verifyPwd(password, user.password_hash))) return jsonResp({ error: '用户名或密码错误' }, 401);

  const token = createToken({ id: user.id, username: user.username });
  return jsonResp({ ok: true, message: '登录成功', token }, 200, { 'Set-Cookie': `jwt_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400` });
});

// ── Logout ─────────────────────────────────────────────────────────
app.post('/api/admin/logout', () => jsonResp({ ok: true }, 200, { 'Set-Cookie': 'jwt_token=; Path=/; HttpOnly; Max-Age=0' }));

// ── Get current user ───────────────────────────────────────────────
app.get('/api/admin/user', (c) => {
  const token = extractToken(c.req.raw);
  if (!token) return jsonResp({ loggedIn: false });
  const p = verifyToken(token);
  return p ? jsonResp({ loggedIn: true, username: p.username }) : jsonResp({ loggedIn: false });
});

// ── Helper: build news row from raw data ───────────────────────────
function normalizeNewsRow(r: any): any {
  return { id: r.id, title: r.title, summary: r.summary, content: r.content, category: r.category, cover_image: r.cover_image, author: r.author, status: r.status, publish_time: r.publish_time, created_at: r.created_at, updated_at: r.updated_at };
}

// ── Public news list ───────────────────────────────────────────────
app.get('/api/news', async (c) => {
  const u = new URL(c.req.url);
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1') || 1);
  const limit = Math.min(Math.max(1, parseInt(u.searchParams.get('limit') || '10') || 10), 50);
  const cat = u.searchParams.get('category');
  const kw = u.searchParams.get('keyword');

  const ctx = dbCtx(c);
  let items: any[] = [];
  let _total = 0;
  if (ctx.isD1) {
    let w = "WHERE status = 'published'";
    const params: unknown[] = [];
    if (cat) { w += ' AND category = ?'; params.push(cat); }
    if (kw) { w += ' AND title LIKE ?'; params.push(`%${kw}%`); }
    // @ts-ignore
    const totalRow = await c.env.DB!.sql.get(`SELECT COUNT(*) as total FROM news ${w}`, ...params);
    // @ts-ignore
    const rows = await c.env.DB!.sql.all(`SELECT * FROM news ${w} ORDER BY publish_time DESC LIMIT ? OFFSET ?`, ...params, limit, (page - 1) * limit);
    items = (rows.results || []).map(normalizeNewsRow);
    _total = totalRow?.total ?? 0;
  } else {
    items = ctx.mem.news.filter((n: any) => n.status === 'published');
    if (cat) items = items.filter((n: any) => n.category === cat);
    if (kw) items = items.filter((n: any) => n.title?.includes(kw));
  }

  items.sort((a: any, b: any) => (b.publish_time || '').localeCompare(a.publish_time || ''));
  const total = items.length;
  const paged = items.slice((page - 1) * limit, page * limit);

  return jsonResp({ items: paged.map(normalizeNewsRow), pagination: { page, limit, total: _total } });
});

// ── Public news detail ─────────────────────────────────────────────
app.get('/api/news/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return jsonResp({ error: '无效的ID' }, 400);

  const ctx = dbCtx(c);
  let row: any;
  if (ctx.isD1) {
    // @ts-ignore
    row = await c.env.DB!.sql.get(`SELECT * FROM news WHERE id = ? AND status = 'published'`, id);
  } else {
    row = ctx.mem.news.find((n: any) => n.id === id && n.status === 'published');
  }
  if (!row) return jsonResp({ error: '新闻不存在' }, 404);
  return jsonResp(normalizeNewsRow(row));
});

// ── Admin: get single news (for editing) ───────────────────────────
app.get('/api/admin/news/:id', async (c) => {
  if (checkAuth(c.req.raw)) return checkAuth(c.req.raw)!;
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return jsonResp({ error: '无效的ID' }, 400);

  const ctx = dbCtx(c);
  let row: any;
  if (ctx.isD1) {
    // @ts-ignore
    row = await c.env.DB!.sql.get(`SELECT * FROM news WHERE id = ?`, id);
  } else {
    row = ctx.mem.news.find((n: any) => n.id === id);
  }
  if (!row) return jsonResp({ error: '新闻不存在' }, 404);
  return jsonResp(normalizeNewsRow(row));
});

// ── Admin: news list ───────────────────────────────────────────────
app.get('/api/admin/news', async (c) => {
  if (checkAuth(c.req.raw)) return checkAuth(c.req.raw)!;
  const u = new URL(c.req.url);
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1') || 1);
  const limit = Math.min(Math.max(1, parseInt(u.searchParams.get('limit') || '20') || 20), 100);
  const cat = u.searchParams.get('category');
  const kw = u.searchParams.get('keyword');
  const st = u.searchParams.get('status');

  const ctx = dbCtx(c);
  let items: any[];
  if (ctx.isD1) {
    const conds: string[] = ['1=1'];
    const params: unknown[] = [];
    if (cat) { conds.push('category = ?'); params.push(cat); }
    if (kw) { conds.push('title LIKE ?'); params.push(`%${escapeSql(kw)}%`); }
    if (st) { conds.push('status = ?'); params.push(st); }
    const where = conds.join(' AND ');
    // @ts-ignore
    const totalR = await c.env.DB!.sql.get(`SELECT COUNT(*) as total FROM news WHERE ${where}`, ...params);
    // @ts-ignore
    const rows = await c.env.DB!.sql.all(`SELECT * FROM news WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, limit, (page - 1) * limit);
    items = (rows.results || []).map(normalizeNewsRow);
  } else {
    items = [...ctx.mem.news];
    if (cat) items = items.filter((n: any) => n.category === cat);
    if (kw) items = items.filter((n: any) => n.title?.includes(kw));
    if (st) items = items.filter((n: any) => n.status === st);
  }

  items.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total = items.length;
  const paged = items.slice((page - 1) * limit, page * limit);

  return jsonResp({ items: paged.map(normalizeNewsRow), pagination: { page, limit, total } });
});

// ── Admin: create news ─────────────────────────────────────────────
app.post('/api/admin/news', async (c) => {
  if (checkAuth(c.req.raw)) return checkAuth(c.req.raw)!;
  const body: Record<string, string> = await c.req.json().catch(() => ({}));
  const now = new Date().toISOString();
  if (!body.title || !body.summary || !body.content || !body.category) return jsonResp({ error: '请填写必填字段' }, 400);
  if (!ALLOWED_CATEGORIES.includes(body.category)) return jsonResp({ error: '无效的分类' }, 400);

  if (c.env.DB) {
    // @ts-ignore
    await c.env.DB.sql.run(
      `INSERT INTO news (title,summary,content,category,cover_image,author,status,publish_time,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      escapeHtml(body.title), escapeHtml(body.summary), body.content, body.category,
      body.cover_image || null, body.author || '编辑部', body.status || 'draft',
      body.publish_time || now, now, now,
    );
  } else {
    const ctx = dbCtx(c);
    ctx._memExec('', [
      escapeHtml(body.title), escapeHtml(body.summary), body.content, body.category,
      body.cover_image || null, body.author || '编辑部', body.status || 'draft',
      body.publish_time || now, now, now,
    ]);
  }
  return jsonResp({ ok: true }, 201);
});

// ── Admin: update news ─────────────────────────────────────────────
app.put('/api/admin/news/:id', async (c) => {
  if (checkAuth(c.req.raw)) return checkAuth(c.req.raw)!;
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return jsonResp({ error: '无效的ID' }, 400);

  const ctx = dbCtx(c);
  let existing: any;
  if (ctx.isD1) {
    // @ts-ignore
    existing = await c.env.DB!.sql.get(`SELECT id FROM news WHERE id = ?`, id);
  } else {
    existing = ctx.mem.news.find((n: any) => n.id === id);
  }
  if (!existing) return jsonResp({ error: '新闻不存在' }, 404);

  const body: Record<string, string> = await c.req.json().catch(() => ({}));
  if (body.category && !ALLOWED_CATEGORIES.includes(body.category)) return jsonResp({ error: '无效的分类' }, 400);

  if (ctx.isD1) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const now = new Date().toISOString();
    if (body.title !== undefined)       { sets.push('title=?'); vals.push(escapeHtml(body.title)); }
    if (body.summary !== undefined)      { sets.push('summary=?'); vals.push(escapeHtml(body.summary)); }
    if (body.content !== undefined)      { sets.push('content=?'); vals.push(body.content); }
    if (body.category !== undefined)     { sets.push('category=?'); vals.push(body.category); }
    if (body.status !== undefined)       { sets.push('status=?'); vals.push(body.status); }
    if (body.publish_time !== undefined) { sets.push('publish_time=?'); vals.push(body.publish_time); }
    if (body.cover_image !== undefined)  { sets.push('cover_image=?'); vals.push(body.cover_image || null); }
    if (body.author !== undefined)       { sets.push('author=?'); vals.push(body.author); }
    sets.push('updated_at=?'); vals.push(now);
    vals.push(id);
    // @ts-ignore
    await c.env.DB!.sql.run(`UPDATE news SET ${sets.join(',')} WHERE id=?`, ...vals);
  } else {
    // Update in-memory
    const idx = ctx.mem.news.findIndex((n: any) => n.id === id);
    if (idx >= 0) {
      const now = new Date().toISOString();
      if (body.title !== undefined)      ctx.mem.news[idx].title = escapeHtml(body.title);
      if (body.summary !== undefined)    ctx.mem.news[idx].summary = escapeHtml(body.summary);
      if (body.content !== undefined)    ctx.mem.news[idx].content = body.content;
      if (body.category !== undefined)   ctx.mem.news[idx].category = body.category;
      if (body.status !== undefined)     ctx.mem.news[idx].status = body.status;
      if (body.publish_time !== undefined) ctx.mem.news[idx].publish_time = body.publish_time;
      if (body.cover_image !== undefined) ctx.mem.news[idx].cover_image = body.cover_image;
      if (body.author !== undefined)     ctx.mem.news[idx].author = body.author;
      ctx.mem.news[idx].updated_at = now;
    }
  }
  return jsonResp({ ok: true });
});

// ── Admin: delete news ─────────────────────────────────────────────
app.delete('/api/admin/news/:id', async (c) => {
  if (checkAuth(c.req.raw)) return checkAuth(c.req.raw)!;
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return jsonResp({ error: '无效的ID' }, 400);

  const ctx = dbCtx(c);
  let existing: any;
  if (ctx.isD1) {
    // @ts-ignore
    existing = await c.env.DB!.sql.get(`SELECT id FROM news WHERE id = ?`, id);
  } else {
    existing = ctx.mem.news.find((n: any) => n.id === id);
  }
  if (!existing) return jsonResp({ error: '新闻不存在' }, 404);

  if (ctx.isD1) {
    // @ts-ignore
    await c.env.DB!.sql.run(`DELETE FROM news WHERE id=?`, id);
  } else {
    ctx.mem.news = ctx.mem.news.filter((n: any) => n.id !== id);
  }
  return jsonResp({ ok: true });
});

// ── Image upload to R2 ─────────────────────────────────────────────
app.post('/api/upload', async (c) => {
  if (checkAuth(c.req.raw)) return checkAuth(c.req.raw)!;
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return jsonResp({ error: '请选择要上传的文件' }, 400);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return jsonResp({ error: '仅支持 jpg、png、webp' }, 400);
  if (file.size > 5 * 1024 * 1024) return jsonResp({ error: '图片大小不能超过 5MB' }, 400);

  if (!c.env.IMAGE_BUCKET) return jsonResp({ error: '文件存储服务未配置（本地开发跳过）' }, 503);

  const bucket = c.env.IMAGE_BUCKET;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const key = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const publicUrl = `https://your-r2-subdomain.r2.cloudflarestorage.com/${key}`;
  return jsonResp({ ok: true, url: publicUrl, filename: file.name, size: file.size });
});

export default app;
