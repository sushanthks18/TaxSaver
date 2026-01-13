import { useState, useEffect } from 'react';

interface FinancialYearSelectorProps {
  selectedYear: string;
  onChange: (year: string) => void;
}

export default function FinancialYearSelector({ selectedYear, onChange }: FinancialYearSelectorProps) {
  const [years, setYears] = useState<string[]>([]);

  useEffect(() => {
    // Generate FY years from 2020 to current + 1
    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const startYear = month >= 3 ? currentYear : currentYear - 1; // FY starts April
    
    const fyYears = [];
    for (let i = 0; i <= 5; i++) {
      const year = startYear - i;
      fyYears.push(`${year}-${String(year + 1).slice(2)}`);
    }
    setYears(fyYears);
  }, []);

  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">Financial Year:</label>
      <select
        value={selectedYear}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            FY {year}
          </option>
        ))}
      </select>
    </div>
  );
}
