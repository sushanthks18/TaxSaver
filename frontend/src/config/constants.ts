export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'TaxSaver';

export const TAX_RATES = {
  EQUITY_SHORT_TERM: 15,
  EQUITY_LONG_TERM: 10,
  CRYPTO_SHORT_TERM: 30,
  CRYPTO_LONG_TERM: 20,
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PORTFOLIO: '/portfolio',
  TAX_CALCULATOR: '/tax-calculator',
  RECOMMENDATIONS: '/recommendations',
  REPORTS: '/reports',
  PROFILE: '/profile',
};
