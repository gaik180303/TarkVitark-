import { Router } from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetail,
  updateUserAvatar,
  getUserChannelProfile,
  getPastParticipatedDebates,
  getHostedDebateRooms
} from '../controllers/user.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { multerUploads } from '../middlewares/multer.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { loginLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateAccountSchema
} from '../validators/user.validators.js';

const router = Router();

// Public routes — multer parses multipart fields before validation runs
router.post('/register', loginLimiter, multerUploads, validate(registerSchema), registerUser);
router.post('/login', loginLimiter, validate(loginSchema), loginUser);
router.post('/refresh', refreshAccessToken);

// Protected routes
router.use(verifyJWT);
router.post('/logout', logoutUser);
router.post('/change-password', validate(changePasswordSchema), changeCurrentPassword);
router.get('/current', getCurrentUser);
router.patch('/update', validate(updateAccountSchema), updateAccountDetail);
router.patch('/avatar', multerUploads, updateUserAvatar);
router.get('/profile/:username', getUserChannelProfile);
router.get('/participated', getPastParticipatedDebates);
router.get('/hosted', getHostedDebateRooms);

export default router;
