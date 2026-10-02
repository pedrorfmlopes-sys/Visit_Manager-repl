import fs from 'node:fs';
import type {Request,Response,NextFunction} from 'express';

// An operator creates this local marker before a reviewed data reset. There is
// deliberately no HTTP endpoint that can enable/disable maintenance or reset data.
let activeOperations=0;
export function contactMaintenanceEnabled() {
  const marker=process.env.CONTACT_ACCESS_MAINTENANCE_FILE;
  return Boolean(marker && fs.existsSync(marker));
}
export function contactMaintenanceStatus() {
  return {maintenance:contactMaintenanceEnabled(),activeOperations};
}
export function beginContactOperation() {
  activeOperations++;
  let complete=false;
  return ()=>{if(!complete){complete=true;activeOperations--;}};
}
export function contactMaintenanceMiddleware(req:Request,res:Response,next:NextFunction) {
  if(['/api/health','/api/ready'].includes(req.path))return next();
  if(contactMaintenanceEnabled()) {
    res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','60');
    return res.status(503).json({message:'O VisitManager está em manutenção. Tenta novamente dentro de alguns minutos.'});
  }
  const complete=beginContactOperation();
  // An aborted connection may still have a running handler. Keep it counted;
  // the operator must restart under maintenance rather than assume it drained.
  res.once('finish',complete);next();
}
