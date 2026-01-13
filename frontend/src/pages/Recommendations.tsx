import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiService } from '../services/api';
import type { User, TaxRecommendation } from '../types';

interface RecommendationsProps {
  user: User;
}

export default function Recommendations({ user }: RecommendationsProps) {
  const [recommendations, setRecommendations] = useState<TaxRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      const response = await apiService.getRecommendations();
      setRecommendations(response.data.recommendations);
    } catch (error) {
      console.error('Failed to load recommendations', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await apiService.generateRecommendations();
      setRecommendations(response.data.recommendations);
      alert(`Generated ${response.data.recommendations.length} recommendations!`);
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to generate recommendations');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (recommendationId: string) => {
    try {
      await apiService.updateRecommendationStatus(recommendationId, 'accepted');
      alert('Recommendation accepted!');
      loadRecommendations();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleReject = async (recommendationId: string) => {
    try {
      await apiService.updateRecommendationStatus(recommendationId, 'rejected');
      alert('Recommendation rejected!');
      loadRecommendations();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPriorityColor = (score: number) => {
    if (score >= 7) return 'bg-red-100 text-red-800';
    if (score >= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tax Saving Recommendations</h1>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate New Recommendations'}
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Recommendations Yet</h3>
            <p className="text-gray-500 mb-6">
              Generate recommendations to see tax-saving opportunities based on your portfolio.
            </p>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Generate Recommendations
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.recommendationId}
                className="bg-white shadow rounded-lg p-6 border-l-4 border-indigo-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{rec.assetSymbol}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getPriorityColor(
                          rec.priorityScore
                        )}`}
                      >
                        Priority: {rec.priorityScore}/10
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          rec.status === 'pending'
                            ? 'bg-blue-100 text-blue-800'
                            : rec.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rec.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-4">{rec.notes}</p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-500">Current Price</div>
                        <div className="text-lg font-medium">{formatCurrency(rec.currentPrice)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Purchase Price</div>
                        <div className="text-lg font-medium">{formatCurrency(rec.purchasePrice)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Quantity</div>
                        <div className="text-lg font-medium">{rec.quantity}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Deadline</div>
                        <div className="text-lg font-medium">
                          {new Date(rec.deadline).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-600">Potential Loss to Harvest</div>
                          <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(rec.potentialLoss)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Estimated Tax Savings</div>
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(rec.taxSavings)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {rec.status === 'pending' && (
                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      onClick={() => handleReject(rec.recommendationId)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleAccept(rec.recommendationId)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Accept Recommendation
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Important:</strong> These are suggestions only. Consult with a Chartered Accountant before executing any tax loss harvesting strategy.
          </p>
        </div>
      </div>
    </Layout>
  );
}
