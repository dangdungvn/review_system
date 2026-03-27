const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    console.log('✓ Connected to MySQL');

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_DATABASE}`);
    console.log(`✓ Database '${process.env.DB_DATABASE}' created (or already exists)`);

    // Show databases
    const [databases] = await connection.query('SHOW DATABASES');
    console.log('\n📊 Available databases:');
    databases.forEach(db => console.log(`  - ${db.Database}`));

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await connection.end();
  }
}

createDatabase();
