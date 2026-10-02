import type {Express,Request,Response,NextFunction} from 'express';
import {pool} from '../../db';
import {ContactAccessService,ensureContactAccessSchema} from '../../contactAccessService';
import {z} from 'zod';
import {getUserContext} from '../../authContext';
import {ensureInvoiceDirectorySchema} from '../../invoiceDirectoryImport';
import {storage} from '../../storage';

export async function registerContactAccessRoutes(app:Express) {
  const service=new ContactAccessService(pool);
  app.get('/api/contact-access/status',async(req,res,next)=>{
    try {
      if(!(req as any).session?.user?.id)return res.status(401).json({message:'Sessão inválida.'});
      const context=await getUserContext(req);
      res.setHeader('Cache-Control','no-store');
      res.json(process.env.CONTACT_ACCESS_V2==='true' ? await service.summary(context.userId) : {enabled:false,pending:0});
    }catch(error){next(error);}
  });
  // Kept default-off until every legacy CRM route has passed the same boundary.
  if(process.env.CONTACT_ACCESS_V2!=='true') return;
  await ensureContactAccessSchema(pool);
  await ensureInvoiceDirectorySchema(pool);
  app.use('/api',async(req:any,res,next)=>{
    if(!req.session?.user?.id)return next();
    try {
      const context=await getUserContext(req);
      req.userContext=context;
      res.setHeader('Cache-Control','private, no-store');
      req.session.user.role=context.userRole;
      req.session.user.empresaId=context.empresaId;
      if(context.userRole==='admin')return next();
      const refs:Array<{kind:'person'|'entity';id:string}>=[];
      const direct=req.path.match(/^\/(contactos|entidades)\/([^/]+)(?:\/|$)/);
      if(direct)refs.push({kind:direct[1]==='contactos'?'person':'entity',id:decodeURIComponent(direct[2])});
      const activity=req.path.match(/^\/(visitas|tarefas)\/([^/]+)(?:\/|$)/);
      if(activity && !['ia','proximidade'].includes(activity[2])) {
        const record=activity[1]==='visitas' ? await storage.getVisita(activity[2],context.empresaId!,context.userId,context.userRole)
          : await storage.getTarefa(activity[2],context.empresaId!,context.userId,context.userRole);
        if(!record)return res.status(404).json({message:'Registo indisponível.'});
      }
      // The external Odoo directory has no Visit contact grants. Its discovery,
      // linking and import operations require an administrator in this mode.
      if(/\/odoo\/(?:search|import|pull|chatter)|\/odoo-link$/.test(req.path) || /\/(?:search-partner|partner\/|sync\/partners\/)/.test(req.path))return res.status(403).json({message:'A consulta e importação do diretório externo exige um administrador.'});
      for(const source of [req.body,req.query])if(source && typeof source==='object') {
        for(const [key,kind] of [['entidadeId','entity'],['entityId','entity'],['contactoId','person'],['contactId','person']] as const) {
          const value=source[key];if(typeof value==='string' && value)refs.push({kind,id:value});
        }
        for(const key of ['contactosIds','contactIds'])if(source[key]) {
          let values=source[key];
          if(typeof values==='string') {try{values=JSON.parse(values);}catch{values=[values];}}
          if(!Array.isArray(values) || values.length>200)return res.status(400).json({message:'Contactos inválidos.'});
          for(const id of values)if(typeof id==='string' && id)refs.push({kind:'person',id});
        }
      }
      for(const ref of refs)if(!await service.allowed(context.userId,ref.kind,ref.id))return res.status(404).json({message:'Registo indisponível.'});
      if(req.body && typeof req.body==='object' && ('assignedUserId' in req.body || 'createdByUserId' in req.body)) {
        if(req.body.assignedUserId && req.body.assignedUserId!==context.userId)return res.status(403).json({message:'A atribuição de contactos exige um administrador.'});
        delete req.body.createdByUserId;
        delete req.body.assignedUserId;
      }
      next();
    } catch(error){next(error);}
  });
  const route=(method:'get'|'post',path:string,fn:(req:any,userId:string)=>Promise<unknown>)=>{
    app[method]('/api/contact-access'+path,async(req:Request,res:Response,next:NextFunction)=>{
      try {
        const userId=(req as any).session?.user?.id;
        if(!userId) return res.status(401).json({message:'Sessão inválida.'});
        res.setHeader('Cache-Control','no-store');
        res.json(await fn(req,userId));
      }catch(error){
        if(error instanceof z.ZodError) return res.status(400).json({message:'Dados inválidos.'});
        next(error);
      }
    });
  };
  route('get','/contacts',(req,id)=>service.list(id,z.enum(['entity','person']).parse(req.query.kind)));
  route('get','/requests',(_req,id)=>service.requests(id));
  route('get','/users',(_req,id)=>service.users(id));
  route('post','/submissions',(req,id)=>service.submit(id,req.body));
  route('post','/requests/:id/decision',(req,id)=>{
    const body=z.object({action:z.enum(['approve','reject','distinct']),recordId:z.string().max(300).optional()}).strict().parse(req.body);
    return service.decide(id,z.string().uuid().parse(req.params.id),body.action,body.recordId);
  });
  route('post','/grants',(req,id)=>{
    const body=z.object({userId:z.string().min(1).max(300),kind:z.enum(['entity','person']),recordId:z.string().min(1).max(300),decision:z.enum(['granted','revoked'])}).strict().parse(req.body);
    return service.grant(id,body.userId,body.kind,body.recordId,body.decision);
  });
}
