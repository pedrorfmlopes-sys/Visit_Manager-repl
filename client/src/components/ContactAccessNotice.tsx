import {useQuery} from '@tanstack/react-query';
import {Link} from 'wouter';
import {useAuth} from '@/hooks/useAuth';

export function ContactAccessNotice() {
  const {isAdmin}=useAuth();
  const {data}=useQuery<{enabled:boolean;pending:number}>({queryKey:['/api/contact-access/status'],retry:false,refetchInterval:30000});
  if(!data?.enabled)return null;
  return <div className="border-b bg-card px-4 py-2 text-sm"><Link href="/contact-access" className="font-medium underline underline-offset-4">Contactos e autorizações</Link>
    {data.pending>0 && <span className="ml-3" role="status">{isAdmin?`${data.pending} pedido(s) de acesso para analisar`:`${data.pending} pedido(s) a aguardar análise`}</span>}
  </div>;
}
