import crypto from 'node:crypto';
import type {Pool,PoolClient} from 'pg';

// Deliberately explicit. Never TRUNCATE a schema or use CASCADE: a new foreign
// key/table must be reviewed before it can become part of this operation.
export const contactResetTables=[
 'commercial_project_links','commercial_projects','contact_access_audit','contact_access_grants','contact_access_requests',
 'contactos','entidades','gabinetes','invoice_directory_assignments','invoice_directory_records','invoice_directory_sources',
 'invoice_jobs','invoice_project_links','lead_approval_requests','lead_followers','leads','leads_contactos','leads_marcas',
 'lembretes','marcas','odoo_contact_requests','tarefas','visitas','visitas_audio','visitas_contactos','visitas_marcas',
] as const;
const digest=(value:unknown)=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';
async function snapshot(client:PoolClient,schema:string,tables:string[]) {
 const result:Record<string,{count:number;fingerprint:string}>={};
 for(const table of tables) {
  const rows=(await client.query(`SELECT to_jsonb(t)::text AS value FROM ${quote(schema)}.${quote(table)} t ORDER BY to_jsonb(t)::text`)).rows;
  result[table]={count:rows.length,fingerprint:digest(rows.map(r=>r.value))};
 }
 return result;
}
export async function resetVisitTestData(pool:Pool,options:{schema:string;expectedFingerprint?:string;commit?:boolean}) {
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(options.schema))throw Error('Schema inválido.');
 if(options.commit && !options.expectedFingerprint)throw Error('É obrigatória uma pré-visualização antes da limpeza.');
 const client=await pool.connect();
 try {
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  await client.query("SET LOCAL lock_timeout='5s'");
  const all=(await client.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename',[options.schema])).rows.map(r=>r.tablename as string);
  if(!['users','empresas','visitas','contactos','entidades'].every(name=>all.includes(name)))throw Error('A base não corresponde ao VisitManager.');
  const business=all.filter(name=>(contactResetTables as readonly string[]).includes(name));
  const protectedTables=all.filter(name=>!business.includes(name));
  await client.query(`LOCK TABLE ${business.map(name=>quote(options.schema)+'.'+quote(name)).join(',')} IN ACCESS EXCLUSIVE MODE`);
  const before=await snapshot(client,options.schema,all);
  const fingerprint=digest({schema:options.schema,before});
  if(options.expectedFingerprint && options.expectedFingerprint!==fingerprint)throw Error('Os dados mudaram desde a pré-visualização. A limpeza foi cancelada.');
  if(!options.expectedFingerprint) {
   await client.query('ROLLBACK');return {mode:'preview',fingerprint,business:Object.fromEntries(business.map(name=>[name,before[name].count])),protectedTables};
  }
  await client.query(`TRUNCATE TABLE ${business.map(name=>quote(options.schema)+'.'+quote(name)).join(',')} RESTART IDENTITY`);
  const after=await snapshot(client,options.schema,all);
  if(business.some(name=>after[name].count!==0) || protectedTables.some(name=>JSON.stringify(before[name])!==JSON.stringify(after[name])))throw Error('A verificação dos dados preservados falhou.');
  await client.query(options.commit?'COMMIT':'ROLLBACK');
  return {mode:options.commit?'committed':'rehearsed-and-rolled-back',fingerprint,business:Object.fromEntries(business.map(name=>[name,before[name].count])),protectedTables,protectedUnchanged:true};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
