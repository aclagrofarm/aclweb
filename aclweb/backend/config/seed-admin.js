const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/acl_agro_farm'
});

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const email = process.env.ADMIN_EMAIL || 'admin@aclagrofarm.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123';

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      const passwordHash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, existing.rows[0].id]);
      console.log(`Admin password updated: ${username} / ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (username, email, password_hash, role, full_name, is_active) VALUES ($1, $2, $3, $4, $5, true)',
      [username, email, passwordHash, 'super_admin', 'Administrator']
    );

    console.log(`Admin account created: ${username} / ${email}`);
  } catch (error) {
    console.error('Failed to create admin user:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();
