import Task from '../models/Task.js';

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const computeStreak = (tasks) => {
  const completionDates = new Set(
    tasks
      .filter((task) => task.completed && task.updatedAt)
      .map((task) => startOfDay(task.updatedAt).getTime())
  );

  let streak = 0;
  let cursor = startOfDay().getTime();

  while (completionDates.has(cursor)) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }

  return streak;
};

export const getSummary = async (req, res) => {
  try {
    const userId = req.session.userId;
    const tasks = await Task.find({ user: userId });

    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const weekStart = startOfDay();
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    const weekEnd = endOfDay(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000));

    const summary = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((task) => task.completed).length,
      pendingTasks: tasks.filter((task) => !task.completed).length,
      dueToday: tasks.filter(
        (task) => task.dueDate && task.dueDate >= todayStart && task.dueDate <= todayEnd
      ).length,
      dueThisWeek: tasks.filter(
        (task) => task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd
      ).length,
      overdue: tasks.filter((task) => task.dueDate && task.dueDate < todayStart && !task.completed).length,
      streak: computeStreak(tasks),
    };

    const dailyBreakdown = {};
    tasks.forEach((task) => {
      const dateKey = startOfDay(task.dueDate || task.createdAt).toISOString().slice(0, 10);
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = { created: 0, completed: 0 };
      }
      dailyBreakdown[dateKey].created += 1;
      if (task.completed) {
        const completedKey = startOfDay(task.updatedAt).toISOString().slice(0, 10);
        if (!dailyBreakdown[completedKey]) {
          dailyBreakdown[completedKey] = { created: 0, completed: 0 };
        }
        dailyBreakdown[completedKey].completed += 1;
      }
    });

    res.json({ summary, dailyBreakdown });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load summary', error: error.message });
  }
};
