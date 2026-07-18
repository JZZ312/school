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
      // Ease out cubic
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

  // Start typing after hero animation
  setTimeout(typeWriter, 1200);
}

// ===== Dynamic News Loader =====
async function loadNews() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/news');
    const news = await res.json();

    grid.innerHTML = '';

    if (news.length === 0) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--gray-500);padding:40px;">暂无新闻</p>';
      return;
    }

    news.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'news-card scroll-animate';
      card.style.transitionDelay = `${0.05 + index * 0.1}s`;

      card.innerHTML = `
        <div class="news-date">
          <span class="news-day">${escHtml(item.year)}</span>
          <span class="news-month">${escHtml(item.category)}</span>
        </div>
        <div class="news-body">
          <h3>${escHtml(item.title)}</h3>
          <p>${escHtml(item.summary || '')}</p>
        </div>
      `;

      grid.appendChild(card);
    });

    // Re-observe new elements for scroll animation
    grid.querySelectorAll('.scroll-animate').forEach(el => {
      observer.observe(el);
    });

  } catch (err) {
    console.error('Failed to load news:', err);
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#dc3545;padding:40px;">新闻加载失败，请稍后重试</p>';
  }
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Load news after DOM ready
document.addEventListener('DOMContentLoaded', loadNews);
