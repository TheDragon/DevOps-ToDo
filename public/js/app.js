const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const logoutBtn = document.getElementById('logout-btn');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const taskForm = document.getElementById('task-form');
const tasksList = document.getElementById('tasks-list');
const statsGrid = document.getElementById('stats-grid');
const dailyChart = document.getElementById('daily-chart');
const welcomeMessage = document.getElementById('welcome-message');
const themeToggle = document.getElementById('theme-toggle');
const filterRadios = document.querySelectorAll("input[name='filter']");
const searchInput = document.getElementById('search-input');
const tagsInput = document.getElementById('tags-input');
const sortSelect = document.getElementById('sort-select');

const state = {
  user: null,
  filter: 'all',
  search: '',
  sort: 'created',
  tags: [],
  editingTaskId: null,
  reminderTimers: {},
};

const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);

logoutBtn.classList.add('hidden');

const showToast = (message, timeout = 4000) => {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), timeout);
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('devops-todo-theme', theme);
};

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'light' ? 'dark' : 'light');
});

applyTheme(localStorage.getItem('devops-todo-theme') || 'light');

const apiFetch = async (url, options = {}) => {
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

const renderStats = (summary) => {
  statsGrid.innerHTML = '';
  const entries = [
    { label: 'Total Tasks', value: summary.totalTasks },
    { label: 'Completed', value: summary.completedTasks },
    { label: 'Pending', value: summary.pendingTasks },
    { label: 'Due Today', value: summary.dueToday },
    { label: 'Due This Week', value: summary.dueThisWeek },
    { label: 'Overdue', value: summary.overdue },
    { label: 'Streak', value: `${summary.streak} day${summary.streak === 1 ? '' : 's'}` },
  ];
  entries.forEach(({ label, value }) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<h3>${label}</h3><strong>${value}</strong>`;
    statsGrid.appendChild(card);
  });
};

const renderChart = (dailyBreakdown) => {
  dailyChart.innerHTML = '';
  const entries = Object.entries(dailyBreakdown)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .slice(-7);

  if (!entries.length) {
    dailyChart.innerHTML = '<p class="muted">No recent activity yet.</p>';
    return;
  }

  const max = Math.max(
    ...entries.map(([_, value]) => Math.max(value.created, value.completed))
  );

  entries.forEach(([date, value]) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    const createdHeight = max ? (value.created / max) * 120 : 4;
    const completedHeight = max ? (value.completed / max) * 120 : 4;
    bar.innerHTML = `
      <div style="height:${createdHeight}px"></div>
      <div style="height:${completedHeight}px; background: rgba(79,70,229,0.35);"></div>
      <span>${new Date(date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
    `;
    dailyChart.appendChild(bar);
  });
};

const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const renderTasks = (tasks) => {
  tasksList.innerHTML = '';
  const template = document.getElementById('task-template');
  tasks.forEach((task) => {
    const element = template.content.cloneNode(true);
    const article = element.querySelector('.task');
    const title = element.querySelector('.task-title');
    const notes = element.querySelector('.task-notes');
    const meta = element.querySelector('.task-meta');
    const toggle = element.querySelector('.task-toggle');
    const editBtn = element.querySelector('.edit-task');
    const deleteBtn = element.querySelector('.delete-task');

    title.textContent = task.title;
    notes.textContent = task.notes || 'No notes yet';
    if (!task.notes) {
      notes.classList.add('muted');
    }

    const due = task.dueDate ? `<span class="badge">Due ${formatDate(task.dueDate)}</span>` : '';
    const priority = `<span class="badge">${task.priority.toUpperCase()}</span>`;
    const tags = (task.tags || [])
      .map((tag) => `<span class="badge">#${tag}</span>`)
      .join('');
    const status = task.completed ? '<span class="badge">Completed</span>' : '';
    meta.innerHTML = [due, priority, tags, status].filter(Boolean).join(' ');

    toggle.checked = task.completed;
    toggle.addEventListener('change', async () => {
      try {
        await apiFetch(`/api/tasks/${task._id}/toggle`, { method: 'PATCH' });
        showToast('Task updated');
        await loadTasks();
        await loadDashboard();
      } catch (error) {
        showToast(error.message);
      }
    });

    editBtn.addEventListener('click', () => {
      state.editingTaskId = task._id;
      taskForm.title.value = task.title;
      taskForm.notes.value = task.notes;
      taskForm.dueDate.value = task.dueDate ? task.dueDate.slice(0, 10) : '';
      taskForm.priority.value = task.priority;
      taskForm.tags.value = (task.tags || []).join(',');
      taskForm.reminder.value = task.reminderMinutesBefore || '';
      taskForm.querySelector('button[type="submit"]').textContent = 'Update Task';
      taskForm.scrollIntoView({ behavior: 'smooth' });
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try {
        await apiFetch(`/api/tasks/${task._id}`, { method: 'DELETE' });
        showToast('Task deleted');
        await loadTasks();
        await loadDashboard();
      } catch (error) {
        showToast(error.message);
      }
    });

    tasksList.appendChild(element);
  });

  if (!tasks.length) {
    tasksList.innerHTML = '<p class="muted">No tasks yet. Create your first one above.</p>';
  }
};

const scheduleNotifications = (tasks) => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  Object.values(state.reminderTimers).forEach((timer) => clearTimeout(timer));
  state.reminderTimers = {};

  tasks.forEach((task) => {
    if (!task.dueDate || !task.reminderMinutesBefore || task.completed) return;
    const dueTime = new Date(task.dueDate).getTime();
    const reminderTime = dueTime - task.reminderMinutesBefore * 60 * 1000;
    const delay = reminderTime - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('Task Reminder', {
          body: `${task.title} is due soon`,
          tag: `task-${task._id}`,
        });
      }
    }, delay);
    state.reminderTimers[task._id] = timer;
  });
};

const loadTasks = async () => {
  try {
    const params = new URLSearchParams({
      filter: state.filter,
      search: state.search,
      sort: state.sort,
    });
    if (state.tags.length) {
      params.set('tags', state.tags.join(','));
    }
    const { tasks } = await apiFetch(`/api/tasks?${params.toString()}`);
    renderTasks(tasks);
    scheduleNotifications(tasks);
  } catch (error) {
    showToast(error.message);
  }
};

const loadDashboard = async () => {
  try {
    const { summary, dailyBreakdown } = await apiFetch('/api/dashboard/summary');
    renderStats(summary);
    renderChart(dailyBreakdown);
  } catch (error) {
    console.error(error);
  }
};

const onAuthenticated = (user) => {
  state.user = user;
  welcomeMessage.textContent = `Welcome back, ${user.name}`;
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  loadTasks();
  loadDashboard();
};

const onLoggedOut = () => {
  state.user = null;
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
  logoutBtn.classList.add('hidden');
};

const checkSession = async () => {
  try {
    const { user } = await apiFetch('/api/auth/profile');
    if (user) {
      onAuthenticated(user);
    }
  } catch (error) {
    onLoggedOut();
  }
};

const normalizeRegistrationOptions = (opt) => {
  // Accept common shapes: opt, {publicKey: {...}}, {options: {...}}
  const pk = opt?.publicKey || opt?.options || opt;
  // Some servers accidentally nest twice
  const maybePk = pk?.publicKey || pk;
  return maybePk;
};

const normalizeAuthenticationOptions = (opt) => {
  const pk = opt?.publicKey || opt?.options || opt;
  const maybePk = pk?.publicKey || pk;
  return maybePk;
};

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const { options, user } = await apiFetch('/api/auth/register/begin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const regOptions = normalizeRegistrationOptions(options);
    console.debug('Normalized registration options:', regOptions);
    if (!regOptions || !regOptions.challenge) {
      console.debug('Registration options received (raw):', options);
      throw new Error('Invalid registration options from server');
    }
    if (!regOptions.user || !regOptions.user.id) {
      // Fallback: build user block from API's returned user payload
      if (user && user.id && user.email && user.name) {
        regOptions.user = {
          id: user.id,
          name: user.email,
          displayName: user.name,
        };
        console.debug('Filled missing user block from payload:', regOptions.user);
      } else {
        console.debug('Registration options missing user or id and no fallback:', regOptions);
        throw new Error('Invalid registration options from server');
      }
    }
    const attResp = await SimpleWebAuthnBrowser.startRegistration(regOptions);

    const result = await apiFetch('/api/auth/register/complete', {
      method: 'POST',
      body: JSON.stringify({ email: payload.email, attestationResponse: attResp }),
    });

    showToast('Passkey registered successfully');
    registerForm.reset();
    onAuthenticated(result.user || user);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Registration failed');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const { options } = await apiFetch('/api/auth/login/begin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const authOptions = normalizeAuthenticationOptions(options);
    if (!authOptions || !authOptions.challenge) {
      console.debug('Authentication options received:', options);
      throw new Error('Invalid authentication options from server');
    }
    const assertion = await SimpleWebAuthnBrowser.startAuthentication(authOptions);

    const { user } = await apiFetch('/api/auth/login/complete', {
      method: 'POST',
      body: JSON.stringify({ email: payload.email, assertionResponse: assertion }),
    });

    showToast('Signed in successfully');
    loginForm.reset();
    onAuthenticated(user);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Login failed');
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    onLoggedOut();
    showToast('Logged out');
  } catch (error) {
    showToast(error.message);
  }
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const payload = Object.fromEntries(formData.entries());
  payload.tags = payload.tags ? payload.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  if (!payload.reminder) delete payload.reminder;
  if (!payload.dueDate) delete payload.dueDate;
  if (!payload.notes) payload.notes = '';

  try {
    if (state.editingTaskId) {
      await apiFetch(`/api/tasks/${state.editingTaskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: payload.title,
          notes: payload.notes,
          dueDate: payload.dueDate,
          priority: payload.priority,
          tags: payload.tags,
          reminderMinutesBefore: payload.reminder ? Number(payload.reminder) : undefined,
        }),
      });
      showToast('Task updated');
    } else {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          notes: payload.notes,
          dueDate: payload.dueDate,
          priority: payload.priority,
          tags: payload.tags,
          reminderMinutesBefore: payload.reminder ? Number(payload.reminder) : undefined,
        }),
      });
      showToast('Task created');
    }
    state.editingTaskId = null;
    taskForm.reset();
    taskForm.querySelector('button[type="submit"]').textContent = 'Add Task';
    await loadTasks();
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

filterRadios.forEach((radio) =>
  radio.addEventListener('change', async (event) => {
    state.filter = event.target.value;
    await loadTasks();
  })
);

searchInput.addEventListener('input', async (event) => {
  state.search = event.target.value;
  await loadTasks();
});

tagsInput.addEventListener('change', async (event) => {
  state.tags = event.target.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  await loadTasks();
});

sortSelect.addEventListener('change', async (event) => {
  state.sort = event.target.value;
  await loadTasks();
});

checkSession();
