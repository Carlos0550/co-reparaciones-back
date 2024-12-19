const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

const checkConnection = async () => {
  try {
    console.log("Comprobando conexión...")
    const res = await pool.query('SELECT NOW()');
    console.log('Database connected');
  } catch (err) {
    console.error('Database connection failed:', err);
  }
};



module.exports = {pool, checkConnection};
