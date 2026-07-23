// ===== Navbar scroll effect =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;

  // Navbar background
  if (scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  // Back to top button
  if (scrollY > 600) {
    backToTop.classList.add('visible');
  } else {
    backToTop.classList.remove('visible');
  }

  // Active nav link
  updateActiveNav();
});

// Mobile menu toggle
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  const spans = navToggle.querySelectorAll('span');
  if (navLinks.classList.contains('open')) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  }
});

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    const spans = navToggle.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  });
});

// ===== Active nav highlight =====
function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const scrollPos = window.scrollY + 120;

  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');

    if (scrollPos >= top && scrollPos < top + height) {
      navLinks.querySelectorAll('a').forEach(a => a.classList.remove('active'));
      const activeLink = navLinks.querySelector(`a[href="#${id}"]`);
      if (activeLink) activeLink.classList.add('active');
    }
  });
}

// ===== Back to top =====
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== Counter animation =====
function animateCounters() {
  const counters = document.querySelectorAll('.stat-number');
  counters.forEach(counter => {
    const target = parseInt(counter.getAttribute('data-target'));
    if (!target) return;
    const duration = 2000;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = Math.floor(eased * target);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        counter.textContent = target;
      }
    }

    requestAnimationFrame(update);
  });
}

// ===== Scroll animations =====
const observerOptions = {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animated');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.scroll-animate').forEach(el => {
  observer.observe(el);
});

// ===== Hero counter trigger =====
const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters();
      heroObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroSection = document.getElementById('hero');
if (heroSection) {
  heroObserver.observe(heroSection);
}

// ===== Smooth parallax on hero (desktop only) =====
if (window.matchMedia('(min-width: 769px)').matches) {
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const heroContent = document.querySelector('.hero-content');
    if (heroContent && scrolled < window.innerHeight) {
      heroContent.style.transform = `translateY(${scrolled * 0.3}px)`;
      heroContent.style.opacity = 1 - (scrolled / window.innerHeight) * 0.8;
    }
  });
}

// ===== Typing effect for hero subtitle =====
const heroSubtitle = document.querySelector('.hero-subtitle');
if (heroSubtitle) {
  const text = heroSubtitle.textContent;
  heroSubtitle.textContent = '';
  let i = 0;

  function typeWriter() {
    if (i < text.length) {
      heroSubtitle.textContent += text.charAt(i);
      i++;
      setTimeout(typeWriter, 80);
    }
  }

  setTimeout(typeWriter, 1200);
}

// ===== News Data (fetched from API) =====
let ALL_NEWS = [];          // Full news list fetched from API
let LOADED = false;         // Whether news data has been fetched
const HOMEPAGE_LIMIT = 3;   // Items shown on homepage grid
const MODAL_LIMIT = 10;     // Items shown in modal list at once

// Fetch all published news from API on page load
async function fetchNews() {
  if (LOADED || ALL_NEWS.length > 0) return;
  try {
    const res = await fetch('/api/news?limit=100&page=1');
    if (!res.ok) throw new Error('Failed to fetch news');
    const data = await res.json();
    ALL_NEWS = (data.items || []).map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      content: item.content || '',
      category: item.category,
      cover_image: item.cover_image || '',
      author: item.author || '编辑部',
      status: item.status || 'published',
      publish_time: item.publish_time || item.created_at || '',
      created_at: item.created_at || '',
      updated_at: item.updated_at || '',
    }));
    LOADED = true;
    // Re-render after loading
    renderHomepageNews(newsCurrentPage);
    renderModalNewsList();
  } catch (err) {
    console.error('Failed to load news:', err);
    // Fallback: show empty state
    LOADED = true;
    renderHomepageNews(1);
  }
}

// ===== News Rendering =====
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: `${d.getMonth() + 1}月`,
    full: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
  };
}

/** Create a news card element — matches original .news-card HTML structure */
function createNewsCard(item) {
  const card = document.createElement('div');
  card.className = 'news-card scroll-animate';
  const fd = formatDate(item.publish_time || item.date || item.created_at);

  card.innerHTML = `
    <div class="news-card-header">
      <span class="news-category-badge">${escHtml(item.category)}</span>
      <span class="news-card-date">${fd.full}</span>
    </div>
    <div class="news-card-body">
      <h3>${escHtml(item.title)}</h3>
      <p>${escHtml(item.summary)}</p>
    </div>
    <div class="news-card-footer">
      <a href="javascript:void(0)" class="news-read-more" onclick="readFullNews(${item.id})">
        阅读更多
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="7" x2="13" y2="7"/>
          <polyline points="9 3 13 7 9 11"/>
        </svg>
      </a>
    </div>
  `;
  return card;
}

/** Render pagination controls — keeps original structure */
function renderPagination(containerId, totalItems, currentPage, pageSize, callbackName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(totalItems / pageSize);
  container.innerHTML = '';

  if (totalPages <= 1) return;

  // Prev button
  const prevBtn = document.createElement('button');
  prevBtn.className = `page-btn ${currentPage === 1 ? 'disabled' : ''}`;
  prevBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 4 6 8 10 12"/></svg>`;
  if (currentPage > 1) {
    prevBtn.onclick = () => window[callbackName](currentPage - 1);
  }
  container.appendChild(prevBtn);

  // Page numbers
  const startPage = Math.max(1, currentPage - 1);
  const endPage = Math.min(totalPages, currentPage + 1);

  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.className = 'page-btn';
    firstBtn.textContent = '1';
    firstBtn.onclick = () => window[callbackName](1);
    container.appendChild(firstBtn);

    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.className = 'page-dots';
      dots.textContent = '…';
      container.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    btn.textContent = String(i);
    btn.onclick = () => window[callbackName](i);
    container.appendChild(btn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'page-dots';
      dots.textContent = '…';
      container.appendChild(dots);
    }

    const lastBtn = document.createElement('button');
    lastBtn.className = 'page-btn';
    lastBtn.textContent = String(totalPages);
    lastBtn.onclick = () => window[callbackName](totalPages);
    container.appendChild(lastBtn);
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = `page-btn ${currentPage === totalPages ? 'disabled' : ''}`;
  nextBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 10 8 6 12"/></svg>`;
  if (currentPage < totalPages) {
    nextBtn.onclick = () => window[callbackName](currentPage + 1);
  }
  container.appendChild(nextBtn);
}

// ===== Homepage News (grid view) =====
let newsCurrentPage = 1;
let newsCategoryFilter = '';

function getFilteredNews() {
  if (!newsCategoryFilter) return ALL_NEWS;
  return ALL_NEWS.filter(n => n.category === newsCategoryFilter);
}

function renderHomepageNews(page) {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  grid.innerHTML = '';
  newsCurrentPage = page || 1;

  const filtered = getFilteredNews();
  const start = (newsCurrentPage - 1) * HOMEPAGE_LIMIT;
  const items = filtered.slice(start, start + HOMEPAGE_LIMIT);

  if (items.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--gray-500);padding:60px 0;">暂无新闻</p>';
    return;
  }

  items.forEach((item, index) => {
    const card = createNewsCard(item);
    card.style.transitionDelay = `${index * 0.08}s`;
    grid.appendChild(card);
  });

  // Re-observe for scroll animation
  grid.querySelectorAll('.scroll-animate').forEach(el => {
    observer.observe(el);
  });

  renderPagination('newsPagination', filtered.length, newsCurrentPage, HOMEPAGE_LIMIT, 'renderHomepageNews');
}

// ===== Modal News (list view) =====
let modalCurrentPage = 1;
let modalCategoryFilter = '';

function getModalFilteredNews() {
  if (!modalCategoryFilter) return ALL_NEWS;
  return ALL_NEWS.filter(n => n.category === modalCategoryFilter);
}

function renderModalNewsList() {
  const list = document.getElementById('modalNewsList');
  if (!list) return;

  list.innerHTML = '';

  const filtered = getModalFilteredNews();

  if (filtered.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--gray-500);padding:40px 20px;">暂无该分类的新闻</p>';
    const pagEl = document.getElementById('modalPagination');
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  filtered.forEach(item => {
    const fd = formatDate(item.publish_time || item.date || item.created_at);
    const el = document.createElement('div');
    el.className = 'news-modal-item';
    el.setAttribute('data-news-id', item.id);
    el.innerHTML = `
      <div class="news-modal-item-date">
        <span class="news-modal-item-day">${fd.day}</span>
        <span class="news-modal-item-month">${fd.month}</span>
      </div>
      <div class="news-modal-item-content">
        <span class="news-modal-item-category">${escHtml(item.category)}</span>
        <div class="news-modal-item-title">${escHtml(item.title)}</div>
        <div class="news-modal-item-summary">${escHtml(item.summary)}</div>
      </div>
    `;
    list.appendChild(el);
  });

  // Simple pagination in modal
  const pagEl = document.getElementById('modalPagination');
  if (pagEl) pagEl.innerHTML = '';
}

function openAllNews() {
  document.getElementById('newsModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderModalNewsList();
}

function closeAllNews() {
  document.getElementById('newsModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

/** "阅读更多" — open modal and scroll to the specific news item */
window.readFullNews = function(id) {
  // Open modal first
  openAllNews();
  // Scroll to the matching item
  setTimeout(() => {
    const item = document.querySelector(`.news-modal-item[data-news-id="${id}"]`);
    if (item) {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Briefly highlight the item
      item.classList.add('highlighted');
      setTimeout(() => item.classList.remove('highlighted'), 2000);
    }
  }, 150);
};

function setModalCategory(cat) {
  newsCategoryFilter = cat;
  modalCategoryFilter = cat;

  // Update filter buttons in both toolbar and modal
  document.querySelectorAll('#newsFilters .filter-btn, #modalFilters .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === cat);
  });

  renderHomepageNews(1);
  renderModalNewsList();
}

// ===== Event Listeners =====

// View all news button
const viewAllBtn = document.getElementById('viewAllNewsBtn');
if (viewAllBtn) {
  viewAllBtn.addEventListener('click', openAllNews);
}

// Close modal
const modalClose = document.getElementById('newsModalClose');
const modalOverlay = document.getElementById('newsModalOverlay');
if (modalClose) {
  modalClose.addEventListener('click', closeAllNews);
}
if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeAllNews();
  });
}

// Escape key closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllNews();
});

// Filter buttons in homepage toolbar
document.getElementById('newsFilters')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-btn')) {
    setModalCategory(e.target.dataset.category);
  }
});

// Filter buttons in modal
document.getElementById('modalFilters')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-btn')) {
    modalCategoryFilter = e.target.dataset.category;
    document.getElementById('modalFilters').querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === modalCategoryFilter);
    });
    renderModalNewsList();
  }
});

// ===== Initialize: fetch news from API on DOM ready =====
document.addEventListener('DOMContentLoaded', async () => {
  await fetchNews(); // Fetch from API, then render
});
