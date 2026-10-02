import {ContactInvoiceProjects} from '@/components/ContactInvoiceProjects';
import {useEffect,useState} from 'react';
import {useAuth} from '@/hooks/useAuth';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';

async function api(path:string,body?:unknown) {
  const response=await fetch('/api/contact-access/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if(!response.ok) throw Error(data.message || 'Não foi possível concluir a operação.');
  return data;
}
const initial={kind:'person',name:'',email:'',phone:'',taxId:'',countryCode:'PT'};
export default function ContactAccess() {
  const {isAdmin}=useAuth();
  const [kind,setKind]=useState('person'),[contacts,setContacts]=useState<any[]>([]),[entities,setEntities]=useState<any[]>([]);
  const [requests,setRequests]=useState<any[]>([]),[users,setUsers]=useState<any[]>([]),[selectedUser,setSelectedUser]=useState('');
  const [form,setForm]=useState(initial),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function load() {
    const [people,companies,pending]=await Promise.all([api('contacts?kind=person'),api('contacts?kind=entity'),api('requests')]);
    if(!navigator.onLine)return;
    setContacts(people);setEntities(companies);setRequests(pending);
    if(isAdmin)setUsers(await api('users'));
  }
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[isAdmin]);
  useEffect(()=>{
    const offline=()=>{setContacts([]);setEntities([]);setRequests([]);setUsers([]);setMessage('Liga-te à Internet para confirmar as autorizações dos contactos.');};
    const online=()=>{load().catch(e=>setMessage(e.message));};
    window.addEventListener('offline',offline);window.addEventListener('online',online);
    return ()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',online);};
  },[isAdmin]);
  async function action(fn:()=>Promise<any>,success:string) {
    setBusy(true);setMessage('');
    try{await fn();await load();setMessage(success);}catch(e:any){setMessage(e.message);}finally{setBusy(false);}
  }
  const names=(type:string,id:string)=>(type==='person'?contacts:entities).find(c=>c.id===id)?.name || 'Contacto indisponível';
  const userName=(id:string)=>users.find(u=>u.id===id)?.email || 'Utilizador';
  return <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
    <h1 className="text-2xl font-bold">Contactos e autorizações</h1>
    <p>{isAdmin?'Gere os contactos e os acessos da tua empresa.':'Consulta os contactos autorizados e acompanha os teus pedidos de acesso.'}</p>
    <p role="status" aria-live="polite">{message}</p>
    <ContactInvoiceProjects/>
    <Card><CardHeader><CardTitle>{isAdmin?'Pedidos para rever':'Os meus pedidos'}</CardTitle></CardHeader><CardContent className="space-y-4">
      {!requests.length && <p>Não existem pedidos.</p>}
      {requests.map(r=><div key={r.id} className="rounded border p-3 space-y-2">
        <p className="font-semibold">{r.submitted.name}</p>
        <p>{({pending:'A aguardar análise',approved:'Acesso autorizado',rejected:'Acesso recusado',distinct:'Novo contacto criado'} as any)[r.state]}</p>
        {isAdmin && <><p>Pedido de {userName(r.user_id)}</p><p>{r.submitted.email} {r.submitted.phone}</p></>}
        {isAdmin && r.state==='pending' && <div className="flex flex-wrap gap-2">
          {r.candidates.map((c:any)=><Button key={c.id} disabled={busy} onClick={()=>action(()=>api(`requests/${r.id}/decision`,{action:'approve',recordId:c.id}),'Acesso autorizado.')}>Autorizar: {names(r.kind,c.id)}</Button>)}
          <Button variant="outline" disabled={busy} onClick={()=>action(()=>api(`requests/${r.id}/decision`,{action:'distinct'}),'Contacto separado criado.')}>É um contacto diferente</Button>
          <Button variant="destructive" disabled={busy} onClick={()=>action(()=>api(`requests/${r.id}/decision`,{action:'reject'}),'Pedido recusado.')}>Recusar</Button>
        </div>}
      </div>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Novo contacto</CardTitle></CardHeader><CardContent>
      <form className="space-y-3" onSubmit={e=>{e.preventDefault();action(async()=>{const result=await api('submissions',form);setForm(initial);return result;},'Pedido processado. Consulta a lista e os pedidos acima.');}}>
        <label className="block">Tipo <select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="person">Pessoa</option><option value="entity">Entidade</option></select></label>
        <label className="block">Nome<Input required maxLength={255} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label className="block">Email<Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label className="block">Telefone<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        {form.kind==='entity' && <label className="block">NIF<Input value={form.taxId} onChange={e=>setForm({...form,taxId:e.target.value})}/></label>}
        <p>Uma possível correspondência será analisada por um administrador antes de conceder acesso.</p>
        <Button disabled={busy}>Guardar contacto</Button>
      </form>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{isAdmin?'Contactos da empresa':'Contactos disponíveis'}</CardTitle></CardHeader><CardContent className="space-y-3">
      <label>Mostrar <select value={kind} onChange={e=>setKind(e.target.value)}><option value="person">Pessoas</option><option value="entity">Entidades</option></select></label>
      {isAdmin && <label className="block">Gerir acesso de <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)}><option value="">Selecionar utilizador</option>{users.map(u=><option key={u.id} value={u.id}>{u.email}</option>)}</select></label>}
      {(kind==='person'?contacts:entities).map(c=><div key={c.id} className="rounded border p-3"><p className="font-semibold">{c.name}</p><p>{c.email} {c.phone}{c.alternativePhone && c.alternativePhone!==c.phone ? ` · ${c.alternativePhone}` : ''}</p>
        {isAdmin && selectedUser && <div className="flex gap-2 mt-2">{[['granted','Autorizar'],['revoked','Revogar']].map(([decision,label])=><Button key={decision} variant="outline" disabled={busy} onClick={()=>action(()=>api('grants',{userId:selectedUser,kind,recordId:c.id,decision}),'Permissão atualizada.')}>{label}</Button>)}</div>}
      </div>)}
    </CardContent></Card>
  </div>;
}
