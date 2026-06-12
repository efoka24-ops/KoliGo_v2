import axios from 'axios';

const BASE = 'http://localhost:3001';

const api = axios.create({ baseURL: BASE, timeout: 15_000 });

api.interceptors.request.use((cfg) => {
  const tok = localStorage.getItem('kg_admin_token');
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kg_admin_token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;

export const adminApi = {
  login:           (phone, pin)  => api.post('/auth/signin', { phone, pin }).then(r => r.data),
  stats:           ()            => api.get('/admin/stats').then(r => r.data),
  users:           (params)      => api.get('/admin/users', { params }).then(r => r.data),
  getUser:         (id)          => api.get(`/admin/users/${id}`).then(r => r.data),
  blockUser:       (id, blocked) => api.patch(`/admin/users/${id}/block`, { blocked }).then(r => r.data),
  reviewKyc:       (id, status, reason) => api.patch(`/admin/users/${id}/kyc`, { status, reason }).then(r => r.data),
  kycDocUrl:       (docId)       => `${BASE}/admin/kyc-doc/${docId}`,
  deliveries:      (params)      => api.get('/admin/deliveries', { params }).then(r => r.data),
  cancelDelivery:  (id)          => api.patch(`/admin/deliveries/${id}/cancel`).then(r => r.data),
  finance:         ()            => api.get('/admin/finance').then(r => r.data),
  payWithdrawal:   (id)          => api.patch(`/admin/withdrawals/${id}/pay`).then(r => r.data),
  settings:        ()            => api.get('/admin/settings').then(r => r.data),
  updateSetting:   (key, value)  => api.patch('/admin/settings', { key, value }).then(r => r.data),

  // Issues / Support
  issues:              (params)           => api.get('/admin/issues', { params }).then(r => r.data),
  resolveIssue:        (id, status)       => api.patch(`/admin/issues/${id}/resolve`, { status }).then(r => r.data),

  // Packages
  packages:            (params)           => api.get('/admin/packages', { params }).then(r => r.data),
  getPackage:          (id)               => api.get(`/admin/packages/${id}`).then(r => r.data),

  // Wallets
  wallets:             (params)           => api.get('/admin/wallets', { params }).then(r => r.data),

  // Security events
  securityEvents:      (params)           => api.get('/admin/security-events', { params }).then(r => r.data),

  // User creation
  createUser:          (data)             => api.post('/admin/users/create', data).then(r => r.data),

  // Archive & Reset
  archiveAndReset:     (label)            => api.post('/admin/archive', { label }).then(r => r.data),
  listArchives:        ()                 => api.get('/admin/archives').then(r => r.data),
  restoreArchive:      (id)               => api.post(`/admin/archives/${id}/restore`).then(r => r.data),
  exportDb:            ()                 => api.get('/admin/export', { responseType: 'blob' }).then(r => r.data),
  wipeTotal:           (label)            => api.post('/admin/wipe-total', { label }).then(r => r.data),

  // Cities & Neighborhoods
  cities:              ()                     => api.get('/admin/cities?withCount=true').then(r => r.data),
  createCity:          (name, region)         => api.post('/admin/cities', { name, region }).then(r => r.data),
  updateCity:          (id, data)             => api.patch(`/admin/cities/${id}`, data).then(r => r.data),
  deleteCity:          (id)                   => api.delete(`/admin/cities/${id}`).then(r => r.data),
  neighborhoods:       (cityId)               => api.get(`/admin/cities/${cityId}/neighborhoods`).then(r => r.data),
  createNeighborhood:  (cityId, name)         => api.post(`/admin/cities/${cityId}/neighborhoods`, { name }).then(r => r.data),
  updateNeighborhood:  (id, data)             => api.patch(`/admin/neighborhoods/${id}`, data).then(r => r.data),
  deleteNeighborhood:  (id)                   => api.delete(`/admin/neighborhoods/${id}`).then(r => r.data),
};
