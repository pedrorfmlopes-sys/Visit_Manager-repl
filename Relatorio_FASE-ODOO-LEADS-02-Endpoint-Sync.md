# RELATÓRIO: FASE ODOO-LEADS-02 - Endpoint de Sync de Lead com Odoo

**Data**: 27 Novembro 2025  
**Objetivo**: Criar endpoint POST /api/crm/leads/:id/odoo/sync para sincronizar leads internos com Odoo  
**Status**: ✅ COMPLETO - Endpoint implementado, validações robustas, tratamento de erros  
**Ficheiro Modificado**: 1 (server/routes/crmLeads.ts)

---

## 🎯 O QUE FOI IMPLEMENTADO

### Rota: `POST /api/crm/leads/:id/odoo/sync`

**Localização**: `server/routes/crmLeads.ts` (linhas 283-368)

**Assinatura HTTP**:
```
POST /api/crm/leads/:id/odoo/sync
Authorization: Bearer <session_token>
Content-Type: application/json

Response (sucesso):
{
  "success": true,
  "created": true|false,
  "odooLeadId": "42"  // String do ID Odoo
}

Response (erro):
{
  "success": false,
  "message": "Mensagem amigável",
  "details": "Detalhes técnicos (opcional)"
}
```

---

## 📋 FLUXO DA IMPLEMENTAÇÃO

### 1️⃣ Imports Adicionados

```typescript
import { createLeadFromVmLead, updateLeadFromVmLead } from "../integrations/odooClient";
```

✅ Integra os 2 métodos criados na Fase 01

---

### 2️⃣ Validações Iniciais

```typescript
const { empresaId } = await getUserContext(req);  // RBAC
await assertLeadsEnabled(empresaId);               // Feature flag

const leadId = req.params.id;

// Carregar lead com relações
const lead = await db.query.leads.findFirst({
  where: and(eq(leads.id, leadId), eq(leads.empresaId, empresaId)),
  with: { entidade: true, contacto: true }
});

if (!lead) return 404 "Lead não encontrado"
```

✅ **Verifica**:
- Autenticação do utilizador
- Feature `crmLeadsEnabled` ativo
- Lead existe para a empresa
- Lead carregado com entidade e contacto

---

### 3️⃣ Validações de Contexto

```typescript
if (!lead.entidade || !lead.contacto) {
  return 400 "Este lead não tem entidade ou contacto associados..."
}

if (!lead.entidade.odooPartnerId) {
  return 400 "Esta entidade não está ligada ao Odoo..."
}
```

✅ **Garante**:
- Lead tem entidade associada
- Lead tem contacto associado
- Entidade está ligada ao Odoo (odooPartnerId definido)

**Por quê**:
- OdooClient.createLeadFromVmLead lança erro se odooPartnerId faltar
- Melhor falhar cedo com mensagem clara ao frontend

---

### 4️⃣ Lógica de Sincronização

#### Caso A: Lead Novo (odooLeadId vazio)

```typescript
if (!lead.odooLeadId) {
  // Criar novo lead no Odoo
  odooLeadId = await createLeadFromVmLead({
    vmLead: lead,
    entidade: lead.entidade,
    contacto: lead.contacto,
    empresaId,
  });
  created = true;

  // Armazenar odooLeadId na BD
  await db.update(leads)
    .set({ odooLeadId: String(odooLeadId) })
    .where(eq(leads.id, leadId));

  // Response
  return { success: true, created: true, odooLeadId: "42" }
}
```

**Fluxo**:
1. ✅ Chama `createLeadFromVmLead()` → retorna ID Odoo
2. ✅ Persiste `odooLeadId` na tabela leads
3. ✅ Retorna confirmação ao frontend

---

#### Caso B: Lead Existente (odooLeadId já preenchido)

```typescript
else {
  // Atualizar lead existente no Odoo
  const odooId = Number(lead.odooLeadId);
  await updateLeadFromVmLead({
    odooLeadId: odooId,
    vmLead: lead,
    entidade: lead.entidade,
    contacto: lead.contacto,
    empresaId,
  });

  odooLeadId = odooId;

  // Response
  return { success: true, created: false, odooLeadId: "42" }
}
```

**Fluxo**:
1. ✅ Converte `lead.odooLeadId` (string) para número
2. ✅ Chama `updateLeadFromVmLead()` (sem persist, já existe)
3. ✅ Retorna confirmação ao frontend

---

### 5️⃣ Tratamento de Erros OdooClient

```typescript
try {
  if (!lead.odooLeadId) {
    // ... create
  } else {
    // ... update
  }
} catch (odooError: any) {
  console.error("[CRM Leads] Erro ao sincronizar com Odoo:", {
    leadId,
    message: odooError?.message,
  });

  return 500 {
    success: false,
    message: "Erro ao sincronizar com o Odoo. Tenta novamente ou verifica a configuração Odoo.",
    details: odooError?.message
  }
}
```

✅ **Benefícios**:
- Apanha erros do OdooClient (FK inválido, configuração ausente, etc.)
- Log estruturado para debug
- Mensagem amigável + detalhes técnicos
- Sem stack trace bruto

---

### 6️⃣ Tratamento de Erros Feature Flag

```typescript
catch (error: any) {
  if (error?.code === "LEADS_NOT_ENABLED") {
    return 200 {
      success: false,
      notEnabled: true,
      message: "Módulo de Leads não está ativo para esta empresa."
    }
  }
  // ...
}
```

✅ Segue padrão existente nas outras rotas

---

## 📊 RESPOSTAS HTTP

### ✅ Sucesso - Novo Lead

**Request**:
```json
POST /api/crm/leads/lead-123/odoo/sync
```

**Response (201)**:
```json
{
  "success": true,
  "created": true,
  "odooLeadId": "42"
}
```

---

### ✅ Sucesso - Atualização

**Request**:
```json
POST /api/crm/leads/lead-456/odoo/sync
```

**Response (200)**:
```json
{
  "success": true,
  "created": false,
  "odooLeadId": "42"
}
```

---

### ❌ Erro 404 - Lead não encontrado

```json
{
  "success": false,
  "message": "Lead não encontrado."
}
```

---

### ❌ Erro 400 - Contexto insuficiente

```json
{
  "success": false,
  "message": "Este lead não tem entidade ou contacto associados suficientes para sincronizar com o Odoo."
}
```

---

### ❌ Erro 400 - Entidade sem Odoo

```json
{
  "success": false,
  "message": "Esta entidade não está ligada ao Odoo. Liga primeiro a entidade a um parceiro no Odoo."
}
```

---

### ❌ Erro 500 - Odoo indisponível

```json
{
  "success": false,
  "message": "Erro ao sincronizar com o Odoo. Tenta novamente ou verifica a configuração Odoo.",
  "details": "ODOO_NOT_CONFIGURED"
}
```

---

### ❌ Erro 200 - Feature desativada

```json
{
  "success": false,
  "notEnabled": true,
  "message": "Módulo de Leads não está ativo para esta empresa."
}
```

---

## 🏗️ ARQUITETURA

### Stack Integrado:

```
Frontend (futuro)
  ↓
  POST /api/crm/leads/:id/odoo/sync
    ↓
    ✅ isAuthenticated (middleware)
    ✅ getUserContext (get empresaId)
    ✅ assertLeadsEnabled (feature flag)
    ↓
    Load Lead + Entidade + Contacto (DB)
    ↓
    ✅ Validações (entidade, contacto, odooPartnerId)
    ↓
    [IF odooLeadId empty]
      → createLeadFromVmLead() [OdooClient]
      → Persist odooLeadId na BD
      → Response: created=true
    ↓
    [ELSE odooLeadId exists]
      → updateLeadFromVmLead() [OdooClient]
      → Response: created=false
    ↓
    Response JSON
```

---

## 📝 LOGS ESTRUTURADOS

### Sucesso:
```
[CRM Leads] Lead lead-123 criado no Odoo com ID 42
[CRM Leads] Lead lead-456 actualizado no Odoo com ID 42
```

### Erro:
```
[CRM Leads] Erro ao sincronizar com Odoo: {
  leadId: "lead-123",
  message: "Entidade 'Empresa ABC' não tem parceiro Odoo configurado"
}

[CRM Leads] POST /:id/odoo/sync error: {
  message: "Unknown database error"
}
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Importa OdooClient (createLeadFromVmLead, updateLeadFromVmLead)
- [x] Rota POST /:id/odoo/sync registada
- [x] Autenticação middleware (isAuthenticated)
- [x] RBAC empresaId validado
- [x] Feature flag crmLeadsEnabled validado
- [x] Lead carregado com entidade e contacto
- [x] Validação: lead exists
- [x] Validação: lead.entidade exists
- [x] Validação: lead.contacto exists
- [x] Validação: entidade.odooPartnerId exists
- [x] Lógica CREATE (new lead)
- [x] Lógica UPDATE (existing lead)
- [x] Persist odooLeadId após CREATE
- [x] Error handling OdooClient
- [x] Error handling feature flag
- [x] Logs estruturados
- [x] Mensagens amigáveis ao frontend
- [x] Response format consistente

---

## 🔄 CICLO DE VIDA DE SINCRONIZAÇÃO

### Primeira Sincronização (CREATE):

```
User: "Sincronizar com Odoo"
  ↓
POST /api/crm/leads/lead-123/odoo/sync
  ↓
lead.odooLeadId = null
  ↓
createLeadFromVmLead() → Odoo crm.lead.id = 42
  ↓
UPDATE leads SET odooLeadId = "42" WHERE id = "lead-123"
  ↓
Frontend: "Lead sincronizado com sucesso! ID Odoo: 42"
```

---

### Sincronizações Posteriores (UPDATE):

```
User: Edita "Prospecto - ABC"
  ↓
PATCH /api/crm/leads/lead-123 (local update)
  ↓
User: "Sincronizar com Odoo"
  ↓
POST /api/crm/leads/lead-123/odoo/sync
  ↓
lead.odooLeadId = "42"
  ↓
updateLeadFromVmLead(odooLeadId=42, ...) → Odoo crm.lead.id = 42 updated
  ↓
Frontend: "Lead actualizado no Odoo com sucesso!"
```

---

## 🚀 PRÓXIMOS PASSOS

### Fase ODOO-LEADS-03: Frontend Integration
- [ ] Adicionar botão "Sincronizar com Odoo" na UI de detalhe do lead
- [ ] Toast feedback "Lead sincronizado com sucesso"
- [ ] Toast erro com detalhes do problema
- [ ] Spinner de loading durante sync
- [ ] Mostrar status "Sincronizado" vs "Não Sincronizado"

### Fase ODOO-LEADS-04: Automação
- [ ] Auto-sync ao criar lead (POST /api/crm/leads)
- [ ] Auto-sync ao actualizar lead (PATCH /api/crm/leads/:id)
- [ ] Retry automático em caso de erro
- [ ] Background job para sincronizar leads antigos não sincronizados

### Fase ODOO-LEADS-05: Webhooks Bi-directional
- [ ] Webhook Odoo → Backend para actualizar leads quando mudarem no Odoo
- [ ] Sincronização automática em ambas as direcções

---

## 📦 FICHEIROS MODIFICADOS

### server/routes/crmLeads.ts
- **Adicionado**: `import { createLeadFromVmLead, updateLeadFromVmLead }`
- **Adicionado**: Nova rota `router.post("/:id/odoo/sync", ...)` (86 linhas)
- **Total**: +86 linhas

---

## 🎯 STATUS FINAL

✅ **Endpoint PRONTO para usar**

O endpoint está implementado, testável, e segue todos os requisitos do prompt:
- ✅ Valida configuração Odoo
- ✅ Carrega lead + entidade + contacto
- ✅ Verifica odooPartnerId
- ✅ Chama OdooClient.createLeadFromVmLead se novo
- ✅ Chama OdooClient.updateLeadFromVmLead se existente
- ✅ Persiste odooLeadId
- ✅ Trata erros com mensagens claras
- ✅ Respeita RBAC e feature flag

**Pronto para**: 
1. Testes manuais com curl ou Postman
2. Integração frontend (próxima fase)
3. Auto-sync automation (futuro)

---

**FIM DO RELATÓRIO - FASE ODOO-LEADS-02 COMPLETO**
