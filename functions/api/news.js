/**
 * Cloudflare Pages Function — News CRUD Routes
 */
import { getNews, getNewsDetail, createNews, updateNews, deleteNews } from '../../db.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function checkAuth(request) {
  const cookie = request.headers.get('Cookie') || '';
  const token = cookie.match(/admin_token=([^;]+)/)?.[1];
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const { request, params } = context;

  // GET /api/news — list
  if (!params.id) {
    const allNews = getNews();
    const summaries = allNews.map(n => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      year: n.year,
      category: n.category,
      image: n.image,
      sortOrder: n.sortOrder,
      createdAt: n.createdAt,
    }));
    return json(summaries);
  }

  // GET /api/news/:id — detail
  const item = getNewsDetail(parseInt(params.id));
  if (!item) return json({ error: '新闻不存在' }, 404);
  return json(item);
}

export async function onRequestPost(context) {
  if (!checkAuth(context.request)) {
    return json({ error: '请先登录' }, 401);
  }

  const { request } = context;
  const body = await request.json();
  const { title, content, summary, year, category, sortOrder } = body;

  if (!title || !content || !year || !category) {
    return json({ error: '请填写必填字段' }, 400);
  }

  const newsItem = createNews({ title, content, summary, year, category, sortOrder });
  return json({ ok: true, id: newsItem.id }, 201);
}

export async function onRequestPut(context) {
  if (!checkAuth(context.request)) {
    return json({ error: '请先登录' }, 401);
  }

  const { request, params } = context;
  const existing = getNewsDetail(parseInt(params.id));
  if (!existing) return json({ error: '新闻不存在' }, 404);

  const body = await request.json();
  const { title, content, summary, year, category, sortOrder } = body;

  if (!title || !content || !year || !category) {
    return json({ error: '请填写必填字段' }, 400);
  }

  updateNews(parseInt(params.id), {
    title, content, summary, year, category,
    sortOrder: sortOrder ?? existing.sortOrder,
  });
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  if (!checkAuth(context.request)) {
    return json({ error: '请先登录' }, 401);
  }

  const { params } = context;
  const existing = getNewsDetail(parseInt(params.id));
  if (!existing) return json({ error: '新闻不存在' }, 404);

  deleteNews(parseInt(params.id));
  return json({ ok: true });
}
