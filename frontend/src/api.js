import axios from 'axios';

// Ahora baseURL es relativa porque Vite se encarga del proxy
const api = axios.create({
  baseURL: '/api',
  withCredentials: true 
});

export const fetchCsrfToken = async () => {
  const { data } = await api.get('/auth/csrf');
  api.defaults.headers.common['X-CSRF-Token'] = data.csrfToken;
};

export default api;