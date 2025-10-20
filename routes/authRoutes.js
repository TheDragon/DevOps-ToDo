import { Router } from 'express';
import {
  beginRegistration,
  completeRegistration,
  beginAuthentication,
  completeAuthentication,
  getProfile,
  logout,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register/begin', beginRegistration);
router.post('/register/complete', completeRegistration);
router.post('/login/begin', beginAuthentication);
router.post('/login/complete', completeAuthentication);
router.get('/profile', requireAuth, getProfile);
router.post('/logout', requireAuth, logout);

export default router;
