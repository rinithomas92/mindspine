import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient } from 'pg';
import { sqliteSchema, postgresSchema, careLinksSchema } from './schema';

// Never use ephemeral filesystem storage on Vercel.
const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
if (databaseUrl?.searchParams.get('sslmode') === 'require') databaseUrl.searchParams.set('sslmode', 'verify-full');
const connectionString = databaseUrl?.toString();
if (process.env.VERCEL && !connectionString) throw new Error('DATABASE_URL is required on Vercel.');
types.setTypeParser(20, value => Number(value));
type Store = { pool?: Pool; sqlite?: DatabaseSync; queue: Promise<void>; context: AsyncLocalStorage<PoolClient | 'sqlite'> };
const globalStore = globalThis as unknown as { mindspineStore?: Store };
const store = globalStore.mindspineStore ?? { queue: Promise.resolve(), context: new AsyncLocalStorage<PoolClient | 'sqlite'>() };
globalStore.mindspineStore = store;
function pool() { return store.pool ??= new Pool({connectionString, max:3, idleTimeoutMillis:10000, connectionTimeoutMillis:15000, allowExitOnIdle:true}); }
function sqlite() {
  if (!store.sqlite) {
    const path = resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || './data/mindspine.sqlite');
    mkdirSync(dirname(path), { recursive: true });
    store.sqlite = new DatabaseSync(path);
    store.sqlite.exec(sqliteSchema + careLinksSchema);
    if (!store.sqlite.prepare('PRAGMA table_info(notes)').all().some(c => c.name === 'assessment_json')) store.sqlite.exec("ALTER TABLE notes ADD COLUMN assessment_json TEXT NOT NULL DEFAULT ''");
    if (!store.sqlite.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'specialty')) store.sqlite.exec("ALTER TABLE users ADD COLUMN specialty TEXT NOT NULL DEFAULT ''");
  }
  return store.sqlite;
}
async function locked<T>(fn:()=>Promise<T>):Promise<T> {
  const previous=store.queue;
  let release!:()=>void;
  store.queue=new Promise<void>(r=>{release=r;});
  await previous;
  try{return await fn();}finally{release();}
}
// Ignore question marks inside SQL literals when converting positional parameters.
export function postgresSql(sql:string) {
  let index=0, quoted=false, identifier=false, result='';
  for(let i=0;i<sql.length;i++){
    const c=sql[i];
    if(c==="'"&&!identifier){if(quoted&&sql[i+1]==="'"){result+="''";i++;continue;}quoted=!quoted;}
    if(c==='"'&&!quoted)identifier=!identifier;
    result += c==='?'&&!quoted&&!identifier ? '$'+(++index) : c;
  }
  return result.replace(/\ba\.rowid\b/g,'a.sequence');
}
async function query(sql:string,args:SQLInputValue[]) {
  const active=store.context.getStore();
  if(connectionString){
    const client=active&&active!=='sqlite'?active:pool();
    return client.query(postgresSql(sql),args.map(v=>typeof v==='bigint'?v.toString():v instanceof Uint8Array?Buffer.from(v):v));
  }
  const execute=async()=>{
    const stmt=sqlite().prepare(sql);
    if(/^\s*(SELECT|WITH|INSERT[\s\S]*RETURNING)/i.test(sql))return {rows:stmt.all(...args).map(r=>({...r})),rowCount:0};
    const result=stmt.run(...args);return {rows:[],rowCount:Number(result.changes)};
  };
  return active==='sqlite'?execute():locked(execute);
}
export async function all<T>(sql:string,...args:SQLInputValue[]):Promise<T[]> {return (await query(sql,args)).rows as T[];}
export async function one<T>(sql:string,...args:SQLInputValue[]):Promise<T|undefined> {return (await all<T>(sql,...args))[0];}
export async function run(sql:string,...args:SQLInputValue[]) {const result=await query(sql,args);return {changes:result.rowCount??0};}
export async function transaction<T>(fn:()=>Promise<T>|T):Promise<T>{
  if(store.context.getStore())return await fn();
  if(!connectionString)return locked(async()=>{
    const db=sqlite();db.exec('BEGIN IMMEDIATE');
    try{const value=await store.context.run('sqlite',fn);db.exec('COMMIT');return value;}
    catch(error){db.exec('ROLLBACK');throw error;}
  });
  for(let attempt=0;;attempt++){
    const client=await pool().connect();
    try{
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const value=await store.context.run(client,fn);
      await client.query('COMMIT');return value;
    }catch(error){
      await client.query('ROLLBACK');
      const code=(error as {code?:string}).code;
      if(attempt>=2||!['40001','40P01'].includes(code??''))throw error;
    }finally{client.release();}
  }
}
export async function initializeDatabase(){if(connectionString)await pool().query(postgresSchema + careLinksSchema + "ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT NOT NULL DEFAULT ''; ALTER TABLE notes ADD COLUMN IF NOT EXISTS assessment_json TEXT NOT NULL DEFAULT '';");else sqlite();}
export async function closeDatabase(){await store.pool?.end();store.sqlite?.close();delete store.pool;delete store.sqlite;}
export function id(prefix:string){return `${prefix}-${randomUUID().slice(0,12)}`;}
export async function audit(actor:string,action:string,entity:string){await run('INSERT INTO audit(id,actor_id,action,entity) VALUES (?,?,?,?)',id('log'),actor,action,entity);}
export async function notify(user:string,title:string,message:string){await run('INSERT INTO notifications(id,user_id,title,message) VALUES (?,?,?,?)',id('msg'),user,title,message);}
