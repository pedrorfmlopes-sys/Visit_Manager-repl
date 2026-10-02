import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { offlineStorage } from "./offlineStorage";

// A cold/offline client cannot establish that old grants remain valid.
let serverCopiesAllowed=false;
let clearedServerCopies=false;
export const canCacheServerCopies=()=>serverCopiesAllowed;
async function observeAccessPolicy(response:Response) {
  serverCopiesAllowed=response.headers.get('X-Contact-Access-Policy')==='legacy';
  if(!serverCopiesAllowed && !clearedServerCopies) {
    await offlineStorage.clearServerCopies();clearedServerCopies=true;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getOfflineData(endpoint: string): Promise<any> {
  if(!serverCopiesAllowed)return null;
  await offlineStorage.init();
  
  // Extract ID from detail endpoints like /api/visitas/123
  const visitaMatch = endpoint.match(/\/api\/visitas\/([^\/]+)$/);
  const entidadeMatch = endpoint.match(/\/api\/entidades\/([^\/]+)$/);
  const gabineteMatch = endpoint.match(/\/api\/gabinetes\/([^\/]+)$/);
  const contactoMatch = endpoint.match(/\/api\/contactos\/([^\/]+)$/);
  
  // Detail queries - return single object
  if (visitaMatch) {
    return await offlineStorage.getVisita(visitaMatch[1]);
  } else if (entidadeMatch) {
    return await offlineStorage.getEntidade(entidadeMatch[1]);
  } else if (gabineteMatch) {
    return await offlineStorage.getGabinete(gabineteMatch[1]);
  } else if (contactoMatch) {
    return await offlineStorage.getContacto(contactoMatch[1]);
  }
  
  // List queries - return arrays
  if (endpoint.includes("/api/visitas")) {
    return await offlineStorage.getVisitas();
  } else if (endpoint.includes("/api/entidades")) {
    return await offlineStorage.getEntidades();
  } else if (endpoint.includes("/api/gabinetes")) {
    return await offlineStorage.getGabinetes();
  } else if (endpoint.includes("/api/contactos")) {
    return await offlineStorage.getContactos();
  }
  
  return null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  await observeAccessPolicy(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey.join("/") as string;
    
    try {
      const res = await fetch(endpoint, {
        credentials: "include",
      });
      await observeAccessPolicy(res);

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      
      // Cache successful responses in IndexedDB (both lists and individual items)
      if (navigator.onLine && serverCopiesAllowed) {
        await offlineStorage.init();
        
        if (endpoint.includes("/api/visitas")) {
          if (Array.isArray(data)) {
            for (const visita of data) {
              await offlineStorage.saveVisita(visita);
            }
          } else if (data && data.id) {
            await offlineStorage.saveVisita(data);
          }
        } else if (endpoint.includes("/api/entidades")) {
          if (Array.isArray(data)) {
            for (const entidade of data) {
              await offlineStorage.saveEntidade(entidade);
            }
          } else if (data && data.id) {
            await offlineStorage.saveEntidade(data);
          }
        } else if (endpoint.includes("/api/gabinetes")) {
          if (Array.isArray(data)) {
            for (const gabinete of data) {
              await offlineStorage.saveGabinete(gabinete);
            }
          } else if (data && data.id) {
            await offlineStorage.saveGabinete(data);
          }
        } else if (endpoint.includes("/api/contactos")) {
          if (Array.isArray(data)) {
            for (const contacto of data) {
              await offlineStorage.saveContacto(contacto);
            }
          } else if (data && data.id) {
            await offlineStorage.saveContacto(data);
          }
        }
      }
      
      return data;
    } catch (error) {
      // If offline, try to get data from IndexedDB
      if (!navigator.onLine) {
        const offlineData = await getOfflineData(endpoint);
        if (offlineData !== null) {
          console.log(`📱 Serving ${endpoint} from offline cache`);
          return offlineData;
        }
      }
      
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 0,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

if(typeof window!=='undefined')window.addEventListener('offline',()=>{
  if(!serverCopiesAllowed)void queryClient.resetQueries({predicate:query=>String(query.queryKey[0]).startsWith('/api/') && query.queryKey[0]!=='/api/auth/me'});
});
