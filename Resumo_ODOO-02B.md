# Resumo ODOO-02B / STEP 1 – Cliente Odoo e Rota de Status com Teste de Ligação

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Criar um cliente Odoo no backend (`odooClient.ts`) com função de teste de ligação, implementar a rota `/api/integrations/odoo/status` que testa a autenticação com Odoo via JSON-RPC, reutilizando a configuração guardada em `odoo_connections`.

---

## ✅ Trabalho Realizado

### 1. Cliente Odoo: `server/integrations/odooClient.ts`

**Ficheiro criado com:**

#### Tipos
```typescript
export type OdooConnection = typeof odooConnections.$inferSelect;
export type OdooAuthResponse = { userId: number };
```

#### Função: getOdooConnectionForEmpresa()
```typescript
export async function getOdooConnectionForEmpresa(empresaId: string): Promise<OdooConnection>
```
- Busca na tabela `odoo_connections` pela `empresaId`
- Lança erro `"ODOO_NOT_CONFIGURED"` se não existir configuração
- Retorna a conexão completa (baseUrl, dbName, username, apiKey, environment, isActive)

#### Função: authenticateOdoo() (privada)
```typescript
async function authenticateOdoo(conn: OdooConnection): Promise<OdooAuthResponse>
```
- Implementa autenticação JSON-RPC com Odoo
- Faz POST para `${baseUrl}/web/session/authenticate`
- Envia params: `db`, `login`, `password`
- Extrai e valida `result.uid` (userId)
- Lança erros descritivos se HTTP error ou Odoo error

#### Função Pública: testOdooConnection()
```typescript
export async function testOdooConnection(empresaId: string): Promise<{
  ok: boolean;
  baseUrl: string;
  dbName: string;
  userId: number;
}>
```
- Orquestra a ligação: busca config → autentica → devolve resultado
- Sucesso retorna userId + metadados
- Erro propagado para tratamento na rota

---

### 2. Atualização Rota: `server/routes/integrations/odoo.ts`

**GET /api/integrations/odoo/status** – Antes era apenas leitura de BD, agora testa a ligação

**Mudanças implementadas:**
- Import adicionado: `import { testOdooConnection } from "../../integrations/odooClient";`
- Chamada à `testOdooConnection(empresaId)` em vez de ler apenas BD
- Resposta sucesso:
  ```json
  {
    "connected": true,
    "ok": true,
    "baseUrl": "https://odoo.example.com",
    "dbName": "database_name",
    "userId": 2
  }
  ```
- Resposta sem config:
  ```json
  {
    "connected": false,
    "reason": "not_configured"
  }
  ```
- Resposta com erro:
  ```json
  {
    "connected": false,
    "reason": "error",
    "message": "credenciais erradas ou rede indisponível"
  }
  ```

**Tratamento de erros:**
- Erro `ODOO_NOT_CONFIGURED` → 200 com `connected: false, reason: "not_configured"`
- Erros de HTTP/autenticação → 500 com mensagem descritiva
- Console logging de erros para debugging

---

## 📁 Ficheiros Criados/Modificados

| Ficheiro | Tipo | Descrição |
|----------|------|-----------|
| `server/integrations/odooClient.ts` | **CREATE** | Cliente Odoo com getOdooConnectionForEmpresa, authenticateOdoo, testOdooConnection |
| `server/routes/integrations/odoo.ts` | **EDIT** | Rota GET /status agora testa ligação com Odoo |

---

## 🔌 Fluxo de Funcionamento

```
GET /api/integrations/odoo/status
  ↓ [isAuthenticated middleware]
  ↓ getUserContext(req) → empresaId
  ↓ testOdooConnection(empresaId)
    ├─ getOdooConnectionForEmpresa(empresaId)
    │   └─ db.select().from(odooConnections)
    │       └─ if (!connection) throw "ODOO_NOT_CONFIGURED"
    │
    └─ authenticateOdoo(conn)
        ├─ POST ${baseUrl}/web/session/authenticate
        │   (JSON-RPC: db, login, password)
        │
        ├─ Parse response
        ├─ Extract result.uid (userId)
        └─ Return { userId }
  ↓
  ↓ Resposta:
    ├─ Sucesso (HTTP 200): { connected: true, ok: true, baseUrl, dbName, userId }
    ├─ Não configurado (HTTP 200): { connected: false, reason: "not_configured" }
    └─ Erro (HTTP 500): { connected: false, reason: "error", message }
```

---

## ✅ Padrão Reutilizado

✅ Segue o mesmo padrão dos clientes Google/Microsoft:
- Tipo derivado via `typeof table.$inferSelect`
- Função de helper privada (`authenticateOdoo`)
- Função pública de teste (`testOdooConnection`)
- Rota usa middleware `isAuthenticated`
- Tratamento de erros com mensagens descritivas
- Sem imports de bibliotecas adicionais (usa fetch nativa)

---

## 🧪 Status de Compilação

✅ **TypeScript:** Compilação sem erros  
✅ **Imports:** `odooConnections` do schema importado corretamente  
✅ **Servidor:** Iniciou em porta 5000 sem erros  
✅ **Rota registada:** setupOdooRoutes(app) já existia e é chamada em routes.ts  

---

## 🔍 Como Testar

Com a app a correr:

```bash
# Sem config (deve devolver not_configured)
curl -X GET http://localhost:5000/api/integrations/odoo/status \
  -H "Authorization: Bearer <seu_token>"

# Com config (deve validar credenciais)
# Primeiro guardar config via POST /api/integrations/odoo/save
# Depois GET /status deve retornar connected: true com userId
```

---

## 📝 Comportamento Esperado

| Cenário | HTTP | Response |
|---------|------|----------|
| Sem configuração Odoo | 200 | `{ connected: false, reason: "not_configured" }` |
| Com config válida | 200 | `{ connected: true, ok: true, baseUrl, dbName, userId }` |
| Credenciais erradas | 500 | `{ connected: false, reason: "error", message: "..." }` |
| Rede indisponível | 500 | `{ connected: false, reason: "error", message: "..." }` |
| Sem autenticação | 401 | (middleware isAuthenticated rejeita) |

---

## ✅ Critérios de Aceitação

- [x] Ficheiro `odooClient.ts` criado
- [x] Função `getOdooConnectionForEmpresa()` implementada
- [x] Função privada `authenticateOdoo()` com JSON-RPC
- [x] Função `testOdooConnection()` exportada
- [x] Rota `GET /api/integrations/odoo/status` atualizada
- [x] Testa autenticação via JSON-RPC (não só lê BD)
- [x] Tratamento de erro `ODOO_NOT_CONFIGURED`
- [x] HTTP 200 para not_configured, HTTP 500 para erros reais
- [x] Resposta JSON com `connected`, `reason`, `message`
- [x] Middleware `isAuthenticated` aplicado
- [x] Sem bibliotecas novas (usa fetch nativa)
- [x] Servidor compilado e funcional
- [x] Rota registada em routes.ts

---

## 🚀 Próximos Passos (ODOO-02C)

1. **Sincronização de Entidades:** Buscar lista de clientes Odoo e associar `odooPartnerId`
2. **Sincronização de Contactos:** Buscar contactos do Odoo e atualizar BD
3. **Bidirecional:** Atualizar Odoo quando criar/editar entidades/contactos em Visit Manager
4. **Logs:** Criar histórico de sincronizações
5. **Reconciliação:** Detectar conflitos e propor resoluções

---

## 📝 Notas Técnicas

- Padrão idêntico a Google/Microsoft para consistência
- JSON-RPC é a API padrão do Odoo (não REST)
- userId retornado é essencial para chamadas RPC futuras
- Erro "ODOO_NOT_CONFIGURED" diferenciado (message == check)
- Resposta sucesso inclui dados da conexão para confirmar qual instância está a ser usada
- Sem cache – cada /status faz nova validação (importante para verificar credenciais)

---

**Status Final: ✅ CLIENTE ODOO CRIADO, ROTA DE STATUS COM TESTE DE LIGAÇÃO IMPLEMENTADA E FUNCIONAL**
