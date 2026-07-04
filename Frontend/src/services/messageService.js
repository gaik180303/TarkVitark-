import api from '../lib/axios';

const messageService = {
  // Chat history for a debate room (real-time messages arrive over the socket)
  getMessages: async (debateId) => {
    const response = await api.get(`/messages/${debateId}`);
    return response.data.data;
  },
};

export default messageService;
