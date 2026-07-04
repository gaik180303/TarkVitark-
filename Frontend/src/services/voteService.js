import api from '../lib/axios';

const voteService = {
  // Cast (or change) a pre/post vote for a debate
  castVote: async (debateId, phase, stance) => {
    const response = await api.post(`/debates/${debateId}/votes`, { phase, stance });
    return response.data.data;
  },

  // { summary: {pre,post}, verdict, myVote: {pre, post} }
  getSummary: async (debateId) => {
    const response = await api.get(`/debates/${debateId}/votes/summary`);
    return response.data.data;
  },
};

export default voteService;
