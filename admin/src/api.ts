/**
 * API request utility for admin CMS.
 * Handles token injection, response parsing, and error handling.
 */

const BASE_URL = import.meta.env.VITE_API_BASE || '/api';

interface ApiResponse<T = unknown> {
  ok?: boolean;
  items?: T[];
  pagination?: Pagination;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

/** Make an authenticated API request. */
async function request<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const token = localStorage.getItem('admin_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  // 401 without redirect — login page handles auth state
  if (response.status === 401) {
    // Don't throw for unauthenticated users on public endpoints like /user
    throw new Error('Unauthorized');
  }

  const data: ApiResponse = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `请求失败 (${response.status})`);
  }

  return data as T;
}

// ─── Auth APIs ───

export async function login(username: string, password: string) {
  // Direct fetch to bypass the request interceptor (which sends token that doesn't exist yet)
  const response = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '登录失败');
  }

  // Extract token from response body (Worker returns it there for proxy compatibility)
  if (data.token) {
    localStorage.setItem('admin_token', data.token);
  } else if (response.headers.get('Set-Cookie')) {
    // Fallback: extract from cookie header
    const match = response.headers.get('Set-Cookie')?.match(/jwt_token=([^;]+)/);
    if (match) {
      localStorage.setItem('admin_token', match[1]);
    }
  }

  localStorage.setItem('admin_user', username);
  return data;
}

export function logout() {
  return request('/admin/logout', { method: 'POST' }).finally(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  });
}

export async function getCurrentUser() {
  try {
    return await request<any>('/admin/user', { method: 'GET' });
  } catch {
    return { loggedIn: false };
  }
}

// ─── News APIs ───

export async function getNewsList(
  page = 1,
  limit = 20,
  category?: string,
  keyword?: string,
  status?: string,
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (category) params.set('category', category);
  if (keyword) params.set('keyword', keyword);
  if (status) params.set('status', status);

  return await request<any>(`/admin/news?${params.toString()}`);
}

export async function getPublicNewsList(
  page = 1,
  limit = 10,
  category?: string,
  keyword?: string,
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (category) params.set('category', category);
  if (keyword) params.set('keyword', keyword);

  return await request<any>(`/news?${params.toString()}`);
}

export async function getNewsDetail(id: number) {
  return await request(`/admin/news/${id}`, { method: 'GET' });
}

export async function getPublicNewsDetail(id: number) {
  return await request(`/news/${id}`, { method: 'GET' });
}

export async function createNews(news: Record<string, string>) {
  return await request('/admin/news', {
    method: 'POST',
    body: JSON.stringify(news),
  });
}

export async function updateNews(id: number, news: Record<string, string>) {
  return await request(`/admin/news/${id}`, {
    method: 'PUT',
    body: JSON.stringify(news),
  });
}

export async function deleteNews(id: number) {
  return await request(`/admin/news/${id}`, {
    method: 'DELETE',
  });
}

// ─── Upload API ───

export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('admin_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '上传失败');
  }
  return data;
}
