# RELATÓRIO: CRM LEADS DEBUG - LIST STEP 1

**Data**: 27 Novembro 2025  
**Objetivo**: Debug cirúrgico em 3 pontos - BD → API → UI  
**Status**: ✅ DEBUG CONCLUÍDO - Diagnóstico: 0 leads na BD

---

## 🔍 PONTO 1: CONFIRMAR SE EXISTEM LEADS NA BD

### Execução do Script
**Ficheiro**: `server/scripts/debugLeads.ts`

```typescript
import { db } from "../db";
import { leads } from "../../shared/schema";

async function main() {
  const allLeads = await db.select().from(leads);
  console.log("TOTAL LEADS:", allLeads.length);
  console.dir(allLeads, { depth: 3 });
}

main().then(() => {
  console.log("Done.");
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Resultado:
```
TOTAL LEADS: 0
[]
Done.
```

### Conclusão:
**⚠️ DIAGNÓSTICO CONFIRMADO**: Não há qualquer lead na tabela de `leads`. A BD está vazia.

---

## 🔌 PONTO 2: DEBUG DA ROTA GET /api/crm/leads

### Logs Adicionados
**Ficheiro**: `server/routes/crmLeads.ts` (linhas 50-56)

```typescript
const rows = await db.query.leads.findMany({
  where: whereClause,
  orderBy: (l, { desc }) => desc(l.createdAt),
});

console.log("[CRM Leads] GET /api/crm/leads", {
  empresaId,
  entidadeId,
  contactoId,
  visitaId,
  count: rows.length,
});

return res.json({ leads: rows });
```

### Estado Atual:
- ✅ Log inserido e código pronto
- ⏳ Nenhuma requisição GET /api/crm/leads registada ainda no servidor

### Comportamento Esperado:
```json
[CRM Leads] GET /api/crm/leads {
  "empresaId": "00ff3c16-4281-4ddc-89d7-8c59a50b3fb8",
  "entidadeId": undefined,
  "contactoId": undefined,
  "visitaId": undefined,
  "count": 0
}
```

---

## ✍️ PONTO 3: VALIDAÇÃO DO POST /api/crm/leads

### Logs Adicionados
**Ficheiro**: `server/routes/crmLeads.ts` (linha 182)

```typescript
const [created] = await db
  .insert(leads)
  .values({
    empresaId,
    entidadeId,
    contactoId,
    visitaId: visitaId ?? null,
    titulo,
    descricao: descricao ?? null,
    marca: marca ?? null,
    estado: estado ?? "novo",
    valorPrevisto: valorPrevisto ?? null,
    moeda: moeda ?? "EUR",
    responsavelUserId: responsavelUserId ?? null,
  })
  .returning();

console.log("[CRM Leads] POST created lead", created);

return res.status(201).json({ success: true, lead: created });
```

### Validação da Implementação:
- ✅ `empresaId` retirado de `getUserContext(req)` (não do body)
- ✅ `entidadeId` vem do body e é obrigatório
- ✅ `contactoId` vem do body e é obrigatório
- ✅ `visitaId` vem do body e é opcional (defalta null)
- ✅ Validação com `insertLeadSchema` antes do insert
- ✅ `.returning()` devolve o objeto criado
- ✅ Log imprime o objeto completo do lead criado

**Conclusão**: ✅ POST está corretamente implementado para gravar empresaId, entidadeId, contactoId.

---

## 📊 ANÁLISE SUMÁRIA

| Ponto | Status | Achado |
|-------|--------|--------|
| **1. TOTAL LEADS na BD** | ✅ Confirmado | **ZERO LEADS** - Tabela vazia |
| **2. GET /api/crm/leads Logs** | ✅ Implementado | Logs prontos, aguardando requisições |
| **3. POST /api/crm/leads Implementação** | ✅ Validado | Código correto, pronto para criar leads |

---

## 🎯 ACHADOS PRINCIPAIS

### Encontrado:
1. ✅ **BD está vazia** - `TOTAL LEADS: 0` (array vazio)
2. ✅ **API GET está pronta** - Logs configurados para rastrear requisições
3. ✅ **API POST está correta** - empresaId, entidadeId, contactoId mapeados adequadamente

### Por Que Não Há Leads?
- ❌ Nenhum lead foi criado ainda via POST /api/crm/leads
- ❌ Nenhuma visita foi convertida para lead (funcionalidade de "Adicionar lead" pode não estar implementada no frontend)
- ❌ Nenhuma migração ou seed script criou leads de teste

---

## 🔗 FICHEIROS AFETADOS

| Ficheiro | Linhas | Tipo | Alteração |
|----------|--------|------|-----------|
| `server/scripts/debugLeads.ts` | NOVO | Script | Debug para contar leads na BD |
| `server/routes/crmLeads.ts` | 50-56 | Log | Console.log no GET / |
| `server/routes/crmLeads.ts` | 182 | Log | Console.log no POST / |

---

## 📋 PRÓXIMOS PASSOS (CONFORME PEDIDO NO PROMPT)

### Fase 1: Se Quiser Testar Criação de Leads
1. Abrir /admin/visitas (ou visita existente)
2. Procurar botão "Adicionar lead" ou similar
3. Preencher formulário: Entidade, Contacto, Título
4. Submeter
5. Ver no servidor:
   - Log `[CRM Leads] POST created lead { ... }`
   - Confirmar campos: empresaId, entidadeId, contactoId, visitaId (se aplicável)

### Fase 2: Verificar GET Filters
1. Depois de ter ≥1 lead na BD
2. Correr novamente: `tsx server/scripts/debugLeads.ts`
3. Deverá mostrar: `TOTAL LEADS: 1` (ou mais)
4. Abrir /admin/leads
5. Ver no servidor log: `[CRM Leads] GET /api/crm/leads { empresaId: "...", count: 1 }`

### Fase 3: Testar Filtros por Entidade/Contacto
1. Abrir Entidade com leads esperados
2. Secção "Leads desta entidade" chama: `/api/crm/leads?entidadeId=...`
3. Ver no servidor log: `[CRM Leads] GET /api/crm/leads { entidadeId: "...", count: X }`
4. Idem para Contacto

---

## 🛠️ ESTADO DO SERVIDOR

**Status**: ✅ RUNNING na porta 5000  
**Arquivo de Logs**: `/tmp/logs/Start_application_20251127_010913_920.log`  
**Última Inicialização**: 27/11/2025 às 01:09:00

---

## 📝 RESUMO EXECUTIVO

### Problema Identificado:
- ❌ `/admin/leads` mostra 0 leads
- ❌ Secções "Leads desta entidade" e "Leads deste contacto" sem dados
- ❌ Razão: **BD vazia - nenhum lead foi criado**

### Debug Realizado:
1. ✅ Script `debugLeads.ts` criado → Confirma 0 leads
2. ✅ Logs adicionados ao GET /api/crm/leads → Prontos para rastrear
3. ✅ POST validado → Código correto para gravar dados

### Próximo Passo Recomendado:
**Criar pelo menos 1 lead** (via POST /api/crm/leads ou botão UI) e revalidar:
1. Rodar `tsx server/scripts/debugLeads.ts` → deverá mostrar TOTAL LEADS ≥ 1
2. Abrir /admin/leads → deverá mostrar o lead criado
3. Ver logs do servidor para confirmar filtros funcionam

---

## ✅ CHECKLIST

- [x] Script debug criado em `server/scripts/debugLeads.ts`
- [x] TOTAL LEADS confirmado: 0
- [x] GET /api/crm/leads modificado com logs
- [x] POST /api/crm/leads validado (empresaId, entidadeId, contactoId)
- [x] Servidor RUNNING e pronto para testes
- [x] Diagnóstico completo e documentado

---

**FIM DO DEBUG STEP 1**

**Aguardando**: Criação de leads para validar GET/POST em operação real.
