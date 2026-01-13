const priceService = require('./dist/services/price.service').default;
const db = require('./dist/database').db;

async function updatePrices() {
  try {
    console.log('🔄 Fetching live prices from Yahoo Finance...');
    
    // Get all holdings
    const result = await db.query('SELECT DISTINCT asset_symbol, asset_type FROM holdings');
    console.log(`Found ${result.rows.length} unique assets to update`);
    
    for (const holding of result.rows) {
      try {
        let price;
        if (holding.asset_type === 'stock') {
          price = await priceService.getStockPrice(holding.asset_symbol);
        } else if (holding.asset_type === 'crypto') {
          price = await priceService.getCryptoPrice(holding.asset_symbol);
        }
        
        if (price) {
          await db.query(
            'UPDATE holdings SET current_price = $1, updated_at = NOW() WHERE asset_symbol = $2',
            [price, holding.asset_symbol]
          );
          console.log(`✅ ${holding.asset_symbol}: ₹${price}`);
        }
      } catch (err) {
        console.log(`❌ ${holding.asset_symbol}: ${err.message}`);
      }
    }
    
    console.log('✅ Price update complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updatePrices();
