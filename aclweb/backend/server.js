const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { randomInt, randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/acl_agro_farm'
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: false,
}));
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiRateLimit);

const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many inquiries. Please try again later.' },
  handler: (_req, res) => res.status(429).json({ ok: false, message: 'Too many inquiries. Please try again later.' })
});

const agentApplicationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many Agent applications. Please try again later.' },
  handler: (_req, res) => res.status(429).json({ ok: false, message: 'Too many Agent applications. Please try again later.' })
});

const customerAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${rateLimit.ipKeyGenerator(req.ip)}:${normalizeCustomerLoginPhone(req.body?.phone) || 'unknown'}`,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many sign-in attempts. Please try again later.' },
  handler: (_req, res) => res.status(429).json({ ok: false, message: 'Too many sign-in attempts. Please try again later.' })
});

const customerOtpIssueRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many code requests. Please try again later.' },
  handler: (_req, res) => res.status(429).json({ ok: false, message: 'Too many code requests. Please try again later.' })
});

const customerOtpVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many code attempts. Please try again later.' },
  handler: (_req, res) => res.status(429).json({ ok: false, message: 'Too many code attempts. Please try again later.' })
});

const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, '');
const databaseBackupDirectory = path.resolve(rootDir, '..', 'private-database-backups');
fs.mkdirSync(databaseBackupDirectory, { recursive: true });
const findPostgresBinary = (name, override) => {
  if (override) return override;
  const executable = `${name}${process.platform === 'win32' ? '.exe' : ''}`;
  if (process.env.PG_BIN_DIR) {
    const configuredPath = path.join(process.env.PG_BIN_DIR, executable);
    if (fs.existsSync(configuredPath)) return configuredPath;
  }
  if (process.platform === 'win32') {
    for (const root of [process.env.ProgramW6432, process.env.ProgramFiles, 'C:\\Program Files'].filter(Boolean)) {
      const installRoot = path.join(root, 'PostgreSQL');
      if (!fs.existsSync(installRoot)) continue;
      const versions = fs.readdirSync(installRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((first, second) => second.localeCompare(first, undefined, { numeric: true }));
      for (const version of versions) {
        for (const candidate of [path.join(installRoot, version, 'bin', executable), path.join(installRoot, version, 'pgAdmin 4', 'runtime', executable)]) {
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    }
  }
  return executable;
};
const pgDumpBinary = findPostgresBinary('pg_dump', process.env.PG_DUMP_PATH);
const pgRestoreBinary = findPostgresBinary('pg_restore', process.env.PG_RESTORE_PATH);
const getPostgresCliEnvironment = () => {
  const connection = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/acl_agro_farm');
  const environment = { ...process.env };
  environment.PGHOST = decodeURIComponent(connection.hostname);
  environment.PGPORT = connection.port || '5432';
  environment.PGUSER = decodeURIComponent(connection.username);
  environment.PGDATABASE = decodeURIComponent(connection.pathname.replace(/^\//, ''));
  if (connection.password) environment.PGPASSWORD = decodeURIComponent(connection.password);
  for (const [parameter, variable] of [['sslmode', 'PGSSLMODE'], ['sslrootcert', 'PGSSLROOTCERT'], ['sslcert', 'PGSSLCERT'], ['sslkey', 'PGSSLKEY']]) {
    const value = connection.searchParams.get(parameter);
    if (value) environment[variable] = value;
  }
  return environment;
};
const runPostgresCli = (binary, args) => new Promise((resolve, reject) => {
  const child = spawn(binary, args, { env: getPostgresCliEnvironment(), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8000); });
  child.once('error', reject);
  child.once('close', (code) => {
    if (code === 0) return resolve();
    return reject(new Error(stderr.trim() || `${path.basename(binary)} exited with code ${code}.`));
  });
});
const createDatabaseBackup = async (label = 'manual') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `acl-agro-${label}-${timestamp}-${randomUUID().slice(0, 8)}.dump`;
  const filePath = path.join(databaseBackupDirectory, filename);
  try {
    await runPostgresCli(pgDumpBinary, ['--format=custom', '--no-owner', '--no-acl', '--file', filePath]);
    if (process.platform !== 'win32') await fs.promises.chmod(filePath, 0o600);
    const stat = await fs.promises.stat(filePath);
    return { filename, filePath, size: stat.size, createdAt: stat.mtime.toISOString() };
  } catch (error) {
    await fs.promises.rm(filePath, { force: true }).catch(() => {});
    throw error;
  }
};
const databaseBackupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, databaseBackupDirectory),
    filename: (_req, _file, callback) => callback(null, `restore-upload-${randomUUID()}.dump`)
  }),
  limits: { fileSize: 1024 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['.dump', '.backup'].includes(path.extname(file.originalname).toLowerCase())) {
      return callback(new Error('Choose a PostgreSQL custom-format .dump or .backup archive.'));
    }
    return callback(null, true);
  }
});
const parseDatabaseBackupUpload = (req, res, next) => databaseBackupUpload.single('backup')(req, res, (error) => {
  if (error) return res.status(400).json({ ok: false, message: error.message });
  return next();
});
const privateCustomerUploadDir = path.join(__dirname, '..', '..', 'private-uploads', 'customer-projects');
const paymentQrDirectory = path.join(rootDir, 'assets', 'images', 'payment-qr');
fs.mkdirSync(paymentQrDirectory, { recursive: true });
const paymentQrTypes = new Map([
  ['.png', { mimeType: 'image/png', signature: (header) => header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ['.jpg', { mimeType: 'image/jpeg', signature: (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff }],
  ['.jpeg', { mimeType: 'image/jpeg', signature: (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff }],
  ['.webp', { mimeType: 'image/webp', signature: (header) => header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP' }]
]);
const paymentQrUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, paymentQrDirectory),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension === '.jpeg' ? '.jpg' : extension}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const definition = paymentQrTypes.get(extension);
    if (!definition || file.mimetype !== definition.mimeType) return callback(new Error('Choose a PNG, JPG, or WebP QR image up to 5 MB.'));
    callback(null, true);
  }
});
const hasValidPaymentQrSignature = async (file) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const definition = paymentQrTypes.get(extension);
  if (!definition) return false;
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead >= 8 && definition.signature(header);
  } finally {
    await handle.close();
  }
};
const customerProjectDocumentTypes = {
  citizenship: { step: 1, label: 'Citizenship / Nagarikta' },
  land_title: { step: 1, label: 'Land ownership / Lalpurja' },
  land_map: { step: 1, label: 'Land map / Naksa' },
  voucher_500: { step: 1, label: 'Rs. 500 payment voucher' },
  visit_confirmation: { step: 2, label: 'Visit confirmation letter' },
  voucher_10000: { step: 2, label: 'Rs. 10,000 payment voucher' },
  signed_agreement: { step: 3, label: 'Signed agreement' },
  voucher_100000: { step: 4, label: 'Rs. 100,000 company share voucher' },
  land_rokka: { step: 5, label: 'Land rokka document' },
  service_charge_voucher: { step: 5, label: 'Service charge voucher' }
};
const customerProjectUploadRoot = privateCustomerUploadDir;
fs.mkdirSync(customerProjectUploadRoot, { recursive: true });
const acceptedProjectFiles = new Map([
  ['.pdf', { storageExtension: '.pdf', mimeType: 'application/pdf', mimeTypes: ['application/pdf'] }],
  ['.jpg', { storageExtension: '.jpg', mimeType: 'image/jpeg', mimeTypes: ['image/jpeg'] }],
  ['.jpeg', { storageExtension: '.jpg', mimeType: 'image/jpeg', mimeTypes: ['image/jpeg'] }],
  ['.png', { storageExtension: '.png', mimeType: 'image/png', mimeTypes: ['image/png'] }],
  ['.gif', { storageExtension: '.gif', mimeType: 'image/gif', mimeTypes: ['image/gif'] }],
  ['.webp', { storageExtension: '.webp', mimeType: 'image/webp', mimeTypes: ['image/webp'] }],
  ['.bmp', { storageExtension: '.bmp', mimeType: 'image/bmp', mimeTypes: ['image/bmp', 'image/x-ms-bmp'] }],
  ['.tif', { storageExtension: '.tiff', mimeType: 'image/tiff', mimeTypes: ['image/tiff', 'image/x-tiff'] }],
  ['.tiff', { storageExtension: '.tiff', mimeType: 'image/tiff', mimeTypes: ['image/tiff', 'image/x-tiff'] }],
  ['.avif', { storageExtension: '.avif', mimeType: 'image/avif', mimeTypes: ['image/avif'] }],
  ['.heic', { storageExtension: '.heic', mimeType: 'image/heic', mimeTypes: ['image/heic', 'image/heif'] }],
  ['.heif', { storageExtension: '.heic', mimeType: 'image/heic', mimeTypes: ['image/heic', 'image/heif'] }]
]);
const hasValidCustomerProjectSignature = async (file) => {
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension === '.pdf') return header.subarray(0, 5).toString() === '%PDF-';
    if (extension === '.jpg' || extension === '.jpeg') return bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (extension === '.png') return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(header.subarray(0, 6).toString());
    if (extension === '.webp') return header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP';
    if (extension === '.bmp') return header.subarray(0, 2).toString() === 'BM';
    if (extension === '.tif' || extension === '.tiff') {
      return header.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00]))
        || header.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]));
    }
    if (['.avif', '.heic', '.heif'].includes(extension)) {
      const brand = header.subarray(8, 12).toString();
      return header.subarray(4, 8).toString() === 'ftyp'
        && ['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
    }
    return false;
  } finally {
    await handle.close();
  }
};
const customerProjectUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, customerProjectUploadRoot),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${acceptedProjectFiles.get(extension)?.storageExtension || ''}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const originalExtension = path.extname(file.originalname).toLowerCase();
    const definition = acceptedProjectFiles.get(originalExtension);
    if (!definition || !definition.mimeTypes.includes(file.mimetype)) {
      return callback(new Error('Upload a PDF or image file (JPG, PNG, GIF, WEBP, BMP, TIFF, AVIF, or HEIC) up to 10 MB.'));
    }
    callback(null, true);
  }
});
const customerProjectUploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many document uploads. Please try again later.' }
});

const handleCustomerProjectUpload = (req, res, next) => {
  customerProjectUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const statusCode = error instanceof multer.MulterError ? 400 : 415;
    return res.status(statusCode).json({ ok: false, message: error.message || 'Unable to upload this document.' });
  });
};

const ensureDbConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
};

const ensureDefaultSettings = async () => {
  try {
    const defaults = [
      { key_name: 'site_name', value_text: 'ACL Agro Farm Ltd.' },
      { key_name: 'default_language', value_text: 'np' },
      { key_name: 'company_email', value_text: 'info@aclagrofarm.com' },
      { key_name: 'company_phone', value_text: '+977-9812093798' },
      { key_name: 'company_address', value_text: 'Nepal' },
      { key_name: 'payment_method_1_name', value_text: 'eSewa' },
      { key_name: 'payment_method_2_name', value_text: 'Khalti' },
      { key_name: 'payment_method_3_name', value_text: 'Bank' }
    ];

    for (const setting of defaults) {
      await pool.query(
        `INSERT INTO site_settings (key_name, value_text)
         VALUES ($1, $2)
         ON CONFLICT (key_name)
         DO NOTHING`,
        [setting.key_name, setting.value_text]
      );
    }
  } catch (error) {
    console.error('Failed to seed settings:', error.message);
  }
};

const loadTranslations = () => JSON.parse(fs.readFileSync(path.join(rootDir, 'js', 'translations.js'), 'utf8'));

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const publicBranchColumns = `
  b.id, b.branch_code, b.branch_name, b.branch_type, b.full_address,
  b.manager_name, b.designation, b.phone, b.alternate_phone, b.email,
  b.opening_hours, b.status, b.latitude, b.longitude, b.established_date,
  p.id AS province_id, p.name AS province_name, p.code AS province_code,
  d.id AS district_id, d.name AS district_name, d.code AS district_code,
  m.id AS municipality_id, m.name AS municipality_name, m.local_type,
  w.id AS ward_id, w.ward_number
`;

const publicBranchJoins = `
  FROM branches b
  JOIN provinces p ON p.id = b.province_id
  JOIN districts d ON d.id = b.district_id
  JOIN municipalities m ON m.id = b.municipality_id
  LEFT JOIN wards w ON w.id = b.ward_id
`;

const staffPermissionKeys = [
  'dashboard', 'account_management', 'inventory', 'agent_applications', 'customers', 'project_approvals',
  'my_projects', 'branches', 'services', 'projects', 'blog', 'gallery', 'inquiries',
  'investment_applications', 'settings'
];

const getRequiredStaffPermission = (requestPath) => {
  const route = requestPath.replace(/^\/api\/admin/, '');
  if (route === '/dashboard' || route.startsWith('/attendance')) return 'dashboard';
  if (route.startsWith('/agent-applications')) return 'agent_applications';
  if (route.startsWith('/chat')) return 'dashboard';
  if (route.startsWith('/accounts') || route.startsWith('/user-management/ids')) return 'account_management';
  if (route.startsWith('/inventory')) return 'inventory';
  if (route.startsWith('/my-projects')) return 'my_projects';
  if (route.startsWith('/customer-projects')) return 'project_approvals';
  if (route.startsWith('/customers')) return 'customers';
  if (route.startsWith('/branches')) return 'branches';
  if (route.startsWith('/services')) return 'services';
  if (route.startsWith('/projects')) return 'projects';
  if (route.startsWith('/blog')) return 'blog';
  if (route.startsWith('/gallery')) return 'gallery';
  if (route.startsWith('/inquiries')) return 'inquiries';
  if (route.startsWith('/investment-applications')) return 'investment_applications';
  if (route.startsWith('/settings')) return 'settings';
  return null;
};

const requireAdmin = async (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ ok: false, message: 'Administrator authentication required.' });
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role,
              m.id AS managed_user_id, COALESCE(m.permissions, '[]'::jsonb) AS permissions
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN managed_user_ids m ON m.user_id=u.id
       WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE
       LIMIT 1`,
      [token]
    );
    const user = result.rows[0];
    if (!user) return res.status(403).json({ ok: false, message: 'Administrator permission required.' });
    if (!['admin', 'manager', 'super_admin'].includes(user.role)) {
      if (!['employee', 'agent'].includes(user.role)) return res.status(403).json({ ok: false, message: 'Administrator permission required.' });
      const requiredPermission = getRequiredStaffPermission(req.originalUrl.split('?')[0]);
      if (!requiredPermission || !user.permissions.includes(requiredPermission)) {
        return res.status(403).json({ ok: false, message: 'You do not have permission to access this section.' });
      }
    }
    req.adminUser = user;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.once('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const action = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[req.method];
        const resource = req.path.replace(/^\/api\/admin\/?/, '').slice(0, 255) || 'admin';
        const sanitize = (value, depth = 0) => {
          if (depth > 4) return '[TRUNCATED]';
          if (Array.isArray(value)) return value.slice(0, 30).map((entry) => sanitize(entry, depth + 1));
          if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, entry]) => [
              key,
              /(password|pin|token|secret|authorization|cookie|credential)/i.test(key) ? '[REDACTED]' : sanitize(entry, depth + 1)
            ]));
          }
          if (typeof value === 'string') return value.slice(0, 1000);
          return value;
        };
        const details = { params: sanitize(req.params || {}), body: sanitize(req.body || {}) };
        pool.query(
          `INSERT INTO activity_logs (actor_user_id,actor_username,actor_role,action,resource,request_method,request_path,status_code,details,ip_address)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
          [user.id, user.username, user.role, action, resource, req.method, req.originalUrl.slice(0, 1000), res.statusCode, JSON.stringify(details), req.ip || null]
        ).catch((error) => console.error('Unable to write activity log:', error.message));
      });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Unable to verify administrator session.' });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (req.adminUser?.role !== 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Only a super administrator can access this system feature.' });
  }
  return next();
};

app.get('/api/admin/chat', requireAdmin, async (req, res) => {
  const afterId = Math.max(0, parsePositiveInteger(req.query.afterId) || 0);
  try {
    const result = afterId
      ? await pool.query(
        `SELECT id, author_username, author_name, author_role, message, created_at
         FROM team_chat_messages WHERE id > $1 ORDER BY id ASC LIMIT 100`,
        [afterId]
      )
      : await pool.query(
        `SELECT id, author_username, author_name, author_role, message, created_at
         FROM (SELECT id, author_username, author_name, author_role, message, created_at
               FROM team_chat_messages ORDER BY id DESC LIMIT 50) recent
         ORDER BY id ASC`
      );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load team chat.' });
  }
});

app.post('/api/admin/chat', requireAdmin, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message || message.length > 1000) {
    return res.status(400).json({ ok: false, message: 'Message must contain 1 to 1000 characters.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO team_chat_messages (user_id,author_username,author_name,author_role,message)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,author_username,author_name,author_role,message,created_at`,
      [req.adminUser.id, req.adminUser.username, req.adminUser.full_name || req.adminUser.username, req.adminUser.role, message]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to send team chat message.' });
  }
});

app.get('/api/admin/activity-logs', requireAdmin, requireSuperAdmin, async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
  const search = String(req.query.search || '').trim().slice(0, 120);
  try {
    const values = search ? [`%${search}%`] : [];
    const filter = search ? 'WHERE actor_username ILIKE $1 OR resource ILIKE $1 OR action ILIKE $1' : '';
    const countResult = await pool.query(`SELECT COUNT(*)::integer AS total FROM activity_logs ${filter}`, values);
    const result = await pool.query(
      `SELECT id, actor_username, actor_role, action, resource, request_method, request_path,
              status_code, details, ip_address, created_at
       FROM activity_logs ${filter}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );
    res.json({ ok: true, data: result.rows, total: countResult.rows[0].total, limit, offset });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load activity logs.' });
  }
});

app.get('/api/admin/database-backups', requireAdmin, requireSuperAdmin, async (_req, res) => {
  try {
    const entries = await fs.promises.readdir(databaseBackupDirectory, { withFileTypes: true });
    const backups = await Promise.all(entries
      .filter((entry) => entry.isFile() && /^acl-agro-(manual|pre-restore)-[a-zA-Z0-9-]+\.dump$/.test(entry.name))
      .map(async (entry) => {
        const stat = await fs.promises.stat(path.join(databaseBackupDirectory, entry.name));
        return { filename: entry.name, size: stat.size, createdAt: stat.mtime.toISOString() };
      }));
    backups.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    res.json({ ok: true, data: backups.slice(0, 200) });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to list database backups.' });
  }
});

app.post('/api/admin/database-backups', requireAdmin, requireSuperAdmin, async (_req, res) => {
  try {
    const backup = await createDatabaseBackup();
    res.status(201).json({ ok: true, data: { filename: backup.filename, size: backup.size, createdAt: backup.createdAt } });
  } catch (error) {
    console.error('Database backup failed:', error.message);
    res.status(500).json({ ok: false, message: 'Unable to create the database backup. Check PostgreSQL backup utility configuration.' });
  }
});

app.get('/api/admin/database-backups/:filename/download', requireAdmin, requireSuperAdmin, async (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename || !/^acl-agro-(manual|pre-restore)-[a-zA-Z0-9-]+\.dump$/.test(filename)) {
    return res.status(400).json({ ok: false, message: 'Invalid backup filename.' });
  }
  const filePath = path.join(databaseBackupDirectory, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, message: 'Backup not found.' });
  return res.download(filePath, filename);
});

app.post('/api/admin/database-backups/restore', requireAdmin, requireSuperAdmin, parseDatabaseBackupUpload, async (req, res) => {
  const uploadedPath = req.file?.path;
  if (!uploadedPath) return res.status(400).json({ ok: false, message: 'Select a database backup archive.' });
  try {
    if (req.body?.confirmation !== 'RESTORE') {
      return res.status(400).json({ ok: false, message: 'Type RESTORE to confirm replacing the current database.' });
    }
    await runPostgresCli(pgRestoreBinary, ['--list', uploadedPath]);
    const safetyBackup = await createDatabaseBackup('pre-restore');
    await runPostgresCli(pgRestoreBinary, [
      '--clean', '--if-exists', '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction',
      '--dbname', getPostgresCliEnvironment().PGDATABASE, uploadedPath
    ]);
    res.json({ ok: true, message: 'Database restored successfully.', safetyBackup: safetyBackup.filename });
  } catch (error) {
    console.error('Database restore failed:', error.message);
    res.status(400).json({ ok: false, message: 'Restore failed. The current database was not replaced unless the restore completed.' });
  } finally {
    await fs.promises.rm(uploadedPath, { force: true }).catch(() => {});
  }
});

const requireCustomer = async (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ ok: false, message: 'Customer sign-in required.' });
  try {
    const result = await pool.query(
      `SELECT c.id, c.customer_code, c.full_name, c.email, c.phone, c.address
       FROM customer_sessions s
       JOIN managed_customers c ON c.id = s.customer_id
       WHERE s.session_token = $1 AND s.expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    if (!result.rows[0]) return res.status(401).json({ ok: false, message: 'Your session has expired. Please sign in again.' });
    req.customer = result.rows[0];
    req.customerSessionToken = token;
    return next();
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Unable to verify customer session.' });
  }
};

const ensureCustomerProject = async (customerId) => {
  await pool.query(
    `WITH next_project AS (
       SELECT nextval(pg_get_serial_sequence('customer_projects', 'id'))::integer AS id
     )
     INSERT INTO customer_projects (id, customer_id, project_code)
     SELECT id, $1, 'ACL-PROJ-' || LPAD(id::text, 5, '0')
     FROM next_project
     ON CONFLICT (customer_id) DO NOTHING`,
    [customerId]
  );
  const projectResult = await pool.query('SELECT * FROM customer_projects WHERE customer_id=$1 LIMIT 1', [customerId]);
  const project = projectResult.rows[0];
  if (!project) throw new Error('Unable to initialize customer project.');
  for (let stepNumber = 1; stepNumber <= 5; stepNumber += 1) {
    await pool.query(
      'INSERT INTO customer_project_steps (project_id, step_number) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [project.id, stepNumber]
    );
  }
  return project;
};

const getCustomerProjectSnapshot = async (project, downloadPrefix) => {
  const [stepsResult, documentsResult] = await Promise.all([
    pool.query('SELECT step_number, status, staff_note, updated_at FROM customer_project_steps WHERE project_id=$1 ORDER BY step_number', [project.id]),
    pool.query('SELECT id, step_number, document_type, original_name, file_size, uploaded_at FROM customer_project_documents WHERE project_id=$1 ORDER BY uploaded_at DESC', [project.id])
  ]);
  const steps = stepsResult.rows.map((step) => {
    const requiredDocuments = Object.entries(customerProjectDocumentTypes)
      .filter(([, definition]) => definition.step === step.step_number)
      .map(([documentType, definition]) => {
        const document = documentsResult.rows.find((item) => item.document_type === documentType) || null;
        return {
          documentType,
          label: definition.label,
          uploaded: Boolean(document),
          document: document ? {
            id: document.id,
            originalName: document.original_name,
            fileSize: document.file_size,
            uploadedAt: document.uploaded_at,
            downloadUrl: `${downloadPrefix}/${document.id}`
          } : null
        };
      });
    return { ...step, requiredDocuments };
  });
  return { project, steps };
};

const normalizeCustomerLoginPhone = (value) => String(value || '').trim().replace(/[\s().-]/g, '');
const isValidCustomerLoginPhone = (value) => /^\+?[1-9]\d{6,14}$/.test(value);
const isCustomerMailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);

const sendCustomerPinResetOtp = async (email, otp) => {
  if (!isCustomerMailConfigured()) throw new Error('Customer email delivery is not configured.');
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP port.');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } } : {})
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'ACL Agro Farm customer PIN reset code',
    text: `Your ACL Agro Farm PIN reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your ACL Agro Farm PIN reset code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
  });
};

app.post('/api/customer/forgot-pin', customerOtpIssueRateLimit, async (req, res) => {
  const phone = normalizeCustomerLoginPhone(req.body?.phone);
  const genericResponse = { ok: true, message: 'If an account with that phone number has a registered email, a reset code has been sent.' };
  if (!isValidCustomerLoginPhone(phone)) return res.json(genericResponse);
  if (!isCustomerMailConfigured()) {
    return res.status(503).json({ ok: false, message: 'Email delivery is not configured. Please contact support.' });
  }

  let resetId;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const customerResult = await client.query(
      'SELECT id, email FROM managed_customers WHERE phone=$1 LIMIT 1 FOR UPDATE',
      [phone]
    );
    const customer = customerResult.rows[0];
    if (!customer || !customer.email) {
      await client.query('ROLLBACK');
      return res.json(genericResponse);
    }

    await client.query(
      'UPDATE customer_pin_resets SET consumed_at=NOW() WHERE customer_id=$1 AND consumed_at IS NULL',
      [customer.id]
    );
    const otp = String(randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    const resetResult = await client.query(
      `INSERT INTO customer_pin_resets (customer_id, otp_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes') RETURNING id`,
      [customer.id, otpHash]
    );
    resetId = resetResult.rows[0].id;
    await client.query('COMMIT');

    try {
      await sendCustomerPinResetOtp(customer.email, otp);
    } catch (error) {
      await pool.query('UPDATE customer_pin_resets SET consumed_at=NOW() WHERE id=$1', [resetId]);
      console.error('Customer PIN reset email failed:', error.message);
      return res.status(503).json({ ok: false, message: 'Unable to send a reset email right now. Please contact support.' });
    }
    return res.json(genericResponse);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Customer PIN reset request failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to process the reset request.' });
  } finally {
    client?.release();
  }
});

app.post('/api/customer/reset-pin', customerOtpVerifyRateLimit, async (req, res) => {
  const phone = normalizeCustomerLoginPhone(req.body?.phone);
  const otp = String(req.body?.otp || '');
  const pin = String(req.body?.pin || '');
  if (!isValidCustomerLoginPhone(phone) || !/^\d{6}$/.test(otp) || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ ok: false, message: 'Enter a valid phone number, 6-digit code, and new 6-digit PIN.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT r.id, r.customer_id, r.otp_hash, r.attempts
       FROM customer_pin_resets r
       JOIN managed_customers c ON c.id=r.customer_id
       WHERE c.phone=$1
         AND r.consumed_at IS NULL AND r.expires_at > NOW()
       ORDER BY r.created_at DESC
       LIMIT 1 FOR UPDATE OF r`,
      [phone]
    );
    const reset = result.rows[0];
    if (!reset || reset.attempts >= 5) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, message: 'The reset code is invalid or expired.' });
    }

    if (!(await bcrypt.compare(otp, reset.otp_hash))) {
      const attempts = reset.attempts + 1;
      await client.query(
        'UPDATE customer_pin_resets SET attempts=$1, consumed_at=CASE WHEN $1 >= 5 THEN NOW() ELSE consumed_at END WHERE id=$2',
        [attempts, reset.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ ok: false, message: 'The reset code is invalid or expired.' });
    }

    const passwordHash = await bcrypt.hash(pin, 12);
    await client.query('UPDATE managed_customers SET password_hash=$1, updated_at=NOW() WHERE id=$2', [passwordHash, reset.customer_id]);
    await client.query('UPDATE customer_pin_resets SET consumed_at=NOW() WHERE customer_id=$1 AND consumed_at IS NULL', [reset.customer_id]);
    await client.query('DELETE FROM customer_sessions WHERE customer_id=$1', [reset.customer_id]);
    await client.query('COMMIT');
    res.json({ ok: true, message: 'PIN reset successfully. Sign in with your new PIN.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Customer PIN reset failed:', error.message);
    res.status(500).json({ ok: false, message: 'Unable to reset the PIN right now.' });
  } finally {
    client.release();
  }
});

app.post('/api/customer/register', customerAuthRateLimit, async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const pin = String(req.body?.pin || '');
  const phone = normalizeCustomerLoginPhone(req.body?.phone);
  const address = String(req.body?.address || '').trim();
  if (fullName.length < 2 || fullName.length > 255) return res.status(400).json({ ok: false, message: 'Enter your full name.' });
  if (!isValidCustomerLoginPhone(phone)) return res.status(400).json({ ok: false, message: 'Enter a valid phone number.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return res.status(400).json({ ok: false, message: 'Enter a valid email address for account recovery.' });
  if (address.length < 3 || address.length > 2000) return res.status(400).json({ ok: false, message: 'Enter your current address.' });
  if (!/^\d{6}$/.test(pin)) return res.status(400).json({ ok: false, message: 'PIN must contain exactly 6 digits.' });
  try {
    const passwordHash = await bcrypt.hash(pin, 12);
    const result = await pool.query(
      `WITH next_customer AS (
         SELECT nextval(pg_get_serial_sequence('managed_customers', 'id'))::integer AS id
       )
      INSERT INTO managed_customers (id, customer_code, full_name, email, phone, address, password_hash)
      SELECT id, 'ACL-CUS-' || LPAD(id::text, 5, '0'), $1, $2, $3, $4, $5
       FROM next_customer
       RETURNING id, customer_code, full_name, email, phone, address`,
          [fullName, email || null, phone, address, passwordHash]
    );
    res.status(201).json({ ok: true, message: 'Customer account created. Sign in with your phone number and PIN.', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ ok: false, message: 'An account with this phone number already exists.' });
    res.status(500).json({ ok: false, message: 'Unable to create customer account.' });
  }
});

app.post('/api/customer/login', customerAuthRateLimit, async (req, res) => {
  const phone = normalizeCustomerLoginPhone(req.body?.phone);
  const pin = String(req.body?.pin || '');
  if (!isValidCustomerLoginPhone(phone) || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ ok: false, message: 'Enter a valid phone number and 6-digit PIN.' });
  }
  try {
    const result = await pool.query(
      `SELECT id, customer_code, full_name, email, phone, address, password_hash
       FROM managed_customers WHERE phone=$1 AND password_hash IS NOT NULL LIMIT 1`,
      [phone]
    );
    const customer = result.rows[0];
    if (!customer || !(await bcrypt.compare(pin, customer.password_hash))) {
      return res.status(401).json({ ok: false, message: 'Phone number or PIN is incorrect.' });
    }
    const token = uuidv4();
    await pool.query(
      `INSERT INTO customer_sessions (customer_id, session_token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [customer.id, token]
    );
    delete customer.password_hash;
    res.json({ ok: true, token, data: customer });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to sign in right now.' });
  }
});

app.get('/api/customer/me', requireCustomer, (req, res) => {
  res.json({ ok: true, data: req.customer });
});

app.patch('/api/customer/me', requireCustomer, async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = normalizeCustomerLoginPhone(req.body?.phone);
  const address = String(req.body?.address || '').trim();
  if (fullName.length < 2 || fullName.length > 255) return res.status(400).json({ ok: false, message: 'Enter a valid full name.' });
  if (!isValidCustomerLoginPhone(phone)) return res.status(400).json({ ok: false, message: 'Enter a valid phone number.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return res.status(400).json({ ok: false, message: 'Enter a valid email address.' });
  if (address.length < 3 || address.length > 2000) return res.status(400).json({ ok: false, message: 'Enter a valid address.' });
  try {
    const result = await pool.query(
      `UPDATE managed_customers SET full_name=$1, email=$2, phone=$3, address=$4, updated_at=NOW()
       WHERE id=$5 RETURNING id, customer_code, full_name, email, phone, address`,
      [fullName, email, phone, address, req.customer.id]
    );
    req.customer = result.rows[0];
    res.json({ ok: true, data: result.rows[0], message: 'Individual details saved.' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ ok: false, message: 'This phone number is already used by another customer.' });
    res.status(500).json({ ok: false, message: 'Unable to save individual details.' });
  }
});

app.post('/api/customer/logout', requireCustomer, async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_sessions WHERE session_token=$1', [req.customerSessionToken]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to sign out.' });
  }
});

app.get('/api/customer/project', requireCustomer, async (req, res) => {
  try {
    const project = await ensureCustomerProject(req.customer.id);
    const data = await getCustomerProjectSnapshot(project, '/api/customer/project/documents');
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load project progress.' });
  }
});

app.post('/api/customer/project/documents/:documentType', requireCustomer, customerProjectUploadRateLimit, (req, res, next) => {
  customerProjectUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const statusCode = error instanceof multer.MulterError ? 400 : 415;
    res.status(statusCode).json({ ok: false, message: error.message || 'Upload a PDF, JPG, or PNG file no larger than 10 MB.' });
  });
}, async (req, res) => {
  const documentType = req.params.documentType;
  const definition = customerProjectDocumentTypes[documentType];
  if (!definition) {
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ ok: false, message: 'Unknown project document type.' });
  }
  if (!req.file) return res.status(400).json({ ok: false, message: 'Choose a document to upload.' });
  if (!(await hasValidCustomerProjectSignature(req.file))) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(415).json({ ok: false, message: 'The file content does not match a supported PDF, JPG, or PNG document.' });
  }

  let previousStorageName = null;
  try {
    const project = await ensureCustomerProject(req.customer.id);
    if (project.status === 'completed' || definition.step !== project.current_step) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ ok: false, message: 'Documents can only be uploaded for the active project step.' });
    }
    const stepResult = await pool.query(
      'SELECT status FROM customer_project_steps WHERE project_id=$1 AND step_number=$2',
      [project.id, definition.step]
    );
    if (stepResult.rows[0]?.status === 'approved') {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ ok: false, message: 'This project step has already been approved.' });
    }
    if (stepResult.rows[0]?.status === 'awaiting_review') {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ ok: false, message: 'This step is under review. Wait for admin feedback before changing documents.' });
    }

    const prior = await pool.query(
      'SELECT storage_name FROM customer_project_documents WHERE project_id=$1 AND document_type=$2',
      [project.id, documentType]
    );
    previousStorageName = prior.rows[0]?.storage_name || null;
    const originalName = path.basename(req.file.originalname).slice(0, 255);
    await pool.query(
      `INSERT INTO customer_project_documents (project_id, step_number, document_type, original_name, storage_name, mime_type, file_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id, document_type)
       DO UPDATE SET original_name=EXCLUDED.original_name, storage_name=EXCLUDED.storage_name,
                     mime_type=EXCLUDED.mime_type, file_size=EXCLUDED.file_size, uploaded_at=NOW()`,
      [project.id, definition.step, documentType, originalName, path.basename(req.file.filename), acceptedProjectFiles.get(path.extname(req.file.originalname).toLowerCase()).mimeType, req.file.size]
    );

    if (previousStorageName) await fs.promises.unlink(path.join(privateCustomerUploadDir, previousStorageName)).catch(() => {});
    res.status(201).json({ ok: true, message: 'Document uploaded. Submit the step for admin review when all required documents are ready.' });
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    res.status(500).json({ ok: false, message: 'Unable to save this project document.' });
  }
});

app.post('/api/customer/project/steps/:stepNumber/submit', requireCustomer, async (req, res) => {
  const stepNumber = Number(req.params.stepNumber);
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 5) {
    return res.status(400).json({ ok: false, message: 'A valid project step is required.' });
  }
  try {
    const project = await ensureCustomerProject(req.customer.id);
    if (project.status === 'completed' || Number(project.current_step) !== stepNumber) {
      return res.status(409).json({ ok: false, message: 'Only the current project step can be submitted.' });
    }
    if (stepNumber === 1) {
      const profileResult = await pool.query(
        'SELECT full_name, email, phone, address FROM managed_customers WHERE id=$1',
        [req.customer.id]
      );
      const profile = profileResult.rows[0];
      if (!profile || !profile.full_name?.trim() || !profile.email?.trim() || !profile.phone?.trim() || !profile.address?.trim()) {
        return res.status(409).json({ ok: false, message: 'Complete and save your individual details before submitting Step 1.' });
      }
    }
    const stepResult = await pool.query(
      'SELECT status FROM customer_project_steps WHERE project_id=$1 AND step_number=$2',
      [project.id, stepNumber]
    );
    if (!['pending', 'rejected'].includes(stepResult.rows[0]?.status)) {
      return res.status(409).json({ ok: false, message: 'This step is not ready to be submitted.' });
    }
    const requiredTypes = Object.entries(customerProjectDocumentTypes)
      .filter(([, definition]) => definition.step === stepNumber)
      .map(([documentType]) => documentType);
    const documentsResult = await pool.query(
      'SELECT document_type FROM customer_project_documents WHERE project_id=$1 AND step_number=$2',
      [project.id, stepNumber]
    );
    const uploadedTypes = new Set(documentsResult.rows.map((row) => row.document_type));
    if (requiredTypes.some((documentType) => !uploadedTypes.has(documentType))) {
      return res.status(409).json({ ok: false, message: 'Upload all required documents before submitting this step.' });
    }
    const updateResult = await pool.query(
      `UPDATE customer_project_steps SET status='awaiting_review', staff_note=NULL, updated_at=NOW()
       WHERE project_id=$1 AND step_number=$2 AND status IN ('pending','rejected')
       RETURNING step_number`,
      [project.id, stepNumber]
    );
    if (!updateResult.rows[0]) return res.status(409).json({ ok: false, message: 'This step has already changed. Refresh your project progress.' });
    await pool.query('UPDATE customer_projects SET updated_at=NOW() WHERE id=$1', [project.id]);
    res.json({ ok: true, message: 'Step submitted for admin review.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to submit this project step for review.' });
  }
});

app.get('/api/customer/project/documents/:documentId', requireCustomer, async (req, res) => {
  const documentId = parsePositiveInteger(req.params.documentId);
  if (!documentId) return res.status(400).json({ ok: false, message: 'A valid document is required.' });
  try {
    const result = await pool.query(
      `SELECT d.storage_name, d.original_name, d.mime_type
       FROM customer_project_documents d
       JOIN customer_projects p ON p.id=d.project_id
       WHERE d.id=$1 AND p.customer_id=$2 LIMIT 1`,
      [documentId, req.customer.id]
    );
    const document = result.rows[0];
    if (!document) return res.status(404).json({ ok: false, message: 'Document not found.' });
    res.type(document.mime_type).download(path.join(privateCustomerUploadDir, document.storage_name), document.original_name);
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to download this document.' });
  }
});

app.get('/api/admin/customer-projects', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.project_code, p.current_step, p.status, p.service_charge, p.created_at, p.updated_at,
              c.customer_code, c.full_name, c.email, c.phone,
              s.status AS current_step_status
       FROM customer_projects p
       JOIN managed_customers c ON c.id=p.customer_id
       LEFT JOIN customer_project_steps s ON s.project_id=p.id AND s.step_number=p.current_step
       WHERE p.status <> 'completed'
       ORDER BY p.updated_at DESC, p.id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load customer project progress.' });
  }
});

app.get('/api/admin/my-projects', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.project_code, p.current_step, p.status, p.service_charge, p.created_at, p.updated_at,
              c.customer_code, c.full_name, c.email, c.phone,
              s.status AS current_step_status
       FROM customer_projects p
       JOIN managed_customers c ON c.id=p.customer_id
       LEFT JOIN customer_project_steps s ON s.project_id=p.id AND s.step_number=p.current_step
       WHERE p.status='completed'
       ORDER BY p.updated_at DESC, p.id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load completed customer projects.' });
  }
});

app.get('/api/admin/customer-projects/:projectId', requireAdmin, async (req, res) => {
  const projectId = parsePositiveInteger(req.params.projectId);
  if (!projectId) return res.status(400).json({ ok: false, message: 'A valid project is required.' });
  try {
    const result = await pool.query(
      `SELECT p.*, c.customer_code, c.full_name, c.email, c.phone
       FROM customer_projects p JOIN managed_customers c ON c.id=p.customer_id
       WHERE p.id=$1 LIMIT 1`,
      [projectId]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Customer project not found.' });
    const data = await getCustomerProjectSnapshot(result.rows[0], `/api/admin/customer-projects/${projectId}/documents`);
    res.json({ ok: true, data: { ...data, customer: {
      customerCode: result.rows[0].customer_code,
      fullName: result.rows[0].full_name,
      email: result.rows[0].email,
      phone: result.rows[0].phone
    } } });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load project details.' });
  }
});

app.get('/api/admin/customer-projects/:projectId/documents/:documentId', requireAdmin, async (req, res) => {
  const projectId = parsePositiveInteger(req.params.projectId);
  const documentId = parsePositiveInteger(req.params.documentId);
  if (!projectId || !documentId) return res.status(400).json({ ok: false, message: 'A valid project document is required.' });
  try {
    const result = await pool.query(
      'SELECT storage_name, original_name, mime_type FROM customer_project_documents WHERE id=$1 AND project_id=$2 LIMIT 1',
      [documentId, projectId]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Project document not found.' });
    res.type(result.rows[0].mime_type).download(
      path.join(privateCustomerUploadDir, result.rows[0].storage_name),
      result.rows[0].original_name
    );
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to download project document.' });
  }
});

app.patch('/api/admin/customer-projects/:projectId/steps/:stepNumber', requireAdmin, async (req, res) => {
  const projectId = parsePositiveInteger(req.params.projectId);
  const stepNumber = Number(req.params.stepNumber);
  const status = String(req.body?.status || '');
  const staffNote = String(req.body?.staffNote || '').trim().slice(0, 2000) || null;
  if (!projectId || !Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 5) {
    return res.status(400).json({ ok: false, message: 'A valid customer project step is required.' });
  }
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ ok: false, message: 'Choose approved or rejected.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const projectResult = await client.query('SELECT * FROM customer_projects WHERE id=$1 FOR UPDATE', [projectId]);
    const project = projectResult.rows[0];
    if (!project) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Customer project not found.' });
    }
    if (project.status === 'completed' || project.current_step !== stepNumber) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'Only the current project step can be reviewed.' });
    }
    const stepResult = await client.query(
      'SELECT status FROM customer_project_steps WHERE project_id=$1 AND step_number=$2 FOR UPDATE',
      [projectId, stepNumber]
    );
    if (stepResult.rows[0]?.status !== 'awaiting_review') {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'This step is not waiting for review.' });
    }
    const requiredTypes = Object.entries(customerProjectDocumentTypes)
      .filter(([, definition]) => definition.step === stepNumber)
      .map(([documentType]) => documentType);
    const docsResult = await client.query(
      'SELECT document_type FROM customer_project_documents WHERE project_id=$1 AND step_number=$2',
      [projectId, stepNumber]
    );
    const uploaded = new Set(docsResult.rows.map((row) => row.document_type));
    if (requiredTypes.some((documentType) => !uploaded.has(documentType))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'Required documents for this step are still missing.' });
    }
    await client.query(
      'UPDATE customer_project_steps SET status=$1, staff_note=$2, updated_at=NOW() WHERE project_id=$3 AND step_number=$4',
      [status, staffNote, projectId, stepNumber]
    );
    if (status === 'approved') {
      const completed = stepNumber === 5;
      await client.query(
        'UPDATE customer_projects SET current_step=$1, status=$2, updated_at=NOW() WHERE id=$3',
        [completed ? 5 : stepNumber + 1, completed ? 'completed' : 'in_progress', projectId]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, message: status === 'approved' ? 'Step approved.' : 'Step returned for correction.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ ok: false, message: 'Unable to update project step.' });
  } finally {
    client.release();
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, message: 'Server healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Database unavailable', error: error.message });
  }
});

app.get('/api/site-settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key_name, value_text, value_json FROM site_settings');
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key_name] = row.value_json ?? row.value_text ?? null;
    });
    res.json({ ok: true, data: settings });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

const editableSiteSettings = [
  'site_name', 'default_language', 'company_email', 'company_phone', 'company_address',
  'payment_bank_name', 'payment_account_name', 'payment_account_number',
  'payment_method_1_name', 'payment_method_2_name', 'payment_method_3_name'
];
const paymentQrSettingKeys = [1, 2, 3].map((slot) => `payment_method_${slot}_qr_image_url`).concat('payment_qr_image_url');

const parsePaymentQrUpload = (req, res, next) => {
  paymentQrUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const statusCode = error instanceof multer.MulterError ? 400 : 415;
    return res.status(statusCode).json({ ok: false, message: error.message || 'Unable to upload the payment QR image.' });
  });
};

const savePaymentQrUpload = async (req, res) => {
  const slot = Number(req.params.slot || 3);
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ ok: false, message: 'Choose a QR payment slot from 1 to 3.' });
  }
  if (!req.file) return res.status(400).json({ ok: false, message: 'Choose a QR image to upload.' });
  if (!(await hasValidPaymentQrSignature(req.file))) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(415).json({ ok: false, message: 'The selected file is not a valid PNG, JPG, or WebP image.' });
  }
  const imageUrl = `/assets/images/payment-qr/${path.basename(req.file.filename)}`;
  const settingKey = `payment_method_${slot}_qr_image_url`;
  try {
    const previousResult = await pool.query(
      `SELECT value_text FROM site_settings
       WHERE key_name=$1 OR ($2=3 AND key_name='payment_qr_image_url')
       ORDER BY (key_name=$1) DESC LIMIT 1`,
      [settingKey, slot]
    );
    await pool.query(
      `INSERT INTO site_settings (key_name, value_text)
       VALUES ($1, $2)
       ON CONFLICT (key_name) DO UPDATE SET value_text=EXCLUDED.value_text, value_json=NULL, updated_at=NOW()`,
      [settingKey, imageUrl]
    );
    const previousUrl = previousResult.rows[0]?.value_text || '';
    if (previousUrl.startsWith('/assets/images/payment-qr/')) {
      await fs.promises.unlink(path.join(paymentQrDirectory, path.basename(previousUrl))).catch(() => {});
    }
    res.status(201).json({ ok: true, data: { slot, imageUrl }, message: 'Payment QR image uploaded.' });
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    res.status(500).json({ ok: false, message: 'Unable to save the payment QR image.' });
  }
};

app.post('/api/admin/settings/payment-qr', requireAdmin, parsePaymentQrUpload, savePaymentQrUpload);
app.post('/api/admin/settings/payment-qr/:slot', requireAdmin, parsePaymentQrUpload, savePaymentQrUpload);

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT key_name, value_text FROM site_settings WHERE key_name = ANY($1::text[]) OR key_name = ANY($2::text[])',
      [editableSiteSettings, paymentQrSettingKeys]
    );
    res.json({ ok: true, data: Object.fromEntries(result.rows.map((row) => [row.key_name, row.value_text || ''])) });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load site settings.' });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  const settings = req.body || {};
  const values = Object.fromEntries(editableSiteSettings.map((key) => [key, String(settings[key] || '').trim()]));
  if (!values.site_name || !values.company_email || !values.company_address) {
    return res.status(400).json({ ok: false, message: 'Site name, company email, and address are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.company_email)) {
    return res.status(400).json({ ok: false, message: 'Enter a valid company email address.' });
  }
  if (!['en', 'np'].includes(values.default_language)) {
    return res.status(400).json({ ok: false, message: 'Choose a supported default language.' });
  }
  if (values.site_name.length > 255 || values.company_email.length > 255 || values.company_phone.length > 50 || values.company_address.length > 1000) {
    return res.status(400).json({ ok: false, message: 'One or more settings exceed the allowed length.' });
  }
  if (values.payment_bank_name.length > 150 || values.payment_account_name.length > 255 || values.payment_account_number.length > 100) {
    return res.status(400).json({ ok: false, message: 'Payment account details exceed the allowed length.' });
  }
  if ([1, 2, 3].some((slot) => !values[`payment_method_${slot}_name`] || values[`payment_method_${slot}_name`].length > 60)) {
    return res.status(400).json({ ok: false, message: 'Enter a label up to 60 characters for each payment method.' });
  }
  try {
    for (const key of editableSiteSettings) {
      await pool.query(
        `INSERT INTO site_settings (key_name, value_text)
         VALUES ($1, $2)
         ON CONFLICT (key_name) DO UPDATE SET value_text = EXCLUDED.value_text, value_json = NULL, updated_at = NOW()`,
        [key, values[key]]
      );
    }
    res.json({ ok: true, data: values });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to save site settings.' });
  }
});

app.get('/api/translations', (req, res) => {
  try {
    const translationData = fs.readFileSync(path.join(rootDir, 'js', 'translations.js'), 'utf8');
    const match = translationData.match(/const translations\s*=\s*(\{[\s\S]*?\});?\s*$/);
    if (!match) {
      return res.status(500).json({ ok: false, message: 'Translations file not found or malformed' });
    }
    res.json({ ok: true, data: JSON.parse(match[1]) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/locations/provinces', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, code FROM provinces ORDER BY name');
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load provinces.' });
  }
});

app.get('/api/locations/districts', async (req, res) => {
  const provinceId = parsePositiveInteger(req.query.provinceId);
  if (!provinceId) return res.status(400).json({ ok: false, message: 'A valid provinceId is required.' });
  try {
    const result = await pool.query(
      'SELECT id, province_id, name, code FROM districts WHERE province_id = $1 ORDER BY name',
      [provinceId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load districts.' });
  }
});

app.get('/api/locations/municipalities', async (req, res) => {
  const districtId = parsePositiveInteger(req.query.districtId);
  if (!districtId) return res.status(400).json({ ok: false, message: 'A valid districtId is required.' });
  try {
    const result = await pool.query(
      'SELECT id, district_id, name, local_type FROM municipalities WHERE district_id = $1 ORDER BY name',
      [districtId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load municipalities.' });
  }
});

app.get('/api/locations/wards', async (req, res) => {
  const municipalityId = parsePositiveInteger(req.query.municipalityId);
  if (!municipalityId) return res.status(400).json({ ok: false, message: 'A valid municipalityId is required.' });
  try {
    const result = await pool.query(
      'SELECT id, municipality_id, ward_number FROM wards WHERE municipality_id = $1 ORDER BY ward_number',
      [municipalityId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load wards.' });
  }
});

app.get('/api/branches/stats', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT b.id)::int AS total,
        COUNT(DISTINCT b.id) FILTER (WHERE b.branch_type = 'provincial')::int AS provincial,
        COUNT(DISTINCT b.id) FILTER (WHERE b.branch_type = 'district')::int AS district,
        COUNT(DISTINCT b.id) FILTER (WHERE b.branch_type = 'municipality')::int AS municipality,
        COUNT(DISTINCT b.id) FILTER (WHERE b.branch_type = 'ward')::int AS ward
       FROM branches b WHERE b.is_published = TRUE`
    );
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load branch statistics.' });
  }
});

app.get('/api/branches', async (req, res) => {
  const page = parsePositiveInteger(req.query.page) || 1;
  const requestedLimit = parsePositiveInteger(req.query.limit) || 12;
  const limit = Math.min(requestedLimit, 50);
  const offset = (page - 1) * limit;
  const filters = ['b.is_published = TRUE'];
  const values = [];
  const addFilter = (sql, value) => {
    values.push(value);
    filters.push(`${sql} $${values.length}`);
  };
  ['provinceId', 'districtId', 'municipalityId', 'wardId'].forEach((key) => {
    const value = parsePositiveInteger(req.query[key]);
    if (value) addFilter(`b.${key.replace('Id', '_id')} =`, value);
  });
  const branchId = parsePositiveInteger(req.query.branchId);
  if (branchId) addFilter('b.id =', branchId);
  const text = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
  if (text) {
    values.push(`%${text}%`);
    const placeholder = `$${values.length}`;
    filters.push(`(b.branch_name ILIKE ${placeholder} OR b.branch_code ILIKE ${placeholder} OR b.full_address ILIKE ${placeholder} OR p.name ILIKE ${placeholder} OR d.name ILIKE ${placeholder} OR m.name ILIKE ${placeholder})`);
  }
  if (['provincial', 'district', 'municipality', 'ward'].includes(req.query.branchType)) addFilter('b.branch_type =', req.query.branchType);
  if (['active', 'planned', 'temporarily_closed'].includes(req.query.status)) addFilter('b.status =', req.query.status);
  try {
    const where = filters.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(DISTINCT b.id)::int AS total ${publicBranchJoins} WHERE ${where}`, values);
    const dataValues = values.concat([limit, offset]);
    const result = await pool.query(
      `SELECT ${publicBranchColumns} ${publicBranchJoins}
       WHERE ${where} ORDER BY p.name, d.name, m.name, w.ward_number NULLS LAST, b.branch_name
       LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
      dataValues
    );
    res.json({ ok: true, data: result.rows, pagination: { page, limit, total: countResult.rows[0].total, pages: Math.ceil(countResult.rows[0].total / limit) } });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load branches.' });
  }
});

app.get('/api/branches/:id', async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid branch id is required.' });
  try {
    const result = await pool.query(
      `SELECT ${publicBranchColumns} ${publicBranchJoins}
       WHERE b.id = $1 AND b.is_published = TRUE`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Published branch not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load branch details.' });
  }
});

app.get('/api/admin/branches', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT ${publicBranchColumns}, b.is_published, b.created_at, b.updated_at ${publicBranchJoins} ORDER BY b.created_at DESC`);
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load branch records.' });
  }
});

app.post('/api/admin/branches', requireAdmin, async (req, res) => {
  const branch = req.body || {};
  const required = ['branchCode', 'branchName', 'branchType', 'provinceId', 'districtId', 'municipalityId'];
  if (required.some((key) => !branch[key])) return res.status(400).json({ ok: false, message: 'Branch code, name, type, and location are required.' });
  if (!['provincial', 'district', 'municipality', 'ward'].includes(branch.branchType)) return res.status(400).json({ ok: false, message: 'Invalid branch type.' });
  if (branch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(branch.email))) return res.status(400).json({ ok: false, message: 'A valid branch email is required.' });
  if (branch.phone && !/^[+()\d\s-]{7,50}$/.test(String(branch.phone))) return res.status(400).json({ ok: false, message: 'A valid branch phone number is required.' });
  try {
    const location = await pool.query(
      `SELECT 1 FROM districts d
       JOIN municipalities m ON m.district_id = d.id
       WHERE d.id = $1 AND d.province_id = $2 AND m.id = $3`,
      [branch.districtId, branch.provinceId, branch.municipalityId]
    );
    if (!location.rows[0]) return res.status(400).json({ ok: false, message: 'Branch location hierarchy is inconsistent.' });
    if (branch.branchType === 'ward' && !branch.wardId) return res.status(400).json({ ok: false, message: 'Ward branches require a ward assignment.' });
    const result = await pool.query(
      `INSERT INTO branches (branch_code, branch_name, branch_type, province_id, district_id, municipality_id, ward_id, full_address, manager_name, designation, phone, alternate_phone, email, opening_hours, status, latitude, longitude, established_date, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [branch.branchCode, branch.branchName, branch.branchType, branch.provinceId, branch.districtId, branch.municipalityId, branch.wardId || null, branch.fullAddress || null, branch.managerName || null, branch.designation || null, branch.phone || null, branch.alternatePhone || null, branch.email || null, branch.openingHours || null, branch.status || 'planned', branch.latitude || null, branch.longitude || null, branch.establishedDate || null, branch.isPublished === true]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    const duplicate = error.code === '23505';
    res.status(duplicate ? 409 : 400).json({ ok: false, message: duplicate ? 'Branch code already exists.' : 'Unable to create branch record.' });
  }
});

app.patch('/api/admin/branches/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid branch id is required.' });
  const allowed = {
    branchName: 'branch_name', branchType: 'branch_type', provinceId: 'province_id', districtId: 'district_id',
    municipalityId: 'municipality_id', wardId: 'ward_id', fullAddress: 'full_address', managerName: 'manager_name',
    designation: 'designation', phone: 'phone', alternatePhone: 'alternate_phone', email: 'email',
    openingHours: 'opening_hours', status: 'status', latitude: 'latitude', longitude: 'longitude',
    establishedDate: 'established_date', isPublished: 'is_published'
  };
  const updates = Object.entries(allowed).filter(([key]) => Object.prototype.hasOwnProperty.call(req.body || {}, key));
  if (!updates.length) return res.status(400).json({ ok: false, message: 'No editable branch fields supplied.' });
  const values = updates.map(([key]) => req.body[key]);
  const assignments = updates.map(([, column], index) => `${column} = $${index + 1}`);
  values.push(id);
  try {
    const result = await pool.query(`UPDATE branches SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING id`, values);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Branch not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({ ok: false, message: 'Unable to update branch record.' });
  }
});

const normalizeManagedUserId = (body = {}, { requirePassword = false } = {}) => {
  const idType = String(body.idType || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = normalizeCustomerLoginPhone(body.phone);
  const password = String(body.password || '');
  const permissions = Array.isArray(body.permissions) ? [...new Set(body.permissions.map(String))] : [];
  if (!['member', 'employee', 'agent'].includes(idType)) return { error: 'Choose a valid user ID type.' };
  if (fullName.length < 2 || fullName.length > 255) return { error: 'Enter a valid full name.' };
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)) return { error: 'Enter a valid email address.' };
  if (phone.length > 50) return { error: 'Phone number is too long.' };
  if (['employee', 'agent'].includes(idType)) {
    if (!email || email.length > 255) return { error: 'Employee and agent accounts require a valid email for login.' };
    if (!isValidCustomerLoginPhone(phone)) return { error: 'Enter a valid phone number to use as the login username.' };
    if (requirePassword && password.length !== 6) return { error: 'Password must be exactly 6 characters.' };
    if (password && password.length !== 6) return { error: 'Password must be exactly 6 characters.' };
    if (permissions.some((permission) => !staffPermissionKeys.includes(permission))) return { error: 'One or more selected permissions are invalid.' };
    if (!permissions.includes('dashboard')) return { error: 'Dashboard access is required for staff accounts.' };
  }
  return { value: { idType, fullName: fullName.slice(0, 255), email: email.slice(0, 255) || null, phone: phone.slice(0, 50) || null, password, permissions } };
};

app.get('/api/admin/agent-applications', requireAdmin, async (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 120);
  const status = ['pending', 'under_review', 'approved', 'rejected'].includes(String(req.query.status || ''))
    ? String(req.query.status)
    : '';
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
  const filters = [];
  const values = [];
  if (status) {
    values.push(status);
    filters.push(`status=$${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    const searchParameter = `$${values.length}`;
    filters.push(`(application_code ILIKE ${searchParameter} OR full_name ILIKE ${searchParameter} OR phone ILIKE ${searchParameter} OR email ILIKE ${searchParameter} OR district ILIKE ${searchParameter})`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const countResult = await pool.query(`SELECT COUNT(*)::integer AS total FROM agent_applications ${where}`, values);
    const result = await pool.query(
      `SELECT id,application_code,full_name,phone,email,district,municipality,address,experience_years,coverage_area,message,privacy_consent,status,internal_notes,created_at,updated_at
       FROM agent_applications ${where} ORDER BY created_at DESC,id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );
    res.json({ ok: true, data: result.rows, total: countResult.rows[0].total, limit, offset });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load Agent applications.' });
  }
});

app.patch('/api/admin/agent-applications/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid Agent application is required.' });
  const status = String(req.body?.status || '').trim();
  const internalNotes = String(req.body?.internalNotes || '').trim();
  if (!['pending', 'under_review', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ ok: false, message: 'Choose a valid application status.' });
  }
  if (internalNotes.length > 2000) return res.status(400).json({ ok: false, message: 'Internal notes must be 2000 characters or fewer.' });
  try {
    const result = await pool.query(
      `UPDATE agent_applications SET status=$1,internal_notes=$2,updated_at=NOW() WHERE id=$3
       RETURNING id,application_code,status,internal_notes,updated_at`,
      [status, internalNotes || null, id]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Agent application not found.' });
    res.json({ ok: true, data: result.rows[0], message: 'Agent application review saved.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to save Agent application review.' });
  }
});

app.get('/api/admin/user-management/ids', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM managed_user_ids ORDER BY created_at DESC, id DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load managed user IDs.' });
  }
});

app.get('/api/admin/accounts', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, is_active, created_at
       FROM users WHERE role IN ('admin','manager','super_admin')
       ORDER BY created_at DESC, id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load admin accounts.' });
  }
});

app.post('/api/admin/accounts/admin', requireAdmin, async (req, res) => {
  if (req.adminUser.role !== 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Only a super administrator can create admin accounts.' });
  }
  const username = normalizeCustomerLoginPhone(req.body?.phone);
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!isValidCustomerLoginPhone(username)) return res.status(400).json({ ok: false, message: 'Enter a valid phone number to use as the login username.' });
  if (fullName.length < 2 || fullName.length > 255) return res.status(400).json({ ok: false, message: 'Enter a valid full name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return res.status(400).json({ ok: false, message: 'Enter a valid email address.' });
  if (password.length !== 6) return res.status(400).json({ ok: false, message: 'Admin password must be exactly 6 characters.' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username,email,password_hash,role,full_name,is_active)
       VALUES ($1,$2,$3,'admin',$4,true)
       RETURNING id,username,email,full_name,role,is_active,created_at`,
      [username, email, passwordHash, fullName]
    );
    res.status(201).json({ ok: true, data: result.rows[0], message: 'Admin account created.' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ ok: false, message: 'That phone number or email is already in use.' });
    res.status(500).json({ ok: false, message: 'Unable to create admin account.' });
  }
});

app.post('/api/admin/user-management/ids', requireAdmin, async (req, res) => {
  const normalized = normalizeManagedUserId(req.body, { requirePassword: true });
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const { idType, fullName, email, phone, password, permissions } = normalized.value;
  const prefix = { member: 'MEM', employee: 'EMP', agent: 'AGT' }[idType];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const identityResult = await client.query(
      "SELECT nextval(pg_get_serial_sequence('managed_user_ids', 'id'))::integer AS id"
    );
    const id = identityResult.rows[0].id;
    const idCode = `ACL-${prefix}-${String(id).padStart(5, '0')}`;
    const passwordHash = ['employee', 'agent'].includes(idType) ? await bcrypt.hash(password, 12) : null;
    const userResult = passwordHash
      ? await client.query(
        `INSERT INTO users (username,email,password_hash,role,full_name,is_active)
        VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
        [phone, email, passwordHash, idType, fullName]
      )
      : { rows: [null] };
    const userId = userResult.rows[0]?.id || null;
    const result = await client.query(
      `INSERT INTO managed_user_ids (id,id_type,id_code,full_name,email,phone,permissions,user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
      [id, idType, idCode, fullName, email, phone, JSON.stringify(permissions), userId]
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true, data: { ...result.rows[0], login_username: userId ? phone : null }, message: `${idType === 'employee' ? 'Employee' : idType === 'agent' ? 'Agent' : 'Member'} ID created${userId ? ' with login access' : ''}.` });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(error.code === '23505' ? 409 : 400).json({ ok: false, message: error.code === '23505' ? 'That email or login ID is already in use.' : 'Unable to create user ID record.' });
  } finally {
    client.release();
  }
});

app.patch('/api/admin/user-management/ids/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid user ID record is required.' });
  const normalized = normalizeManagedUserId(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const { idType, fullName, email, phone, password, permissions } = normalized.value;
  const prefix = { member: 'MEM', employee: 'EMP', agent: 'AGT' }[idType];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingResult = await client.query('SELECT * FROM managed_user_ids WHERE id=$1 FOR UPDATE', [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'User ID record not found.' });
    }
    const idCode = `ACL-${prefix}-${String(id).padStart(5, '0')}`;
    if (existing.user_id && !['employee', 'agent'].includes(idType)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'A login-enabled staff account cannot be changed to a member ID.' });
    }
    let userId = existing.user_id;
    if (['employee', 'agent'].includes(idType)) {
      if (!userId && !password) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'Set a 6-character password to enable this staff login.' });
      }
      const passwordHash = password ? await bcrypt.hash(password, 12) : null;
      if (userId) {
        await client.query(
          `UPDATE users SET username=$1,email=$2,full_name=$3,role=$4,
             password_hash=COALESCE($5,password_hash),is_active=true,updated_at=NOW()
           WHERE id=$6`,
          [phone, email, fullName, idType, passwordHash, userId]
        );
      } else {
        const userResult = await client.query(
          `INSERT INTO users (username,email,password_hash,role,full_name,is_active)
           VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
          [phone, email, passwordHash, idType, fullName]
        );
        userId = userResult.rows[0].id;
      }
    }
    const result = await client.query(
      `UPDATE managed_user_ids
       SET id_type=$1,id_code=$2,full_name=$3,email=$4,phone=$5,permissions=$6::jsonb,user_id=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [idType, idCode, fullName, email, phone, JSON.stringify(permissions), userId, id]
    );
    await client.query('COMMIT');
    res.json({ ok: true, data: { ...result.rows[0], login_username: userId ? phone : null }, message: 'Staff permissions and profile saved.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(error.code === '23505' ? 409 : 400).json({ ok: false, message: error.code === '23505' ? 'That email or login ID is already in use.' : 'Unable to update user ID record.' });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/user-management/ids/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid user ID record is required.' });
  try {
    const result = await pool.query('DELETE FROM managed_user_ids WHERE id=$1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'User ID record not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to delete user ID record.' });
  }
});

const normalizeInventoryItem = (body = {}) => {
  const name = String(body.name || '').trim();
  const category = String(body.category || '').trim();
  const unit = String(body.unit || '').trim();
  const supplier = String(body.supplier || '').trim();
  const notes = String(body.notes || '').trim();
  const quantity = Number(body.quantity);
  const unitCost = Number(body.unitCost || 0);
  const reorderLevel = Number(body.reorderLevel || 0);
  if (!name || name.length > 255) return { error: 'Item name is required and must be 255 characters or fewer.' };
  if (category.length > 100 || unit.length < 1 || unit.length > 30 || supplier.length > 255 || notes.length > 2000) {
    return { error: 'One or more inventory fields exceed the allowed length.' };
  }
  if (![quantity, unitCost, reorderLevel].every(Number.isFinite) || quantity < 0 || unitCost < 0 || reorderLevel < 0) {
    return { error: 'Quantity, unit cost, and low-stock level must be valid non-negative numbers.' };
  }
  return { value: { name, category: category || null, quantity, unit, unitCost, reorderLevel, supplier: supplier || null, notes: notes || null } };
};

app.get('/api/admin/inventory', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_items ORDER BY category NULLS LAST, name ASC, id ASC');
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load inventory.' });
  }
});

app.post('/api/admin/inventory', requireAdmin, async (req, res) => {
  const normalized = normalizeInventoryItem(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const item = normalized.value;
  try {
    const result = await pool.query(
      `INSERT INTO inventory_items (name,category,quantity,unit,unit_cost,reorder_level,supplier,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [item.name, item.category, item.quantity, item.unit, item.unitCost, item.reorderLevel, item.supplier, item.notes]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to create inventory item.' });
  }
});

app.patch('/api/admin/inventory/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid inventory item is required.' });
  const normalized = normalizeInventoryItem(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const item = normalized.value;
  try {
    const result = await pool.query(
      `UPDATE inventory_items
       SET name=$1,category=$2,quantity=$3,unit=$4,unit_cost=$5,reorder_level=$6,supplier=$7,notes=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [item.name, item.category, item.quantity, item.unit, item.unitCost, item.reorderLevel, item.supplier, item.notes, id]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Inventory item not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to update inventory item.' });
  }
});

app.delete('/api/admin/inventory/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid inventory item is required.' });
  try {
    const result = await pool.query('DELETE FROM inventory_items WHERE id=$1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Inventory item not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to delete inventory item.' });
  }
});

const normalizeManagedCustomer = (body = {}) => {
  const fullName = String(body.fullName || body.name || '').trim();
  const email = String(body.email || '').trim();
  const phone = normalizeCustomerLoginPhone(body.phone);
  const address = String(body.address || '').trim();
  if (!fullName) return { error: 'Customer name is required.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid customer email address.' };
  if (fullName.length > 255 || email.length > 255 || phone.length > 50 || address.length > 2000) {
    return { error: 'One or more customer fields exceed the allowed length.' };
  }
  return { value: { fullName, email: email || null, phone: phone || null, address: address || null } };
};

app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, customer_code, full_name, email, phone, address, created_at, updated_at FROM managed_customers ORDER BY created_at DESC, id DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load customers.' });
  }
});

app.post('/api/admin/customers', requireAdmin, async (req, res) => {
  const normalized = normalizeManagedCustomer(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const customer = normalized.value;
  try {
    const result = await pool.query(
      `WITH next_customer AS (
         SELECT nextval(pg_get_serial_sequence('managed_customers', 'id'))::integer AS id
       )
       INSERT INTO managed_customers (id, customer_code, full_name, email, phone, address)
       SELECT id, 'ACL-CUS-' || LPAD(id::text, 5, '0'), $1, $2, $3, $4
       FROM next_customer
      RETURNING id, customer_code, full_name, email, phone, address, created_at, updated_at`,
      [customer.fullName, customer.email, customer.phone, customer.address]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ ok: false, message: 'Unable to create customer.' });
  }
});

app.patch('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid customer record is required.' });
  const normalized = normalizeManagedCustomer(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const customer = normalized.value;
  const pin = String(req.body?.pin || '').trim();
  if (pin && !/^\d{6}$/.test(pin)) return res.status(400).json({ ok: false, message: 'Customer PIN must contain exactly 6 digits.' });
  const passwordHash = pin ? await bcrypt.hash(pin, 12) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE managed_customers
       SET full_name=$1, email=$2, phone=$3, address=$4,
           password_hash=COALESCE($5, password_hash), updated_at=NOW()
      WHERE id=$6 RETURNING id, customer_code, full_name, email, phone, address, created_at, updated_at`,
      [customer.fullName, customer.email, customer.phone, customer.address, passwordHash, id]
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Customer not found.' });
    }
    if (passwordHash) await client.query('DELETE FROM customer_sessions WHERE customer_id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ ok: false, message: 'Unable to update customer.' });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid customer record is required.' });
  try {
    const result = await pool.query('DELETE FROM managed_customers WHERE id=$1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Customer not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to delete customer.' });
  }
});

app.post('/api/contact', contactRateLimit, async (req, res) => {
  const { name, email, phone, province, district, municipality, ward, branchType, branchNumber, locationCode, subject, message, website } = req.body || {};

  if (website) {
    return res.status(200).json({ ok: true, message: 'Contact message submitted successfully.' });
  }

  if (typeof name !== 'string' || typeof message !== 'string' || name.trim().length < 2 || message.trim().length < 10) {
    return res.status(400).json({ ok: false, message: 'Name and message are required.' });
  }

  const emailValue = typeof email === 'string' ? email.trim() : '';
  if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  const allowedBranchTypes = new Set(['head', 'province']);
  const normalizedBranchType = allowedBranchTypes.has(branchType) ? branchType : null;
  const wardNumber = ward === '' || ward === null || typeof ward === 'undefined' ? null : Number(ward);
  if (wardNumber !== null && (!Number.isInteger(wardNumber) || wardNumber < 1 || wardNumber > 32)) {
    return res.status(400).json({ ok: false, message: 'Ward number must be between 1 and 32.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contact_inquiries (name, email, phone, province, district, municipality, ward_number, branch_type, branch_number, location_code, subject, message, status, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', 'website')
       RETURNING *`,
      [
        name.trim().slice(0, 255),
        emailValue || null,
        typeof phone === 'string' ? phone.trim().slice(0, 50) || null : null,
        typeof province === 'string' ? province.trim().slice(0, 120) || null : null,
        typeof district === 'string' ? district.trim().slice(0, 120) || null : null,
        typeof municipality === 'string' ? municipality.trim().slice(0, 160) || null : null,
        wardNumber,
        normalizedBranchType,
        typeof branchNumber === 'string' ? branchNumber.trim().slice(0, 50) || null : null,
        typeof locationCode === 'string' ? locationCode.trim().slice(0, 100) || null : null,
        typeof subject === 'string' ? subject.trim().slice(0, 255) || null : null,
        message.trim().slice(0, 10000)
      ]
    );

    res.status(201).json({
      ok: true,
      message: 'Contact message submitted successfully.',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to save inquiry.', error: error.message });
  }
});

app.post('/api/investment-apply', async (req, res) => {
  const {
    fullName,
    phone,
    email,
    district,
    municipality,
    farmingSector,
    investmentAmount,
    partnershipModel,
    message,
    privacyConsent
  } = req.body || {};

  if (!fullName || !phone || !district || !farmingSector || !investmentAmount) {
    return res.status(400).json({ ok: false, message: 'Please complete all required fields.' });
  }

  if (privacyConsent !== true) {
    return res.status(400).json({ ok: false, message: 'Privacy consent is required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO investment_applications (
        full_name,
        phone,
        email,
        district,
        municipality,
        sector,
        investment_amount,
        partnership_model,
        message,
        privacy_consent,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new') RETURNING *`,
      [
        fullName.trim(),
        phone.trim(),
        email || null,
        district.trim(),
        municipality || null,
        farmingSector.trim(),
        Number(investmentAmount),
        partnershipModel || null,
        message || null,
        true
      ]
    );

    const reference = `INV-${String(result.rows[0].id).padStart(6, '0')}`;
    res.status(201).json({
      ok: true,
      message: 'Investment application submitted successfully.',
      reference,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to submit investment application.', error: error.message });
  }
});

app.post('/api/agent-applications', agentApplicationRateLimit, async (req, res) => {
  const body = req.body || {};
  if (body.website) return res.status(200).json({ ok: true, message: 'Agent application submitted successfully.' });

  const fullName = String(body.fullName || '').trim();
  const phone = normalizeCustomerLoginPhone(body.phone);
  const email = String(body.email || '').trim().toLowerCase();
  const district = String(body.district || '').trim();
  const municipality = String(body.municipality || '').trim();
  const address = String(body.address || '').trim();
  const coverageArea = String(body.coverageArea || '').trim();
  const experienceYears = body.experienceYears === '' || body.experienceYears === null || typeof body.experienceYears === 'undefined'
    ? 0
    : Number(body.experienceYears);
  const message = String(body.message || '').trim();

  if (fullName.length < 2 || fullName.length > 255) return res.status(400).json({ ok: false, message: 'Enter your full name.' });
  if (!isValidCustomerLoginPhone(phone)) return res.status(400).json({ ok: false, message: 'Enter a valid phone number.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return res.status(400).json({ ok: false, message: 'Enter a valid email address.' });
  if (district.length < 2 || district.length > 120) return res.status(400).json({ ok: false, message: 'Enter your district.' });
  if (municipality.length > 160 || address.length > 1000) return res.status(400).json({ ok: false, message: 'One or more location fields are too long.' });
  if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 60) return res.status(400).json({ ok: false, message: 'Enter valid years of experience.' });
  if (coverageArea.length < 2 || coverageArea.length > 255) return res.status(400).json({ ok: false, message: 'Describe the area you can serve.' });
  if (message.length > 3000) return res.status(400).json({ ok: false, message: 'Your message is too long.' });
  if (body.privacyConsent !== true) return res.status(400).json({ ok: false, message: 'Privacy consent is required.' });

  try {
    const result = await pool.query(
      `WITH next_application AS (
         SELECT nextval(pg_get_serial_sequence('agent_applications', 'id'))::integer AS id
       )
       INSERT INTO agent_applications (id,application_code,full_name,phone,email,district,municipality,address,experience_years,coverage_area,message,privacy_consent)
       SELECT id,'ACL-AGT-APP-' || LPAD(id::text,6,'0'),$1,$2,$3,$4,$5,$6,$7,$8,$9,true FROM next_application
       RETURNING id,application_code,status,created_at`,
      [fullName, phone, email, district, municipality || null, address || null, experienceYears, coverageArea, message || null]
    );
    res.status(201).json({
      ok: true,
      message: 'Agent application submitted successfully.',
      reference: result.rows[0].application_code,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Agent application submission failed:', error.message);
    res.status(500).json({ ok: false, message: 'Unable to submit your Agent application right now.' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Username and password are required.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, COALESCE(m.permissions, '[]'::jsonb) AS permissions, m.id_code
       FROM users u LEFT JOIN managed_user_ids m ON m.user_id=u.id
       WHERE u.username = $1 OR u.email = $1 LIMIT 1`,
      [username]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    }

    const token = uuidv4();
    await pool.query(
      'INSERT INTO sessions (user_id, session_token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'' + '30 days' + '\')',
      [user.id, token]
    );

    res.json({ ok: true, token, user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      id_code: user.id_code,
      permissions: user.permissions
    } });
  } catch (error) {
    const databaseUnavailable = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code);
    console.error('Admin login failed:', error.code || error.message);
    res.status(databaseUnavailable ? 503 : 500).json({
      ok: false,
      message: databaseUnavailable
        ? 'Database unavailable. Start PostgreSQL and try again.'
        : 'Unable to log in right now. Please try again later.'
    });
  }
});

app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const [counts, recentInquiries, recentInvestmentApplications] = await Promise.all([
      pool.query(`
      SELECT
        (SELECT COUNT(*) FROM contact_inquiries) AS total_inquiries,
        (SELECT COUNT(*) FROM contact_inquiries WHERE status = 'new') AS new_inquiries,
        (SELECT COUNT(*) FROM investment_applications) AS investment_applications,
        (SELECT COUNT(*) FROM investment_applications WHERE status = 'new') AS new_investment_applications,
        (SELECT COUNT(*) FROM projects WHERE status = 'published') AS published_projects,
        (SELECT COUNT(*) FROM blog_posts WHERE status = 'published') AS published_blog_posts,
        (SELECT COUNT(*) FROM customer_project_steps WHERE status = 'awaiting_review') AS pending_project_approvals,
        (SELECT COUNT(*) FROM inventory_items WHERE quantity <= reorder_level) AS low_stock_items
      `),
      pool.query(
        `SELECT id,name,subject,status,created_at FROM contact_inquiries ORDER BY created_at DESC,id DESC LIMIT 5`
      ),
      pool.query(
        `SELECT id,full_name,sector,investment_amount,status,created_at FROM investment_applications ORDER BY created_at DESC,id DESC LIMIT 5`
      )
    ]);

    res.json({
      ok: true,
      data: {
        ...counts.rows[0],
        recent_inquiries: recentInquiries.rows,
        recent_investment_applications: recentInvestmentApplications.rows
      },
      profile: req.adminUser
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/admin/inquiries', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, subject, message, status, source, created_at
       FROM contact_inquiries
       ORDER BY created_at DESC, id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load contact inquiries.' });
  }
});

const normalizeAdminService = (body = {}) => {
  const titleEn = String(body.titleEn || '').trim();
  const status = String(body.status || 'draft');
  const sortOrder = body.sortOrder === '' || body.sortOrder === undefined ? 0 : Number(body.sortOrder);
  if (!titleEn) return { error: 'English service title is required.' };
  if (!['draft', 'published'].includes(status)) return { error: 'Service status must be draft or published.' };
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return { error: 'Sort order must be a non-negative whole number.' };

  const imageUrl = String(body.imageUrl || '').trim();
  if (/^(javascript|data):/i.test(imageUrl)) return { error: 'Provide a valid image URL or local path.' };

  const slug = titleEn.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `service-${Date.now()}`;

  return {
    value: {
      slug,
      category: String(body.category || '').trim() || null,
      titleEn,
      titleNp: String(body.titleNp || '').trim() || null,
      summaryEn: String(body.summaryEn || '').trim() || null,
      summaryNp: String(body.summaryNp || '').trim() || null,
      contentEn: String(body.contentEn || '').trim() || null,
      contentNp: String(body.contentNp || '').trim() || null,
      imageUrl: imageUrl || null,
      sortOrder,
      status
    }
  };
};

app.get('/api/admin/services', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, slug, category, title_en, title_np, summary_en, summary_np, content_en, content_np, image_url, sort_order, status, created_at, updated_at FROM services ORDER BY sort_order ASC, id ASC'
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load services.' });
  }
});

app.post('/api/admin/services', requireAdmin, async (req, res) => {
  const normalized = normalizeAdminService(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const service = normalized.value;
  try {
    const result = await pool.query(
      `INSERT INTO services (slug, category, title_en, title_np, summary_en, summary_np, content_en, content_np, image_url, sort_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, slug, category, title_en, title_np, summary_en, summary_np, content_en, content_np, image_url, sort_order, status`,
      [service.slug, service.category, service.titleEn, service.titleNp, service.summaryEn, service.summaryNp, service.contentEn, service.contentNp, service.imageUrl, service.sortOrder, service.status]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      ok: false,
      message: error.code === '23505' ? 'A service with this title already exists.' : 'Unable to create service.'
    });
  }
});

app.patch('/api/admin/services/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid service id is required.' });
  const normalized = normalizeAdminService(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const service = normalized.value;
  try {
    const result = await pool.query(
      `UPDATE services SET slug=$1, category=$2, title_en=$3, title_np=$4, summary_en=$5, summary_np=$6, content_en=$7, content_np=$8, image_url=$9, sort_order=$10, status=$11, updated_at=NOW()
      WHERE id=$12
       RETURNING id, slug, category, title_en, title_np, summary_en, summary_np, content_en, content_np, image_url, sort_order, status`,
      [service.slug, service.category, service.titleEn, service.titleNp, service.summaryEn, service.summaryNp, service.contentEn, service.contentNp, service.imageUrl, service.sortOrder, service.status, id]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Service not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      ok: false,
      message: error.code === '23505' ? 'A service with this title already exists.' : 'Unable to update service.'
    });
  }
});

app.delete('/api/admin/services/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid service id is required.' });
  try {
    const result = await pool.query('DELETE FROM services WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Service not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to delete service.' });
  }
});

const normalizeAdminProject = (body = {}) => {
  const titleEn = String(body.titleEn || '').trim();
  const status = String(body.status || 'draft');
  const sortOrder = body.sortOrder === '' || body.sortOrder === undefined ? 0 : Number(body.sortOrder);
  const projectStatus = String(body.projectStatus || 'planning');
  const progress = body.progress === '' || body.progress === undefined ? 0 : Number(body.progress);
  const budgetValue = body.estimatedBudget === '' || body.estimatedBudget === undefined || body.estimatedBudget === null
    ? null
    : Number(body.estimatedBudget);
  if (!titleEn) return { error: 'English project title is required.' };
  if (!['draft', 'published'].includes(status)) return { error: 'Project status must be draft or published.' };
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return { error: 'Sort order must be a non-negative whole number.' };
  if (!['planning', 'ongoing', 'completed', 'on_hold'].includes(projectStatus)) return { error: 'Invalid project status.' };
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return { error: 'Progress must be a whole number from 0 to 100.' };
  if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0)) return { error: 'Estimated budget must be a non-negative amount.' };

  const imageUrl = String(body.imageUrl || '').trim();
  if (/^(javascript|data):/i.test(imageUrl)) return { error: 'Provide a valid image URL or local path.' };
  const gallery = (Array.isArray(body.gallery) ? body.gallery : String(body.gallery || '').split(/\r?\n/))
    .map((item) => String(item).trim())
    .filter(Boolean);
  if (gallery.some((item) => /^(javascript|data):/i.test(item))) return { error: 'Gallery items must be valid image or video URLs.' };
  const slug = titleEn.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `project-${Date.now()}`;

  return {
    value: {
      slug,
      titleEn,
      titleNp: String(body.titleNp || '').trim() || null,
      category: String(body.category || '').trim() || null,
      summaryEn: String(body.summaryEn || '').trim() || null,
      summaryNp: String(body.summaryNp || '').trim() || null,
      contentEn: String(body.contentEn || '').trim() || null,
      contentNp: String(body.contentNp || '').trim() || null,
      location: [body.province, body.district, body.municipality].map((part) => String(part || '').trim()).filter(Boolean).join(', ') || String(body.location || '').trim() || null,
      province: String(body.province || '').trim() || null,
      district: String(body.district || '').trim() || null,
      municipality: String(body.municipality || '').trim() || null,
      objectives: String(body.objectives || '').trim() || null,
      projectScope: String(body.projectScope || '').trim() || null,
      targetBeneficiaries: String(body.targetBeneficiaries || '').trim() || null,
      estimatedBudget: budgetValue,
      duration: String(body.duration || '').trim() || null,
      projectStatus,
      progress,
      gallery,
      contactPerson: String(body.contactPerson || '').trim() || null,
      sortOrder,
      status,
      featured: body.featured === true || body.featured === 'true',
      imageUrl: imageUrl || null
    }
  };
};

app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC');
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load projects.' });
  }
});

app.post('/api/admin/projects', requireAdmin, async (req, res) => {
  const normalized = normalizeAdminProject(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const project = normalized.value;
  try {
    const idResult = await pool.query("SELECT nextval(pg_get_serial_sequence('projects', 'id'))::int AS id");
    const projectId = idResult.rows[0].id;
    const projectCode = `ACL-PRJ-${String(projectId).padStart(4, '0')}`;
    const result = await pool.query(
      `INSERT INTO projects (id, project_code, slug, title_en, title_np, category, summary_en, summary_np, content_en, content_np, location, province, district, municipality, objectives, project_scope, target_beneficiaries, estimated_budget, duration, project_status, progress, gallery, contact_person, sort_order, status, featured, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24,$25,$26,$27)
       RETURNING *`,
      [projectId, projectCode, project.slug, project.titleEn, project.titleNp, project.category, project.summaryEn, project.summaryNp, project.contentEn, project.contentNp, project.location, project.province, project.district, project.municipality, project.objectives, project.projectScope, project.targetBeneficiaries, project.estimatedBudget, project.duration, project.projectStatus, project.progress, JSON.stringify(project.gallery), project.contactPerson, project.sortOrder, project.status, project.featured, project.imageUrl]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      ok: false,
      message: error.code === '23505' ? 'A project with this title already exists.' : 'Unable to create project.'
    });
  }
});

app.patch('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid project id is required.' });
  const normalized = normalizeAdminProject(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const project = normalized.value;
  try {
    const result = await pool.query(
      `UPDATE projects SET slug=$1, title_en=$2, title_np=$3, category=$4, summary_en=$5, summary_np=$6, content_en=$7, content_np=$8, location=$9, province=$10, district=$11, municipality=$12, objectives=$13, project_scope=$14, target_beneficiaries=$15, estimated_budget=$16, duration=$17, project_status=$18, progress=$19, gallery=$20::jsonb, contact_person=$21, sort_order=$22, status=$23, featured=$24, image_url=$25, updated_at=NOW()
       WHERE id=$26 RETURNING *`,
      [project.slug, project.titleEn, project.titleNp, project.category, project.summaryEn, project.summaryNp, project.contentEn, project.contentNp, project.location, project.province, project.district, project.municipality, project.objectives, project.projectScope, project.targetBeneficiaries, project.estimatedBudget, project.duration, project.projectStatus, project.progress, JSON.stringify(project.gallery), project.contactPerson, project.sortOrder, project.status, project.featured, project.imageUrl, id]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Project not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      ok: false,
      message: error.code === '23505' ? 'A project with this title already exists.' : 'Unable to update project.'
    });
  }
});

app.delete('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid project id is required.' });
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Project not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to delete project.' });
  }
});

const normalizeAdminGalleryItem = (body = {}) => {
  const titleEn = String(body.titleEn || body.title || '').trim();
  const status = String(body.status || 'draft');
  if (!titleEn) return { error: 'Gallery title is required.' };
  if (!['draft', 'published'].includes(status)) return { error: 'Gallery status must be draft or published.' };

  const imageUrl = String(body.imageUrl || body.image || '').trim();
  if (!imageUrl) return { error: 'Image URL is required.' };
  if (/^(javascript|data):/i.test(imageUrl)) return { error: 'Provide a valid image URL or local path.' };

  return {
    value: {
      titleEn,
      titleNp: String(body.titleNp || '').trim() || null,
      category: String(body.category || '').trim() || null,
      imageUrl,
      altTextEn: String(body.altTextEn || '').trim() || null,
      altTextNp: String(body.altTextNp || '').trim() || null,
      status
    }
  };
};

app.get('/api/admin/gallery', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM gallery_items ORDER BY id ASC'
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load gallery items.' });
  }
});

app.post('/api/admin/gallery', requireAdmin, async (req, res) => {
  const normalized = normalizeAdminGalleryItem(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const item = normalized.value;
  try {
    const result = await pool.query(
      `INSERT INTO gallery_items (title_en, title_np, category, image_url, alt_text_en, alt_text_np, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [item.titleEn, item.titleNp, item.category, item.imageUrl, item.altTextEn, item.altTextNp, item.status]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      ok: false,
      message: 'Unable to create gallery item.'
    });
  }
});

app.patch('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid gallery item id is required.' });
  const normalized = normalizeAdminGalleryItem(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const item = normalized.value;
  try {
    const result = await pool.query(
      `UPDATE gallery_items SET title_en=$1, title_np=$2, category=$3, image_url=$4, alt_text_en=$5, alt_text_np=$6, status=$7
       WHERE id=$8 RETURNING *`,
      [item.titleEn, item.titleNp, item.category, item.imageUrl, item.altTextEn, item.altTextNp, item.status, id]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Gallery item not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ ok: false, message: 'Unable to update gallery item.' });
  }
});

app.delete('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid gallery item id is required.' });
  try {
    const result = await pool.query('DELETE FROM gallery_items WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Gallery item not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to delete gallery item.' });
  }
});

app.get('/api/gallery', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM gallery_items WHERE status = 'published' ORDER BY id DESC"
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

const normalizeAdminBlogPost = (body = {}) => {
  const titleEn = String(body.blogTitle || body.titleEn || '').trim();
  const contentEn = String(body.blogContent || body.contentEn || '').trim();
  const shortDescription = String(body.shortDescription || body.excerptEn || '').trim();
  const status = String(body.status || 'draft');
  const rawPublishDate = String(body.publishDate || body.publishedAt || '').trim();
  const seoTitle = String(body.seoTitle || '').trim();
  if (!titleEn) return { error: 'Blog title is required.' };
  if (!['draft', 'published'].includes(status)) return { error: 'Blog status must be draft or published.' };
  if (status === 'published' && !contentEn) return { error: 'Add blog content before publishing.' };

  const featuredImage = String(body.featuredImage || '').trim();
  if (/^(javascript|data):/i.test(featuredImage)) return { error: 'Provide a valid image URL or local path.' };
  const slug = titleEn.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `blog-${Date.now()}`;

  const publishDate = rawPublishDate || (status === 'published' ? new Date().toISOString().slice(0, 10) : null);

  return {
    value: {
      slug,
      titleEn,
      titleNp: String(body.titleNp || '').trim() || null,
      excerptEn: shortDescription || null,
      excerptNp: String(body.excerptNp || '').trim() || null,
      contentEn: contentEn || null,
      contentNp: String(body.contentNp || '').trim() || null,
      category: String(body.category || '').trim() || 'General',
      featuredImage: featuredImage || null,
      author: String(body.author || '').trim() || null,
      shortDescription: shortDescription || null,
      seoTitle: seoTitle || null,
      publishDate,
      status
    }
  };
};

app.get('/api/admin/blog', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blog_posts ORDER BY id ASC');
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load blog posts.' });
  }
});

app.post('/api/admin/blog', requireAdmin, async (req, res) => {
  const normalized = normalizeAdminBlogPost(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const post = normalized.value;
  try {
    const serial = await pool.query("SELECT nextval(pg_get_serial_sequence('blog_posts', 'id'))::int AS id");
    const blogCode = `ACL-BLOG-${String(serial.rows[0].id).padStart(4, '0')}`;
    const publishDate = post.publishDate || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `INSERT INTO blog_posts (blog_code, slug, title_en, title_np, excerpt_en, excerpt_np, content_en, content_np, category, featured_image, author, status, short_description, seo_title, publish_date, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CASE WHEN $16 THEN NOW() ELSE NULL END)
       RETURNING *`,
      [blogCode, post.slug, post.titleEn, post.titleNp, post.excerptEn, post.excerptNp, post.contentEn, post.contentNp, post.category, post.featuredImage, post.author, post.status, post.shortDescription, post.seoTitle, publishDate, post.status === 'published']
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      ok: false,
      message: error.code === '23505' ? 'A blog post with this title already exists.' : 'Unable to create blog post.'
    });
  }
});

app.patch('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid blog post id is required.' });
  const normalized = normalizeAdminBlogPost(req.body);
  if (normalized.error) return res.status(400).json({ ok: false, message: normalized.error });
  const post = normalized.value;
  try {
    const publishDate = post.publishDate || (post.status === 'published' ? new Date().toISOString().slice(0, 10) : null);
    const result = await pool.query(
      `UPDATE blog_posts SET blog_code=COALESCE(blog_code, 'ACL-BLOG-' || LPAD(id::text, 4, '0')), slug=$1, title_en=$2, title_np=$3, excerpt_en=$4, excerpt_np=$5, content_en=$6, content_np=$7, category=$8, featured_image=$9, author=$10, status=$11, short_description=$12, seo_title=$13, publish_date=$14, published_at=CASE WHEN $15 THEN COALESCE(published_at,NOW()) ELSE NULL END, updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [post.slug, post.titleEn, post.titleNp, post.excerptEn, post.excerptNp, post.contentEn, post.contentNp, post.category, post.featuredImage, post.author, post.status, post.shortDescription, post.seoTitle, publishDate, post.status === 'published', id]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Blog post not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 400).json({
      ok: false,
      message: error.code === '23505' ? 'A blog post with this title already exists.' : 'Unable to update blog post.'
    });
  }
});

app.delete('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: 'A valid blog post id is required.' });
  try {
    const result = await pool.query('DELETE FROM blog_posts WHERE id=$1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Blog post not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to delete blog post.' });
  }
});

app.get('/api/admin/attendance/status', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT event_type, created_at FROM attendance_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.adminUser.id]
    );
    res.json({ ok: true, data: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load attendance status.' });
  }
});

app.post('/api/admin/attendance/:action', requireAdmin, async (req, res) => {
  const { action } = req.params;
  if (!['in', 'out'].includes(action)) {
    return res.status(400).json({ ok: false, message: 'Attendance action must be in or out.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO attendance_events (user_id, event_type) VALUES ($1, $2) RETURNING event_type, created_at',
      [req.adminUser.id, action]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to record attendance.' });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC"
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/blog', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC NULLS LAST, created_at DESC"
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/blog/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published' LIMIT 1",
      [req.params.slug]
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Published blog post not found.' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Unable to load blog post.' });
  }
});

app.get('/api/faqs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM faqs WHERE status = 'published' ORDER BY sort_order ASC, id ASC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE status = $1 ORDER BY sort_order ASC, created_at DESC',
      ['published']
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.use(express.static(publicDir));

app.get(/\.(html|css|js|png|jpg|jpeg|svg|webp|gif|ico|woff|woff2)$/i, (req, res, next) => {
  const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const candidate = path.join(rootDir, relativePath);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return res.sendFile(candidate);
  }
  next();
});

app.get('/{*path}', (req, res) => {
  const requestedPath = req.path.startsWith('/admin/') ? path.join(rootDir, 'admin', '404.html') : path.join(rootDir, '404.html');
  if (fs.existsSync(requestedPath)) {
    return res.sendFile(requestedPath);
  }
  res.status(404).sendFile(path.join(rootDir, '404.html'));
});

const startServer = async () => {
  await ensureDbConnection();
  await ensureDefaultSettings();
  app.listen(PORT, () => {
    console.log(`ACL Agro Farm server running at http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});

module.exports = { app, pool };
