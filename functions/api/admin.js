/**
 * Cloudflare Pages Function — Admin Auth Routes
 * Handles: GET /api/admin, POST /api/admin/login, POST /api/admin/logout
 */
import { verifyAdmin } from '../../db.js';

export async function onRequestGet(context) {
  // GET /api/admin — check login status
  const cookie = context.request.headers.get('Cookie') || '';
  const token = cookie.match(/admin_token=([^;]+)/)?.[1];
  let loggedIn = false;

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      loggedIn = payload.exp > Date.now();
    } catch {}
  }

  return json({ loggedIn });
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);

  // POST /api/admin/login
  if (url.pathname.endsWith('/login')) {
    return handleLogin(context);
  }

  // POST /api/admin/logout
  if (url.pathname.endsWith('/logout')) {
    return handleLogout(context);
  }

  return json({ error: 'Not found' }, 404);
}

async function handleLogin(context) {
  const { username, password } = await context.request.json();

  if (!username || !password) {
    return json({ error: '请输入用户名和密码' }, 400);
  }

  const user = verifyAdmin(username, password);
  if (!user) {
    return json({ error: '用户名或密码错误' }, 401);
  }

  // Simple token (base64 encoded JSON, not cryptographically signed)
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const payload = btoa(JSON.stringify({
    username: user.username,
    id: user.id,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  }));
  const token = header + '.' + payload;

  const response = json({ ok: true });
  response.headers.set('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  return response;
}

function handleLogout(context) {
  const response = json({ ok: true });
  response.headers.set('Set-Cookie', 'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return response;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
