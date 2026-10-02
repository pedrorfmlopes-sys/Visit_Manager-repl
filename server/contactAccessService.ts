import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { canReadContact, identityMatch, type ContactKind } from '../shared/contactAccessPolicy';

const detailFields={tipoEntidade:'tipo_entidade',morada:'morada',cidade:'cidade',codigoPostal:'codigo_postal',website:'website',
  latitude:'latitude',longitude:'longitude',logoUrl:'logo_url',domain:'domain',industry:'industry',descricao:'descricao',
  linkedinUrl:'linkedin_url',facebookUrl:'facebook_url',twitterUrl:'twitter_url',instagramUrl:'instagram_url',xUrl:'x_url',fotoUrl:'foto_url'} as const;
const submission = z.object({
  kind: z.enum(['entity','person']), name: z.string().trim().min(1).max(255),
  email: z.union([z.string().email(),z.literal('')]).default(''),
  phone: z.string().max(50).default(''), taxId: z.string().max(50).default(''),
  countryCode: z.string().regex(/^[A-Z]{2}$/).default('PT'),
  jobTitle:z.string().max(255).default(''), notes:z.string().max(10000).default(''),entityId:z.string().min(1).max(300).nullable().default(null),
  entityTypeId:z.string().min(1).max(300).nullable().default(null),proximityAlertsEnabled:z.boolean().default(false),
  details:z.record(z.string().max(10000).nullable()).default({}).refine(value=>Object.keys(value).every(k=>k in detailFields),'Campos inválidos.'),
}).strict();
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), {status}); };
const table = (kind: ContactKind) => kind === 'entity' ? 'entidades' : 'contactos';

// Only the server's private PostgreSQL role may use these tables. The browser
// never receives database credentials or an arbitrary query interface.
export async function ensureContactAccessSchema(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS contact_access_grants (
      empresa_id varchar NOT NULL REFERENCES empresas(id), user_id varchar NOT NULL REFERENCES users(id),
      kind text NOT NULL CHECK(kind IN ('entity','person')), record_id varchar NOT NULL,
      decision text NOT NULL CHECK(decision IN ('granted','revoked')),
      decided_by varchar NOT NULL REFERENCES users(id), decided_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(empresa_id,user_id,kind,record_id))`);
    await client.query(`CREATE TABLE IF NOT EXISTS contact_access_requests (
      id uuid PRIMARY KEY, empresa_id varchar NOT NULL REFERENCES empresas(id),
      user_id varchar NOT NULL REFERENCES users(id), kind text NOT NULL CHECK(kind IN ('entity','person')),
      submitted jsonb NOT NULL, candidates jsonb NOT NULL, state text NOT NULL DEFAULT 'pending'
        CHECK(state IN ('pending','approved','rejected','distinct')),
      record_id varchar, decided_by varchar REFERENCES users(id), reason text,
      created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz)`);
    await client.query(`CREATE INDEX IF NOT EXISTS contact_access_requests_pending
      ON contact_access_requests(empresa_id,state,created_at)`);
    await client.query(`CREATE TABLE IF NOT EXISTS contact_access_audit (
      id uuid PRIMARY KEY, empresa_id varchar NOT NULL REFERENCES empresas(id),
      actor_id varchar NOT NULL REFERENCES users(id), subject_id varchar NOT NULL REFERENCES users(id),
      action text NOT NULL, kind text NOT NULL, record_id varchar, request_id uuid,
      created_at timestamptz NOT NULL DEFAULT now())`);
    for (const name of ['contact_access_grants','contact_access_requests','contact_access_audit']) {
      await client.query(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`);
      await client.query(`REVOKE ALL ON ${name} FROM PUBLIC`);
      for (const role of ['anon','authenticated']) {
        if ((await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) {
          await client.query(`REVOKE ALL ON ${name} FROM ${role}`);
        }
      }
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export class ContactAccessService {
  constructor(private pool: Pool) {}
  private async transaction<T>(fn: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  private async actor(client: PoolClient, userId: string, admin = false) {
    const user = (await client.query('SELECT id,empresa_id,role,ativo FROM users WHERE id=$1',[userId])).rows[0];
    if (!user?.ativo || !user.empresa_id || !['admin','agent'].includes(user.role)) fail('Sessão inválida.',401);
    if (admin && user.role !== 'admin') fail('Apenas administradores podem decidir acessos.',403);
    return user;
  }
  private async audit(client: PoolClient, user: any, subject: string, action: string, kind: ContactKind, record: string | null, request: string | null = null) {
    await client.query(`INSERT INTO contact_access_audit(id,empresa_id,actor_id,subject_id,action,kind,record_id,request_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[crypto.randomUUID(),user.empresa_id,user.id,subject,action,kind,record,request]);
  }
  private async insert(client: PoolClient, user: any, body: z.infer<typeof submission>, owner = user.id) {
    const id = crypto.randomUUID();
    if (body.kind === 'entity') {
      if(body.entityTypeId && !(await client.query('SELECT 1 FROM entidade_tipos WHERE id=$1 AND empresa_id=$2',[body.entityTypeId,user.empresa_id])).rowCount)fail('Tipo de entidade indisponível.',404);
      await client.query(`INSERT INTO entidades(id,empresa_id,nome,email,telefone,nif,country_code,created_by_user_id,notas)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,user.empresa_id,body.name,body.email,body.phone,body.taxId,body.countryCode,owner,body.notes]);
      if(body.entityTypeId || body.proximityAlertsEnabled)await client.query('UPDATE entidades SET entidade_tipo_id=$2,proximity_alerts_enabled=$3 WHERE id=$1',[id,body.entityTypeId,body.proximityAlertsEnabled]);
    } else {
      await client.query(`INSERT INTO contactos(id,empresa_id,nome,email,telemovel,created_by_user_id,funcao,observacoes,entidade_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,user.empresa_id,body.name,body.email,body.phone,owner,body.jobTitle,body.notes,body.entityId]);
    }
    const details=Object.entries(body.details).filter(([key])=>body.kind==='person' ? key==='fotoUrl' : key!=='fotoUrl');
    if(details.length)await client.query(`UPDATE ${table(body.kind)} SET ${details.map(([key],index)=>`${detailFields[key as keyof typeof detailFields]}=$${index+3}`).join(',')} WHERE id=$1 AND empresa_id=$2`,[id,user.empresa_id,...details.map(([,value])=>value)]);
    return id;
  }
  async submit(userId: string, input: unknown, grantTo?:string, onCreate?:(client:PoolClient,id:string)=>Promise<void>) {
    const body = submission.parse(input);
    return this.transaction(async client => {
      const user = await this.actor(client,userId);
      const target=grantTo ? await this.actor(client,grantTo) : null;
      if(target && (user.role!=='admin' || target.empresa_id!==user.empresa_id))fail('Atribuição não autorizada.',403);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['contact-access:'+user.empresa_id]);
      if(body.entityId) {
        const entity=(await client.query(`SELECT e.empresa_id,e.created_by_user_id,g.decision FROM entidades e
          LEFT JOIN contact_access_grants g ON g.empresa_id=e.empresa_id AND g.user_id=$2 AND g.kind='entity' AND g.record_id=e.id
          WHERE e.id=$1 AND e.empresa_id=$3`,[body.entityId,user.id,user.empresa_id])).rows[0];
        if(!entity || !canReadContact({companyId:user.empresa_id,recordCompanyId:entity.empresa_id,userId:user.id,
          role:user.role,active:user.ativo,createdBy:entity.created_by_user_id,decision:entity.decision}))fail('Entidade indisponível.',404);
      }
      const rows = (await client.query(body.kind === 'entity'
        ? 'SELECT id,nome AS name,email,telefone AS phone,nif AS "taxId",country_code AS "countryCode" FROM entidades WHERE empresa_id=$1'
        : 'SELECT id,nome AS name,email,telemovel AS phone FROM contactos WHERE empresa_id=$1',[user.empresa_id])).rows;
      const hasImported=(await client.query("SELECT to_regclass('invoice_directory_records') AS name")).rows[0].name;
      const sources=hasImported ? (await client.query('SELECT local_id,source_data FROM invoice_directory_records WHERE empresa_id=$1 AND kind=$2',[user.empresa_id,body.kind])).rows : [];
      const sourceById=new Map(sources.map(row=>[row.local_id,row.source_data]));
      const matches = rows.map(row => {
        const source=sourceById.get(row.id);
        const reasons=new Set(identityMatch(body,row));
        // Imported people may have a landline and a mobile. Entities may also
        // use a trading name; all supplied identities require the same review.
        if(source)for(const reason of identityMatch(body,{...row,phone:source.phone,name:source.trading_name || row.name}))reasons.add(reason);
        return {id:row.id,reasons:Array.from(reasons)};
      }).filter(row => row.reasons.length);
      if (matches.length) {
        const subjectId=target?.id || user.id;
        // Return only the request ID, never the matched contact ID or name.
        const previous = (await client.query(`SELECT id FROM contact_access_requests
          WHERE empresa_id=$1 AND user_id=$2 AND kind=$3 AND state='pending' AND submitted=$4::jsonb`,
          [user.empresa_id,subjectId,body.kind,JSON.stringify(body)])).rows[0];
        if (previous) return {state:'pending',requestId:previous.id};
        const id = crypto.randomUUID();
        await client.query(`INSERT INTO contact_access_requests(id,empresa_id,user_id,kind,submitted,candidates)
          VALUES($1,$2,$3,$4,$5,$6)`,[id,user.empresa_id,subjectId,body.kind,JSON.stringify(body),JSON.stringify(matches)]);
        await this.audit(client,user,subjectId,'requested',body.kind,null,id);
        return {state:'pending',requestId:id};
      }
      const id = await this.insert(client,user,body);
      if(onCreate)await onCreate(client,id);
      if(target) {
        await this.setGrant(client,user,target.id,body.kind,id,'granted');
        await this.audit(client,user,target.id,'granted',body.kind,id);
      }
      await this.audit(client,user,user.id,'created',body.kind,id);
      return {state:'created',id};
    });
  }
  async requests(userId: string) {
    return this.transaction(async client => {
      const user = await this.actor(client,userId);
      if (user.role === 'admin') return (await client.query(`SELECT * FROM contact_access_requests
        WHERE empresa_id=$1 ORDER BY CASE WHEN state='pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 200`,[user.empresa_id])).rows;
      return (await client.query(`SELECT id,kind,submitted,state,created_at,decided_at FROM contact_access_requests
        WHERE empresa_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 200`,[user.empresa_id,user.id])).rows;
    });
  }
  async users(userId: string) {
    return this.transaction(async client => {
      const user=await this.actor(client,userId,true);
      return (await client.query('SELECT id,email,first_name,last_name FROM users WHERE empresa_id=$1 AND ativo=true ORDER BY email',[user.empresa_id])).rows;
    });
  }
  async summary(userId:string) {
    return this.transaction(async client=>{
      const user=await this.actor(client,userId);
      const result=await client.query(`SELECT count(*)::int AS pending FROM contact_access_requests
        WHERE empresa_id=$1 AND state='pending' AND ($3::boolean OR user_id=$2)`,[user.empresa_id,user.id,user.role==='admin']);
      return {enabled:true,pending:result.rows[0].pending};
    });
  }
  async decide(userId: string, requestId: string, action: 'approve' | 'reject' | 'distinct', recordId?: string) {
    if (!['approve','reject','distinct'].includes(action)) fail('Decisão inválida.');
    return this.transaction(async client => {
      const user = await this.actor(client,userId,true);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['contact-access:'+user.empresa_id]);
      const request = (await client.query(`SELECT * FROM contact_access_requests WHERE id=$1 AND empresa_id=$2 FOR UPDATE`,[requestId,user.empresa_id])).rows[0];
      if (!request) fail('Pedido não encontrado.',404);
      if (request.state !== 'pending') fail('Este pedido já foi decidido.',409);
      const subject = await this.actor(client,request.user_id);
      if (subject.empresa_id !== user.empresa_id) fail('Utilizador fora da empresa.',403);
      let record: string | null = null;
      if (action === 'approve') {
        if (!request.candidates.some((candidate: any) => candidate.id === recordId)) fail('Seleciona um contacto correspondente.');
        if (!(await client.query(`SELECT id FROM ${table(request.kind)} WHERE id=$1 AND empresa_id=$2`,[recordId,user.empresa_id])).rowCount) fail('Contacto não encontrado.',404);
        record = recordId!;
        await this.setGrant(client,user,subject.id,request.kind,record,'granted');
      } else if (action === 'distinct') {
        record = await this.insert(client,user,submission.parse(request.submitted),subject.id);
      }
      const state = {approve:'approved',reject:'rejected',distinct:'distinct'}[action];
      await client.query(`UPDATE contact_access_requests SET state=$2,record_id=$3,decided_by=$4,decided_at=now() WHERE id=$1`,[request.id,state,record,user.id]);
      await this.audit(client,user,subject.id,state,request.kind,record,request.id);
      return {state,id:record};
    });
  }
  private async setGrant(client: PoolClient, user: any, subjectId: string, kind: ContactKind, recordId: string, decision: string) {
    await client.query(`INSERT INTO contact_access_grants(empresa_id,user_id,kind,record_id,decision,decided_by)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(empresa_id,user_id,kind,record_id)
      DO UPDATE SET decision=excluded.decision,decided_by=excluded.decided_by,decided_at=now()`,
      [user.empresa_id,subjectId,kind,recordId,decision,user.id]);
  }
  async grant(userId: string, subjectId: string, kind: ContactKind, recordId: string, decision: 'granted' | 'revoked') {
    if (!['entity','person'].includes(kind) || !['granted','revoked'].includes(decision)) fail('Permissão inválida.');
    return this.transaction(async client => {
      const user = await this.actor(client,userId,true), subject = await this.actor(client,subjectId);
      if (subject.empresa_id !== user.empresa_id) fail('Utilizador fora da empresa.',403);
      if (!(await client.query(`SELECT id FROM ${table(kind)} WHERE id=$1 AND empresa_id=$2`,[recordId,user.empresa_id])).rowCount) fail('Contacto não encontrado.',404);
      await this.setGrant(client,user,subject.id,kind,recordId,decision);
      await this.audit(client,user,subject.id,decision,kind,recordId);
      return {ok:true};
    });
  }
  async allowed(userId: string, kind: ContactKind, recordId: string) {
    if (!['entity','person'].includes(kind)) return false;
    return this.transaction(async client => {
      const user = await this.actor(client,userId);
      if ((await client.query("SELECT to_regclass('invoice_directory_records') AS name")).rows[0].name) {
        const source=(await client.query('SELECT status FROM invoice_directory_records WHERE empresa_id=$1 AND kind=$2 AND local_id=$3',[user.empresa_id,kind,recordId])).rows[0];
        if(source && source.status!=='active' && user.role!=='admin') return false;
      }
      const row = (await client.query(`SELECT r.empresa_id,r.created_by_user_id,g.decision FROM ${table(kind)} r
        LEFT JOIN contact_access_grants g ON g.empresa_id=r.empresa_id AND g.record_id=r.id AND g.kind=$3 AND g.user_id=$2
        WHERE r.id=$1 AND r.empresa_id=$4`,[recordId,user.id,kind,user.empresa_id])).rows[0];
      return Boolean(row) && canReadContact({companyId:user.empresa_id,userId:user.id,role:user.role,active:user.ativo,
        recordCompanyId:row.empresa_id,createdBy:row.created_by_user_id,decision:row.decision});
    });
  }
  async list(userId: string, kind: ContactKind) {
    if (!['entity','person'].includes(kind)) fail('Tipo de contacto inválido.');
    return this.transaction(async client => {
      const user=await this.actor(client,userId);
      const hasImported=(await client.query("SELECT to_regclass('invoice_directory_records') AS name")).rows[0].name;
      const imported=hasImported ? `AND ($4::boolean OR NOT EXISTS(SELECT 1 FROM invoice_directory_records i
        WHERE i.empresa_id=r.empresa_id AND i.kind=$3 AND i.local_id=r.id AND i.status<>'active'))` : '';
      // Explicit projection deliberately omits nested users, notes and related
      // entities. Authorization of one person does not authorize their employer.
      const fields=kind==='entity' ? 'r.telefone AS phone,r.nif AS "taxId",r.country_code AS "countryCode"' : 'r.telemovel AS phone'+(hasImported ? `,(SELECT i.source_data->>'phone' FROM invoice_directory_records i WHERE i.empresa_id=r.empresa_id AND i.kind='person' AND i.local_id=r.id) AS "alternativePhone"` : '');
      return (await client.query(`SELECT r.id,r.nome AS name,r.email,${fields} FROM ${table(kind)} r
        LEFT JOIN contact_access_grants g ON g.empresa_id=r.empresa_id AND g.user_id=$2 AND g.kind=$3 AND g.record_id=r.id
        WHERE r.empresa_id=$1 ${imported} AND ($4::boolean OR (COALESCE(g.decision,'')<>'revoked'
          AND (g.decision='granted' OR r.created_by_user_id=$2))) ORDER BY r.nome,r.id`,[user.empresa_id,user.id,kind,user.role==='admin'])).rows;
    });
  }
}
