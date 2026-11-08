CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_user_ids (
  id SERIAL PRIMARY KEY,
  id_type VARCHAR(20) NOT NULL CHECK (id_type IN ('member', 'employee', 'agent')),
  id_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE managed_user_ids ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE managed_user_ids ADD COLUMN IF NOT EXISTS user_id INT UNIQUE REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_managed_user_ids_type ON managed_user_ids(id_type);

CREATE TABLE IF NOT EXISTS managed_customers (
  id SERIAL PRIMARY KEY,
  customer_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE managed_customers ADD COLUMN IF NOT EXISTS password_hash TEXT;

DROP INDEX IF EXISTS idx_managed_customers_login_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_customers_login_phone
  ON managed_customers (phone)
  WHERE password_hash IS NOT NULL AND phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_sessions (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES managed_customers(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);

CREATE TABLE IF NOT EXISTS customer_pin_resets (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES managed_customers(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_pin_resets_customer_created
  ON customer_pin_resets(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_projects (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE REFERENCES managed_customers(id) ON DELETE CASCADE,
  project_code VARCHAR(40) NOT NULL UNIQUE,
  current_step SMALLINT NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  service_charge NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_project_steps (
  project_id INT NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
  step_number SMALLINT NOT NULL CHECK (step_number BETWEEN 1 AND 5),
  status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_review', 'approved', 'rejected')),
  staff_note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, step_number)
);

CREATE TABLE IF NOT EXISTS customer_project_documents (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
  step_number SMALLINT NOT NULL CHECK (step_number BETWEEN 1 AND 5),
  document_type VARCHAR(60) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(100) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL CHECK (file_size > 0),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_project_documents_project_step
  ON customer_project_documents(project_id, step_number);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  actor_username VARCHAR(100) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  request_method VARCHAR(10) NOT NULL,
  request_path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS team_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  author_username VARCHAR(100) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_role VARCHAR(50) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_chat_messages_created_at ON team_chat_messages (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS attendance_events (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(3) NOT NULL CHECK (event_type IN ('in', 'out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_events_user_created
  ON attendance_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_np TEXT,
  content_en TEXT,
  content_np TEXT,
  meta_description_en TEXT,
  meta_description_np TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(100),
  title_en VARCHAR(255) NOT NULL,
  title_np VARCHAR(255),
  summary_en TEXT,
  summary_np TEXT,
  content_en TEXT,
  content_np TEXT,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE services ADD COLUMN IF NOT EXISTS category VARCHAR(100);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) UNIQUE,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title_en VARCHAR(255) NOT NULL,
  title_np VARCHAR(255),
  category VARCHAR(100),
  summary_en TEXT,
  summary_np TEXT,
  content_en TEXT,
  content_np TEXT,
  location VARCHAR(255),
  province VARCHAR(120),
  district VARCHAR(120),
  municipality VARCHAR(160),
  objectives TEXT,
  project_scope TEXT,
  target_beneficiaries TEXT,
  estimated_budget NUMERIC(14, 2),
  duration VARCHAR(100),
  project_status VARCHAR(30) NOT NULL DEFAULT 'Planning',
  progress INT NOT NULL DEFAULT 0,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_person VARCHAR(255),
  sort_order INT DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  featured BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS province VARCHAR(120);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS district VARCHAR(120);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS municipality VARCHAR(160);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_scope TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_beneficiaries TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(14, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS duration VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_status VARCHAR(30) NOT NULL DEFAULT 'Planning';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress INT NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
UPDATE projects SET project_code = 'ACL-PRJ-' || LPAD(id::text, 4, '0') WHERE project_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code ON projects (project_code);

CREATE TABLE IF NOT EXISTS project_images (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption_en TEXT,
  caption_np TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  blog_code VARCHAR(50) UNIQUE,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title_en VARCHAR(255) NOT NULL,
  title_np VARCHAR(255),
  excerpt_en TEXT,
  excerpt_np TEXT,
  content_en TEXT,
  content_np TEXT,
  category VARCHAR(100),
  featured_image TEXT,
  author VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  short_description TEXT,
  seo_title VARCHAR(255),
  publish_date DATE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS blog_code VARCHAR(50);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS publish_date DATE;
UPDATE blog_posts SET blog_code = 'ACL-BLOG-' || LPAD(id::text, 4, '0') WHERE blog_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_blog_code ON blog_posts (blog_code);

CREATE TABLE IF NOT EXISTS gallery_items (
  id SERIAL PRIMARY KEY,
  title_en VARCHAR(255),
  title_np VARCHAR(255),
  category VARCHAR(100),
  image_url TEXT NOT NULL,
  alt_text_en TEXT,
  alt_text_np TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit VARCHAR(30) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  reorder_level NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  supplier VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items (name);

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  province VARCHAR(120),
  district VARCHAR(120),
  municipality VARCHAR(160),
  ward_number INTEGER,
  branch_type VARCHAR(30),
  branch_number VARCHAR(50),
  location_code VARCHAR(100),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  source VARCHAR(100) DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS province VARCHAR(120);
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS district VARCHAR(120);
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS municipality VARCHAR(160);
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS ward_number INTEGER;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS branch_type VARCHAR(30);
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS branch_number VARCHAR(50);
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS location_code VARCHAR(100);

CREATE TABLE IF NOT EXISTS investment_applications (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  district VARCHAR(255),
  municipality VARCHAR(255),
  sector VARCHAR(255),
  investment_amount NUMERIC(12,2),
  partnership_model VARCHAR(100),
  message TEXT,
  privacy_consent BOOLEAN DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_applications (
  id SERIAL PRIMARY KEY,
  application_code VARCHAR(40) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  district VARCHAR(120) NOT NULL,
  municipality VARCHAR(160),
  address TEXT,
  experience_years SMALLINT NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 60),
  coverage_area VARCHAR(255) NOT NULL,
  message TEXT,
  privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_applications_status_created
  ON agent_applications (status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  question_en TEXT NOT NULL,
  question_np TEXT,
  answer_en TEXT NOT NULL,
  answer_np TEXT,
  sort_order INT DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(100) UNIQUE NOT NULL,
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provinces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  province_id INT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20) NOT NULL,
  UNIQUE (province_id, name),
  UNIQUE (province_id, code)
);

CREATE TABLE IF NOT EXISTS municipalities (
  id SERIAL PRIMARY KEY,
  district_id INT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  local_type VARCHAR(40) NOT NULL DEFAULT 'municipality',
  UNIQUE (district_id, name)
);

CREATE TABLE IF NOT EXISTS wards (
  id SERIAL PRIMARY KEY,
  municipality_id INT NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  ward_number INT NOT NULL CHECK (ward_number BETWEEN 1 AND 35),
  UNIQUE (municipality_id, ward_number)
);

CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  branch_code VARCHAR(50) NOT NULL UNIQUE,
  branch_name VARCHAR(255) NOT NULL,
  branch_type VARCHAR(30) NOT NULL CHECK (branch_type IN ('provincial', 'district', 'municipality', 'ward')),
  province_id INT NOT NULL REFERENCES provinces(id),
  district_id INT NOT NULL REFERENCES districts(id),
  municipality_id INT NOT NULL REFERENCES municipalities(id),
  ward_id INT REFERENCES wards(id),
  full_address TEXT,
  manager_name VARCHAR(255),
  designation VARCHAR(160),
  phone VARCHAR(50),
  alternate_phone VARCHAR(50),
  email VARCHAR(255),
  opening_hours VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('active', 'planned', 'temporarily_closed')),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  established_date DATE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (branch_type <> 'ward' OR ward_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INT,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_investment_status ON investment_applications(status);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_districts_province ON districts(province_id);
CREATE INDEX IF NOT EXISTS idx_municipalities_district ON municipalities(district_id);
CREATE INDEX IF NOT EXISTS idx_wards_municipality ON wards(municipality_id);
CREATE INDEX IF NOT EXISTS idx_branches_public_location ON branches(is_published, province_id, district_id, municipality_id, ward_id);
CREATE INDEX IF NOT EXISTS idx_branches_public_type ON branches(is_published, branch_type);
