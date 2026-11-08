const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/acl_agro_farm'
});

const projects = [
  {
    slug: 'integrated-agriculture-modern-farming', titleEn: 'Integrated Agriculture & Modern Farming', titleNp: 'एकीकृत कृषि, पशुपालन तथा आधुनिक खेती परियोजना', category: 'Integrated Agriculture', location: 'Nepal',
    summaryEn: 'A proposed integrated agriculture enterprise connecting livestock, soilless cultivation, fodder production and farm management.',
    contentEn: '- Combines agriculture, livestock and modern farming systems\n- Proposed minimum land area: 5 kattha\n- Includes buffalo, goat, duck, soilless farming and fodder production\n- Initial investment estimates require feasibility study and a written agreement.',
    imageUrl: 'assets/images/s1.png', sortOrder: 1, featured: true
  },
  {
    slug: 'livestock-development', titleEn: 'Livestock Development', titleNp: 'भैँसी, बाख्रा तथा हाँसपालन विकास', category: 'Livestock', location: 'Nepal',
    summaryEn: 'A livestock development plan based on clean housing, balanced feed, animal health and production records.',
    contentEn: '- Initial plan: 5 buffalo, 20 goats and 50 ducks\n- Focus on animal health, hygiene and biosecurity\n- Production and income depend on breed, health, market prices and operating costs.',
    imageUrl: 'assets/images/s3.png', sortOrder: 2, featured: false
  },
  {
    slug: 'cold-storage-market-network', titleEn: 'Cold Storage & Market Network', titleNp: 'शीत भण्डार तथा कृषि बजार सञ्जाल', category: 'Market Infrastructure', location: 'Nepal',
    summaryEn: 'A proposed storage and collection network to preserve product quality and improve market access.',
    contentEn: '- Protects produce quality and reduces post-harvest loss\n- Supports collection, grading, storage and distribution\n- Serves local markets and potential new market connections.',
    imageUrl: 'assets/images/s4.png', sortOrder: 3, featured: false
  },
  {
    slug: 'fodder-production-project', titleEn: 'Fodder Production', titleNp: 'घाँस तथा पशु आहार उत्पादन', category: 'Animal Nutrition', location: 'Nepal',
    summaryEn: 'A supporting project focused on fodder selection, reliable supply, storage and responsible use of farm residues.',
    contentEn: '- Selects suitable fodder crops for the local area\n- Plans production, irrigation and storage\n- Supports livestock feed cost management.',
    imageUrl: 'assets/images/a1.png', sortOrder: 4, featured: false
  },
  {
    slug: 'agricultural-infrastructure-development', titleEn: 'Agricultural Infrastructure & Development', titleNp: 'कृषि पूर्वाधार तथा विकास', category: 'Farm Infrastructure', location: 'Nepal',
    summaryEn: 'A phased plan for farm setup, livestock housing, water, irrigation, storage and waste management.',
    contentEn: '- Begins with land, market and technical feasibility\n- Plans housing, production areas and storage\n- Requires local permits and compliance with environmental standards.',
    imageUrl: 'assets/images/a2.png', sortOrder: 5, featured: false
  },
  {
    slug: 'modern-greenhouse-initiative', titleEn: 'Modern Greenhouse Initiative', titleNp: 'आधुनिक ग्रीनहाउस तथा संरक्षित खेती', category: 'Protected Farming', location: 'Gulmi, Nepal',
    summaryEn: 'A greenhouse project exploring quality crop production, efficient water use and practical protected-farming technology.',
    contentEn: '- Grows vegetables and other locally suitable crops\n- Uses protected environments and smart irrigation\n- Expansion depends on technical assessment and market demand.',
    imageUrl: 'assets/images/s2.png', sortOrder: 6, featured: false
  }
];

async function seedProjects() {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const existing = await client.query('SELECT COUNT(*)::int AS total FROM projects');
    if (existing.rows[0].total > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      console.log(`Project seed skipped; ${existing.rows[0].total} project records already exist.`);
      return;
    }

    for (const project of projects) {
      await client.query(
        `INSERT INTO projects (slug, title_en, title_np, category, summary_en, content_en, location, sort_order, status, featured, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'published',$9,$10)`,
        [project.slug, project.titleEn, project.titleNp, project.category, project.summaryEn, project.contentEn, project.location, project.sortOrder, project.featured, project.imageUrl]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log(`Seeded ${projects.length} published project records.`);
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to seed projects:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedProjects();
