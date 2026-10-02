import {and,eq,not} from 'drizzle-orm';
import {db} from './db';
import {contactos,entidades,visitas,visitasContactos,leadsContactos,leads} from '@shared/schema';
import {contactAccessWhere} from './contactAccessSql';

// Deny the entire activity when it includes a hidden contact: merely removing
// the nested name would leave notes, summaries and attachments exposed.
export async function contactRecordBoundary(company:string,userId:string,role:string) {
  if(process.env.CONTACT_ACCESS_V2!=='true' || role==='admin')return (_record:any)=>true;
  const [entities,people,hiddenVisitContacts,hiddenLeadContacts]=await Promise.all([
    db.select({id:entidades.id}).from(entidades).where(contactAccessWhere('entity',company,userId,role)),
    db.select({id:contactos.id}).from(contactos).where(contactAccessWhere('person',company,userId,role)),
    db.select({id:visitasContactos.visitaId}).from(visitasContactos).innerJoin(contactos,eq(contactos.id,visitasContactos.contactoId))
      .where(and(eq(visitasContactos.empresaId,company),not(contactAccessWhere('person',company,userId,role)!))),
    db.select({id:leadsContactos.leadId}).from(leadsContactos).innerJoin(leads,eq(leads.id,leadsContactos.leadId)).innerJoin(contactos,eq(contactos.id,leadsContactos.contactoId))
      .where(and(eq(leads.empresaId,company),not(contactAccessWhere('person',company,userId,role)!))),
  ]);
  const entityIds=new Set(entities.map(r=>r.id)),personIds=new Set(people.map(r=>r.id)),hiddenVisits=new Set(hiddenVisitContacts.map(r=>r.id));
  const hiddenLeads=new Set(hiddenLeadContacts.map(r=>r.id));
  // A task/reminder may only contain visitaId, without the visit relation.
  const relatedVisits=await db.select({id:visitas.id,entidadeId:visitas.entidadeId,contactoId:visitas.contactoId}).from(visitas).where(eq(visitas.empresaId,company));
  for(const visit of relatedVisits)if((visit.entidadeId && !entityIds.has(visit.entidadeId)) || (visit.contactoId && !personIds.has(visit.contactoId)))hiddenVisits.add(visit.id);
  const allowed=(record:any):boolean=>{
    if(!record)return true;
    if(record.empresaId && record.empresaId!==company)return false;
    if(hiddenLeads.has(record.id) || (record.leadId && hiddenLeads.has(record.leadId)))return false;
    if(record.entidadeId && !entityIds.has(record.entidadeId))return false;
    if(record.contactoId && !personIds.has(record.contactoId))return false;
    if(record.entidade?.id && !entityIds.has(record.entidade.id))return false;
    if(record.contacto?.id && !personIds.has(record.contacto.id))return false;
    if((record.dataVisita && hiddenVisits.has(record.id)) || (record.visitaId && hiddenVisits.has(record.visitaId)))return false;
    if(record.visita && !allowed(record.visita))return false;
    if(record.tarefa && !allowed(record.tarefa))return false;
    if(Array.isArray(record.contactos) && record.contactos.some((link:any)=>!personIds.has(link.contactoId || link.contacto?.id || link.id)))return false;
    return true;
  };
  return allowed;
}
