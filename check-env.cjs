const db = require('./electron/database.cjs');
console.log('DB Path:', db._getDbPath());
console.log('NODE_ENV:', process.env.NODE_ENV);
