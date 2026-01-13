import priceService from './src/services/price.service';
import { db } from './src/database';

async function updateLivePrices() {
  try {
    console.log('🔄 Fetching LIVE prices from Yahoo Finance & CoinGecko...\n');
    
    const result = await db.query('SELECT DISTINCT asset_symbol, asset_type FROM holdings');
    console.log(`Found ${result.rows.length} assets\n`);
    
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
          console.log(`✅ ${holding.asset_symbol}: ₹${price.toFixed(2)}`);
        }
      } catch (err: any) {
        console.log(`❌ ${holding.asset_symbol}: ${err.message}`);
      }
    }
    
    console.log('\n✅ Live prices updated! Refresh your browser.');
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateLivePrices();
