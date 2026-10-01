import crypto from 'node:crypto';
import type { Express } from 'express';
import { Router } from 'express';
import { pool } from '../db';
import { requireAdmin } from '../authContext';
import { encryptSecret, decryptSecret } from '../secretCrypto';
import { z } from 'zod';
import { assertEmpresaModuleEnabled } from '../modules';

const query = async (sql: string, args: any[] = []) => (await pool.query(sql, args)).rows as any[];
const error = (message: string, status = 400) => Object.assign(new Error(message), { status });
function origin(value: string, publicOnly = false) {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/') throw error('Usa apenas o endereço base da aplicação.');
  const allowed = (process.env.INVOICE_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!publicOnly && !allowed.includes(u.origin)) throw error('O endereço não está autorizado em INVOICE_ALLOWED_ORIGINS.');
  if (u.protocol !== 'https:' && !(process.env.INTEGRATION_LAB === 'true' && u.protocol === 'http:')) throw error('A ligação exige HTTPS.');
  return u.origin;
}
async function connection(company: string) {
  const c = (await query('SELECT * FROM invoice_connections WHERE empresa_id=$1', [company]))[0];
  if (!c?.enabled) throw error('Integração InvoiceStudio desativada.', 409);
  return c;
}
async function remote(company: string, path: string, body?: any) {
  const c = await connection(company);
  const response = await fetch(origin(c.base_url) + '/integrations/visit-manager/v1/' + path, {
    method: body ? 'POST':'GET', redirect:'error', signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Bearer '+decryptSecret(c.token_encrypted),'X-Visit-Company':company,'Content-Type':'application/json'},
    body:body ? JSON.stringify(body):undefined,
  });
  const data = await response.json();
  if (!response.ok) throw error(String(data.error || 'Pedido recusado pelo InvoiceStudio'), response.status);
  return data;
}
const running = new Set<string>();
export async function deliverInvoiceJob(company: string, id: string) {
  if (running.has(company)) throw error('Existe uma sincronização em curso.', 409);
  running.add(company);
  try {
    await connection(company);
    const j = (await query('SELECT * FROM invoice_jobs WHERE empresa_id=$1 AND id=$2', [company,id]))[0];
    if (!j) throw error('Operação não encontrada.',404);
    if (j.state === 'done') return j.result;
    if (j.state === 'cancelled') throw error('Este envio foi cancelado.',409);
    await query("UPDATE invoice_jobs SET state='sending',attempts=attempts+1,updated_at=now() WHERE id=$1",[id]);
    try {
      const result = await remote(company,'events',j.payload);
      if(j.kind==='project') await query(`INSERT INTO invoice_project_links(empresa_id,project_id,remote_id,snapshot) VALUES($1,$2,$3,$4)
        ON CONFLICT(empresa_id,project_id) DO UPDATE SET remote_id=excluded.remote_id,snapshot=excluded.snapshot,synced_at=now()`,[company,j.source_id,result.project.id,JSON.stringify(result.project)]);
      await query("UPDATE invoice_jobs SET state='done',result=$2,error=NULL,updated_at=now() WHERE id=$1",[id,JSON.stringify(result)]);
      return result;
    } catch(e:any) {
      const state = e.status===409 ? 'conflict' : e.status && e.status < 500 ? 'rejected':'pending';
      await query('UPDATE invoice_jobs SET state=$2,error=$3,updated_at=now() WHERE id=$1',[id,state,e.status ? e.message : 'Ligação indisponível. Podes repetir o envio.']);
      throw error(e.status ? e.message : 'Ligação indisponível. O envio ficou guardado.',e.status || 503);
    }
  } finally { running.delete(company); }
}
async function enqueue(company:string, kind:string, sourceId:string, data:any) {
  const id = crypto.randomUUID();
  await query('INSERT INTO invoice_jobs(id,empresa_id,kind,source_id,payload) VALUES($1,$2,$3,$4,$5)',[id,company,kind,sourceId,JSON.stringify({version:1,id,kind,data})]);
  return {id,state:'pending'};
}
const projectInput = z.object({name:z.string().trim().min(1).max(300), reference:z.string().max(200).default(''),address:z.string().max(1000).default(''),description:z.string().max(10000).default(''),status:z.enum(['active','completed','archived']).default('active'),participants:z.array(z.object({entityId:z.string(),name:z.string().max(300),role:z.enum(['owner','architect','installer','customer','contractor','other'])})).max(100).default([])});
export function setupInvoiceStudio(app:Express) {
  const router = Router();
  router.use(requireAdmin);
  router.use((req:any,res,next)=>{if(!req.userContext?.empresaId)return res.status(403).json({message:'Empresa obrigatória.'});next();});
  const route = (method:'get'|'post'|'put',path:string,fn:(req:any,company:string)=>Promise<any>)=>router[method](path,async(req:any,res)=>{try{res.json(await fn(req,req.userContext.empresaId));}catch(e:any){res.status(e instanceof z.ZodError ? 400 : e.status || 500).json({message:e instanceof z.ZodError ? 'Dados inválidos.' : e.status ? e.message:'Não foi possível concluir a operação.'});}});
  route('get','/settings',async(_req,c)=>{
    const row=(await query('SELECT enabled,base_url,public_url,auto_sync,token_encrypted FROM invoice_connections WHERE empresa_id=$1',[c]))[0];
    return {companyId:c,enabled:row?.enabled || false,baseUrl:row?.base_url || '',publicUrl:row?.public_url || '',autoSync:row?.auto_sync || false,hasToken:!!row?.token_encrypted};
  });
  route('put','/settings',async(req,c)=>{
    const body=z.object({enabled:z.boolean(),baseUrl:z.string(),publicUrl:z.string(),token:z.string().max(256).optional(),autoSync:z.boolean().default(false)}).parse(req.body);
    const old=(await query('SELECT * FROM invoice_connections WHERE empresa_id=$1',[c]))[0];
    const baseUrl=body.baseUrl ? origin(body.baseUrl):'';
    const publicUrl=body.publicUrl ? origin(body.publicUrl,true):'';
    const token=body.token ? encryptSecret(body.token):old?.token_encrypted || '';
    if(body.enabled && (!baseUrl || !token))throw error('Configura o endereço e a chave antes de ativar.');
    if(old?.base_url && baseUrl!==old.base_url && !body.token)throw error('Uma alteração de servidor exige uma nova chave.');
    await query(`INSERT INTO invoice_connections(empresa_id,enabled,base_url,public_url,token_encrypted,auto_sync) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(empresa_id) DO UPDATE SET enabled=excluded.enabled,base_url=excluded.base_url,public_url=excluded.public_url,token_encrypted=excluded.token_encrypted,auto_sync=excluded.auto_sync,updated_at=now()`,[c,body.enabled,baseUrl,publicUrl,token,body.autoSync]);return {ok:true};
  });
  route('post','/test',async(_req,c)=>remote(c,'status'));
  route('get','/jobs',async(_req,c)=>({items:await query('SELECT id,kind,source_id,state,attempts,error,created_at FROM invoice_jobs WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 100',[c])}));
  route('post','/jobs/:id/retry',async(req,c)=>deliverInvoiceJob(c,req.params.id));
  route('post','/jobs/:id/cancel',async(req,c)=>{
    const rows=await query("UPDATE invoice_jobs SET state='cancelled',updated_at=now() WHERE empresa_id=$1 AND id=$2 AND state IN ('pending','conflict','rejected') RETURNING id",[c,req.params.id]);
    if(!rows.length)throw error('O envio não pode ser cancelado neste estado.',409);return {ok:true};
  });
  route('get','/projects',async(_req,c)=>({items:await query(`SELECT p.*,l.remote_id,l.snapshot,l.synced_at FROM commercial_projects p LEFT JOIN invoice_project_links l ON l.empresa_id=p.empresa_id AND l.project_id=p.id WHERE p.empresa_id=$1 ORDER BY p.updated_at DESC`,[c])}));
  route('post','/projects',async(req,c)=>{
    const b=projectInput.parse(req.body);await validateParticipants(c,b.participants);
    const id=crypto.randomUUID();await query('INSERT INTO commercial_projects(id,empresa_id,name,reference,address,description,status,participants) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,c,b.name,b.reference,b.address,b.description,b.status,JSON.stringify(b.participants)]);return {id,...b};
  });
  route('put','/projects/:id',async(req,c)=>{
    const b=projectInput.parse(req.body);await validateParticipants(c,b.participants);
    const rows=await query('UPDATE commercial_projects SET name=$3,reference=$4,address=$5,description=$6,status=$7,participants=$8,updated_at=now() WHERE empresa_id=$1 AND id=$2 RETURNING id',[c,req.params.id,b.name,b.reference,b.address,b.description,b.status,JSON.stringify(b.participants)]);if(!rows.length)throw error('Projeto não encontrado.',404);return {ok:true};
  });
  route('get','/options',async(_req,c)=>({entities:await query('SELECT id,nome FROM entidades WHERE empresa_id=$1 ORDER BY nome',[c]),leads:await query('SELECT id,titulo FROM leads WHERE empresa_id=$1 ORDER BY titulo',[c]),visits:await query('SELECT id,notas AS objetivo FROM visitas WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 300',[c]),tasks:await query('SELECT id,titulo FROM tarefas WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 300',[c])}));
  route('get','/projects/:id/links',async(req,c)=>({items:await query('SELECT object_type,object_id FROM commercial_project_links WHERE empresa_id=$1 AND project_id=$2',[c,req.params.id])}));
  route('post','/projects/:id/links',async(req,c)=>{
    await project(c,req.params.id);
    const b=z.object({type:z.enum(['lead','visit','task']),id:z.string()}).parse(req.body);
    if(b.type==='lead')await assertEmpresaModuleEnabled(c,'leads').catch(()=>{throw error('Módulo oportunidades desativado.',403);});
    const table={lead:'leads',visit:'visitas',task:'tarefas'}[b.type];
    if(!(await query(`SELECT id FROM ${table} WHERE empresa_id=$1 AND id=$2`,[c,b.id])).length)throw error('Registo não encontrado.',404);
    await query('INSERT INTO commercial_project_links(empresa_id,project_id,object_type,object_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[c,req.params.id,b.type,b.id]);return {ok:true};
  });
  route('post','/directory',async(req,c)=>{
    const ids=z.array(z.string()).min(1).max(100).parse(req.body.entityIds);
    const entidades=await query('SELECT id,nome,nif,country_code AS "countryCode",tipo_entidade AS "tipoEntidade",email,telefone,website,notas FROM entidades WHERE empresa_id=$1 AND id=ANY($2::varchar[])',[c,ids]);
    if(entidades.length!==new Set(ids).size)throw error('Entidades fora da empresa.',403);
    const contactos=await query('SELECT id,entidade_id AS "entidadeId",nome,email,telemovel,funcao FROM contactos WHERE empresa_id=$1 AND entidade_id=ANY($2::varchar[])',[c,ids]);
    return enqueue(c,'directory',ids.join(','),{entidades,contactos});
  });
  route('post','/projects/:id/send',async(req,c)=>{
    const p=await project(c,req.params.id);return enqueue(c,'project',p.id,{id:p.id,name:p.name,reference:p.reference,address:p.address,description:p.description,participants:p.participants,remoteId:z.string().max(200).optional().parse(req.body.remoteId)});
  });
  route('get','/remote-projects',async(_req,c)=>remote(c,'projects'));
  route('post','/remote-projects/import',async(req,c)=>{
    const id=z.string().parse(req.body.id);const p=(await remote(c,'projects')).items.find((x:any)=>x.id===id);if(!p)throw error('Projeto não encontrado.',404);
    const exists=(await query('SELECT project_id FROM invoice_project_links WHERE empresa_id=$1 AND remote_id=$2',[c,id]))[0];if(exists)return {id:exists.project_id};
    const local=crypto.randomUUID();await query('INSERT INTO commercial_projects(id,empresa_id,name,reference,address,description) VALUES($1,$2,$3,$4,$5,$6)',[local,c,p.name,p.reference,p.address,p.description]);
    const job=await enqueue(c,'project',local,{id:local,name:p.name,remoteId:id});await deliverInvoiceJob(c,job.id);return {id:local};
  });
  route('post','/projects/:id/request',async(req,c)=>{
    await assertEmpresaModuleEnabled(c,'leads').catch(()=>{throw error('Módulo oportunidades desativado.',403);});
    await project(c,req.params.id);const b=z.object({leadId:z.string(),context:z.string().max(10000).default('')}).parse(req.body);
    const lead=(await query('SELECT titulo,descricao FROM leads WHERE empresa_id=$1 AND id=$2',[c,b.leadId]))[0];if(!lead)throw error('Oportunidade não encontrada.',404);
    if(!(await query("SELECT 1 FROM commercial_project_links WHERE empresa_id=$1 AND project_id=$2 AND object_type='lead' AND object_id=$3",[c,req.params.id,b.leadId])).length)throw error('Associa primeiro a oportunidade ao projeto.');
    return enqueue(c,'proposal-request',b.leadId,{id:b.leadId,projectId:req.params.id,title:lead.titulo,context:b.context || lead.descricao || ''});
  });
  route('get','/proposals',async(_req,c)=>remote(c,'requests'));
  app.use('/api/integrations/invoice-studio',router);
  let working=false;
  const timer=setInterval(async()=>{
    if(working)return;working=true;
    try{
      await query("UPDATE invoice_jobs SET state='pending',error='Envio interrompido; aguarda nova tentativa.' WHERE state='sending' AND updated_at<now()-interval '5 minutes'");
      const jobs=await query(`SELECT j.id,j.empresa_id FROM invoice_jobs j JOIN invoice_connections c ON c.empresa_id=j.empresa_id WHERE c.enabled AND c.auto_sync AND j.state='pending' AND j.attempts<5 AND j.updated_at < now()-interval '1 minute' ORDER BY j.created_at LIMIT 10`);
      for(const j of jobs)await deliverInvoiceJob(j.empresa_id,j.id).catch(()=>{});
    }catch{}finally{working=false;}
  },60000);timer.unref();
}
async function project(company:string,id:string){const row=(await query('SELECT * FROM commercial_projects WHERE empresa_id=$1 AND id=$2',[company,id]))[0];if(!row)throw error('Projeto não encontrado.',404);return row;}
async function validateParticipants(company:string,items:any[]){for(const p of items){if(!(await query('SELECT id FROM entidades WHERE empresa_id=$1 AND id=$2',[company,p.entityId])).length)throw error('Participante fora da empresa.',403);}}
