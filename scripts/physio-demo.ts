// Explicit local-only setup; never run automatically at application startup.
import {initializeDatabase,one,run,transaction,audit,closeDatabase} from '../src/lib/db';
import {hashPassword,verifyPassword} from '../src/lib/password';

if(process.env.DATABASE_URL || process.env.VERCEL || process.env.NODE_ENV==='production') {
  throw new Error('Physiotherapist demo setup is only available for local SQLite development.');
}
const id='demo-physiotherapist',email='physio@mindspine.local',password='PhysioDemo!2026';
try {
  await initializeDatabase();
  await transaction(async()=>{
    const existing=await one<{id:string;role:string;specialty:string;password:string}>('SELECT id,role,specialty,password FROM users WHERE id=? OR email=?',id,email);
    if(existing){
      if(existing.id!==id || existing.role!=='practitioner' || existing.specialty!=='physiotherapist' || !verifyPassword(password,existing.password)) {
        throw new Error('An account conflicts with the demo identity or its password was changed. No account was overwritten.');
      }
      await run('UPDATE users SET active=1 WHERE id=?',id);
      await audit(id,'demo.account_activated',id);
    } else {
      await run('INSERT INTO users(id,name,email,password,role,specialty,active) VALUES (?,?,?,?,?,?,?)',id,'Demo Physiotherapist',email,hashPassword(password),'practitioner','physiotherapist',1);
      await audit(id,'demo.account_created',id);
    }
  });
  console.log('Local physiotherapist demo is active. Select Try physiotherapist demo, then Sign in. No patient data was added.');
} finally {await closeDatabase();}
