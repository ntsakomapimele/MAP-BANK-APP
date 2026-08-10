import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Update to match your Django port

const ACCESS_KEY = 'map_bank_access';
const REFRESH_KEY = 'map_bank_refresh';

// IMPORTANT: sessionStorage (not localStorage) on purpose.
// localStorage is shared across every tab/window for this origin, so logging
// into a second account in another window would silently overwrite the first
// window's tokens and both windows would end up acting as the same user.
// sessionStorage is scoped per browser tab/window, so each one keeps its own
// independent login - exactly what's needed to test two accounts side by side.
// (Trade-off: logging in again is required after a full browser restart, and
// duplicating a tab via Ctrl+T can inherit the same session - opening a brand
// new window does not.)
export const tokenStore = {
  getAccess: () => sessionStorage.getItem(ACCESS_KEY),
  getRefresh: () => sessionStorage.getItem(REFRESH_KEY),
  setTokens: (access, refresh) => {
    if (access) sessionStorage.setItem(ACCESS_KEY, access);
    if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the access token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On a 401, try exactly once to refresh the access token and replay the
// original request. If that fails, fully log the user out.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthEndpoint =
      original?.url?.includes('/auth/login/') ||
      original?.url?.includes('/auth/register/') ||
      original?.url?.includes('/auth/refresh/');

    if (status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const refresh = tokenStore.getRefresh();
      if (!refresh) {
        tokenStore.clear();
        return Promise.reject(error);
      }
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_BASE_URL}/auth/refresh/`, { refresh })
            .then((res) => res.data)
            .finally(() => {
              refreshPromise = null;
            });
        }
        const data = await refreshPromise;
        tokenStore.setTokens(data.access, data.refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (refreshErr) {
        tokenStore.clear();
        window.dispatchEvent(new Event('map-bank-logout'));
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

// ---- Auth ----
export const registerUser = (payload) => api.post('/auth/register/', payload);
export const verifyRegistrationOtp = (payload) => api.post('/auth/verify-registration/', payload);
export const loginUser = (username, password) => api.post('/auth/login/', { username, password });
export const logoutUser = (refresh) => api.post('/auth/logout/', { refresh });
export const getMe = () => api.get('/auth/me/');

// ---- Accounts ----
export const getAccounts = () => api.get('/accounts/');
export const createAccount = (accountType) => api.post('/accounts/', { account_type: accountType });
export const getAccount = (id) => api.get(`/accounts/${id}/`);
export const deposit = (id, amount) => api.post(`/accounts/${id}/deposit/`, { amount });
export const withdraw = (id, amount) => api.post(`/accounts/${id}/withdraw/`, { amount });
export const transfer = (id, toAccountNumber, amount) =>
  api.post(`/accounts/${id}/transfer/`, { to_account_number: toAccountNumber, amount });
export const getAccountTransactions = (id, page = 1) =>
  api.get(`/accounts/${id}/transactions/`, { params: { page } });

// ---- Transactions (combined, all accounts) ----
export const getAllTransactions = (page = 1) => api.get('/transactions/', { params: { page } });

export default api;
