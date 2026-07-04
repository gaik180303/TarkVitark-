import api from '../lib/axios';

const debateService = {
  // Get list of active debates
  getActiveDebates: async () => {
    const response = await api.get('/debates/active');
    return response.data.data;
  },

  // Get list of upcoming debates
  getUpcomingDebates: async () => {
    const response = await api.get('/debates/upcoming');
    return response.data.data;
  },

  // Get details for a specific debate
  getDebateDetails: async (debateId) => {
    const response = await api.get(`/debates/${debateId}`);
    return response.data.data;
  },

  // Register for a debate (used by both ActiveDiscussion and FutureEvents)
  registerForDebate: async (debateId, stance, agreedToRules) => {
    if (!debateId) throw new Error('Debate ID is required');
    if (!stance) throw new Error('Stance is required');
    if (!agreedToRules) throw new Error('You must agree to the rules');

    const response = await api.post('/debates/register', {
      debateId,
      stance,
      agreedToRules
    });
    return response.data;
  },

  // Create (host) a new debate — the server sets the authenticated user as host
  createDebate: async ({ title, description, scheduledAt }) => {
    const response = await api.post('/debates/create', { title, description, scheduledAt });
    return response.data.data;
  },

  // Get debates hosted by the current user
  getHostedDebates: async () => {
    const response = await api.get('/debates/hosted');
    return response.data.data;
  },

  // Get debates the current user has participated in
  getParticipatedDebates: async () => {
    const response = await api.get('/debates/participated');
    return response.data.data;
  },
};

export default debateService;
