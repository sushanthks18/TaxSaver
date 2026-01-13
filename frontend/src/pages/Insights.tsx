import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiService } from '../services/api';
import FinancialYearSelector from '../components/FinancialYearSelector';
import type { User } from '../types';

interface InsightsProps {
  user: User;
}

export default function Insights({ user }: InsightsProps) {
  const [insights, setInsights] = useState<any[]>([]);
  const [performers, setPerformers] = useState<any>({ best: [], worst: [] });
  const [carryForward, setCarryForward] = useState<any>(null);
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, [financialYear]);

  const loadInsights = async () => {
    try {
      const [insightsRes, performersRes, cfRes] = await Promise.all([
        apiService.getInsights(financialYear),
        apiService.getTopPerformers(),
        apiService.getCarryForward(financialYear)
      ]);
      
      setInsights(insightsRes.data.insights || []);
      setPerformers(performersRes.data);
      setCarryForward(cfRes.data);
    } catch (error) {
      console.error('Failed to load insights', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '💡';
      default: return 'ℹ️';
    }
  };

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex justify-center items-center h-64">
          <div className="text-xl text-gray-600">Loading insights...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="px-4 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Insights</h1>
          <FinancialYearSelector selectedYear={financialYear} onChange={setFinancialYear} />
        </div>

        {/* Carry Forward Section */}
        {carryForward && (carryForward.totalSTCarryForward > 0 || carryForward.totalLTCarryForward > 0) && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-indigo-900 mb-4">💼 Carry Forward Losses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-indigo-600">Short-Term Losses</p>
                <p className="text-2xl font-bold text-indigo-900">
                  ₹{carryForward.totalSTCarryForward.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-indigo-600 mt-1">Can offset ST and LT gains</p>
              </div>
              <div>
                <p className="text-sm text-indigo-600">Long-Term Losses</p>
                <p className="text-2xl font-bold text-indigo-900">
                  ₹{carryForward.totalLTCarryForward.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-indigo-600 mt-1">Can offset LT gains only</p>
              </div>
            </div>
          </div>
        )}

        {/* Insights Cards */}
        <div className="space-y-4 mb-8">
          {insights.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
              No insights available. Add holdings to get personalized recommendations.
            </div>
          ) : (
            insights.map((insight, index) => (
              <div
                key={index}
                className={`border rounded-lg p-6 ${getPriorityColor(insight.priority)}`}
              >
                <div className="flex items-start">
                  <span className="text-2xl mr-3">{getPriorityIcon(insight.priority)}</span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{insight.title}</h3>
                    <p className="text-sm mb-2">{insight.message}</p>
                    <p className="text-sm font-medium">→ {insight.action}</p>
                    {insight.value && (
                      <p className="text-xs mt-2 opacity-75">
                        Value: ₹{insight.value.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best Performers */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-900 mb-4">🏆 Best Performers</h2>
            <div className="space-y-3">
              {performers.best.map((holding: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 bg-green-50 rounded">
                  <div>
                    <p className="font-semibold">{holding.asset_symbol}</p>
                    <p className="text-xs text-gray-600 capitalize">{holding.asset_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">+{parseFloat(holding.return_percent).toFixed(2)}%</p>
                    <p className="text-xs text-gray-600">
                      ₹{parseFloat(holding.profit_loss).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
              {performers.best.length === 0 && (
                <p className="text-center text-gray-500 py-4">No data available</p>
              )}
            </div>
          </div>

          {/* Worst Performers */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-4">📉 Worst Performers</h2>
            <div className="space-y-3">
              {performers.worst.map((holding: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded">
                  <div>
                    <p className="font-semibold">{holding.asset_symbol}</p>
                    <p className="text-xs text-gray-600 capitalize">{holding.asset_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{parseFloat(holding.return_percent).toFixed(2)}%</p>
                    <p className="text-xs text-gray-600">
                      ₹{parseFloat(holding.profit_loss).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
              {performers.worst.length === 0 && (
                <p className="text-center text-gray-500 py-4">No data available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
