const fs = require('fs');
const path = require('path');
const pool = require('./db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema applied.');
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
