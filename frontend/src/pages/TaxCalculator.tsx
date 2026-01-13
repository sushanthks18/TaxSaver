import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiService } from '../services/api';
import type { User, TaxSummary } from '../types';

interface TaxCalculatorProps {
  user: User;
}

export default function TaxCalculator({ user }: TaxCalculatorProps) {
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState('');

  useEffect(() => {
    loadCurrentYear();
  }, []);

  const loadCurrentYear = async () => {
    try {
      const response = await apiService.getCurrentFinancialYear();
      setFinancialYear(response.data.financialYear);
      calculateTax(response.data.financialYear);
    } catch (error) {
      console.error('Failed to load financial year', error);
      setLoading(false);
    }
  };

  const calculateTax = async (year?: string) => {
    setLoading(true);
    try {
      const response = await apiService.calculateTax(year || financialYear);
      setTaxSummary(response.data.taxSummary);
    } catch (error) {
      console.error('Failed to calculate tax', error);
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

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex justify-center items-center h-64">
          <div className="text-xl text-gray-600">Calculating taxes...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="px-4 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tax Calculator</h1>
          <div className="text-lg font-medium text-gray-700">
            FY {taxSummary?.financialYear}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-green-500">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Gains</dt>
              <dd className="mt-1 text-2xl font-semibold text-green-600">
                {formatCurrency(
                  (taxSummary?.totalShortTermGains || 0) + (taxSummary?.totalLongTermGains || 0)
                )}
              </dd>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-red-500">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Losses</dt>
              <dd className="mt-1 text-2xl font-semibold text-red-600">
                {formatCurrency(
                  (taxSummary?.totalShortTermLosses || 0) + (taxSummary?.totalLongTermLosses || 0)
                )}
              </dd>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Net Taxable Gains</dt>
              <dd className="mt-1 text-2xl font-semibold text-blue-600">
                {formatCurrency(
                  (taxSummary?.netShortTermGains || 0) + (taxSummary?.netLongTermGains || 0)
                )}
              </dd>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-indigo-500">
            <div className="p-5">
              <dt className="text-sm font-medium text-gray-500 truncate">Tax Liability</dt>
              <dd className="mt-1 text-2xl font-semibold text-indigo-600">
                {formatCurrency(taxSummary?.totalTaxWithSurchargeAndCess || 0)}
              </dd>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
          {/* Short-term */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Short-term Capital Gains</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Gains:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(taxSummary?.totalShortTermGains || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Losses:</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(taxSummary?.totalShortTermLosses || 0)}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-900 font-medium">Net Gains:</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(taxSummary?.netShortTermGains || 0)}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600 mb-1">Tax Rate: 15% (Equity) / 30% (Crypto)</div>
                <div className="text-sm text-gray-500">
                  Holding period: Less than 12 months (stocks) or 36 months (other assets)
                </div>
              </div>
            </div>
          </div>

          {/* Long-term */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Long-term Capital Gains</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Gains:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(taxSummary?.totalLongTermGains || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Losses:</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(taxSummary?.totalLongTermLosses || 0)}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-900 font-medium">Net Gains:</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(taxSummary?.netLongTermGains || 0)}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600 mb-1">Tax Rate: 10% (Equity, above ₹1L) / 20% (Crypto)</div>
                <div className="text-sm text-gray-500">
                  Holding period: More than 12 months (stocks) or 36 months (other assets)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Calculation Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tax Calculation Breakdown</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Base Tax on Capital Gains:</span>
              <span className="font-medium">
                {formatCurrency(taxSummary?.totalTaxLiability || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>+ Surcharge (if applicable):</span>
              <span>
                {formatCurrency(
                  (taxSummary?.totalTaxWithSurchargeAndCess || 0) - (taxSummary?.totalTaxLiability || 0) > 0
                    ? ((taxSummary?.totalTaxWithSurchargeAndCess || 0) - (taxSummary?.totalTaxLiability || 0)) * 0.96
                    : 0
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>+ Cess (4%):</span>
              <span>
                {formatCurrency(
                  (taxSummary?.totalTaxWithSurchargeAndCess || 0) - (taxSummary?.totalTaxLiability || 0) > 0
                    ? ((taxSummary?.totalTaxWithSurchargeAndCess || 0) - (taxSummary?.totalTaxLiability || 0)) * 0.04
                    : (taxSummary?.totalTaxLiability || 0) * 0.04
                )}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-300">
              <span className="text-lg font-bold text-gray-900">Total Tax Liability:</span>
              <span className="text-2xl font-bold text-indigo-600">
                {formatCurrency(taxSummary?.totalTaxWithSurchargeAndCess || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Check the Recommendations page to see how you can reduce your tax liability through strategic tax loss harvesting!
          </p>
        </div>
      </div>
    </Layout>
  );
}
