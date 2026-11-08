const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const rootDir = path.join(__dirname, '..', '..');
const blogSource = fs.readFileSync(path.join(rootDir, 'js', 'blog-data.js'), 'utf8');
const blogWindow = {};
vm.runInNewContext(blogSource, { window: blogWindow }, { filename: 'blog-data.js' });

const blogPosts = blogWindow.blogPlan.map((article) => {
  const category = blogWindow.blogCategories.find((item) => item.id === article.category);
  return {
    slug: `planned-article-${String(article.id).padStart(3, '0')}`,
    titleEn: `${category?.label || 'Agriculture'} Guide ${String(article.id).padStart(3, '0')}`,
    titleNp: article.title,
    category: category?.label || 'Agriculture',
    featuredImage: category?.image || 'assets/images/logo3.png'
  };
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/acl_agro_farm'
});

async function seedBlog() {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const existing = await client.query('SELECT COUNT(*)::int AS total FROM blog_posts');
    if (existing.rows[0].total > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      console.log(`Blog seed skipped; ${existing.rows[0].total} blog records already exist.`);
      return;
    }

    for (const post of blogPosts) {
      const blogCode = `ACL-BLOG-${String(blogPosts.indexOf(post) + 1).padStart(4, '0')}`;
      await client.query(
        `INSERT INTO blog_posts (blog_code, slug, title_en, title_np, category, featured_image, status)
         VALUES ($1,$2,$3,$4,$5,$6,'draft')`,
        [blogCode, post.slug, post.titleEn, post.titleNp, post.category, post.featuredImage]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log(`Seeded ${blogPosts.length} draft blog topics for editing.`);
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to seed blog topics:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedBlog();
