const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '******localhost:5432/acl_agro_farm'
});

async function seedBranches() {
  const seedPath = path.join(__dirname, '..', '..', 'database', 'seed-branches.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');

  try {
    await pool.query(sql);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE branch_code BETWEEN 'ACL01' AND 'ACL20')::int AS seeded,
        COUNT(*) FILTER (WHERE is_published = TRUE)::int AS published
       FROM branches`
    );
    console.log(`Branch seed complete: ${result.rows[0].seeded} ACL draft records, ${result.rows[0].published} published records.`);
  } catch (error) {
    console.error('Failed to seed branches:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedBranches();
