import axios from 'axios';

// En production le back-office est servi par le meme hote que l'API (/admin/) : adresse relative.
// En developpement (vite, port 5174) l'API locale tourne sur 3001.
const BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001';

const api = axios.create({ baseURL: BASE, timeout: 15_000 });

api.interceptors.request.use((cfg) => {
  // L'hebergeur rejette PUT/PATCH/DELETE avant PHP : on envoie POST + X-HTTP-Method-Override.
  const verb = (cfg.method || 'get').toUpperCase();
  if (['PUT', 'PATCH', 'DELETE'].includes(verb)) {
    cfg.headers['X-HTTP-Method-Override'] = verb;
    cfg.method = 'post';
  }
  const tok = localStorage.getItem('kg_admin_token');
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kg_admin_token');
      window.location.href = '/admin/';
    }
    return Promise.reject(err);
  }
);

export default api;

export const adminApi = {
  login:           (phone, pin)  => api.post('/auth/signin', { phone, pin }).then(r => r.data),
  loginEmail:      (email, pin)  => api.post('/auth/signin', { email, pin }).then(r => r.data),
  adminEmailStart: (email, reset) => api.post('/auth/admin/email/start', { email, reset }).then(r => r.data),
  adminEmailVerify: (email, code) => api.post('/auth/admin/email/verify', { email, code }).then(r => r.data),
  adminEmailSetPassword: (setupToken, password) => api.post('/auth/admin/email/set-password', { setupToken, password }).then(r => r.data),
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
  startTestPayment: (phone, amount) => api.post('/admin/test-payment', { phone, amount }).then(r => r.data),
  testPaymentStatus: (id)        => api.get(`/admin/test-payment/${id}`).then(r => r.data),
  pricing:         ()            => api.get('/admin/pricing').then(r => r.data),
  updatePricing:   (payload)     => api.patch('/admin/pricing', payload).then(r => r.data),
  cgu:             ()            => api.get('/admin/cgu').then(r => r.data),
  publishCgu:      (fr, en)      => api.post('/admin/cgu', { fr, en }).then(r => r.data),
  siteContent:     ()            => api.get('/admin/site-content').then(r => r.data),
  updateSiteContent: (payload)   => api.patch('/admin/site-content', payload).then(r => r.data),

  // Issues / Support
  issues:              (params)           => api.get('/admin/issues', { params }).then(r => r.data),
  resolveIssue:        (id, status)       => api.patch(`/admin/issues/${id}/resolve`, { status }).then(r => r.data),

  // Packages
  packages:            (params)           => api.get('/admin/packages', { params }).then(r => r.data),
  getPackage:          (id)               => api.get(`/admin/packages/${id}`).then(r => r.data),

  // Factures (vente / paiement / livraison)
  invoices:            (params)           => api.get('/admin/invoices', { params }).then(r => r.data),
  invoice:             (id, type)         => api.get(`/admin/invoices/${id}/${type}`).then(r => r.data),

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
