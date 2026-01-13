import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import { API_URL } from '../config/constants';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/auth/logout');
    localStorage.removeItem('token');
    return response.data;
  }

  // Portfolio
  async getHoldings() {
    const response = await this.client.get('/portfolio/holdings');
    return response.data;
  }

  async getPortfolioSummary() {
    const response = await this.client.get('/portfolio/summary');
    return response.data;
  }

  async createHolding(data: any) {
    const response = await this.client.post('/portfolio/holdings', data);
    return response.data;
  }

  async updateHolding(holdingId: string, data: any) {
    const response = await this.client.put(`/portfolio/holdings/${holdingId}`, data);
    return response.data;
  }

  async deleteHolding(holdingId: string) {
    const response = await this.client.delete(`/portfolio/holdings/${holdingId}`);
    return response.data;
  }

  async uploadCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post('/portfolio/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Tax
  async calculateTax(financialYear?: string) {
    const response = await this.client.get('/tax/calculate', {
      params: { year: financialYear },
    });
    return response.data;
  }

  async getCurrentFinancialYear() {
    const response = await this.client.get('/tax/current-year');
    return response.data;
  }

  async getRecommendations(status?: string) {
    const response = await this.client.get('/tax/recommendations', {
      params: { status },
    });
    return response.data;
  }

  async generateRecommendations(financialYear?: string) {
    const response = await this.client.post('/tax/recommendations/generate', {
      financialYear,
    });
    return response.data;
  }

  async updateRecommendationStatus(recommendationId: string, status: 'accepted' | 'rejected') {
    const response = await this.client.patch(`/tax/recommendations/${recommendationId}`, {
      status,
    });
    return response.data;
  }

  async generateReport(financialYear: string, reportType: string) {
    const response = await this.client.post('/tax/reports', {
      financialYear,
      reportType,
    });
    return response.data;
  }

  // User Settings
  async updateUserSettings(data: any) {
    const response = await this.client.put('/user/settings', data);
    return response.data;
  }

  // Prices
  async refreshPrices() {
    const response = await this.client.get('/prices/refresh');
    return response.data;
  }

  // Reports
  async generatePDFReport(financialYear: string) {
    const response = await this.client.post('/reports/generate', {
      financialYear,
      format: 'pdf'
    });
    return response.data;
  }

  // Transactions
  async getTransactions(filters?: any) {
    const response = await this.client.get('/transactions', { params: filters });
    return response.data;
  }

  async executeRecommendation(recommendationId: string) {
    const response = await this.client.post(`/transactions/execute-recommendation/${recommendationId}`);
    return response.data;
  }

  // Insights & Analytics
  async getInsights(financialYear: string) {
    const response = await this.client.get(`/insights?year=${financialYear}`);
    return response.data;
  }

  async getTopPerformers() {
    const response = await this.client.get('/insights/performers');
    return response.data;
  }

  async getCarryForward(financialYear: string) {
    const response = await this.client.get(`/insights/carry-forward?year=${financialYear}`);
    return response.data;
  }

  // Notifications
  async getNotifications() {
    const response = await this.client.get('/notifications');
    return response.data;
  }

  async markNotificationRead(notificationId: string) {
    const response = await this.client.patch(`/notifications/${notificationId}/read`);
    return response.data;
  }
}

export const apiService = new ApiService();
