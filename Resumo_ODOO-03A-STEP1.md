# Resumo Odoo / PHASE 03A: Criar Lead de Teste no Odoo – STEP 1

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Criar um serviço backend que envia uma lead de teste para o Odoo (`crm.lead.create`) e expor via endpoint:
- `POST /api/integrations/odoo/test-create-lead`

**Scope:** Endpoint de teste manual apenas (não ligado a visitas/contactos reais ainda)

---

## ✅ Trabalho Realizado

### 1. Type CreateOdooLeadInput

**Ficheiro:** `server/integrations/odooClient.ts` (linhas 26-32)

```typescript
export type CreateOdooLeadInput = {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
};
```

| Campo | Tipo | Requerido | Descrição |
|-------|------|-----------|-----------|
| `name` | string | ✅ Sim | Nome da lead |
| `contactName` | string \| null | ❌ Não | Nome do contacto |
| `email` | string \| null | ❌ Não | Email do contacto |
| `phone` | string \| null | ❌ Não | Telefone do contacto |
| `description` | string \| null | ❌ Não | Descrição/observações |

---

### 2. Função createOdooLead()

**Ficheiro:** `server/integrations/odooClient.ts` (linhas 261-304)

```typescript
export async function createOdooLead(
  empresaId: string,
  input: CreateOdooLeadInput
): Promise<{ id: number }> {
  // 1. Get conexão Odoo
  const conn = await getOdooConnectionForEmpresa(empresaId);

  // 2. Construir payload (campos opcionais)
  const payload: Record<string, any> = {
    name: input.name,
  };

  if (input.contactName) {
    payload.contact_name = input.contactName;
  }
  if (input.email) {
    payload.email_from = input.email;
  }
  if (input.phone) {
    payload.phone = input.phone;
  }
  if (input.description) {
    payload.description = input.description;
  }

  // 3. Call Odoo JSON-RPC: crm.lead.create
  const result = await callOdooJsonRpc<number>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        conn.username,
        conn.apiKey,
        "crm.lead",
        "create",
        [payload],
      ],
    },
  });

  // 4. Retornar ID da lead criada
  return { id: result };
}
```

**Fluxo:**
1. Busca conexão Odoo para a empresa
2. Constrói payload JSON com campos opcionais
3. Chama `crm.lead.create` via JSON-RPC
4. Retorna ID da lead criada

**Mapeamento de Campos (Odoo):**
| Input | Campo Odoo |
|-------|-----------|
| `contactName` | `contact_name` |
| `email` | `email_from` |
| `phone` | `phone` |
| `description` | `description` |

---

### 3. Import da Função

**Ficheiro:** `server/routes/integrations/odoo.ts` (linha 9)

```typescript
import { testOdooConnection, searchOdooPartners, getOdooPartnerById, createOdooLead } from "../../integrations/odooClient";
```

---

### 4. Rota POST /api/integrations/odoo/test-create-lead

**Ficheiro:** `server/routes/integrations/odoo.ts` (linhas 152-210)

```typescript
router.post("/test-create-lead", isAuthenticated, async (req: any, res) => {
  try {
    // 1. Get contexto (empresaId)
    const { empresaId } = await getUserContext(req);
    if (!empresaId) {
      return res.status(400).json({ error: "User has no company assigned" });
    }

    // 2. Parse body
    const {
      name,
      contactName,
      email,
      phone,
      description,
    } = (req.body ?? {}) as {
      name?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      description?: string;
    };

    // 3. Defaults (se vazios)
    const leadName =
      name?.trim() ||
      "Visit Manager – Lead de teste";

    const leadDescription =
      description?.trim() ||
      "Lead de teste enviada pela aplicação Visit Manager (endpoint /test-create-lead).";

    // 4. Chamar função
    const result = await createOdooLead(empresaId, {
      name: leadName,
      contactName: contactName?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      description: leadDescription,
    });

    // 5. Sucesso
    return res.json({
      success: true,
      leadId: result.id,
    });
  } catch (error: any) {
    // 6. Erro: Odoo não configurado
    if (error?.message === "ODOO_NOT_CONFIGURED") {
      return res.status(200).json({
        success: false,
        notConfigured: true,
      });
    }

    // 7. Erro genérico
    console.error("[Odoo] test-create-lead error:", error);
    return res.status(500).json({
      success: false,
      error: "Odoo lead creation error",
      message: error?.message ?? "Unknown error",
    });
  }
});
```

---

## 📁 Ficheiros Editados

| Ficheiro | Linhas | Mudança |
|----------|--------|---------|
| `server/integrations/odooClient.ts` | 26-32 | Type `CreateOdooLeadInput` |
| `server/integrations/odooClient.ts` | 261-304 | Função `createOdooLead()` |
| `server/routes/integrations/odoo.ts` | 9 | Import `createOdooLead` |
| `server/routes/integrations/odoo.ts` | 152-210 | Rota POST `/test-create-lead` |

**Total:** 2 ficheiros editados, ~120 linhas adicionadas

---

## 🔌 API Endpoint

### POST /api/integrations/odoo/test-create-lead

**Request:**
```bash
curl -X POST "http://localhost:5000/api/integrations/odoo/test-create-lead" \
  -H "Content-Type: application/json" \
  -H "Cookie: SESSION=..." \
  -d '{
    "name": "Lead Manual de Teste",
    "contactName": "Pedro Silva",
    "email": "pedro@example.com",
    "phone": "+351 915 000 000",
    "description": "Lead criada via endpoint de teste."
  }'
```

**Headers Requeridos:**
- `Content-Type: application/json`
- `Cookie: SESSION=...` (autenticação)

**Body (Opcional):**
```json
{
  "name": "Nome da Lead",
  "contactName": "Nome do Contacto",
  "email": "contacto@example.com",
  "phone": "+351 9XX XXX XXX",
  "description": "Descrição adicional"
}
```

### Response - Sucesso (HTTP 200)
```json
{
  "success": true,
  "leadId": 1234
}
```

### Response - Não Configurado (HTTP 200)
```json
{
  "success": false,
  "notConfigured": true
}
```

### Response - Erro (HTTP 500)
```json
{
  "success": false,
  "error": "Odoo lead creation error",
  "message": "Error details here"
}
```

---

## ✅ Critérios de Aceitação

- [x] Type `CreateOdooLeadInput` criado
- [x] Função `createOdooLead()` criada
- [x] Rota POST `/test-create-lead` adicionada
- [x] Tratamento de Odoo não configurado
- [x] Tratamento de erros HTTP
- [x] Defaults para name + description
- [x] Import adicionado
- [x] TypeScript sem erros
- [x] Servidor running
- [x] Middleware `isAuthenticated` aplicado

---

## 🧪 Casos de Teste

### Teste 1: Criar Lead com Todos os Campos
```bash
curl -X POST "http://localhost:5000/api/integrations/odoo/test-create-lead" \
  -H "Content-Type: application/json" \
  --cookie "SESSION=..." \
  -d '{
    "name": "Nova Oportunidade",
    "contactName": "João Silva",
    "email": "joao@empresa.com",
    "phone": "+351 920 000 000",
    "description": "Lead qualificada da Visit Manager"
  }'
```

**Esperado:**
```json
{
  "success": true,
  "leadId": 2345
}
```

**Verificação no Odoo:**
- CRM → Leads → ID 2345
- Nome: "Nova Oportunidade"
- Contacto: "João Silva"
- Email: "joao@empresa.com"
- Telefone: "+351 920 000 000"
- Descrição: "Lead qualificada da Visit Manager"

### Teste 2: Criar Lead com Mínimos (Apenas Name)
```bash
curl -X POST "http://localhost:5000/api/integrations/odoo/test-create-lead" \
  -H "Content-Type: application/json" \
  --cookie "SESSION=..." \
  -d '{ "name": "Lead Simples" }'
```

**Esperado:**
```json
{
  "success": true,
  "leadId": 2346
}
```

### Teste 3: Sem Name (Usa Default)
```bash
curl -X POST "http://localhost:5000/api/integrations/odoo/test-create-lead" \
  -H "Content-Type: application/json" \
  --cookie "SESSION=..." \
  -d '{ "email": "teste@example.com" }'
```

**Esperado:**
```json
{
  "success": true,
  "leadId": 2347
}
```

**No Odoo:** Lead com nome "Visit Manager – Lead de teste"

### Teste 4: Odoo Não Configurado
```bash
# Sem credenciais Odoo configuradas
curl -X POST "http://localhost:5000/api/integrations/odoo/test-create-lead" \
  -H "Content-Type: application/json" \
  --cookie "SESSION=..." \
  -d '{ "name": "Teste" }'
```

**Esperado:**
```json
{
  "success": false,
  "notConfigured": true
}
```

### Teste 5: Sem Autenticação
```bash
curl -X POST "http://localhost:5000/api/integrations/odoo/test-create-lead" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Teste" }'
```

**Esperado:** Redirecionado para login ou 401 Unauthorized

---

## 📊 JSON-RPC Payload (Odoo)

**Formato:**
```json
{
  "jsonrpc": "2.0",
  "id": 1234567890,
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [
      "db_name",
      "username",
      "api_key",
      "crm.lead",
      "create",
      [
        {
          "name": "Lead Name",
          "contact_name": "Contact Name",
          "email_from": "email@example.com",
          "phone": "+351 9XX XXX XXX",
          "description": "Description here"
        }
      ]
    ]
  }
}
```

**Response (Sucesso):**
```json
{
  "jsonrpc": "2.0",
  "id": 1234567890,
  "result": 1234
}
```

---

## 🚀 Próximos Steps (PHASE 03B, 03C, etc.)

### STEP 2: Criar Lead Automaticamente ao Criar Visita
```
Trigger: Criar nova Visita
├─ User seleciona Entidade + Contacto
├─ Se ambos ligados a Odoo:
│  ├─ Recuperar dados Odoo (partner)
│  ├─ Criar lead: name = "Visita ao {partner_name}"
│  ├─ Link: lead_id no registo de Visita
│  └─ Toast: "Lead criada no Odoo"
└─ Se não ligado: Skip
```

### STEP 3: Sincronizar Dados da Visita com Lead
```
Trigger: Atualizar Visita
├─ Se lead_id existe:
│  ├─ Update crm.lead fields:
│  │  ├─ Descrição (adicionar notas)
│  │  ├─ Status (pending → qualified)
│  │  └─ Outros campos conforme estado
│  └─ Toast: "Lead atualizada no Odoo"
└─ Se sem lead_id: Skip
```

### STEP 4: Dashboard de Leads Sincronizadas
```
Page: /odoo/leads
├─ Listar leads criadas via Visit Manager
├─ Status no Odoo (new, qualified, won, lost)
├─ Link para Visita correspondente
├─ Botão: "Abrir no Odoo"
└─ Estatísticas: leads por entidade, status, etc.
```

---

## ✅ Status de Compilação

✅ **TypeScript:** Sem erros  
✅ **Imports:** Todos presentes  
✅ **Função:** `createOdooLead()` completa  
✅ **Rota:** POST `/test-create-lead` funcional  
✅ **Tratamento de erros:** Completo (not-configured + generic)  
✅ **Middleware:** `isAuthenticated` aplicado  
✅ **Servidor:** Running sem erros  

---

## 📝 Notas Técnicas

1. **Padrão Reutilizável:** Função `createOdooLead()` pode ser usada em:
   - Criação automática ao nova Visita
   - Integrações futuras (calendar events, tasks)
   - Batch operations

2. **Defaults:** Name e description têm defaults automáticos se vazios
   - Garante que lead sempre tem informação mínima

3. **Validação:** `.trim()` em todos os campos para evitar espaços em branco

4. **Soft Fail:** Se Odoo não está configurado, retorna `{ success: false, notConfigured: true }` (sem erro 500)

5. **Namespacing:** Prefix `email_from` vem de Odoo (não `email` que é campo diferente)

---

## 🏁 Conclusão

Implementação bem-sucedida de serviço de criação de leads no Odoo:
- ✅ Type + Função + Rota criados
- ✅ Endpoint de teste manual operacional
- ✅ Tratamento completo de erros
- ✅ Pronto para ser integrado a Visitas na próxima fase

**PRONTO PARA DEPLOY** 🚀

---

**Status Final: ✅ ODOO-03A-STEP1 - COMPLETA E FUNCIONAL**

Endpoint de teste para criar leads no Odoo operacional e documentado!
