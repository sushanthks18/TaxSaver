import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiService } from '../services/api';
import type { User, Holding } from '../types';

interface PortfolioProps {
  user: User;
}

export default function Portfolio({ user }: PortfolioProps) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    assetType: 'stock',
    assetSymbol: '',
    assetName: '',
    quantity: '',
    averageBuyPrice: '',
    currentPrice: '',
    purchaseDate: '',
    platform: '',
  });

  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    try {
      const response = await apiService.getHoldings();
      setHoldings(response.data.holdings);
    } catch (error) {
      console.error('Failed to load holdings', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await apiService.uploadCSV(file);
      alert('CSV uploaded successfully!');
      loadHoldings();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createHolding(formData);
      alert('Holding added successfully!');
      setShowAddForm(false);
      setFormData({
        assetType: 'stock',
        assetSymbol: '',
        assetName: '',
        quantity: '',
        averageBuyPrice: '',
        currentPrice: '',
        purchaseDate: '',
        platform: '',
      });
      loadHoldings();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to add holding');
    }
  };

  const handleDelete = async (holdingId: string) => {
    if (!confirm('Are you sure you want to delete this holding?')) return;
    
    try {
      await apiService.deleteHolding(holdingId);
      alert('Holding deleted successfully!');
      loadHoldings();
    } catch (error) {
      alert('Failed to delete holding');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
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
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Holdings</h1>
          <div className="flex space-x-3">
            <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <span>{uploading ? 'Uploading...' : 'Upload CSV'}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCSVUpload}
                disabled={uploading}
              />
            </label>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Add Holding
            </button>
          </div>
        </div>

        {/* Add Holding Form */}
        {showAddForm && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Add New Holding</h2>
            <form onSubmit={handleAddHolding} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.assetType}
                  onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                >
                  <option value="stock">Stock</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.assetSymbol}
                  onChange={(e) => setFormData({ ...formData, assetSymbol: e.target.value })}
                  placeholder="e.g., RELIANCE, BTC"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.assetName}
                  onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buy Price</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.averageBuyPrice}
                  onChange={(e) => setFormData({ ...formData, averageBuyPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Price</label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.currentPrice}
                  onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  placeholder="Zerodha, WazirX, etc."
                />
              </div>
              <div className="col-span-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add Holding
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Holdings Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Buy Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Term</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                    No holdings yet. Add your first holding or upload a CSV file.
                  </td>
                </tr>
              ) : (
                holdings.map((holding) => (
                  <tr key={holding.holdingId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{holding.assetSymbol}</div>
                      <div className="text-sm text-gray-500">{holding.assetName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        holding.assetType === 'stock' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {holding.assetType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">{holding.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {formatCurrency(holding.averageBuyPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {formatCurrency(holding.currentPrice || holding.averageBuyPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-medium ${
                        (holding.profitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(holding.profitLoss || 0)}
                      </div>
                      <div className={`text-xs ${
                        (holding.profitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {holding.profitLossPercentage?.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs rounded ${
                        holding.isShortTerm 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {holding.isShortTerm ? 'ST' : 'LT'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(holding.holdingId)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
