const express = require('express');
const path = require('path');
const fs = require('fs');
const { router: adminRouter, requireAuth } = require('./admin');
const { getNews, getNewsDetail, createNews, updateNews, deleteNews } = require('../db');

const router = express.Router();

// ── 公开接口 ──

router.get('/', (req, res) => {
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
  res.json(summaries);
});

router.get('/:id', (req, res) => {
  const item = getNewsDetail(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: '新闻不存在' });
  res.json(item);
});

// ── 需登录接口 ──

router.post('/', requireAuth, (req, res) => {
  try {
    const { title, content, summary, year, category, sortOrder } = req.body;

    if (!title || !content || !year || !category) {
      return res.status(400).json({ error: '请填写必填字段' });
    }

    const newsItem = createNews({ title, content, summary, year, category, sortOrder });
    res.status(201).json({ ok: true, id: newsItem.id });
  } catch (err) {
    console.error('创建新闻失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const existing = getNewsDetail(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: '新闻不存在' });

    const { title, content, summary, year, category, sortOrder } = req.body;

    if (!title || !content || !year || !category) {
      return res.status(400).json({ error: '请填写必填字段' });
    }

    updateNews(parseInt(req.params.id), {
      title, content, summary, year, category,
      sortOrder: sortOrder ?? existing.sortOrder,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('更新新闻失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    const existing = getNewsDetail(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: '新闻不存在' });
    deleteNews(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    console.error('删除新闻失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
