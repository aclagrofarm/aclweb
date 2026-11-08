# ACL Agro Farm Ltd. Website

This project is a bilingual agriculture business website for ACL Agro Farm Ltd. in Nepal, with a public frontend, admin area, and backend API connected to PostgreSQL.

## 1. Open project in Visual Studio Code

1. Open VS Code.
2. Open the folder: `aclweb`.
3. Open the integrated terminal.

## 2. Install Node.js

Download and install Node.js LTS from:

- https://nodejs.org/

Verify installation:

```bash
node -v
npm -v
```

## 3. Install dependencies

From the project root:

```bash
npm install
```

## 4. Configure environment

Copy `.env.example` to `.env` and update values:

```bash
copy .env.example .env
```

Set the database URL and secure secrets in `.env`.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` to enable customer PIN-reset emails. Use the credentials from your email provider and keep them private.

## 5. Configure PostgreSQL

1. Install PostgreSQL locally.
2. Create a database named `acl_agro_farm`.
3. Create a user if needed.
4. Confirm the `DATABASE_URL` matches your PostgreSQL credentials.

Example:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/acl_agro_farm
```

## 6. Initialize database

```bash
npm run init-db
```

This creates tables and base schema.

## 7. Create initial admin

```bash
npm run seed-admin
```

This creates the default administrator account using the environment variables.

## 8. Start development server

```bash
npm run dev
```

Then open:

- Public website: http://localhost:3000/
- Admin login: http://localhost:3000/admin/login.html

## 9. Troubleshooting

- If Node is not recognized, install Node.js LTS and reopen the terminal.
- If PostgreSQL connection fails, confirm the database is running and `DATABASE_URL` is correct.
- If the port is busy, change `PORT` in `.env`.
- If you receive permission errors, ensure the PostgreSQL user has access to the database.

## 10. Deployment preparation

- Set production environment values in a secure environment manager.
- Use a production database and strong secret keys.
- Serve the app behind HTTPS.
- Restrict admin routes to authenticated administrators.
- Turn off debug mode in production.
- Keep backups and audit logs enabled.

## 11. Notes

This project uses bilingual content in Nepali and English, with localStorage for the selected language and a PostgreSQL-backed backend for persistent data.
