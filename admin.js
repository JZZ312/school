const API = '/api';
let isLoggedIn = false;

// ── Check login status from cookie ──
function checkLogin() {
  const cookie = document.cookie;
  const match = cookie.match(/admin_token=([^;]+)/);
  if (!match) return false;
  try {
    const token = match[1];
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(`${API}/admin`);
    const data = await res.json();
    isLoggedIn = data.loggedIn;
  } catch {
    isLoggedIn = checkLogin();
  }
  showView(isLoggedIn ? 'dashboard' : 'login');
});

function showView(view) {
  document.getElementById('loginView').style.display = view === 'login' ? '' : 'none';
  document.getElementById('dashboardView').style.display = view === 'dashboard' ? '' : 'none';
  if (view === 'dashboard') {
    loadNewsList();
  }
}

// ── Login ──
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username.value,
        password: form.password.value,
      }),
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      isLoggedIn = true;
      showView('dashboard');
      form.reset();
    } else {
      errEl.textContent = data.error || '登录失败';
    }
  } catch {
    errEl.textContent = '网络错误，请检查服务器是否运行';
  }
});

// ── Logout ──
document.getElementById('btnLogout').addEventListener('click', async () => {
  try {
    await fetch(`${API}/admin/logout`, { method: 'POST', credentials: 'include' });
  } catch {}
  isLoggedIn = false;
  showView('login');
});

// ── Load News List ──
async function loadNewsList() {
  try {
    const res = await fetch(`${API}/news`);
    const news = await res.json();
    const tbody = document.getElementById('newsTableBody');
    tbody.innerHTML = '';

    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.table-wrapper');

    if (news.length === 0) {
      emptyState.style.display = '';
      tableWrapper.style.display = 'none';
      document.getElementById('panelCount').textContent = '共 0 条新闻';
      return;
    }

    emptyState.style.display = 'none';
    tableWrapper.style.display = '';
    document.getElementById('panelCount').textContent = `共 ${news.length} 条新闻`;

    news.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>
          <div class="news-title-cell">${escHtml(item.title)}</div>
          ${item.summary ? `<div class="news-summary-cell">${escHtml(item.summary)}</div>` : ''}
        </td>
        <td>${escHtml(item.year)}</td>
        <td>${escHtml(item.category)}</td>
        <td>${item.sortOrder}</td>
        <td class="action-btns">
          <button class="action-btn edit" onclick="editNews(${item.id})">编辑</button>
          <button class="action-btn delete" onclick="deleteNews(${item.id})">删除</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('加载新闻失败:', err);
  }
}

// ── Add New ──
document.getElementById('btnAddNew').addEventListener('click', () => {
  document.getElementById('formTitle').textContent = '新增新闻';
  document.getElementById('newsForm').reset();
  document.getElementById('newsForm').querySelector('[name="id"]').value = '';
  showForm(true);
});

// ── Edit ──
window.editNews = async function(id) {
  try {
    const res = await fetch(`${API}/news/${id}`);
    const item = await res.json();

    document.getElementById('formTitle').textContent = '编辑新闻';
    const form = document.getElementById('newsForm');
    form.querySelector('[name="id"]').value = item.id;
    form.querySelector('[name="title"]').value = item.title;
    form.querySelector('[name="summary"]').value = item.summary || '';
    form.querySelector('[name="content"]').value = item.content;
    form.querySelector('[name="year"]').value = item.year;
    form.querySelector('[name="category"]').value = item.category;
    form.querySelector('[name="sortOrder"]').value = item.sortOrder;

    showForm(true);
  } catch (err) {
    alert('加载新闻详情失败');
  }
};

// ── Delete ──
window.deleteNews = async function(id) {
  if (!confirm('确定要删除这条新闻吗？此操作不可恢复。')) return;

  try {
    const res = await fetch(`${API}/news/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      loadNewsList();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `删除失败 (${res.status})`);
    }
  } catch (err) {
    console.error('删除新闻失败:', err);
    alert('网络错误，删除失败。请检查服务器是否运行。');
  }
};

// ── Form Submit ──
document.getElementById('newsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.querySelector('[name="id"]').value;
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API}/news/${id}` : `${API}/news`;

  const data = {
    title: form.querySelector('[name="title"]')?.value || '',
    content: form.querySelector('[name="content"]')?.value || '',
    summary: form.querySelector('[name="summary"]')?.value || '',
    year: form.querySelector('[name="year"]')?.value || '',
    category: form.querySelector('[name="category"]')?.value || '',
    sortOrder: form.querySelector('[name="sortOrder"]')?.value || 0,
  };

  try {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      showForm(false);
      loadNewsList();
    } else {
      const errData = await res.json().catch(() => ({}));
      alert(errData.error || `保存失败 (${res.status})`);
    }
  } catch (err) {
    console.error('保存新闻失败:', err);
    alert('网络错误，保存失败。请检查服务器是否运行。\n\n错误: ' + err.message);
  }
});

// ── Cancel / Back ──
document.getElementById('btnCancel').addEventListener('click', () => showForm(false));
document.getElementById('btnBackToList').addEventListener('click', () => showForm(false));

function showForm(show) {
  document.getElementById('newsListView').style.display = show ? 'none' : '';
  document.getElementById('newsFormView').style.display = show ? '' : 'none';
}

// ── Escape HTML ──
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
