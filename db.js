const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'school.json');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Default admin credentials
const DEFAULT_ADMIN = { username: 'admin', password: 'nysdewq142857' };

// Load or initialize database
function loadDB() {
  if (fs.existsSync(DB_PATH)) {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  }

  // Fresh install — seed data
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);

  const db = {
    news: [
      {
        id: 1,
        title: '首届高考取得"开门红"',
        content: '2022年，学校首届高考成绩斐然，多名学生被重点大学录取，受到市委市政府和区委区政府通令嘉奖，开创了宛城区基础教育的新篇章。',
        summary: '首届高考成绩斐然，受到市委市政府和区委区政府通令嘉奖。',
        year: '2022',
        category: '高考',
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        title: '深化校际合作共谋发展',
        content: '学校依托与南阳师范学院、南阳市一中的共享共建机制，持续汇聚优质教育资源，推动教育教学质量全面提升。双方在教育科研、师资培训、课程建设等方面展开深度合作。',
        summary: '深化校际合作，持续汇聚优质教育资源。',
        year: '2023',
        category: '合作',
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        title: '数字化校园建设成效显著',
        content: '学校建成内含50余台标准计算机的学生微机房2个，中心云机房、录播教室、标准化考场等信息化项目全部完工并投入使用，为智慧教学奠定了坚实基础。',
        summary: '数字化校园建设成效显著，信息化项目全面完工。',
        year: '2024',
        category: '建设',
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    adminUsers: [
      {
        id: 1,
        username: DEFAULT_ADMIN.username,
        password_hash: hash,
        role: 'admin',
      },
    ],
    nextId: 4,
  };

  saveDB(db);
  console.log('  默认管理员: ' + DEFAULT_ADMIN.username + ' / ' + DEFAULT_ADMIN.password);
  console.log('  ⚠️  首次启动，请在后台修改默认密码！');
  return db;
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// ── DB helpers ──
let db = loadDB();

function getNews() {
  return [...db.news].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || b.id - a.id);
}

function getNewsSummary(id) {
  const item = db.news.find(n => n.id === id);
  return item ? { ...item, content: undefined } : null;
}

function getNewsDetail(id) {
  return db.news.find(n => n.id === id) || null;
}

function createNews(fields) {
  const now = new Date().toISOString();
  const newsItem = {
    id: db.nextId++,
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
  db.news.push(newsItem);
  saveDB(db);
  return newsItem;
}

function updateNews(id, fields) {
  const idx = db.news.findIndex(n => n.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  if (fields.title !== undefined) db.news[idx].title = fields.title;
  if (fields.content !== undefined) db.news[idx].content = fields.content;
  if (fields.summary !== undefined) db.news[idx].summary = fields.summary;
  if (fields.year !== undefined) db.news[idx].year = fields.year;
  if (fields.category !== undefined) db.news[idx].category = fields.category;
  if (fields.image !== undefined) db.news[idx].image = fields.image;
  if (fields.sortOrder !== undefined) db.news[idx].sortOrder = parseInt(fields.sortOrder) || 0;
  db.news[idx].updatedAt = now;

  saveDB(db);
  return db.news[idx];
}

function deleteNews(id) {
  const idx = db.news.findIndex(n => n.id === id);
  if (idx === -1) return false;
  db.news.splice(idx, 1);
  saveDB(db);
  return true;
}

function verifyAdmin(username, password) {
  const user = db.adminUsers.find(u => u.username === username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, role: user.role };
}

module.exports = {
  getNews,
  getNewsSummary,
  getNewsDetail,
  createNews,
  updateNews,
  deleteNews,
  verifyAdmin,
};
