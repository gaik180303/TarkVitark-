import { Router } from 'express';
import {
    getActiveDebates,
    getUpcomingDebates,
    registerForDebate,
    getRegistrationForDebate,
    getDebateDetails,
    createDebate,
    getHostedDebates,
    getParticipatedDebates,
} from '../controllers/discussion.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createDebateSchema, registerForDebateSchema } from '../validators/debate.validators.js';
import { castVote, getVoteSummary } from '../controllers/vote.controller.js';
import { castVoteSchema } from '../validators/vote.validators.js';

const router = Router();

// Public routes
router.get('/active', getActiveDebates);
router.get('/upcoming', getUpcomingDebates);

// Protected routes — specific paths MUST be declared before '/:id',
// otherwise Express matches them as a debate id.
router.use(verifyJWT);
router.post('/register', validate(registerForDebateSchema), registerForDebate);
router.post('/create', validate(createDebateSchema), createDebate);
router.get('/hosted', getHostedDebates);
router.get('/participated', getParticipatedDebates);
router.get('/:id/registration', getRegistrationForDebate);
router.post('/:id/votes', validate(castVoteSchema), castVote);
router.get('/:id/votes/summary', getVoteSummary);
router.get('/:id', getDebateDetails);

export default router;
