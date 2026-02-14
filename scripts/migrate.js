'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const DB = require('../core/database');
const dbPath = process.env.DB_PATH || './data/linkmd.db';

async function migrate() {
  console.log(`[migrate] Initializing database at ${dbPath}...`);
  const db = new DB(dbPath);
  await db.init();

  // Verify tables
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('[migrate] Tables:', tables.map(t => t.name).join(', '));

  // Verify FTS5
  const triggers = await db.all("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name");
  console.log('[migrate] Triggers:', triggers.map(t => t.name).join(', '));

  // Verify indexes
  const indexes = await db.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name");
  console.log('[migrate] Indexes:', indexes.map(i => i.name).join(', '));

  await db.close();
  console.log('[migrate] Database initialized successfully.');
}

migrate().catch(err => {
  console.error('[migrate] Error:', err);
  process.exit(1);
});
