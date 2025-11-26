# Resumo ODOO-02A / STEP 3 – Endpoints para Ligar/Desligar Entidades e Contactos a Odoo

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Criar dois endpoints simples (`POST /api/entidades/:id/odoo-link` e `POST /api/contactos/:id/odoo-link`) para ligar/desligar Entidades e Contactos a um parceiro Odoo, atualizando apenas o campo `odooPartnerId` na BD sem fazer chamadas ao Odoo.

---

## ✅ Trabalho Realizado

### 1. Endpoint: POST /api/entidades/:id/odoo-link

**Ficheiro:** `server/routes.ts` (linhas 664-695)

**Funcionalidade:**
- Path: `/api/entidades/:id/odoo-link`
- Método: POST
- Auth: `isAuthenticated` middleware
- Request body:
  ```json
  { "odooPartnerId": 12345 }
  ```
  ou para desligar:
  ```json
  { "odooPartnerId": null }
  ```

**Lógica:**
1. Extrai `id` do path e `odooPartnerId` do body
2. Valida que `odooPartnerId` está presente (undefined → HTTP 400)
3. Obtém `empresaId` via `getUserContext(req)`
4. Normaliza ID:
   - Se `null` ou string vazia → `null`
   - Caso contrário → converter para `string`
5. Atualiza BD com segurança multi-tenant:
   ```typescript
   db.update(entidades)
     .set({ odooPartnerId: normalizedId })
     .where(and(eq(entidades.id, id), eq(entidades.empresaId, empresaId)))
   ```
6. Retorna sucesso com ID atualizado

**Respostas:**

Sucesso (HTTP 200):
```json
{
  "success": true,
  "entidadeId": "uuid-123",
  "odooPartnerId": "12345"
}
```

Sucesso - desligar (HTTP 200):
```json
{
  "success": true,
  "entidadeId": "uuid-123",
  "odooPartnerId": null
}
```

Erro - parâmetro faltando (HTTP 400):
```json
{
  "error": "Missing odooPartnerId in body"
}
```

Erro - BD/rede (HTTP 500):
```json
{
  "error": "Failed to update entidade Odoo link",
  "message": "..."
}
```

---

### 2. Endpoint: POST /api/contactos/:id/odoo-link

**Ficheiro:** `server/routes.ts` (linhas 770-801)

**Funcionalidade:** Idêntica à de Entidades, mas para Contactos

**Request body:**
```json
{ "odooPartnerId": 54321 }
```

**Lógica:** Mesma da Entidades, aplicada à tabela `contactos`

**Respostas:**

Sucesso (HTTP 200):
```json
{
  "success": true,
  "contactoId": "uuid-456",
  "odooPartnerId": "54321"
}
```

---

## 📁 Ficheiros Editados

| Ficheiro | Linhas | Mudança |
|----------|--------|---------|
| `server/routes.ts` | 664-695 | POST /api/entidades/:id/odoo-link |
| `server/routes.ts` | 770-801 | POST /api/contactos/:id/odoo-link |

---

## 🔌 Fluxo de Funcionamento

```
POST /api/entidades/:id/odoo-link
  ├─ Body: { "odooPartnerId": 12345 }
  ├─ Auth: isAuthenticated middleware
  ├─ getUserContext(req) → empresaId
  ├─ Normalizar ID (null/empty → null, else → string)
  ├─ db.update(entidades)
  │   .set({ odooPartnerId })
  │   .where(id=... AND empresaId=...)
  └─ res.json({ success: true, entidadeId, odooPartnerId })
```

---

## ✅ Padrão de Segurança (Multi-tenant)

Ambos os endpoints garantem **isolamento de dados por empresa**:

```typescript
where(and(
  eq(entidades.id, id),           // Objeto correto
  eq(entidades.empresaId, empresaId) // Da empresa do user
))
```

Isto previne:
- Um user de uma empresa editar dados de outra empresa
- Ataques ID enumeration (um user não consegue ligar IDs de outra empresa)

---

## 🧪 Exemplos de Teste

**Ligar Entidade a Odoo:**
```bash
curl -X POST "http://localhost:5000/api/entidades/abc123/odoo-link" \
  -H "Content-Type: application/json" \
  -d '{"odooPartnerId": 42}'
```

**Desligar Entidade (remover link):**
```bash
curl -X POST "http://localhost:5000/api/entidades/abc123/odoo-link" \
  -H "Content-Type: application/json" \
  -d '{"odooPartnerId": null}'
```

**Ligar Contacto:**
```bash
curl -X POST "http://localhost:5000/api/contactos/def456/odoo-link" \
  -H "Content-Type: application/json" \
  -d '{"odooPartnerId": 99}'
```

---

## 🧪 Status de Compilação

✅ **TypeScript:** Compilação sem erros  
✅ **Imports:** `entidades`, `contactos`, `and`, `eq`, `db` já importados em routes.ts  
✅ **Servidor:** Reiniciado com sucesso  
✅ **Endpoints registados:** Ambas as rotas estão ativas

---

## ✅ Critérios de Aceitação

- [x] POST /api/entidades/:id/odoo-link criado
- [x] POST /api/contactos/:id/odoo-link criado
- [x] Ambos aceitam `odooPartnerId` no body
- [x] Validação: erro se `odooPartnerId` está undefined
- [x] Normalização: null/empty → null, resto → string
- [x] Multi-tenant: Filtro por empresaId + id
- [x] Retorna `{ success: true, id, odooPartnerId }`
- [x] Tratamento de erros (try-catch, HTTP 500)
- [x] Console logging para debugging
- [x] Sem chamadas ao Odoo (conforme requerimento)
- [x] Sem biblioteca nova
- [x] Middleware `isAuthenticated` aplicado
- [x] Servidor compilado e funcional

---

## 📊 Fluxo de Dados

```
Frontend (React)
  ↓ POST /entidades/:id/odoo-link
  ↓ Body: { odooPartnerId: 123 }
  ↓
Backend (Express)
  ├─ isAuthenticated middleware
  ├─ getUserContext() → empresaId
  ├─ Normalize ID
  ├─ db.update(entidades)
  │   SET { odooPartnerId: "123" }
  │   WHERE id=... AND empresaId=...
  └─ res.json({ success: true, ... })
  ↓ Response: { success: true, entidadeId, odooPartnerId: "123" }
  ↓
Frontend (React) → Atualiza UI com novo estado
```

---

## 📝 Observações Técnicas

**Normalização de ID:**
- `null` ou `""` → `null` (desligar)
- Qualquer outro valor → `String(value)` (BD armazena como texto)
- Permite tanto `{ odooPartnerId: 123 }` como `{ odooPartnerId: "456" }`

**Segurança Multi-tenant:**
- `getUserContext()` retorna `empresaId` do token autenticado
- Update filtra por ambos `id` e `empresaId`
- Um user não consegue modificar dados de outra empresa mesmo que saiba o ID

**Tratamento de Erros:**
- Validação: HTTP 400 se param faltando
- Runtime: HTTP 500 com mensagem
- Logging: Console com prefix `[Entidades]` ou `[Contactos]`

**Sem Sincronização com Odoo:**
- Estes endpoints apenas guardam/apagam o ID localmente
- Não fazem chamadas RPC ao Odoo
- A sincronização real será implementada em ODOO-03

---

## 🚀 Próximos Passos (ODOO-03)

1. **Sincronização de dados:** Usar `odooPartnerId` para buscar dados do parceiro
2. **Bidirecional:** Atualizar Odoo quando Entidades/Contactos são editadas
3. **UI:** Componente React para selecionar parceiros via `/search-partner`
4. **Conflito:** Detectar e alertar quando dados locais e Odoo diferem
5. **Logs:** Histórico de sincronizações para auditoria

---

## 🏗️ Arquitetura Geral de Odoo

Até agora temos:
- ✅ **Configuração Odoo:** Guardada em `odoo_connections` (admin)
- ✅ **Teste de Ligação:** `GET /api/integrations/odoo/status`
- ✅ **Pesquisa de Parceiros:** `GET /api/integrations/odoo/search-partner?q=...`
- ✅ **Link/Unlink:** `POST /api/entidades/:id/odoo-link`, `POST /api/contactos/:id/odoo-link`
- ⏳ **Sincronização:** A fazer em ODOO-03

---

**Status Final: ✅ ENDPOINTS DE LIGAÇÃO/DESLIGAÇÃO CRIADOS E FUNCIONAIS**
