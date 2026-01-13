import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';

interface PortfolioChartProps {
  stockValue: number;
  cryptoValue: number;
}

interface TaxChartProps {
  stcgTax: number;
  ltcgTax: number;
}

interface PnLHistory {
  date: string;
  value: number;
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

export function PortfolioPieChart({ stockValue, cryptoValue }: PortfolioChartProps) {
  const data = [
    { name: 'Stocks', value: stockValue },
    { name: 'Crypto', value: cryptoValue },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Portfolio Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any) => `₹${(value || 0).toLocaleString('en-IN')}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaxBarChart({ stcgTax, ltcgTax }: TaxChartProps) {
  const data = [
    { name: 'Short-Term Tax', value: stcgTax, fill: '#EF4444' },
    { name: 'Long-Term Tax', value: ltcgTax, fill: '#10B981' },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Tax Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value: any) => `₹${(value || 0).toLocaleString('en-IN')}`} />
          <Bar dataKey="value" fill="#4F46E5">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PnLLineChart({ history }: { history: PnLHistory[] }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Portfolio Performance (Last 30 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value: any) => `₹${(value || 0).toLocaleString('en-IN')}`} />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#4F46E5" strokeWidth={2} name="Portfolio Value" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
