export interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  panNumber?: string;
  taxRegime?: 'old' | 'new';
  isEmailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Holding {
  holdingId: string;
  userId: string;
  assetType: 'stock' | 'crypto';
  assetSymbol: string;
  assetName?: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice?: number;
  purchaseDate: string;
  platform?: string;
  exchange?: string;
  profitLoss?: number;
  profitLossPercentage?: number;
  holdingPeriodDays?: number;
  isShortTerm?: boolean;
  createdAt: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  totalHoldings: number;
  stocksCount: number;
  cryptoCount: number;
  gainersCount: number;
  losersCount: number;
}

export interface TaxSummary {
  userId: string;
  financialYear: string;
  totalShortTermGains: number;
  totalLongTermGains: number;
  totalShortTermLosses: number;
  totalLongTermLosses: number;
  netShortTermGains: number;
  netLongTermGains: number;
  totalTaxLiability: number;
  totalTaxWithSurchargeAndCess: number;
}

export interface TaxRecommendation {
  recommendationId: string;
  userId: string;
  holdingId: string;
  assetSymbol: string;
  recommendationType: 'harvest_loss' | 'defer_gain' | 'sell_partial';
  currentPrice: number;
  purchasePrice: number;
  quantity: number;
  potentialLoss: number;
  taxSavings: number;
  priorityScore: number;
  deadline: string;
  notes: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
  };
  message?: string;
}
