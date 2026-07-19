const bcrypt = require('bcryptjs');

const DEFAULT_ADMIN = { username: 'admin', password: 'nysdewq142857' };

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

function createSeedDB() {
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);
  return {
    news: SEED_NEWS,
    adminUsers: [
      { id: 1, username: DEFAULT_ADMIN.username, password_hash: hash, role: 'admin' },
    ],
    nextId: 4,
  };
}

function getNews(kv) {
  const raw = kv.get('news', { type: 'json' });
  if (!raw) return [];
  return [...raw].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || b.id - a.id);
}

function getNewsDetail(kv, id) {
  const raw = kv.get('news', { type: 'json' });
  if (!raw) return null;
  return raw.find(n => n.id === id) || null;
}

function createNews(kv, fields) {
  let data = kv.get('news', { type: 'json' }) || [];
  let nextId = parseInt(kv.get('nextId') || '1');
  const now = new Date().toISOString();
  const newsItem = {
    id: nextId++,
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
  data.push(newsItem);
  kv.put('news', JSON.stringify(data));
  kv.put('nextId', String(nextId));
  return newsItem;
}

function updateNews(kv, id, fields) {
  let data = kv.get('news', { type: 'json' }) || [];
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
  kv.put('news', JSON.stringify(data));
  return data[idx];
}

function deleteNews(kv, id) {
  let data = kv.get('news', { type: 'json' }) || [];
  const idx = data.findIndex(n => n.id === id);
  if (idx === -1) return false;
  data.splice(idx, 1);
  kv.put('news', JSON.stringify(data));
  return true;
}

function verifyAdmin(kv, username, password) {
  const raw = kv.get('adminUsers', { type: 'json' });
  if (!raw) return null;
  const user = raw.find(u => u.username === username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, role: user.role };
}

function seedIfEmpty(kv) {
  const news = kv.get('news');
  if (!news) {
    const seed = createSeedDB();
    kv.put('news', JSON.stringify(seed.news));
    kv.put('adminUsers', JSON.stringify(seed.adminUsers));
    kv.put('nextId', String(seed.nextId));
  }
}

module.exports = {
  getNews, getNewsDetail, createNews, updateNews, deleteNews, verifyAdmin, seedIfEmpty,
};
