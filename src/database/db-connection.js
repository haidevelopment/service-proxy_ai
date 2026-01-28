import mysql from 'mysql2/promise';
import { appConfig } from '../config/app.config.js';

const pool = mysql.createPool({
  host: appConfig.db.host,
  port: appConfig.db.port,
  user: appConfig.db.username,
  password: appConfig.db.password,
  database: appConfig.db.database,
  connectionLimit: 10,
  connectTimeout: 10000,
});

export async function execQuery(query, params = []) {
  const connection = await pool.getConnection();
  try {
    console.log('[DB] Executing query:', query);
    console.log('[DB] Query params:', Array.isArray(params) ? params : [params]);
    const [rows] = await connection.execute(query, params);
    console.log('[DB] Rows returned:', Array.isArray(rows) ? rows.length : 0);
    return rows;
  } finally {
    await connection.release();
  }
}
