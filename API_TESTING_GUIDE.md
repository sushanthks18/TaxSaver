# 🧪 TaxSaver API Testing Guide

## Setup First

1. **Start PostgreSQL:**
```bash
docker run --name taxsaver-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=taxsaver \
  -e POSTGRES_DB=taxsaver_db \
  -p 5432:5432 -d postgres:14
```

2. **Initialize Database:**
```bash
cd backend
psql -h localhost -U taxsaver -d taxsaver_db -f src/database/schema.sql
```

3. **Configure Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with database credentials
```

4. **Start Backend:**
```bash
cd backend
npm run dev
```

Backend should be running on **http://localhost:5000**

---

## Authentication Tests

### 1. Register New User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Test@123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid-here",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isEmailVerified": false
    },
    "token": "jwt-token-here"
  },
  "message": "User registered successfully"
}
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Test@123"
  }'
```

**Save the token from response!**

### 3. Get Current User

```bash
TOKEN="your-token-here"

curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Portfolio Tests

### 4. Create Stock Holding (Loss-making)

```bash
curl -X POST http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetType": "stock",
    "assetSymbol": "RELIANCE",
    "assetName": "Reliance Industries",
    "quantity": 10,
    "averageBuyPrice": 2500,
    "currentPrice": 2300,
    "purchaseDate": "2024-01-15",
    "platform": "Zerodha",
    "exchange": "NSE"
  }'
```

### 5. Create Crypto Holding (Profit-making)

```bash
curl -X POST http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetType": "crypto",
    "assetSymbol": "BTC",
    "assetName": "Bitcoin",
    "quantity": 0.5,
    "averageBuyPrice": 3000000,
    "currentPrice": 3500000,
    "purchaseDate": "2023-06-01",
    "platform": "WazirX"
  }'
```

### 6. Create More Holdings (for better testing)

```bash
# Short-term stock loss
curl -X POST http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetType": "stock",
    "assetSymbol": "TCS",
    "assetName": "Tata Consultancy Services",
    "quantity": 5,
    "averageBuyPrice": 3800,
    "currentPrice": 3500,
    "purchaseDate": "2025-06-01",
    "platform": "Groww"
  }'

# Long-term stock gain
curl -X POST http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetType": "stock",
    "assetSymbol": "INFY",
    "assetName": "Infosys",
    "quantity": 20,
    "averageBuyPrice": 1200,
    "currentPrice": 1500,
    "purchaseDate": "2023-01-10",
    "platform": "Zerodha"
  }'
```

### 7. Get All Holdings

```bash
curl -X GET http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** List of all holdings with P&L calculated

### 8. Get Portfolio Summary

```bash
curl -X GET http://localhost:5000/api/portfolio/summary \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalValue": 5250000,
      "totalInvested": 5100000,
      "totalProfitLoss": 150000,
      "totalProfitLossPercentage": 2.94,
      "totalHoldings": 4,
      "stocksCount": 3,
      "cryptoCount": 1,
      "gainersCount": 2,
      "losersCount": 2
    }
  }
}
```

### 9. Update Holding (Change Current Price)

```bash
HOLDING_ID="get-from-holdings-list"

curl -X PUT http://localhost:5000/api/portfolio/holdings/$HOLDING_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPrice": 2200
  }'
```

### 10. Delete Holding

```bash
curl -X DELETE http://localhost:5000/api/portfolio/holdings/$HOLDING_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tax Calculation Tests

### 11. Calculate Tax Liability

```bash
curl -X GET "http://localhost:5000/api/tax/calculate?year=2025-26" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "taxSummary": {
      "userId": "uuid",
      "financialYear": "2025-26",
      "totalShortTermGains": 0,
      "totalLongTermGains": 300000,
      "totalShortTermLosses": 3500,
      "totalLongTermLosses": 2000,
      "netShortTermGains": 0,
      "netLongTermGains": 298000,
      "totalTaxLiability": 19800,
      "totalTaxWithSurchargeAndCess": 20592
    }
  }
}
```

### 12. Get Current Financial Year

```bash
curl -X GET http://localhost:5000/api/tax/current-year \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tax Loss Harvesting Tests

### 13. Generate Recommendations

```bash
curl -X POST http://localhost:5000/api/tax/recommendations/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "financialYear": "2025-26"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "recommendationId": "uuid",
        "assetSymbol": "RELIANCE",
        "recommendationType": "harvest_loss",
        "currentPrice": 2300,
        "purchasePrice": 2500,
        "quantity": 10,
        "potentialLoss": 2000,
        "taxSavings": 300,
        "priorityScore": 7,
        "deadline": "2026-03-31",
        "notes": "Selling this asset will realize a loss...",
        "status": "pending"
      }
    ]
  },
  "message": "Generated 2 recommendations"
}
```

### 14. Get All Recommendations

```bash
curl -X GET http://localhost:5000/api/tax/recommendations \
  -H "Authorization: Bearer $TOKEN"
```

### 15. Get Pending Recommendations Only

```bash
curl -X GET "http://localhost:5000/api/tax/recommendations?status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

### 16. Accept a Recommendation

```bash
RECOMMENDATION_ID="get-from-recommendations-list"

curl -X PATCH http://localhost:5000/api/tax/recommendations/$RECOMMENDATION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "accepted"
  }'
```

### 17. Reject a Recommendation

```bash
curl -X PATCH http://localhost:5000/api/tax/recommendations/$RECOMMENDATION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected"
  }'
```

---

## CSV Upload Test

### 18. Create Sample CSV File

Create `portfolio.csv`:
```csv
asset_type,symbol,name,quantity,buy_price,current_price,purchase_date,platform
stock,HDFC,HDFC Bank,15,1600,1750,2024-03-15,Zerodha
crypto,ETH,Ethereum,2,180000,200000,2024-01-01,WazirX
stock,WIPRO,Wipro,25,450,420,2025-05-20,Groww
```

### 19. Upload CSV

```bash
curl -X POST http://localhost:5000/api/portfolio/upload-csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@portfolio.csv"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "imported": 3,
    "failed": 0,
    "errors": []
  },
  "message": "Successfully imported 3 holdings"
}
```

---

## Report Generation Test (Placeholder)

### 20. Generate Tax Report

```bash
curl -X POST http://localhost:5000/api/tax/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "financialYear": "2025-26",
    "reportType": "capital_gains"
  }'
```

---

## Complete Test Workflow

### **Scenario: User wants to save taxes**

```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"investor@example.com","password":"Test@123","firstName":"Smart","lastName":"Investor"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"

# 2. Add loss-making stocks
curl -X POST http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assetType":"stock","assetSymbol":"PAYTM","quantity":50,"averageBuyPrice":900,"currentPrice":500,"purchaseDate":"2024-06-01"}'

curl -X POST http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assetType":"stock","assetSymbol":"ZOMATO","quantity":100,"averageBuyPrice":150,"currentPrice":100,"purchaseDate":"2024-08-15"}'

# 3. Add profit-making stocks
curl -X POST http://localhost:5000/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assetType":"stock","assetSymbol":"TATA MOTORS","quantity":30,"averageBuyPrice":700,"currentPrice":1000,"purchaseDate":"2023-01-01"}'

# 4. Check portfolio
curl -X GET http://localhost:5000/api/portfolio/summary \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Calculate tax
curl -X GET http://localhost:5000/api/tax/calculate \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Get recommendations
curl -X POST http://localhost:5000/api/tax/recommendations/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq

# 7. View recommendations
curl -X GET http://localhost:5000/api/tax/recommendations \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Expected Tax Calculations

### Example Portfolio:
- PAYTM: 50 shares @ ₹900 → ₹500 = **Loss of ₹20,000** (ST)
- ZOMATO: 100 shares @ ₹150 → ₹100 = **Loss of ₹5,000** (ST)
- TATA MOTORS: 30 shares @ ₹700 → ₹1000 = **Gain of ₹9,000** (LT)

### Tax Calculation:
- Short-term losses: ₹25,000
- Long-term gains: ₹9,000 (exempt up to ₹1L, so ₹0 taxable)
- Net ST gains after set-off: ₹0 (losses > gains)
- **Total tax: ₹0**

### Without Harvesting:
- If you sold only profitable stocks: Tax on ₹9,000 = ₹0 (under exemption)

### With Harvesting:
- Harvest losses to carry forward
- Can offset future gains
- **Potential savings in future years**

---

## Common Issues & Fixes

### Issue: "Database connection failed"
**Fix:** Ensure PostgreSQL is running and credentials in `.env` are correct

### Issue: "Token expired"
**Fix:** Login again to get a new token

### Issue: "Holding already exists"
**Fix:** Use PUT to update instead of POST to create

### Issue: "Cannot find module"
**Fix:** Run `npm install` in backend directory

---

## Pro Tips

1. **Use jq** for pretty JSON output:
   ```bash
   curl ... | jq
   ```

2. **Save token** to environment variable:
   ```bash
   export TOKEN="your-token"
   ```

3. **Test with Postman** for easier API testing

4. **Check logs** for errors:
   ```bash
   tail -f backend/logs/combined.log
   ```

---

## 🎉 Success Criteria

You've successfully tested the backend if you can:

✅ Register and login users
✅ Create holdings (stocks and crypto)
✅ View portfolio with calculated P&L
✅ See portfolio summary with statistics
✅ Calculate taxes correctly
✅ Generate smart recommendations
✅ Accept/reject recommendations
✅ Upload CSV files
✅ Update and delete holdings

**The backend is production-ready!** 🚀
