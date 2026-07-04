import api from '../lib/axios';

const userService = {
  // Current user's stance for a debate room
  getDebateStance: async (roomId) => {
    const response = await api.get(`/debates/${roomId}/registration`);
    return response.data.data.stance;
  },

  // Login — auth is set via httpOnly cookies by the server; returns the user object
  login: async (email, password) => {
    const response = await api.post('/users/login', { email, password });
    return response.data.data.user;
  },

  // Register — multipart because of the optional profile picture
  register: async (userData) => {
    const formData = new FormData();
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) formData.append(key, value);
    });

    const response = await api.post('/users/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  },

  logout: async () => {
    const response = await api.post('/users/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/current');
    return response.data.data;
  },

  updateProfile: async (userData) => {
    const response = await api.patch('/users/update', userData);
    return response.data.data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const response = await api.post('/users/change-password', {
      oldPassword,
      newPassword
    });
    return response.data;
  }
};

export default userService;
