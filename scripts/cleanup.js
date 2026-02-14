'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fileManager = require('../core/file-manager');

(async () => {
  console.log('Cleaning up expired sessions...');
  const cleaned = await fileManager.cleanupExpired();
  console.log(`Cleaned ${cleaned} expired session(s).`);
})().catch(console.error);
