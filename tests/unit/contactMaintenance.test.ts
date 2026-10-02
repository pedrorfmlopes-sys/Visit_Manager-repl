import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {contactMaintenanceMiddleware,contactMaintenanceStatus,beginContactOperation} from '../../server/contactMaintenance';

test('maintenance blocks new requests, preserves health checks and waits for existing operations',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contact-maintenance-'));
 const previous=process.env.CONTACT_ACCESS_MAINTENANCE_FILE;
 process.env.CONTACT_ACCESS_MAINTENANCE_FILE=path.join(directory,'maintenance');
 const response:any=new EventEmitter();response.setHeader=()=>{};response.status=(status:number)=>{response.statusCode=status;return response;};response.json=(body:any)=>{response.body=body;return response;};
 let next=0;
 try {
  contactMaintenanceMiddleware({path:'/api/contactos'} as any,response,()=>{next++;});
  const finishJob=beginContactOperation();
  fs.writeFileSync(process.env.CONTACT_ACCESS_MAINTENANCE_FILE,'maintenance');
  assert.deepEqual(contactMaintenanceStatus(),{maintenance:true,activeOperations:2});
  contactMaintenanceMiddleware({path:'/api/contactos'} as any,response,()=>{next++;});
  assert.equal(response.statusCode,503);assert.equal(next,1);
  contactMaintenanceMiddleware({path:'/api/health'} as any,response,()=>{next++;});
  assert.equal(next,2);
  response.emit('finish');finishJob();finishJob();
  assert.deepEqual(contactMaintenanceStatus(),{maintenance:true,activeOperations:0});
  fs.unlinkSync(process.env.CONTACT_ACCESS_MAINTENANCE_FILE);
  assert.equal(contactMaintenanceStatus().maintenance,false);
 }finally{
  if(previous===undefined)delete process.env.CONTACT_ACCESS_MAINTENANCE_FILE;else process.env.CONTACT_ACCESS_MAINTENANCE_FILE=previous;
  fs.rmSync(directory,{recursive:true,force:true});
 }
});
