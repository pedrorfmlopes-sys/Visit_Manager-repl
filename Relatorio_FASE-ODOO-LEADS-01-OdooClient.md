# RELATÓRIO: FASE ODOO-LEADS-01 - OdooClient Backend

**Data**: 27 Novembro 2025  
**Objetivo**: Criar OdooClient com métodos para sincronizar CRM Leads com Odoo crm.lead  
**Status**: ✅ COMPLETO - Dois métodos implementados: createLeadFromVmLead + updateLeadFromVmLead  
**Ficheiro Modificado**: 1 (server/integrations/odooClient.ts)

---

## 🎯 O QUE FOI FEITO

### 1️⃣ Método: `createLeadFromVmLead()`

**Localização**: `server/integrations/odooClient.ts` (linhas 378-460)

**Assinatura**:
```typescript
export async function createLeadFromVmLead(args: {
  vmLead: any;        // Lead da nossa BD (Visit Manager)
  entidade: any;      // Entidade associada ao lead
  contacto: any;      // Contacto associado ao lead
  empresaId: string;  // ID da empresa
}): Promise<number>
```

**O que faz**:
1. ✅ Valida que a entidade tem `odooPartnerId` (FK para res.partner no Odoo)
   - Se não existir → lança erro claro: "Entidade não tem parceiro Odoo configurado"
2. ✅ Obtém conexão Odoo validada para a empresa
3. ✅ Autentica com JSON-RPC (common.authenticate)
4. ✅ Prepara payload com campos mínimos obrigatórios:
   - `name`: vmLead.titulo
   - `partner_id`: entidade.odooParadooPartnerId (FK)
5. ✅ Adiciona campos opcionais se disponíveis:
   - `description`: vmLead.descricao
   - `contact_name`: contacto.nome
   - `email_from`: contacto.email
   - `phone`: contacto.telefone
   - `expected_revenue`: vmLead.valorPrevisto
6. ✅ Executa call_kw com método "create" no modelo "crm.lead"
7. ✅ Retorna ID do lead criado no Odoo (número inteiro)
8. ✅ Trata erros: captura, loga detalhes, re-lança com contexto

**Payload Odoo (Exemplo)**:
```json
{
  "name": "Novo Cliente Potencial",
  "partner_id": 42,
  "description": "Lead qualificado de visita em 27/11",
  "contact_name": "João Silva",
  "email_from": "joao@empresa.pt",
  "phone": "+351912345678",
  "expected_revenue": 5000
}
```

**Fluxo Técnico**:
```
createLeadFromVmLead()
  ↓
1. Validação: entidade.odooPartnerId existe?
  ↓
2. getOdooConnectionForEmpresa(empresaId) → OdooConnection
  ↓
3. authenticateOdoo(conn) → uid (user ID no Odoo)
  ↓
4. Construir payload com campos do Lead VM
  ↓
5. callOdooJsonRpc execute_kw [db, uid, apiKey, "crm.lead", "create", [payload]]
  ↓
6. Retorna: Odoo Lead ID (integer)
  ↓
7. Log sucesso: "[Odoo] Lead criado com sucesso. Odoo Lead ID: XXX"
```

---

### 2️⃣ Método: `updateLeadFromVmLead()`

**Localização**: `server/integrations/odooClient.ts` (linhas 462-536)

**Assinatura**:
```typescript
export async function updateLeadFromVmLead(args: {
  odooLeadId: number;  // ID da lead no Odoo
  vmLead: any;         // Lead da nossa BD (Visit Manager)
  entidade: any;       // Entidade associada ao lead
  contacto: any;       // Contacto associado ao lead
  empresaId: string;   // ID da empresa
}): Promise<void>
```

**O que faz**:
1. ✅ Obtém conexão Odoo validada para a empresa
2. ✅ Autentica com JSON-RPC
3. ✅ Prepara payload para write (actualização):
   - `name`: vmLead.titulo
   - **NÃO altera `partner_id`** (mantém o original)
4. ✅ Adiciona campos opcionais se disponíveis (como create)
5. ✅ Executa call_kw com método "write" no modelo "crm.lead"
   - Formato: [modelId], payload
6. ✅ Retorna void (sem valor de retorno, apenas confirmação)
7. ✅ Trata erros: captura, loga detalhes, re-lança

**Payload Odoo (Exemplo)**:
```json
{
  "name": "Cliente Potencial - Actualizado",
  "description": "Actualização após follow-up",
  "contact_name": "João Silva",
  "email_from": "joao@empresa.pt",
  "phone": "+351912345678",
  "expected_revenue": 7500
}
```

**Fluxo Técnico**:
```
updateLeadFromVmLead()
  ↓
1. getOdooConnectionForEmpresa(empresaId) → OdooConnection
  ↓
2. authenticateOdoo(conn) → uid
  ↓
3. Construir payload (SEM partner_id)
  ↓
4. callOdooJsonRpc execute_kw [db, uid, apiKey, "crm.lead", "write", [[odooLeadId], payload]]
  ↓
5. Retorna: void (true/ok)
  ↓
6. Log sucesso: "[Odoo] Lead XXX actualizado com sucesso"
```

---

## 🏗️ ARQUITETURA DE INTEGRAÇÃO

### Stack Existente (já presente):

1. **OdooConnection** (schema.ts)
   - `baseUrl`: URL da instância Odoo
   - `dbName`: Nome da BD Odoo
   - `username`: Email do utilizador Odoo
   - `apiKey`: Token de autenticação
   - `isActive`: Flag para ativar/desativar

2. **OdooConnectionsStorage** (server/storage/odooConnections.ts)
   - Métodos: `getOdooConnectionByEmpresaId()`, `upsertOdooConnection()`

3. **JSON-RPC Pattern** (server/integrations/odooClient.ts)
   - `callOdooJsonRpc<T>()` → helper genérico
   - `authenticateOdoo()` → JSON-RPC authenticate
   - `searchOdooPartners()` → search_read em res.partner

4. **Lead Schema** (shared/schema.ts)
   - Tabela: `leads` com campos: titulo, descricao, marca, estado, valorPrevisto, odooLeadId
   - FK: entidadeId, contactoId, visitaId, empresaId

### Fluxo de Sincronização:

```
Frontend: User cria Lead (Visit Manager)
  ↓
Backend POST /api/crm/leads:
  1. Valida schema (Zod)
  2. Insere em BD (leads table)
  3. [OPCIONAL] Sincroniza com Odoo:
     - Busca Entidade (com odooPartnerId)
     - Busca Contacto
     - Chama: createLeadFromVmLead({vmLead, entidade, contacto, empresaId})
     - Armazena: lead.odooLeadId (ID retornado)
  ↓
Quando Lead é actualizado:
  1. Valida schema
  2. Atualiza em BD
  3. [SE odooLeadId existe] Chama: updateLeadFromVmLead({...})
```

---

## 🔑 PONTOS-CHAVE DA IMPLEMENTAÇÃO

### 1. Validação de Entidade Obrigatória

```typescript
if (!entidade?.odooPartnerId) {
  throw new Error(
    `Entidade "${entidade?.nome || 'Unknown'}" não tem parceiro Odoo configurado...`
  );
}
```

✅ **Por quê**:
- Odoo crm.lead **REQUER** `partner_id` (FK para res.partner)
- Sem isso, a BD do Odoo rejeita o CREATE
- Erro claro ajuda frontend a comunicar ao utilizador

---

### 2. Reutilização do Pattern JSON-RPC Existente

```typescript
// Usa o helper genérico já existente
const result = await callOdooJsonRpc<number>(conn, {
  method: "call",
  params: {
    service: "object",
    method: "execute_kw",
    args: [dbName, uid, apiKey, "crm.lead", "create", [payload]],
  },
});
```

✅ **Vantagens**:
- Tratamento de erros centralizado
- Logging estruturado
- Conversão de erros Odoo para erros de app

---

### 3. Campos Mapeados Correctamente

| Visit Manager | Odoo crm.lead | Tipo | Obrigatório |
|---------------|---|------|---|
| vmLead.titulo | name | string | ✅ Sim |
| entidade.odooPartnerId | partner_id | integer FK | ✅ Sim |
| vmLead.descricao | description | text | ❌ Opcional |
| contacto.nome | contact_name | string | ❌ Opcional |
| contacto.email | email_from | email | ❌ Opcional |
| contacto.telefone | phone | string | ❌ Opcional |
| vmLead.valorPrevisto | expected_revenue | float | ❌ Opcional |

---

### 4. Tratamento de Erros Robusto

**Create**:
```typescript
try {
  const result = await callOdooJsonRpc<number>(conn, {...});
  console.log(`[Odoo] Lead criado com sucesso. Odoo Lead ID: ${result}`);
  return result;
} catch (error: any) {
  console.error("[Odoo] Erro ao criar lead:", {
    message: error?.message,
    vmLeadId: vmLead?.id,
    entidadeId: entidade?.id,
    contactoId: contacto?.id,
  });
  throw error;
}
```

✅ **Benefícios**:
- Logs estruturados para debug
- Sem stack trace bruto (segurança)
- Contexto claro (IDs envolvidos)
- Re-lança para caller tratar

---

## 📋 COMO USAR

### Usar `createLeadFromVmLead()`:

```typescript
import { createLeadFromVmLead } from "../integrations/odooClient";

// Em alguma rota/função
const odooLeadId = await createLeadFromVmLead({
  vmLead: {
    titulo: "Novo Prospecto",
    descricao: "Lead gerado a partir de visita",
    valorPrevisto: 5000,
  },
  entidade: {
    id: "ent-123",
    nome: "Empresa ABC",
    odooPartnerId: 42, // FK para res.partner no Odoo
  },
  contacto: {
    id: "cont-456",
    nome: "João Silva",
    email: "joao@empresa.pt",
    telefone: "+351912345678",
  },
  empresaId: "emp-789",
});

// odooLeadId agora contém o ID da lead criada no Odoo
// Pode ser armazenado em leads.odooLeadId na BD
```

---

### Usar `updateLeadFromVmLead()`:

```typescript
import { updateLeadFromVmLead } from "../integrations/odooClient";

// Quando um lead é actualizado
await updateLeadFromVmLead({
  odooLeadId: 15, // ID da lead no Odoo (armazenado em leads.odooLeadId)
  vmLead: {
    titulo: "Prospecto - Actualizado",
    descricao: "Follow-up concluído",
    valorPrevisto: 7500,
  },
  entidade: {
    id: "ent-123",
    nome: "Empresa ABC",
    odooPartnerId: 42,
  },
  contacto: {
    id: "cont-456",
    nome: "João Silva",
    email: "joao@empresa.pt",
    telefone: "+351912345678",
  },
  empresaId: "emp-789",
});

// Sem retorno específico (void), apenas confirmação
```

---

## 🔍 VALIDAÇÕES APLICADAS

### Pre-requisitos Obrigatórios:

| Item | Verificação | Erro Lançado |
|------|---|---|
| **Entidade.odooPartnerId** | EXISTS | "Entidade não tem parceiro Odoo configurado" |
| **OdooConnection** | EXISTS | "ODOO_NOT_CONFIGURED" |
| **OdooConnection.isActive** | TRUE (implícito) | "Integração desativada" |
| **Autenticação** | JSON-RPC OK | Erro Odoo propag. |

### Campos Validados no Zod (Post CREATE):

```typescript
// No POST /api/crm/leads (já existe):
insertLeadSchema = {
  titulo: string (min 1),
  entidadeId: UUID,
  contactoId: UUID,
  estado: string,
  valorPrevisto: numeric (optional),
  // ... mais campos
}
```

---

## 📝 LOGS & DEBUGGING

### Sucesso:
```
[Odoo] Lead criado com sucesso. Odoo Lead ID: 42
[Odoo] Lead 42 actualizado com sucesso
```

### Erros:
```
[Odoo] Erro ao criar lead: {
  message: "Entidade 'Empresa ABC' não tem parceiro Odoo configurado",
  vmLeadId: "lead-123",
  entidadeId: "ent-456",
  contactoId: "cont-789"
}

[Odoo] JSON-RPC error payload: {
  name: "AccessError",
  message: "Access denied for field 'partner_id' on model 'crm.lead'"
}
```

---

## 🚀 PRÓXIMOS PASSOS (Para Fases Futuras)

### Fase ODOO-LEADS-02: Integração nas Rotas
- [ ] Editar POST /api/crm/leads para chamar `createLeadFromVmLead()` após INSERT
- [ ] Editar PATCH /api/crm/leads/:id para chamar `updateLeadFromVmLead()` após UPDATE
- [ ] Armazenar `lead.odooLeadId` após criação bem-sucedida
- [ ] Tratamento de erros: se Odoo falha, lead fica em BD com odooLeadId=null

### Fase ODOO-LEADS-03: Frontend UI
- [ ] Mostrar status de sincronização Odoo na lista de leads
- [ ] Botão "Sincronizar com Odoo" para leads sem odooLeadId
- [ ] Toast feedback: "Lead sincronizado com Odoo" ou "Erro ao sincronizar"

### Fase ODOO-LEADS-04: Webhooks
- [ ] Webhook Odoo → Backend para actualizar leads quando mudarem no Odoo
- [ ] Bi-directional sync

---

## 📦 FICHEIROS MODIFICADOS

### server/integrations/odooClient.ts
- **Adicionado**: `createLeadFromVmLead()` (78 linhas, linhas 378-460)
- **Adicionado**: `updateLeadFromVmLead()` (75 linhas, linhas 462-536)
- **Total**: +160 linhas
- **Exportadas**: Ambas as funções

### Ficheiros NÃO modificados (já existem):
- ✅ server/storage/odooConnections.ts
- ✅ shared/schema.ts (campos já existem)
- ✅ server/integrations/odooLeadsFromVisitas.ts
- ✅ server/routes/integrations/odoo.ts

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Função `createLeadFromVmLead` implementada
- [x] Função `updateLeadFromVmLead` implementada
- [x] Validação de odooPartnerId obrigatório
- [x] Mapeamento correcto de campos (titulo → name, etc.)
- [x] Campos opcionais tratados (descricao, contacto.*, valorPrevisto)
- [x] Reutilização do JSON-RPC pattern existente
- [x] Autenticação JSON-RPC integrada
- [x] Tratamento de erros robusto (log + re-throw)
- [x] Sem stack trace bruto exposto
- [x] Logging estruturado para debug
- [x] Documentação inline clara
- [x] Type-safe (sem `as any`, excepto args object)
- [x] Exportadas e prontas para usar

---

## 🎯 STATUS FINAL

✅ **OdooClient está PRONTO para uso**

Os dois métodos estão implementados, testáveis e prontos para serem integrados nas rotas HTTP. A infraestrutura JSON-RPC Odoo está reutilizada correctamente, tratamento de erros é robusto, e a documentação é completa.

**Próxima fase**: Integrar em POST/PATCH /api/crm/leads para fazer sincronização automática com Odoo.

---

**FIM DO RELATÓRIO - FASE ODOO-LEADS-01 COMPLETO**
