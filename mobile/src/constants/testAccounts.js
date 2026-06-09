export const TEST_ACCOUNTS = {
  vendor: {
    phone: '6 55 11 12 22',
    name: 'Marie Ngono',
    avatar: 'MN',
    role: 'vendor',
    store: 'KameTrend Boutique',
    zone: 'Bonapriso',
    momoProvider: 'orange',
    momoNumber: '6 55 11 12 22',
    isTest: true,
  },
  deliverer: {
    phone: '6 77 23 45 67',
    name: 'Hervé Nkouamba',
    avatar: 'HN',
    role: 'deliverer',
    zone: 'Akwa · Bonapriso',
    vehicle: 'Moto · LT-892-DA',
    momoProvider: 'mtn',
    momoNumber: '6 77 23 45 67',
    isTest: true,
  },
};

// OTP universel pour les comptes de test
export const TEST_OTP = '0000';

// Comptes back-office admin
export const ADMIN_ACCOUNTS = [
  { login: 'admin@koligo.cm',   password: 'admin1234', name: 'Admin KoliGo',  avatar: 'AD', role: 'super_admin' },
  { login: '+237600000001',      password: 'admin1234', name: 'Admin KoliGo',  avatar: 'AD', role: 'super_admin' },
  { login: 'support@koligo.cm', password: 'support123', name: 'Support KoliGo', avatar: 'SK', role: 'support' },
];

// Magic link client de test
export const TEST_CLIENT = {
  orderId: 'KG-2841',
  clientName: 'Aïcha Mballa',
  vendorName: 'Maman Cécile',
  parcelDesc: 'Robe wax + foulard · 1,5 kg',
  codeReception: '4827',
};
