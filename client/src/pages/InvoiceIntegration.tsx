import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
async function api(path:string,body?:any,method?:string){const r=await fetch('/api/integrations/invoice-studio/'+path,{method:method || (body?'POST':'GET'),headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(d.message || 'Não foi possível concluir.');return d;}
const blank={name:'',reference:'',address:'',description:'',status:'active',participants:[] as any[]};
export default function InvoiceIntegration(){
 const [settings,setSettings]=useState<any>({enabled:false,baseUrl:'',publicUrl:'',token:'',autoSync:false});
 const [projects,setProjects]=useState<any[]>([]),[jobs,setJobs]=useState<any[]>([]),[remoteProjects,setRemoteProjects]=useState<any[]>([]),[requests,setRequests]=useState<any[]>([]);
 const [options,setOptions]=useState<any>({entities:[],leads:[],visits:[],tasks:[]});
 const [selected,setSelected]=useState<any>(null),[form,setForm]=useState({...blank}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [entityId,setEntityId]=useState(''),[role,setRole]=useState('architect'),[leadId,setLeadId]=useState(''),[remoteId,setRemoteId]=useState('');
 const [links,setLinks]=useState<any[]>([]),[objectType,setObjectType]=useState('visit'),[objectId,setObjectId]=useState('');
 async function load(){const [s,p,j,o]=await Promise.all([api('settings'),api('projects'),api('jobs'),api('options')]);setSettings({...s,token:''});setProjects(p.items);setJobs(j.items);setOptions(o);}
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
 async function action(fn:()=>Promise<any>,success='Operação concluída.'){setBusy(true);setMessage('');try{await fn();await load();setMessage(success);}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}
 async function choose(p:any){setSelected(p);setForm(p?{...p}: {...blank,participants:[]});setRemoteId('');setLinks(p?(await api('projects/'+p.id+'/links')).items:[]);}
 async function send(path:string,body:any){const j=await api(path,body);await api('jobs/'+j.id+'/retry',{});}
 const field=(key:string,label:string)=><label className="block space-y-1" key={key}><span>{label}</span><Input value={(form as any)[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>;
 return <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24"><h1 className="text-2xl font-bold">Projetos e InvoiceStudio</h1><p>Projetos locais e ligação opcional ao InvoiceStudioClean.</p>
 <p role="status" className="rounded border p-3" aria-live="polite">{message || 'Pronto.'}</p>
 <Card><CardHeader><CardTitle>Integrações da empresa</CardTitle></CardHeader><CardContent className="space-y-3">
 <p>Empresa: <code>{settings.companyId}</code></p><p><Link href="/admin/empresa">Configurar Odoo nas definições da empresa</Link>. Odoo e InvoiceStudio podem estar ativos ao mesmo tempo.</p>
 <label className="block"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/> Ativar InvoiceStudioClean</label>
 <label className="block">Endereço do servidor<Input value={settings.baseUrl} onChange={e=>setSettings({...settings,baseUrl:e.target.value})} placeholder="https://invoice.exemplo.pt"/></label>
 <label className="block">Endereço para abrir no navegador<Input value={settings.publicUrl} onChange={e=>setSettings({...settings,publicUrl:e.target.value})}/></label>
 <label className="block">Chave da integração<Input type="password" autoComplete="new-password" value={settings.token} placeholder={settings.hasToken?'Chave guardada; deixa vazio para manter':''} onChange={e=>setSettings({...settings,token:e.target.value})}/></label>
 <label className="block"><input type="checkbox" checked={settings.autoSync} onChange={e=>setSettings({...settings,autoSync:e.target.checked})}/> Repetir automaticamente envios pendentes (até 5 tentativas)</label>
 <div className="flex gap-2"><Button disabled={busy} onClick={()=>action(()=>api('settings',settings,'PUT'),'Configuração guardada.')}>Guardar ligação</Button><Button variant="outline" disabled={busy || !settings.enabled} onClick={()=>action(()=>api('test',{}),'Ligação validada.')}>Testar ligação</Button>{settings.publicUrl&&<a href={settings.publicUrl} target="_blank" rel="noreferrer">Abrir InvoiceStudio</a>}</div>
 </CardContent></Card>
 <Card><CardHeader><CardTitle>Entidades e contactos</CardTitle></CardHeader><CardContent className="space-y-3">
 <select className="w-full border rounded p-2" aria-label="Entidade" value={entityId} onChange={e=>setEntityId(e.target.value)}><option value="">Selecionar entidade</option>{options.entities.map((e:any)=><option key={e.id} value={e.id}>{e.nome}</option>)}</select>
 <p>Envia a entidade selecionada e os seus contactos. Correspondências existentes ou alterações locais ficam para revisão.</p>
 <Button disabled={busy || !entityId || !settings.enabled} onClick={()=>action(()=>send('directory',{entityIds:[entityId]}),'Entidade e contactos enviados.')}>Enviar entidade e contactos</Button>
 </CardContent></Card>
 <Card><CardHeader><CardTitle>Projetos</CardTitle></CardHeader><CardContent className="space-y-4">
 <div className="flex flex-wrap gap-2"><Button onClick={()=>choose(null).catch(e=>setMessage(e.message))}>Novo projeto</Button>{projects.map(p=><Button variant={selected?.id===p.id?'default':'outline'} key={p.id} onClick={()=>choose(p).catch(e=>setMessage(e.message))}>{p.name}{p.remote_id?' · associado':''}</Button>)}</div>
 <div className="grid gap-3 md:grid-cols-2">{field('name','Nome')}{field('reference','Referência')}{field('address','Localização')}{field('description','Descrição')}</div>
 <label>Estado <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Ativo</option><option value="completed">Concluído</option><option value="archived">Arquivado</option></select></label>
 <h3 className="font-semibold">Entidades envolvidas</h3><p>Seleciona a entidade acima e o seu papel no projeto.</p>
 <select aria-label="Papel no projeto" value={role} onChange={e=>setRole(e.target.value)}>{[['owner','Dono de obra'],['architect','Arquiteto'],['installer','Instalador'],['customer','Cliente'],['contractor','Construtor'],['other','Outro']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
 <Button variant="outline" disabled={!entityId} onClick={()=>setForm({...form,participants:[...form.participants.filter(p=>p.entityId!==entityId || p.role!==role),{entityId,name:options.entities.find((e:any)=>e.id===entityId)?.nome,role}]})}>Adicionar participante</Button>
 {form.participants.map((p:any,i:number)=><p key={p.entityId+':'+p.role}>{p.name} · {({owner:'Dono de obra',architect:'Arquiteto',installer:'Instalador',customer:'Cliente',contractor:'Construtor',other:'Outro'} as Record<string,string>)[p.role] || p.role} <button onClick={()=>setForm({...form,participants:form.participants.filter((_,j)=>j!==i)})}>Remover</button></p>)}
 <Button disabled={busy || !form.name.trim()} onClick={()=>action(async()=>{const r=await api(selected?'projects/'+selected.id:'projects',form,selected?'PUT':'POST');await choose({...form,id:selected?.id || r.id});},'Projeto guardado localmente.')}>Guardar projeto</Button>
 {selected&&<div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Atividade associada</h3>
 <select aria-label="Oportunidade" value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Selecionar oportunidade</option>{options.leads.map((l:any)=><option key={l.id} value={l.id}>{l.titulo}</option>)}</select>
 <Button variant="outline" disabled={busy || !leadId} onClick={()=>action(async()=>{await api('projects/'+selected.id+'/links',{type:'lead',id:leadId});setLinks((await api('projects/'+selected.id+'/links')).items);})}>Associar oportunidade</Button>
 <div className="flex gap-2"><select value={objectType} onChange={e=>{setObjectType(e.target.value);setObjectId('');}}><option value="visit">Visita</option><option value="task">Tarefa</option></select><select aria-label="Atividade" value={objectId} onChange={e=>setObjectId(e.target.value)}><option value="">Selecionar atividade</option>{(objectType==='visit'?options.visits:options.tasks).map((o:any)=><option key={o.id} value={o.id}>{o.titulo || o.objetivo || o.id}</option>)}</select><Button variant="outline" disabled={busy || !objectId} onClick={()=>action(async()=>{await api('projects/'+selected.id+'/links',{type:objectType,id:objectId});setLinks((await api('projects/'+selected.id+'/links')).items);})}>Associar</Button></div>
 {links.map(l=><p key={l.object_type+l.object_id}>{l.object_type==='lead'?'Oportunidade':l.object_type==='visit'?'Visita':'Tarefa'}: {(l.object_type==='lead'?options.leads:l.object_type==='visit'?options.visits:options.tasks).find((o:any)=>o.id===l.object_id)?.titulo || (l.object_type==='visit'?options.visits.find((o:any)=>o.id===l.object_id)?.objetivo:'') || 'Atividade associada'}</p>)}
 <h3 className="font-semibold">Ligação ao InvoiceStudio</h3><Button variant="outline" disabled={busy || !settings.enabled} onClick={()=>action(async()=>setRemoteProjects((await api('remote-projects')).items))}>Consultar projetos do InvoiceStudio</Button>
 <select className="w-full border p-2" value={remoteId} onChange={e=>setRemoteId(e.target.value)}><option value="">Criar / atualizar projeto associado</option>{remoteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <Button disabled={busy || !settings.enabled} onClick={()=>action(()=>send('projects/'+selected.id+'/send',remoteId?{remoteId}:{}),'Projeto associado ao InvoiceStudio.')}>Enviar / associar projeto guardado</Button>
 {projects.find(p=>p.id===selected.id)?.remote_id && settings.publicUrl && <a className="block underline" target="_blank" rel="noreferrer" href={settings.publicUrl+'/?page=projects&projectId='+encodeURIComponent(projects.find(p=>p.id===selected.id).remote_id)}>Abrir projeto no InvoiceStudio</a>}
 <Button disabled={busy || !settings.enabled || !leadId} onClick={()=>action(()=>send('projects/'+selected.id+'/request',{leadId}),'Pedido de proposta enviado.')}>Pedir proposta para a oportunidade</Button>
 </div>}
 <div className="border-t pt-3"><Button variant="outline" disabled={busy || !settings.enabled} onClick={()=>action(async()=>setRemoteProjects((await api('remote-projects')).items))}>Procurar projetos para importar</Button>{remoteProjects.map(p=><p key={p.id}>{p.name} <button disabled={busy} onClick={()=>action(()=>api('remote-projects/import',{id:p.id}),'Projeto importado e associado.')}>Importar para o Visit Manager</button></p>)}</div>
 </CardContent></Card>
 <Card><CardHeader><CardTitle>Propostas recebidas</CardTitle></CardHeader><CardContent><Button disabled={busy || !settings.enabled} onClick={()=>action(async()=>setRequests((await api('proposals')).items))}>Atualizar propostas</Button>{requests.map(r=><div key={r.id} className="border-t py-3"><strong>{r.title}</strong><p>{r.status}</p>{r.proposals.map((p:any)=><p key={p.id}><a className="underline" target="_blank" rel="noreferrer" href={settings.publicUrl+'/?page=proposals&proposalId='+encodeURIComponent(p.id)}>{p.number}</a> · {p.status} · {p.amount ?? 'Valor não disponível'} {p.currency}</p>)}</div>)}</CardContent></Card>
 <Card><CardHeader><CardTitle>Histórico de sincronização</CardTitle></CardHeader><CardContent>{jobs.map(j=><div key={j.id} className="border-t py-2"><p>{j.kind} · {j.state} · {j.attempts} tentativa(s)</p>{j.error&&<p>{j.error}</p>}{j.state!=='done'&&<Button variant="outline" disabled={busy || !settings.enabled} onClick={()=>action(()=>api('jobs/'+j.id+'/retry',{}))}>Repetir envio</Button>}</div>)}</CardContent></Card>
 </div>;
}
