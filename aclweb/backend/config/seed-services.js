const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/acl_agro_farm'
});

const services = [
  {
    slug: 'smart-farming-hydroponics', category: 'SMART FARMING', titleEn: 'Smart Farming & Hydroponics',
    summaryEn: 'Greenhouse setup, soilless cultivation and efficient irrigation for high-value crops.',
    contentEn: '- Greenhouse, polyhouse and net-house setup support\n- Hydroponic and aeroponic cultivation\n- Drip irrigation and automated watering\n- Modern vegetable and high-value crop planning\nStart with technical consultation and a small demonstration farm.',
    imageUrl: 'assets/images/q1.jpg', sortOrder: 1
  },
  {
    slug: 'modern-livestock-farming', category: 'LIVESTOCK', titleEn: 'Modern Livestock Farming',
    summaryEn: 'Farm planning and practical support for healthy, productive livestock systems.',
    contentEn: '- Buffalo, cattle, goat, poultry and duck project planning\n- Modern housing, hygiene and biosecurity systems\n- Feed management and production records\n- Veterinary coordination, health and vaccination planning',
    imageUrl: 'assets/images/q2.jpg', sortOrder: 2
  },
  {
    slug: 'farm-consultancy-planning', category: 'CONSULTANCY', titleEn: 'Farm Consultancy & Planning',
    summaryEn: 'Practical farm assessment, layout, business planning and feasibility support.',
    contentEn: '- Land and soil suitability assessment\n- Farm layout and business planning\n- Crop selection, production cost and market feasibility\n- Project budget and risk analysis',
    imageUrl: 'assets/images/q3.jpg', sortOrder: 3
  },
  {
    slug: 'smart-irrigation-water-management', category: 'WATER MANAGEMENT', titleEn: 'Smart Irrigation & Water Management',
    summaryEn: 'Efficient irrigation systems and water planning matched to local farm conditions.',
    contentEn: '- Drip and sprinkler irrigation\n- Timer and sensor-based irrigation\n- Water collection and efficient-use planning\n- Fertigation and nutrient management\nTechnology selection depends on local water, land and budget conditions.',
    imageUrl: 'assets/images/q4.jpg', sortOrder: 4
  },
  {
    slug: 'fodder-feed-production', category: 'ANIMAL NUTRITION', titleEn: 'Fodder & Feed Production',
    summaryEn: 'Nutritious fodder and year-round feed planning for sustainable livestock farming.',
    contentEn: '- Green fodder and improved feed production\n- Year-round fodder availability planning\n- Silage and hay production training\n- Animal feed cost management',
    imageUrl: 'assets/images/q5.jpg', sortOrder: 5
  },
  {
    slug: 'agricultural-machinery-equipment', category: 'EQUIPMENT', titleEn: 'Agricultural Machinery & Equipment',
    summaryEn: 'Equipment selection, use and maintenance guidance based on farm needs.',
    contentEn: '- Selection support for agricultural tools and machines\n- Power tiller, sprayer, chaff cutter and other equipment\n- Equipment rental models according to need\n- Operation and maintenance training\nSales, rental or installation is announced only when actually available.',
    imageUrl: 'assets/images/q6.jpg', sortOrder: 6
  },
  {
    slug: 'organic-sustainable-agriculture', category: 'SUSTAINABILITY', titleEn: 'Organic & Sustainable Agriculture',
    summaryEn: 'Soil health, composting, integrated pest management and sustainable farm practices.',
    contentEn: '- Compost and vermicompost production\n- Integrated Pest Management (IPM)\n- Soil fertility improvement\n- Farm-waste reuse and eco-friendly production',
    imageUrl: 'assets/images/q7.jpg', sortOrder: 7
  },
  {
    slug: 'farmer-training-skill-development', category: 'CAPACITY BUILDING', titleEn: 'Farmer Training & Skill Development',
    summaryEn: 'Practical training that builds farming knowledge and agricultural business skills.',
    contentEn: '- Practical training in modern farming\n- Livestock and farm management\n- Youth and women agricultural entrepreneurship\n- Digital agriculture tools training',
    imageUrl: 'assets/images/q8.jpg', sortOrder: 8
  },
  {
    slug: 'agro-products-collection-marketing', category: 'MARKET LINKAGE', titleEn: 'Agro Products Collection & Marketing',
    summaryEn: 'Support for grading, packaging and connecting farm products with buyers.',
    contentEn: '- Collection of farm products from farmers\n- Sorting, grading and packaging\n- Market connections with hotels, shops and wholesalers\n- Production price and demand information\nRegular purchase or market guarantees are not claimed without an agreement.',
    imageUrl: 'assets/images/q9.jpg', sortOrder: 9
  },
  {
    slug: 'mushroom-nursery-development', category: 'NURSERY', titleEn: 'Mushroom & Nursery Development',
    summaryEn: 'Planning and support for mushroom cultivation, nurseries and seedling production.',
    contentEn: '- Mushroom farming project planning\n- Plant nursery and seedling production\n- Fruit and vegetable seedling production\n- Small-space commercial farming feasibility',
    imageUrl: 'assets/images/q10.jpg', sortOrder: 10
  },
  {
    slug: 'climate-smart-digital-agriculture', category: 'DIGITAL AGRICULTURE', titleEn: 'Climate-Smart & Digital Agriculture',
    summaryEn: 'Climate-conscious planning and digital tools for more efficient farm management.',
    contentEn: '- Solar-powered irrigation feasibility\n- Weather and market information tools\n- Digital farm records and income tracking\n- Monitoring water, fertilizer and energy use',
    imageUrl: 'assets/images/q11.jpg', sortOrder: 11
  },
  {
    slug: 'integrated-farm-development-management', category: 'INTEGRATED SYSTEMS', titleEn: 'Integrated Farm Development & Management',
    summaryEn: 'Coordinated planning for livestock, crops, fodder, manure and ongoing operations.',
    contentEn: '- Livestock, vegetables, fodder and manure management in one project\n- Support from farm setup through operations\n- Regular production, cost and sales records\n- Progress assessment and expansion planning',
    imageUrl: 'assets/images/q12.jpg', sortOrder: 12
  }
];

async function seedServices() {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const existing = await client.query('SELECT COUNT(*)::int AS total FROM services');
    if (existing.rows[0].total > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      console.log(`Service seed skipped; ${existing.rows[0].total} service records already exist.`);
      return;
    }

    for (const service of services) {
      await client.query(
        `INSERT INTO services (slug, category, title_en, summary_en, content_en, image_url, sort_order, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'published')`,
        [service.slug, service.category, service.titleEn, service.summaryEn, service.contentEn, service.imageUrl, service.sortOrder]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log(`Seeded ${services.length} published service records.`);
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to seed services:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedServices();
