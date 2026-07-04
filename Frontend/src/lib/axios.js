import axios from 'axios';

// Auth rides on httpOnly cookies (withCredentials), never on JS-visible storage.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Endpoints where a 401 is an expected outcome, not an expired session.
const AUTH_PATHS = ['/users/login', '/users/register', '/users/refresh'];
const isAuthPath = (url = '') => AUTH_PATHS.some((p) => url.includes(p));

// Single-flight refresh: many requests can 401 at once; only refresh once and
// let the rest wait on that same promise.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // On a 401 for a normal request, try one silent refresh + retry.
    // We do NOT hard-redirect here: route protection (PrivateRoute) decides where an
    // unauthenticated user goes, so this interceptor is safe to run on public pages too.
    if (status === 401 && original && !original._retry && !isAuthPath(original.url)) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || api.post('/users/refresh');
        await refreshPromise;
        return api(original); // retry with the new cookie
      } catch {
        // fall through — the original 401 propagates to the caller
      } finally {
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
