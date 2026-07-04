import { Router } from 'express';
import debateRouter from './debate.routes.js';
import messageRouter from './message.routes.js';
import userRouter from './user.routes.js';
import paymentRouter from './payment.routes.js';

const router = Router();

router.use('/debates', debateRouter);
router.use('/messages', messageRouter);
router.use('/users', userRouter);
router.use('/payments', paymentRouter);

export default router;
