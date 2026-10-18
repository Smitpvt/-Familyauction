import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || '';
const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  timeout: 20000
});

// Attach Authorization header if JWT token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hfpl_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Global response handler to catch 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't auto-clear if checking /me
      if (!error.config.url.includes('/auth/me')) {
        localStorage.removeItem('hfpl_admin_token');
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me')
};

export const auctionAPI = {
  getState: () => api.get('/auction/state'),
  setRound: (roundId) => api.post('/auction/set-round', { roundId }),
  setPlayer: (playerId) => api.post('/auction/set-player', { playerId }),
  startBidding: () => api.post('/auction/start-bidding'),
  placeBid: (data) => api.post('/auction/bid', data),
  sellPlayer: (data) => api.post('/auction/sell', data),
  markUnsold: () => api.post('/auction/unsold'),
  togglePause: () => api.post('/auction/pause'),
  nextPlayer: () => api.post('/auction/next-player'),
  prevPlayer: () => api.post('/auction/prev-player'),
  undoSale: (playerId) => api.post('/auction/undo-sale', { playerId }),
  setIncrement: (increment) => api.post('/auction/set-increment', { increment })
};

export const teamsAPI = {
  getAll: () => api.get('/teams'),
  getById: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post('/teams', data),
  update: (id, data) => api.put(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`)
};

export const playersAPI = {
  getAll: (params) => api.get('/players', { params }),
  getById: (id) => api.get(`/players/${id}`),
  create: (data) => api.post('/players', data),
  update: (id, data) => api.put(`/players/${id}`, data),
  delete: (id) => api.delete(`/players/${id}`),
  reauction: (id) => api.post(`/players/${id}/re-auction`),
  bulkImport: (players) => api.post('/players/bulk-import', { players })
};

export const roundsAPI = {
  getAll: () => api.get('/rounds'),
  create: (data) => api.post('/rounds', data),
  update: (id, data) => api.put(`/rounds/${id}`, data),
  delete: (id) => api.delete(`/rounds/${id}`)
};

export const resultsAPI = {
  getSummary: () => api.get('/results/summary'),
  getExportUrl: () => `${API_BASE_URL}/api/results/export-csv`
};

export const uploadAPI = {
  uploadImage: (formData) => api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export default api;
