import axios from 'axios';

// Auth rides on httpOnly cookies (withCredentials), never on JS-visible storage.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isAuthAttempt = requestUrl.includes('/users/login') || requestUrl.includes('/users/register');

    // Session expired mid-app: send the user to login. Never redirect for a failed
    // login/register attempt (the form shows the error) or when already on /login.
    if (status === 401 && !isAuthAttempt && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
