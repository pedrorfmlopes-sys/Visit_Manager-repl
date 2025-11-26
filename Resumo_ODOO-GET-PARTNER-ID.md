# Resumo Odoo / STEP: GET /partner/:id – Buscar Parceiro por ID

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Criar uma função no cliente Odoo para buscar um parceiro específico por ID e expor isso numa rota `GET /api/integrations/odoo/partner/:id`.

---

## ✅ Trabalho Realizado

### 1. Função: getOdooPartnerById()

**Ficheiro:** `server/integrations/odooClient.ts` (linhas 196-251)

**Assinatura:**
```typescript
export async function getOdooPartnerById(
  empresaId: string,
  partnerId: number
): Promise<OdooPartner | null>
```

**Funcionalidade:**
1. Obtém a configuração Odoo da empresa via `getOdooConnectionForEmpresa(empresaId)`
2. Chama `callOdooJsonRpc` com `search_read` sobre `res.partner`
3. Filtra por ID: `[["id", "=", partnerId]]`
4. Limita a 1 resultado (`limit: 1`)
5. Extrai campos: name, email, phone, mobile, vat, city, country_id, street
6. Retorna `OdooPartner | null` (null se não encontrado)

**Campos Mapeados:**
- `country_id` (array em Odoo) → `country: p.country_id?.[1] ?? null` (nome do país)
- Todos os campos com coalesce para null

**Exemplo de Resposta Odoo:**
```json
{
  "id": 123,
  "name": "Cliente Teste",
  "email": "cliente@teste.com",
  "phone": "915000000",
  "mobile": null,
  "vat": "PT123456789",
  "city": "Lisboa",
  "country_id": [5, "Portugal"],
  "street": "Rua Exemplo 123"
}
```

**Transformada para:**
```typescript
OdooPartner {
  id: 123,
  name: "Cliente Teste",
  email: "cliente@teste.com",
  phone: "915000000",
  mobile: null,
  vat: "PT123456789",
  city: "Lisboa",
  country: "Portugal",
  street: "Rua Exemplo 123"
}
```

---

### 2. Endpoint: GET /api/integrations/odoo/partner/:id

**Ficheiro:** `server/routes/integrations/odoo.ts` (linhas 116-150)

**Rota:**
```
GET /api/integrations/odoo/partner/:id
```

**Auth:** `isAuthenticated` middleware

**Funcionalidade:**
1. Extrai `:id` do URL e converte para `Number`
2. Valida que é um número válido (HTTP 400 se inválido)
3. Obtém `empresaId` via `getUserContext(req)`
4. Chama `getOdooPartnerById(empresaId, partnerId)`
5. Retorna parceiro ou 404 se não encontrado
6. Tratamento especial para `ODOO_NOT_CONFIGURED` (HTTP 200 com `{ notConfigured: true }`)

**Lógica:**
```typescript
router.get("/partner/:id", isAuthenticated, async (req, res) => {
  const partnerId = Number(req.params.id);
  if (Number.isNaN(partnerId)) return res.status(400).json({ error: "Invalid partner id" });
  
  const partner = await getOdooPartnerById(empresaId, partnerId);
  if (!partner) return res.status(404).json({ error: "Partner not found" });
  
  return res.json({ partner });
});
```

---

## 📁 Ficheiros Editados

| Ficheiro | Linhas | Mudança |
|----------|--------|---------|
| `server/integrations/odooClient.ts` | 196-251 | Função `getOdooPartnerById()` |
| `server/routes/integrations/odoo.ts` | 5 | Import `getOdooPartnerById` |
| `server/routes/integrations/odoo.ts` | 116-150 | Rota GET `/partner/:id` |

---

## 🔌 Padrão de Implementação (Reutilizável)

Segue o mesmo padrão de `searchOdooPartners`:

```
Cliente Odoo (odooClient.ts)
  ├─ getOdooConnectionForEmpresa(empresaId) → OdooConnection
  ├─ callOdooJsonRpc<OdooPartner[]>() → fetch JSON-RPC
  └─ Mapear resultado para OdooPartner

Router Odoo (odoo.ts)
  ├─ Validação de params
  ├─ getUserContext() → empresaId
  ├─ Tratamento de ODOO_NOT_CONFIGURED
  └─ Resposta com try-catch
```

---

## ✅ Respostas da API

**Sucesso (HTTP 200):**
```json
{
  "partner": {
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
}
```

**Não Encontrado (HTTP 404):**
```json
{
  "error": "Partner not found"
}
```

**Odoo Não Configurado (HTTP 200):**
```json
{
  "notConfigured": true,
  "partner": null
}
```

**Parâmetro Inválido (HTTP 400):**
```json
{
  "error": "Invalid partner id"
}
```

**Erro BD/Rede (HTTP 500):**
```json
{
  "error": "Odoo partner fetch error",
  "message": "..."
}
```

---

## 🧪 Exemplos de Teste

**Parceiro Existente:**
```bash
curl "http://localhost:5000/api/integrations/odoo/partner/123"
```

**Parceiro Inexistente:**
```bash
curl "http://localhost:5000/api/integrations/odoo/partner/99999999"
# Esperado: HTTP 404 + { "error": "Partner not found" }
```

**ID Inválido:**
```bash
curl "http://localhost:5000/api/integrations/odoo/partner/abc"
# Esperado: HTTP 400 + { "error": "Invalid partner id" }
```

**Odoo Não Configurado:**
```bash
# Sem configuração Odoo na BD
# Esperado: HTTP 200 + { "notConfigured": true, "partner": null }
```

---

## 🧪 Status de Compilação

✅ **TypeScript:** Compilação sem erros  
✅ **Imports:** `getOdooPartnerById` importado em `odoo.ts`  
✅ **Tipos:** `OdooPartner` já existia  
✅ **Servidor:** Reiniciado com sucesso  
✅ **Rota registada:** `/api/integrations/odoo/partner/:id` ativa

---

## ✅ Critérios de Aceitação

- [x] Função `getOdooPartnerById()` criada em `odooClient.ts`
- [x] Usa padrão existente: `getOdooConnectionForEmpresa()` + `callOdooJsonRpc()`
- [x] Retorna `OdooPartner | null`
- [x] Busca por ID usando `search_read` com `[["id", "=", partnerId]]`
- [x] Extrai todos os campos: name, email, phone, mobile, vat, city, country, street
- [x] Mapeia `country_id` para `country` (nome)
- [x] Rota GET `/api/integrations/odoo/partner/:id` criada
- [x] Valida ID (HTTP 400 se inválido)
- [x] Retorna 404 se não encontrado
- [x] Trata `ODOO_NOT_CONFIGURED` (HTTP 200 com flag)
- [x] Middleware `isAuthenticated` aplicado
- [x] Multi-tenant: usa `empresaId` do context
- [x] Console logging para debugging
- [x] Servidor compilado e funcional

---

## 📊 Fluxo de Dados Completo

```
GET /api/integrations/odoo/partner/123
  ↓ [Request]
  ├─ URL params: id = 123
  ├─ isAuthenticated middleware ✓
  ├─ getUserContext() → empresaId = "empresa-xyz"
  ├─ Number(123) → 123 (válido)
  ├─ getOdooPartnerById("empresa-xyz", 123)
  │   ├─ getOdooConnectionForEmpresa("empresa-xyz") → OdooConnection
  │   ├─ callOdooJsonRpc() → fetch /jsonrpc
  │   │   POST body:
  │   │   {
  │   │     "method": "call",
  │   │     "params": {
  │   │       "service": "object",
  │   │       "method": "execute_kw",
  │   │       "args": ["db", "user", "key", "res.partner", "search_read", 
  │   │               [[["id", "=", 123]]], 
  │   │               {"fields": [...], "limit": 1}]
  │   │     }
  │   │   }
  │   ├─ Response: [{ id: 123, name: "...", email: "...", ... }]
  │   └─ Map → OdooPartner
  └─ res.json({ partner: OdooPartner })
  ↓ [Response]
  { "partner": { id: 123, name: "...", ... } }
```

---

## 🏗️ Arquitetura Odoo Atualizada

```
Odoo Integration Stack
├─ Configuration
│  └─ ✅ OdooIntegrationCard (AdminEmpresa)
│  └─ ✅ odoo_connections table + storage
│
├─ Client Functions (odooClient.ts)
│  ├─ ✅ testOdooConnection() → authenticate + return userId
│  ├─ ✅ searchOdooPartners(query) → search by name/email
│  └─ ✅ getOdooPartnerById(id) → fetch specific partner
│
├─ API Routes (odoo.ts router)
│  ├─ ✅ GET /status → test connection
│  ├─ ✅ POST /save → save configuration
│  ├─ ✅ GET /search-partner?q=... → search partners
│  ├─ ✅ GET /partner/:id → get partner by ID
│  ├─ ✅ POST /entidades/:id/odoo-link → link entity to partner
│  └─ ✅ POST /contactos/:id/odoo-link → link contact to partner
│
└─ ⏳ Próximos Steps
   ├─ Sincronização bidirecional de dados
   ├─ Deteção de conflitos
   └─ Histórico de sincronizações
```

---

## 🚀 Próximos Steps Opcionais

1. **Sincronizar dados:** Quando um parceiro é fetched, sincronizar seus campos com Entidade/Contacto local
2. **Cache:** Armazenar últimos parceiros fetched para reduzir chamadas Odoo
3. **Bulk fetch:** Versão para buscar múltiplos parceiros de uma vez
4. **Update partner:** Rota PATCH para atualizar dados do parceiro em Odoo
5. **Relatórios:** Dashboard com estatísticas de parceiros sincronizados

---

**Status Final: ✅ ROTA GET /partner/:id CRIADA E FUNCIONAL**

Integração Odoo agora consegue:
- ✅ Pesquisar parceiros (search-partner)
- ✅ Buscar parceiro específico (partner/:id)
- ✅ Ligar/desligar entidades e contactos
- ⏳ Sincronizar dados em ambas as direções
