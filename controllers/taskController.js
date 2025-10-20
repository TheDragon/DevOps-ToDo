import Task from '../models/Task.js';

const getDateRange = (filter) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (filter === 'today') {
    return { start, end };
  }

  if (filter === 'thisWeek') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { start: startOfWeek, end: endOfWeek };
  }

  return {};
};

const buildQuery = ({ userId, filter, search, tags }) => {
  const query = { user: userId };

  if (filter && filter !== 'all') {
    const range = getDateRange(filter);
    if (range.start && range.end) {
      query.dueDate = { $gte: range.start, $lte: range.end };
    }
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } },
    ];
  }

  if (tags && tags.length) {
    query.tags = { $all: tags };
  }

  return query;
};

const buildSort = (sortKey) => {
  switch (sortKey) {
    case 'dueDate':
      return { dueDate: 1 };
    case 'priority':
      return { priority: 1 };
    case 'status':
      return { completed: 1, dueDate: 1 };
    default:
      return { createdAt: -1 };
  }
};

export const listTasks = async (req, res) => {
  try {
    const { filter = 'all', search = '', sort = 'created', tags } = req.query;
    const tagArray = typeof tags === 'string' ? tags.split(',').filter(Boolean) : [];

    const tasks = await Task.find(
      buildQuery({
        userId: req.session.userId,
        filter,
        search,
        tags: tagArray,
      })
    ).sort(buildSort(sort));

    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, notes, dueDate, priority, tags = [], reminderMinutesBefore } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const task = await Task.create({
      user: req.session.userId,
      title,
      notes,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority: priority || 'medium',
      tags,
      reminderMinutesBefore,
    });

    res.status(201).json({ task });
  } catch (error) {
    res.status(400).json({ message: 'Failed to create task', error: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }

    const task = await Task.findOneAndUpdate(
      { _id: id, user: req.session.userId },
      updates,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update task', error: error.message });
  }
};

export const toggleTaskCompletion = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ _id: id, user: req.session.userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    task.completed = !task.completed;
    await task.save();
    res.json({ task });
  } catch (error) {
    res.status(400).json({ message: 'Failed to toggle task', error: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOneAndDelete({ _id: id, user: req.session.userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Failed to delete task', error: error.message });
  }
};
