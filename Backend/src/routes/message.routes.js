import { Router } from 'express';
import { getMessagesForDebate } from '../controllers/message.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyJWT);

// Chat history for a debate room (real-time messages go over the socket)
router.get('/:debateId', getMessagesForDebate);

export default router;
