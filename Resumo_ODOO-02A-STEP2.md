# Resumo ODOO-02A / STEP 2 – Pesquisa de Parceiros Odoo (search-partner)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Criar uma função no cliente Odoo para pesquisar `res.partner` (clientes/fornecedores) e expor isso numa rota `GET /api/integrations/odoo/search-partner?q=...` para permitir busca de parceiros sem sincronizar dados ainda.

---

## ✅ Trabalho Realizado

### 1. Atualização Cliente Odoo: `server/integrations/odooClient.ts`

#### Novo Tipo: OdooPartner
```typescript
export type OdooPartner = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  vat?: string | null;
  city?: string | null;
  country?: string | null;
  street?: string | null;
};
```

#### Helper Genérico: callOdooJsonRpc<T>()
```typescript
async function callOdooJsonRpc<T>(
  conn: OdooConnection,
  payload: any
): Promise<T>
```

**Funcionalidades:**
- POST para `${conn.baseUrl}/jsonrpc`
- Implementa JSON-RPC 2.0 (jsonrpc: "2.0", id: timestamp)
- Spread `payload` (method, params, etc.) no corpo
- Valida HTTP response
- Extrai e valida `data.result`
- Lança erros descritivos do Odoo ou HTTP

**Uso:** Base para todas as chamadas RPC futuras

#### Função Pública: searchOdooPartners()
```typescript
export async function searchOdooPartners(
  empresaId: string,
  query: string
): Promise<OdooPartner[]>
```

**Fluxo:**
1. Busca configuração Odoo: `getOdooConnectionForEmpresa(empresaId)`
2. Chama RPC com `execute_kw` (método padrão do Odoo):
   - Serviço: `"object"`
   - Método: `"search_read"`
   - Modelo: `"res.partner"`
   - Filtro: Nome OU Email contém `query` (ilike)
   - Campos: name, email, phone, mobile, vat, city, country_id, street
   - Limite: 10 resultados

3. Mapeia resposta Odoo para tipo `OdooPartner`:
   - `country_id: [id, name]` → `country: string | null`
   - Todos os campos null-safe com `?? null`

**Formato de Filtro Odoo:**
```typescript
[
  ["|", ["name", "ilike", query], ["email", "ilike", query]]
]
```
- `|` = OR lógico
- `ilike` = case-insensitive like (SQL ILIKE)

---

### 2. Nova Rota: `server/routes/integrations/odoo.ts`

#### GET /api/integrations/odoo/search-partner

**Path:** `/search-partner`  
**Query params:** `q` (obrigatório, string)  
**Auth:** `isAuthenticated` middleware

**Fluxo:**
1. Valida parâmetro `q`:
   - Trim whitespace
   - Se vazio: HTTP 400 com erro
2. Extrai `empresaId` via `getUserContext(req)`
3. Chama `searchOdooPartners(empresaId, q)`
4. Retorna `{ results: [...] }`

**Sucesso (HTTP 200):**
```json
{
  "results": [
    {
      "id": 123,
      "name": "Cliente Teste",
      "email": "cliente@teste.com",
      "phone": "915000000",
      "mobile": null,
      "vat": "PT123456789",
      "city": "Lisboa",
      "country": "Portugal",
      "street": "Rua Exemplo 123"
    }
  ]
}
```

**Não configurado (HTTP 200):**
```json
{
  "results": [],
  "notConfigured": true
}
```

**Erro: credenciais/rede (HTTP 500):**
```json
{
  "error": "Odoo search error",
  "message": "credenciais inválidas ou rede indisponível"
}
```

**Erro: parâmetro q faltando (HTTP 400):**
```json
{
  "error": "Missing query parameter q"
}
```

---

## 📁 Ficheiros Editados

| Ficheiro | Secção | Mudança |
|----------|--------|---------|
| `server/integrations/odooClient.ts` | Tipos | Adicionado `OdooPartner` |
| `server/integrations/odooClient.ts` | Helpers | Adicionado `callOdooJsonRpc<T>()` |
| `server/integrations/odooClient.ts` | Público | Adicionado `searchOdooPartners()` |
| `server/routes/integrations/odoo.ts` | Import | Adicionado import de `searchOdooPartners` |
| `server/routes/integrations/odoo.ts` | Rota | Adicionado `GET /search-partner` |

---

## 🔍 Exemplo de Uso

**Sem Odoo configurado:**
```bash
curl -X GET "http://localhost:5000/api/integrations/odoo/search-partner?q=teste"
# Resposta:
# { "results": [], "notConfigured": true }
```

**Com Odoo configurado:**
```bash
curl -X GET "http://localhost:5000/api/integrations/odoo/search-partner?q=cliente"
# Resposta:
# {
#   "results": [
#     { "id": 10, "name": "Cliente ABC", "email": "abc@teste.com", ... }
#   ]
# }
```

---

## 🧪 Status de Compilação

✅ **TypeScript:** Compilação sem erros  
✅ **Imports:** `searchOdooPartners` importado corretamente  
✅ **Rota registada:** Router adicionado em setupOdooRoutes()  
✅ **Servidor:** Iniciado em porta 5000  
✅ **Hot reload:** Vite recarregou com sucesso  

---

## ✅ Critérios de Aceitação

- [x] Helper `callOdooJsonRpc<T>()` criado
- [x] Tipo `OdooPartner` definido com todos os campos
- [x] Função `searchOdooPartners()` implementada
- [x] Usa JSON-RPC para `res.partner.search_read`
- [x] Filtra por nome OU email (ilike)
- [x] Mapeia `country_id` para string
- [x] Limite de 10 resultados
- [x] Rota `GET /search-partner` criada
- [x] Valida query parameter `q`
- [x] Usa middleware `isAuthenticated`
- [x] Trata erro `ODOO_NOT_CONFIGURED` (HTTP 200, notConfigured: true)
- [x] Trata erros reais (HTTP 500)
- [x] Resposta JSON com `results` array
- [x] Sem sincronização de BD (conforme requerimento)
- [x] Sem bibliotecas novas
- [x] Servidor funcional

---

## 🏗️ Arquitetura de Pesquisa

```
GET /search-partner?q=test
  ↓
[isAuthenticated middleware]
  ↓
Extrai empresaId via getUserContext()
  ↓
searchOdooPartners(empresaId, "test")
  ├─ getOdooConnectionForEmpresa(empresaId)
  │   └─ db.select().from(odooConnections)
  │
  └─ callOdooJsonRpc<any[]>(conn, {
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [db, user, pass, "res.partner", "search_read", ...]
      }
    })
      ├─ POST ${baseUrl}/jsonrpc
      ├─ Parse JSON-RPC response
      └─ Extract result array
  
  Mapeia resultado: OdooPartner[]
  ↓
  res.json({ results: [...] })
```

---

## 📝 Observações Técnicas

**JSON-RPC vs REST:**
- Odoo usa JSON-RPC como API principal (não REST)
- Método `execute_kw` é genérico (execute_kw("model", "method", args))
- ID é timestamp (Date.now()) para evitar colisões

**Filtros Odoo:**
- `|` = OR (prefixo)
- `&` = AND (padrão, implícito)
- `["field", "operator", "value"]`
- Operadores: `=`, `ilike`, `like`, `>`, `<`, etc.

**Country_id:**
- Retorna como array `[id, name]` do Odoo
- Mapeado para `string | null` no frontend (apenas o nome)

**Limite de Resultados:**
- 10 parceiros para evitar overload
- Pode ser ajustado conforme necessário

---

## 🚀 Próximos Passos (ODOO-03)

1. **Sincronização uni-direcional:** Buscar lista de parceiros e guardar `odooPartnerId` em Entidades
2. **Sincronização uni-direcional:** Buscar contactos do Odoo e guardar em BD
3. **Sincronização bidirecional:** Atualizar Odoo quando editar Entidades
4. **Buscador em UI:** Componente React para pesquisar e selecionar parceiros
5. **Mapeamento manual:** UI para vincular parceiros existentes com IDs Odoo

---

**Status Final: ✅ FUNÇÃO DE PESQUISA DE PARCEIROS CRIADA, ROTA EXPOSTA E FUNCIONAL**
