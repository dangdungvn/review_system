const fs = require('fs');
const path = require('path');
const { randomBytes, randomUUID } = require('crypto');
const argon2 = require('argon2');
const mysql = require('mysql2/promise');

function readEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const env = {};

  if (!fs.existsSync(envPath)) {
    return env;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    env[key] = value;
  }

  return env;
}

async function ensureColumn(connection, database, table, column, definition) {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [database, table, column],
  );

  if (columns.length === 0) {
    await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

async function main() {
  const env = { ...readEnv(), ...process.env };
  const email = env.ADMIN_EMAIL || 'admin@example.com';
  const generatedPassword = randomBytes(18).toString('base64url');
  const password = env.ADMIN_PASSWORD || generatedPassword;
  const fullName = env.ADMIN_FULL_NAME || 'System Admin';

  const database = env.DB_DATABASE || 'review_system';
  const connection = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME || 'root',
    password: env.DB_PASSWORD || '',
    database,
  });

  await ensureColumn(
    connection,
    database,
    'users',
    'is_active',
    'is_active tinyint(1) NOT NULL DEFAULT 1',
  );

  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  const [existingUsers] = await connection.execute(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email],
  );

  if (existingUsers.length > 0) {
    await connection.execute(
      `UPDATE users
       SET password = ?,
           full_name = ?,
           role = 'admin',
           refresh_token = NULL,
           is_active = 1,
           updated_at = NOW()
       WHERE email = ?`,
      [hashedPassword, fullName, email],
    );
    console.log(`UPDATED ${email}`);
  } else {
    await connection.execute(
      `INSERT INTO users
       (id, email, password, full_name, role, refresh_token, avatar_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', NULL, NULL, 1, NOW(), NOW())`,
      [randomUUID(), email, hashedPassword, fullName],
    );
    console.log(`CREATED ${email}`);
  }

  await connection.end();
  if (!env.ADMIN_PASSWORD) {
    console.log('ADMIN_PASSWORD was not provided; generated a one-time password.');
  }
  console.log(`LOGIN email=${email} password=${password}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
