// Common frontend helpers shared across pages

export const toast = (() => {
  const t = document.createElement('div');
  t.className = 'toast';
  document.body.appendChild(t);
  return t;
})();

export const showToast = (message, timeout = 4000) => {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), timeout);
};

export const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('devops-todo-theme', theme);
};

export const initTheme = () => {
  const saved = localStorage.getItem('devops-todo-theme') || 'light';
  applyTheme(saved);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
  }
};

export const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
};

export const getSession = async () => {
  try {
    const { user } = await apiFetch('/api/auth/profile');
    return user || null;
  } catch (_) {
    return null;
  }
};

