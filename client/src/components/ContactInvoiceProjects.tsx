import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
export function ContactInvoiceProjects() {
 const [items,setItems]=useState<any[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load() {
  setBusy(true);setItems([]);setMessage('');
  try {
   const response=await fetch('/api/contact-access/invoice-projects',{cache:'no-store'}),data=await response.json();
   if(!response.ok)throw Error(data.message || 'Não foi possível consultar os projetos.');if(navigator.onLine)setItems(data.items);
  }catch(error:any){setMessage(error.message);}finally{setBusy(false);}
 }
 useEffect(()=>{
  const offline=()=>{setItems([]);setMessage('Liga-te à Internet para confirmar as autorizações dos projetos.');};
  load();window.addEventListener('offline',offline);window.addEventListener('online',load);
  return ()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',load);};
 },[]);
 return <section className="space-y-3 rounded border p-4"><h2 className="text-xl font-semibold">Projetos do InvoiceStudio</h2>
  <p>Conteúdos publicados para os contactos a que tens acesso.</p><Button variant="outline" disabled={busy} onClick={load}>Atualizar projetos</Button>
  <p role="status">{busy?'A consultar projetos…':message || (!items.length?'Não existem conteúdos autorizados para mostrar.':'')}</p>
  {items.map(project=><article key={project.id} className="rounded border p-3"><h3 className="font-semibold">{project.name}</h3><p>{project.status}</p>
   {project.objects.map((object:any)=><p key={object.type+object.id}>{object.title} {object.downloadable && <a className="underline" href={'/api/contact-access/invoice-projects?'+new URLSearchParams({projectId:project.id,objectType:object.type,download:object.id})}>Descarregar</a>}</p>)}
  </article>)}
 </section>;
}
