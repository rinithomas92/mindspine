import {initializeDatabase,closeDatabase} from '../src/lib/db';
await initializeDatabase();
console.log('Database schema initialized successfully.');
await closeDatabase();
