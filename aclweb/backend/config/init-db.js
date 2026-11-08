const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/acl_agro_farm'
});

async function initDb() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('Database schema initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
