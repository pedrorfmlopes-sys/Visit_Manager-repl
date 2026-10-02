import {and,eq,or,sql} from 'drizzle-orm';
import {contactos,entidades} from '@shared/schema';

export function contactAccessWhere(kind:'entity'|'person',companyId:string,userId:string,role:string) {
  const record=kind==='entity'?entidades:contactos;
  const company=eq(record.empresaId,companyId);
  if(role==='admin') return company;
  if(!userId || role!=='agent') return and(company,sql`false`);
  if(process.env.CONTACT_ACCESS_V2!=='true') return and(company,or(eq(record.createdByUserId,userId),eq(record.assignedUserId,userId)));
  return and(company,
    sql`NOT EXISTS(SELECT 1 FROM invoice_directory_records i WHERE i.empresa_id=${companyId}
      AND i.kind=${kind} AND i.local_id=${record.id} AND i.status<>'active')`,
    sql`NOT EXISTS(SELECT 1 FROM contact_access_grants g WHERE g.empresa_id=${companyId}
      AND g.user_id=${userId} AND g.kind=${kind} AND g.record_id=${record.id} AND g.decision='revoked')`,
    or(eq(record.createdByUserId,userId),sql`EXISTS(SELECT 1 FROM contact_access_grants g WHERE g.empresa_id=${companyId}
      AND g.user_id=${userId} AND g.kind=${kind} AND g.record_id=${record.id} AND g.decision='granted')`));
}
