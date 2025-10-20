import { Router } from 'express';
import {
  listTasks,
  createTask,
  updateTask,
  toggleTaskCompletion,
  deleteTask,
} from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', listTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/toggle', toggleTaskCompletion);
router.delete('/:id', deleteTask);

export default router;
