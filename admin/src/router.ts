import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('./pages/Login.vue'),
      meta: { title: '登录', guest: true },
    },
    {
      path: '/',
      component: () => import('./Layout.vue'),
      redirect: '/news',
      children: [
        {
          path: 'news',
          name: 'NewsList',
          component: () => import('./pages/NewsList.vue'),
          meta: { title: '新闻管理' },
        },
        {
          path: 'news/create',
          name: 'NewsCreate',
          component: () => import('./pages/NewsForm.vue'),
          meta: { title: '发布新闻' },
        },
        {
          path: 'news/edit/:id',
          name: 'NewsEdit',
          component: () => import('./pages/NewsForm.vue'),
          props: true,
          meta: { title: '编辑新闻' },
        },
      ],
    },
  ],
});

/** Navigation guard: require authentication. */
router.beforeEach(async (to) => {
  const token = localStorage.getItem('admin_token');
  if (to.path !== '/login' && !token) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.meta.guest && token) {
    return { path: '/' };
  }
});

export default router;
