require('dotenv').config();
const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings (avoids timezone shifting).
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('[db] idle client error', err));

module.exports = pool;
