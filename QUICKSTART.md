# TaxSaver - Quick Start Guide

## 🚀 Getting Started (15 minutes)

### Step 1: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies (we'll create this next)
cd ../frontend
npm install
```

### Step 2: Setup PostgreSQL Database

**Option A: Using Docker (Recommended)**
```bash
docker run --name taxsaver-postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_USER=taxsaver \
  -e POSTGRES_DB=taxsaver_db \
  -p 5432:5432 \
  -d postgres:14
```

**Option B: Local PostgreSQL Installation**
1. Install PostgreSQL 14+ from https://www.postgresql.org/download/
2. Create database:
```bash
createdb taxsaver_db
```

### Step 3: Initialize Database Schema

```bash
cd backend
psql -d taxsaver_db -f src/database/schema.sql
```

### Step 4: Configure Environment Variables

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env file with your database credentials
```

### Step 5: Start Development Servers

```bash
# From root directory
npm run dev
```

This will start:
- **Backend API**: http://localhost:5000
- **Frontend**: http://localhost:5173

## 📋 What's Included

### Phase 1 (MVP) - Current
✅ Project structure setup
✅ Database schema
✅ Authentication system
✅ User registration & login
✅ CSV portfolio upload
✅ Portfolio analysis with P&L
✅ Tax calculations (Indian tax law)
✅ Tax loss harvesting recommendations
✅ PDF/Excel report generation

### Coming Next
- API integrations (Zerodha, WazirX, etc.)
- Real-time price updates
- Email notifications
- Advanced visualizations

## 🔧 Useful Commands

```bash
# Backend
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run tests
npm run db:migrate   # Run database migrations
npm run lint         # Lint code

# Frontend
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run tests
```

## 📁 Project Structure

```
TaxSaver/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── database/        # Database connection & schema
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Route controllers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Data models
│   │   ├── utils/           # Utility functions
│   │   └── server.ts        # Entry point
│   ├── tests/               # Tests
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/      # React components
    │   ├── pages/           # Page components
    │   ├── hooks/           # Custom hooks
    │   ├── services/        # API services
    │   ├── utils/           # Utilities
    │   ├── types/           # TypeScript types
    │   └── App.tsx          # Main app
    └── package.json
```

## 🧪 Testing the API

Once running, test with:

```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123","firstName":"John","lastName":"Doe"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123"}'
```

## ⚠️ Important Notes

1. **Security**: Change all default passwords and secrets in production
2. **Database**: Backup your database regularly
3. **API Keys**: Never commit `.env` files to version control
4. **Testing**: Always test tax calculations with a CA before relying on them

## 🆘 Troubleshooting

**Database connection failed:**
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Ensure database exists: `psql -l`

**Port already in use:**
- Change PORT in `.env`
- Or kill process: `lsof -ti:5000 | xargs kill`

**Module not found errors:**
- Run `npm install` in both backend and frontend directories

## 📚 Next Steps

1. Create a test account
2. Upload a sample CSV portfolio
3. Review the dashboard
4. Generate a tax report
5. Explore tax-saving recommendations

For detailed documentation, see the main README.md file.
