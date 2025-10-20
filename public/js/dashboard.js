import { apiFetch, initTheme, showToast } from './common.js';

const state = {
  filter: 'all',
  search: '',
  sort: 'created',
  tags: [],
  editingTaskId: null,
  reminderTimers: {},
  user: null,
};

const tasksList = document.getElementById('tasks-list');
const statsGrid = document.getElementById('stats-grid');
const dailyChart = document.getElementById('daily-chart');
const taskForm = document.getElementById('task-form');
const filterRadios = document.querySelectorAll("input[name='filter']");
const searchInput = document.getElementById('search-input');
const tagsInput = document.getElementById('tags-input');
const sortSelect = document.getElementById('sort-select');
const logoutBtn = document.getElementById('logout-btn');
const welcomeMessage = document.getElementById('welcome-message');

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
    if (!task.notes) notes.classList.add('muted');

    const due = task.dueDate ? `<span class="badge">Due ${formatDate(task.dueDate)}</span>` : '';
    const priority = `<span class="badge">${task.priority.toUpperCase()}</span>`;
    const tags = (task.tags || []).map((tag) => `<span class=\"badge\">#${tag}</span>`).join('');
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
  if (Notification.permission === 'default') Notification.requestPermission();
  Object.values(state.reminderTimers).forEach((t) => clearTimeout(t));
  state.reminderTimers = {};
  tasks.forEach((task) => {
    if (!task.dueDate || !task.reminderMinutesBefore || task.completed) return;
    const dueTime = new Date(task.dueDate).getTime();
    const reminderTime = dueTime - task.reminderMinutesBefore * 60 * 1000;
    const delay = reminderTime - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('Task Reminder', { body: `${task.title} is due soon`, tag: `task-${task._id}` });
      }
    }, delay);
    state.reminderTimers[task._id] = timer;
  });
};

const loadTasks = async () => {
  const params = new URLSearchParams({ filter: state.filter, search: state.search, sort: state.sort });
  if (state.tags.length) params.set('tags', state.tags.join(','));
  const { tasks } = await apiFetch(`/api/tasks?${params.toString()}`);
  renderTasks(tasks);
  scheduleNotifications(tasks);
};

const loadDashboard = async () => {
  const { summary, dailyBreakdown } = await apiFetch('/api/dashboard/summary');
  renderStats(summary);
  renderChart(dailyBreakdown);
};

const checkSession = async () => {
  try {
    const { user } = await apiFetch('/api/auth/profile');
    state.user = user;
    welcomeMessage.textContent = `Welcome back, ${user.name}`;
  } catch (_) {
    window.location.href = '/login.html';
  }
};

const init = async () => {
  initTheme();

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  if (taskForm) {
    taskForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(taskForm);
      const payload = Object.fromEntries(formData.entries());
      payload.tags = payload.tags ? payload.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
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
  }

  filterRadios.forEach((radio) => radio.addEventListener('change', async (e) => { state.filter = e.target.value; await loadTasks(); }));
  if (searchInput) searchInput.addEventListener('input', async (e) => { state.search = e.target.value; await loadTasks(); });
  if (tagsInput) tagsInput.addEventListener('change', async (e) => {
    state.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
    await loadTasks();
  });
  if (sortSelect) sortSelect.addEventListener('change', async (e) => { state.sort = e.target.value; await loadTasks(); });

  await checkSession();
  await loadTasks();
  await loadDashboard();
};

init();

