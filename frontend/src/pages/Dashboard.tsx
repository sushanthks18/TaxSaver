import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiService } from '../services/api';
import type { User, PortfolioSummary, TaxSummary } from '../types';
import { PortfolioPieChart, TaxBarChart, PnLLineChart } from '../components/DashboardCharts';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [portfolioRes, taxRes] = await Promise.all([
        apiService.getPortfolioSummary(),
        apiService.calculateTax(),
      ]);
      setSummary(portfolioRes.data.summary);
      setTaxSummary(taxRes.data.taxSummary);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownloadReport = async () => {
    try {
      const response = await apiService.generatePDFReport(taxSummary?.financialYear || '2025-26');
      console.log('Report response:', response);
      
      if (response.success && response.downloadUrl) {
        // Download using fetch with auth token
        const token = localStorage.getItem('token');
        const downloadUrl = `http://localhost:5001${response.downloadUrl}`;
        
        const downloadResponse = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (downloadResponse.ok) {
          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tax-report-${taxSummary?.financialYear || '2025-26'}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          alert('Failed to download report');
        }
      } else if (response.data?.success && response.data?.downloadUrl) {
        // Handle nested data response
        const token = localStorage.getItem('token');
        const downloadUrl = `http://localhost:5001${response.data.downloadUrl}`;
        
        const downloadResponse = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (downloadResponse.ok) {
          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tax-report-${taxSummary?.financialYear || '2025-26'}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          alert('Failed to download report');
        }
      } else {
        console.error('No download URL in response:', response);
        alert('Report generated but download URL not found. Check console.');
      }
    } catch (error: any) {
      console.error('Failed to generate report', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to generate PDF report';
      alert(`Error: ${errorMsg}`);
    }
  };

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex justify-center items-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="px-4 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Welcome back, {user.firstName || 'Investor'}! 👋
        </h1>

        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-1">
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Value</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {formatCurrency(summary?.totalValue || 0)}
                  </dd>
                </div>
                <div className="text-3xl">💼</div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-1">
                  <dt className="text-sm font-medium text-gray-500 truncate">Invested</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {formatCurrency(summary?.totalInvested || 0)}
                  </dd>
                </div>
                <div className="text-3xl">💰</div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-1">
                  <dt className="text-sm font-medium text-gray-500 truncate">P&L</dt>
                  <dd
                    className={`mt-1 text-2xl font-semibold ${
                      (summary?.totalProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(summary?.totalProfitLoss || 0)}
                  </dd>
                  <dd
                    className={`text-sm ${
                      (summary?.totalProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {summary?.totalProfitLossPercentage?.toFixed(2)}%
                  </dd>
                </div>
                <div className="text-3xl">
                  {(summary?.totalProfitLoss || 0) >= 0 ? '📈' : '📉'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-1">
                  <dt className="text-sm font-medium text-gray-500 truncate">Holdings</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {summary?.totalHoldings || 0}
                  </dd>
                  <dd className="text-sm text-gray-500">
                    {summary?.stocksCount || 0} Stocks, {summary?.cryptoCount || 0} Crypto
                  </dd>
                </div>
                <div className="text-3xl">📊</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Summary */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Tax Summary - FY {taxSummary?.financialYear}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Gains</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Short-term Gains:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(taxSummary?.totalShortTermGains || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Long-term Gains:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(taxSummary?.totalLongTermGains || 0)}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Losses</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Short-term Losses:</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(taxSummary?.totalShortTermLosses || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Long-term Losses:</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(taxSummary?.totalLongTermLosses || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-900">Tax Liability:</span>
              <span className="text-2xl font-bold text-indigo-600">
                {formatCurrency(taxSummary?.totalTaxWithSurchargeAndCess || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/portfolio"
              className="flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              View Portfolio
            </a>
            <a
              href="/recommendations"
              className="flex items-center justify-center px-4 py-3 border border-indigo-600 text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50"
            >
              Tax Recommendations
            </a>
            <a
              href="/tax-calculator"
              className="flex items-center justify-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Calculate Tax
            </a>
            <button
              onClick={handleDownloadReport}
              className="flex items-center justify-center px-4 py-3 border border-green-600 text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              📄 Download PDF Report
            </button>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PortfolioPieChart 
            stockValue={(summary?.totalValue || 0) * ((summary?.stocksCount || 0) / (summary?.totalHoldings || 1))}
            cryptoValue={(summary?.totalValue || 0) * ((summary?.cryptoCount || 0) / (summary?.totalHoldings || 1))}
          />
          <TaxBarChart 
            stcgTax={(taxSummary?.totalShortTermGains || 0) * 0.15}
            ltcgTax={Math.max(0, (taxSummary?.totalLongTermGains || 0) - 100000) * 0.10}
          />
        </div>
        
        <div className="mb-8">
          <PnLLineChart history={[
            { date: 'Day 1', value: (summary?.totalValue || 0) * 0.95 },
            { date: 'Day 7', value: (summary?.totalValue || 0) * 0.97 },
            { date: 'Day 14', value: (summary?.totalValue || 0) * 0.98 },
            { date: 'Day 21', value: (summary?.totalValue || 0) * 0.99 },
            { date: 'Day 30', value: summary?.totalValue || 0 },
          ]} />
        </div>

        {/* Disclaimer */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Disclaimer:</strong> This is an educational tool. Not financial or tax advice.
            Consult a Chartered Accountant before making investment decisions.
          </p>
        </div>
      </div>
    </Layout>
  );
}
