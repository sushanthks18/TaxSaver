import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import TaxCalculator from './pages/TaxCalculator';
import Recommendations from './pages/Recommendations';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import Insights from './pages/Insights';
import Toast from './components/Toast';
import { apiService } from './services/api';
import type { User } from './types/index';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      apiService
        .getCurrentUser()
        .then((response) => {
          setUser(response.data.user);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Toast />
      <Router>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" /> : <Login setUser={setUser} />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/dashboard" /> : <Register setUser={setUser} />}
          />
          <Route
            path="/dashboard"
            element={user ? <Dashboard user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/portfolio"
            element={user ? <Portfolio user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/tax-calculator"
            element={user ? <TaxCalculator user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/recommendations"
            element={user ? <Recommendations user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/transactions"
            element={user ? <Transactions user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/settings"
            element={user ? <Settings user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/insights"
            element={user ? <Insights user={user} /> : <Navigate to="/login" />}
          />
          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
