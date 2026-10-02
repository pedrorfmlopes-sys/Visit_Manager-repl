import crypto from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';

const text=z.string().max(1000), id=z.string().min(1).max(300);
const entity=z.object({id,partner_id:text.nullable(),legal_name:z.string().min(1).max(255),trading_name:text,
  tax_id:z.string().max(50),country_code:z.string().length(2),email:z.string().max(255),phone:z.string().max(50),website:z.string().max(500),
  status:z.enum(['active','inactive','archived']),updated_at:text});
const person=z.object({id,full_name:z.string().min(1).max(255),email:z.string().max(255),phone:z.string().max(50),mobile:z.string().max(50),
  status:z.enum(['active','inactive','archived']),updated_at:text});
const assignment=z.object({id,entity_id:id,contact_id:id,job_title:text,department:text,is_primary:z.union([z.literal(0),z.literal(1)]),status:z.enum(['active','inactive'])});
export const directorySnapshot=z.object({entities:z.array(entity).max(50000),contacts:z.array(person).max(50000),assignments:z.array(assignment).max(100000)}).strict();

async function initializeDirectorySchema(client:PoolClient) {
    await client.query(`CREATE TABLE IF NOT EXISTS invoice_directory_sources(
      empresa_id varchar PRIMARY KEY REFERENCES empresas(id),identity text NOT NULL,imported_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS invoice_directory_records(
      empresa_id varchar NOT NULL REFERENCES empresas(id),kind text NOT NULL CHECK(kind IN ('entity','person')),
      source_id text NOT NULL,local_id varchar NOT NULL,status text NOT NULL,fingerprint text NOT NULL,
      imported_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(empresa_id,kind,source_id),UNIQUE(empresa_id,kind,local_id))`);
    await client.query("ALTER TABLE invoice_directory_records ADD COLUMN IF NOT EXISTS source_data jsonb NOT NULL DEFAULT '{}'::jsonb");
    await client.query(`CREATE TABLE IF NOT EXISTS invoice_directory_assignments(
      empresa_id varchar NOT NULL REFERENCES empresas(id),source_id text NOT NULL,
      entity_id varchar NOT NULL REFERENCES entidades(id),contact_id varchar NOT NULL REFERENCES contactos(id),
      job_title text NOT NULL,department text NOT NULL,is_primary boolean NOT NULL,status text NOT NULL,
      PRIMARY KEY(empresa_id,source_id))`);
    for (const name of ['invoice_directory_sources','invoice_directory_records','invoice_directory_assignments']) {
      await client.query(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`);
      await client.query(`REVOKE ALL ON ${name} FROM PUBLIC`);
      for (const role of ['anon','authenticated']) if ((await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await client.query(`REVOKE ALL ON ${name} FROM ${role}`);
    }
}

export async function ensureInvoiceDirectorySchema(pool:Pool) {
  const client=await pool.connect();
  try {await client.query('BEGIN');await initializeDirectorySchema(client);await client.query('COMMIT');}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

export async function importInvoiceDirectory(pool:Pool,companyId:string,input:unknown,sourceIdentity='local-test') {
  const snapshot=directorySnapshot.parse(input);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['contact-access:'+companyId]);
    if (!(await client.query('SELECT 1 FROM empresas WHERE id=$1',[companyId])).rowCount) throw Error('Empresa não encontrada.');
    await initializeDirectorySchema(client);
    const priorSource=(await client.query('SELECT identity FROM invoice_directory_sources WHERE empresa_id=$1',[companyId])).rows[0];
    if(priorSource && priorSource.identity!==sourceIdentity)throw Object.assign(Error('A origem dos contactos mudou. É necessária uma migração revista pelo administrador.'),{status:409});
    await client.query('INSERT INTO invoice_directory_sources(empresa_id,identity) VALUES($1,$2) ON CONFLICT(empresa_id) DO NOTHING',[companyId,sourceIdentity]);
    // A missing source row remains mapped but inactive; it never becomes an
    // unrelated locally owned record or silently keeps project permissions.
    await client.query("UPDATE invoice_directory_records SET status='archived' WHERE empresa_id=$1",[companyId]);
    const existing=(await client.query('SELECT * FROM invoice_directory_records WHERE empresa_id=$1',[companyId])).rows;
    const existingBySource=new Map(existing.map(row=>[row.kind+':'+row.source_id,row]));
    const ids=new Map<string,string>();
    for (const [kind,items] of [['entity',snapshot.entities],['person',snapshot.contacts]] as const) {
      const seen=new Set<string>();
      for (const item of items) {
        if(seen.has(item.id)) throw Error('Identificador duplicado na origem.');
        seen.add(item.id);
        const prior=existingBySource.get(kind+':'+item.id);
        const localId=prior?.local_id || crypto.randomUUID();
        const fingerprint=crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex');
        if (prior && !(await client.query(`SELECT 1 FROM ${kind==='entity'?'entidades':'contactos'} WHERE id=$1 AND empresa_id=$2`,[localId,companyId])).rowCount) throw Error('Associação local inconsistente.');
        if (kind==='entity') {
          const value=entity.parse(item);
          await client.query(`INSERT INTO entidades(id,empresa_id,nome,email,telefone,nif,country_code,website)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome,email=excluded.email,
            telefone=excluded.telefone,nif=excluded.nif,country_code=excluded.country_code,website=excluded.website`,
            [localId,companyId,value.legal_name,value.email,value.phone,value.tax_id,value.country_code,value.website]);
        } else {
          const value=person.parse(item);
          await client.query(`INSERT INTO contactos(id,empresa_id,nome,email,telemovel)
            VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome,email=excluded.email,telemovel=excluded.telemovel`,
            [localId,companyId,value.full_name,value.email,value.mobile || value.phone]);
        }
        await client.query(`INSERT INTO invoice_directory_records(empresa_id,kind,source_id,local_id,status,fingerprint,source_data)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(empresa_id,kind,source_id) DO UPDATE SET
          status=excluded.status,fingerprint=excluded.fingerprint,source_data=excluded.source_data,imported_at=now()`,[companyId,kind,item.id,localId,item.status,fingerprint,JSON.stringify(item)]);
        ids.set(kind+':'+item.id,localId);
      }
    }
    await client.query('DELETE FROM invoice_directory_assignments WHERE empresa_id=$1',[companyId]);
    for(const item of snapshot.assignments) {
      const entityId=ids.get('entity:'+item.entity_id),contactId=ids.get('person:'+item.contact_id);
      if(!entityId || !contactId) throw Error('Associação sem contacto ou entidade na origem.');
      await client.query(`INSERT INTO invoice_directory_assignments(empresa_id,source_id,entity_id,contact_id,job_title,department,is_primary,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[companyId,item.id,entityId,contactId,item.job_title,item.department,item.is_primary===1,item.status]);
    }
    await client.query('COMMIT');
    return {entities:snapshot.entities.length,contacts:snapshot.contacts.length,assignments:snapshot.assignments.length};
  } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
}
