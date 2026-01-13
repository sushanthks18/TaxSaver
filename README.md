# TaxSaver - Tax Loss Harvesting Platform

> **Optimize your tax liability through intelligent portfolio analysis for Indian investors**

## 🎯 Overview

TaxSaver helps Indian investors save taxes through strategic tax loss harvesting for both crypto and stock portfolios. The platform analyzes holdings, identifies opportunities, and generates actionable recommendations with automated tax reports.

## ✨ Features

### Phase 1 (MVP)
- ✅ Secure user authentication with JWT
- ✅ Manual CSV portfolio upload
- ✅ Real-time portfolio analysis with P&L
- ✅ Indian tax law calculations (STCG/LTCG)
- ✅ Tax loss harvesting recommendations
- ✅ Downloadable tax reports (PDF/Excel)

### Phase 2 (Coming Soon)
- 🔄 Exchange API integrations (Zerodha, WazirX, CoinDCX)
- 🔄 Real-time price updates
- 🔄 Email alerts and notifications
- 🔄 Advanced tax scenarios

## 🛠️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts for visualizations
- React Hook Form + Zod validation

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL database
- JWT authentication
- Redis for caching

**External APIs:**
- CoinGecko (crypto prices)
- Yahoo Finance (stock prices)
- Exchange APIs (Zerodha, WazirX, etc.)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
```bash
git clone <repo-url>
cd TaxSaver
```

2. **Install dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Set up environment variables**
```bash
# Backend (.env)
cp backend/.env.example backend/.env
# Configure: DATABASE_URL, JWT_SECRET, etc.

# Frontend (.env)
cp frontend/.env.example frontend/.env
# Configure: VITE_API_URL
```

4. **Initialize database**
```bash
cd backend
npm run db:migrate
npm run db:seed
```

5. **Start development servers**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173` to access the application.

## 📊 Database Schema

See [backend/src/database/schema.sql](backend/src/database/schema.sql) for complete schema.

**Core Tables:**
- `users` - User accounts and profiles
- `api_credentials` - Encrypted exchange API keys
- `holdings` - Current portfolio holdings
- `transactions` - Historical buy/sell transactions
- `tax_reports` - Generated tax reports

## 🔐 Security

- All passwords hashed with bcrypt
- API keys encrypted at rest
- JWT tokens with expiration
- HTTPS only in production
- CORS configured properly
- Input validation on all endpoints

## ⚖️ Legal Disclaimer

**This is an educational tool and does not constitute financial or tax advice.**

Users should consult with a qualified Chartered Accountant before making any investment or tax decisions. Tax laws are subject to change, and calculations may not reflect the latest regulations.

## 📝 License

Private - All rights reserved

## 🤝 Contributing

This is a private project. Contact the maintainer for collaboration opportunities.

## 📧 Support

For issues or questions, please contact: [Your Email]
