# RELATORIO TECNICO - CRM-LEADS-VISITA-STEP1 (Leads na Visita)

Data: 26 Novembro 2025
Status: CONCLUIDO COM SUCESSO
Sessao: Fast Build - Summary Turn (Última volta)
Workflow: RUNNING na porta 5000

---

## OBJETIVO REALIZADO

Permitir listar só os leads de uma visita específica + criar leads directamente da página de visita:

- Backend: Filtro `visitaId` opcional em `GET /api/crm/leads`
- Frontend: Secção "Leads desta visita" na página de detalhe
- Frontend: Dialog para criar novo lead ligado à visita
- Respeita `crmLeadsEnabled` (mostra aviso se desativado)

---

## PARTE 1: BACKEND - FILTRO visitaId

### Ficheiro: server/routes/crmLeads.ts

#### Edit: Rota GET /api/crm/leads (Linhas 15-48)

**Antes:**
```typescript
const rows = await db.query.leads.findMany({
  where: eq(leads.empresaId, empresaId),
  orderBy: (l, { desc }) => desc(l.createdAt),
});
```

**Depois:**
```typescript
// FASE CRM-LEADS-VISITA-STEP1: Support visitaId query parameter for filtering
const visitaId = typeof req.query.visitaId === "string"
  ? req.query.visitaId
  : undefined;

const whereClause = visitaId
  ? and(eq(leads.empresaId, empresaId), eq(leads.visitaId, visitaId))
  : eq(leads.empresaId, empresaId);

const rows = await db.query.leads.findMany({
  where: whereClause,
  orderBy: (l, { desc }) => desc(l.createdAt),
});
```

#### Logica:
1. Lê `visitaId` da query string (opcional)
2. Se `visitaId` provided: Filtra por empresaId AND visitaId
3. Se não: Filtra só por empresaId (comportamento original)
4. Retorna leads ordenados por createdAt (mais recentes primeiro)

#### Usos:
- `GET /api/crm/leads` → Todos os leads da empresa
- `GET /api/crm/leads?visitaId=xyz` → Apenas leads da visita xyz

---

## PARTE 2: FRONTEND - IMPORTS E TIPOS

### Ficheiro: client/src/pages/VisitaDetail.tsx

#### Edit 1: Imports (Linhas 2-16)

**Adicionado:**
- `Flag` icon (lucide-react) para representar Leads
- `DialogDescription, DialogFooter` (shadcn Dialog)

**Total imports:**
```typescript
import { Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
```

#### Edit 2: Estados (Linhas 92-100)

```typescript
// FASE CRM-LEADS-VISITA-STEP1: Leads section state
const [leadDialogOpen, setLeadDialogOpen] = useState(false);
const [leadSaving, setLeadSaving] = useState(false);
const [leadForm, setLeadForm] = useState({
  titulo: "",
  marca: "",
  estado: "novo",
  valorPrevisto: "",
});
```

Gerencia:
- `leadDialogOpen`: Controla visibilidade do Dialog
- `leadSaving`: Bloqueia botão enquanto POST em progresso
- `leadForm`: Dados do form (controlado)

#### Edit 3: Query para Leads da Visita (Linhas 192-226)

```typescript
// FASE CRM-LEADS-VISITA-STEP1: Load leads for this visit
type Lead = {
  id: string;
  titulo: string;
  marca: string | null;
  estado: string;
  valorPrevisto: string | null;
  moeda: string | null;
  createdAt: string;
};

type LeadsResponse = 
  | { leads: Lead[] }
  | { success: false; notEnabled?: boolean; message?: string };

const { data: leadsData, isLoading: leadsLoading } = useQuery<LeadsResponse>({
  queryKey: ["/api/crm/leads", { visitaId: visita?.id }],
  enabled: !!visita?.id,
  queryFn: async () => {
    const params = new URLSearchParams({ visitaId: visita!.id });
    const resp = await fetch(`/api/crm/leads?${params.toString()}`, {
      credentials: "include",
    });
    return resp.json();
  },
});

const leadsDisabled =
  leadsData &&
  "success" in leadsData &&
  leadsData.success === false &&
  leadsData.notEnabled === true;

const leads: Lead[] =
  leadsData && "leads" in leadsData ? leadsData.leads : [];
```

**Logica:**
- Query só executa quando `visita?.id` existe (`enabled` gate)
- Query key: `["/api/crm/leads", { visitaId }]` (cache única por visita)
- Fetch com `URLSearchParams` (query string limpo)
- Detecta se Leads está desativado: `leadsDisabled`
- Extrai array de leads: `leads`

---

## PARTE 3: HANDLER CRIAR LEAD

### Ficheiro: client/src/pages/VisitaDetail.tsx (Linhas 283-353)

```typescript
const handleCreateLeadFromVisita = async () => {
  if (!visita?.id || !visita.entidadeId || !visita.contactoId) {
    toast({ title: "Erro", description: "Contexto de visita incompleto." });
    return;
  }

  try {
    setLeadSaving(true);

    const body = {
      entidadeId: visita.entidadeId,
      contactoId: visita.contactoId,
      visitaId: visita.id,
      titulo: leadForm.titulo.trim(),
      descricao: null,
      marca: leadForm.marca || null,
      estado: leadForm.estado || "novo",
      valorPrevisto: leadForm.valorPrevisto ? Number(leadForm.valorPrevisto) : null,
      moeda: "EUR",
      responsavelUserId: null,
    };

    const resp = await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const json = await resp.json();
    if (!resp.ok || json.success === false) {
      throw new Error(json.message || `HTTP ${resp.status}`);
    }

    toast({ title: "Lead criado", description: "Lead criado a partir desta visita." });

    setLeadDialogOpen(false);
    setLeadForm({ titulo: "", marca: "", estado: "novo", valorPrevisto: "" });

    await queryClient.invalidateQueries({
      queryKey: ["/api/crm/leads", { visitaId: visita.id }],
    });
  } catch (error: any) {
    console.error("[CRM Leads] Error creating lead from visita:", error);
    toast({
      title: "Erro ao criar lead",
      description: error?.message || "Não foi possível criar o lead desta visita.",
      variant: "destructive",
    });
  } finally {
    setLeadSaving(false);
  }
};
```

**Fluxo:**
1. Valida contexto (visita, entidade, contacto existem)
2. Monta payload com dados do form + contexto da visita
3. POST `/api/crm/leads` com JSON
4. Se sucesso: Toast + fecha dialog + invalida query + limpa form
5. Se erro: Toast erro com mensagem específica
6. Finally: Desbloqueia botão

---

## PARTE 4: UI SECÇÃO LEADS

### Ficheiro: client/src/pages/VisitaDetail.tsx (Antes do card Odoo)

#### Card "Leads desta visita" (5 estados):

**1. DESATIVADO:**
```
"O módulo de Leads CRM está desativado para esta empresa."
```
(Sem botão "Adicionar lead")

**2. LOADING:**
```
"A carregar leads..."
```

**3. EMPTY:**
```
"Ainda não existem leads associados a esta visita."
```

**4. COM DADOS:**
Lista em cards com:
- Titulo (negrito)
- Marca + Estado (texto pequeno, cinzento)
- Valor + Data (alinhado direita)
- Hover border para UX

**5. HEADER COM BOTÃO:**
- Título: "Leads desta visita" (com ícone Flag)
- Descrição: "Oportunidades associadas (0..N leads)"
- Botão "Adicionar lead" (se não desativado, disabled se loading)

#### Dialog "Novo lead desta visita":

**Form fields:**
1. **Título** (obrigatório)
   - Input text
   - Placeholder: "Ex.: Projeto Moradia X – Ritmonio"

2. **Marca** (opcional)
   - Input text
   - Placeholder: "Ex.: Ritmonio, Revestech..."

3. **Estado** (dropdown)
   - Options: Novo, Em análise, Proposta enviada, Ganho, Perdido
   - Default: "novo"

4. **Valor previsto** (opcional, numérico)
   - Input number
   - Min 0, step 0.01
   - Placeholder: "Opcional"

**Botões:**
- "Cancelar" (ghost variant, fecha dialog)
- "Criar lead" (primary, disabled se `!titulo.trim()` ou saving)

**Estados de botão:**
- `disabled`: true se `leadSaving` ou título vazio
- Texto: "A criar..." se saving, "Criar lead" caso contrário

---

## PARTE 5: TEST IDs

Todos elementos testáveis:

```typescript
data-testid="card-leads-visita"                   // Card principal
data-testid="button-add-lead-from-visita"        // Botão "Adicionar lead"
data-testid={`row-lead-visita-${lead.id}`}       // Cada linha de lead
data-testid="input-lead-titulo"                  // Input título
data-testid="input-lead-marca"                   // Input marca
data-testid="select-lead-estado"                 // Select estado
data-testid="input-lead-valor"                   // Input valor
data-testid="button-cancel-lead"                 // Botão cancelar
data-testid="button-create-lead-dialog"          // Botão criar
```

---

## FLUXO DE DADOS COMPLETO

### Ao abrir página de visita:

```
1. useQuery("visita") carrega visita
   ↓
2. useQuery("leads", { visitaId: visita.id }) triggered
   ↓
3. Backend: GET /api/crm/leads?visitaId=xyz
   ├─ if crmLeadsEnabled false → { success: false, notEnabled: true }
   └─ if crmLeadsEnabled true → { leads: [...] }
   ↓
4. leadsData recebe resposta
   ↓
5. if leadsDisabled → mostra aviso
   if leads.length === 0 → mostra "Ainda não existem..."
   if leads.length > 0 → renderiza lista
```

### Ao criar lead:

```
1. User clica "Adicionar lead"
   ↓
2. setLeadDialogOpen(true) → Dialog abre
   ↓
3. User preenche form
   ↓
4. User clica "Criar lead"
   ↓
5. handleCreateLeadFromVisita() triggered
   ├─ setLeadSaving(true) → Botão disabled
   ├─ POST /api/crm/leads com { entidadeId, contactoId, visitaId, ... }
   ├─ Se sucesso: toast positivo
   ├─ Fecha dialog + limpa form
   └─ queryClient.invalidateQueries(...) → Re-fetch leads
   ↓
6. Query re-executa, nova lista renderiza com novo lead
```

---

## VALIDACOES

### Frontend:
- Titulo obrigatório (não pode estar vazio)
- Valor: só aceita números (input type="number")
- Marca e valor opcionais (converted to null)
- Dialog disabled enquanto saving
- Toast feedback em sucesso e erro

### Backend:
- `entidadeId, contactoId, titulo` obrigatórios
- `visitaId` pode ser null (creates standalone lead)
- Zod schema validation
- Checks `assertLeadsEnabled()` (401/403 se desativado)

---

## FICHEIROS MODIFICADOS/CRIADOS

### 1. server/routes/crmLeads.ts
- **Edit 1:** GET / - Adicionar visitaId filter (3 linhas)
- Total: ~5 linhas adicionadas

### 2. client/src/pages/VisitaDetail.tsx
- **Edit 1:** Import Flag + DialogDescription/Footer
- **Edit 2:** Estados leadDialogOpen, leadSaving, leadForm
- **Edit 3:** useQuery para leads + tipos + deteccao desativado
- **Edit 4:** Handler handleCreateLeadFromVisita
- **Edit 5:** UI Card "Leads desta visita" (antes Odoo)
- **Edit 6:** Dialog "Novo lead"
- Total: ~250 linhas adicionadas

---

## TESTES PROPOSTOS

### T1: Visita sem Leads Criado
```
1. Abre visita detalhe
2. Verifica secção "Leads desta visita"
3. Mostra "Ainda não existem leads..."
4. Botão "Adicionar lead" ativo
```

### T2: Criar Lead da Visita
```
1. Clica "Adicionar lead"
2. Dialog abre com form vazio
3. Preenche Título: "Projeto X"
4. Preenche Marca: "Ritmonio" (opcional)
5. Estado: "Novo" (default)
6. Valor: "5000"
7. Clica "Criar lead"
8. Toast: "Lead criado"
9. Dialog fecha
10. Secção atualiza com novo lead visível
```

### T3: Validacao Titulo Obrigatorio
```
1. Dialog abre
2. Deixa Título vazio
3. Botão "Criar lead" desativado
4. Preenche Título
5. Botão ativado
```

### T4: Leads Desativado
```
1. Em Definições: desativa Leads module (crmLeadsEnabled = false)
2. Volta a visita
3. Secção mostra aviso: "Módulo de Leads CRM está desativado..."
4. Botão "Adicionar lead" não renderiza
```

### T5: Via DevTools Network
```
1. Secção "Leads desta visita" abre
2. Network: GET /api/crm/leads?visitaId=abc123
3. Response: { leads: [] } (se vazio)
4. Após criar: GET /api/crm/leads?visitaId=abc123
5. Response: { leads: [{ id: "x", titulo: "...", ... }] }
```

### T6: Lista Global vs Visita
```
1. Cria lead A na Visita X
2. Cria lead B na Visita Y
3. Em Visita X: secção mostra só lead A
4. Em Visita Y: secção mostra só lead B
5. Em /admin/leads: lista global mostra A + B
```

---

## ESTADO DO SISTEMA

### Backend:
- ✅ GET /api/crm/leads suporta visitaId query parameter
- ✅ Filtra por empresaId + visitaId (se provided)
- ✅ POST /api/crm/leads aceita visitaId no body
- ✅ Todos endpoints protegidos por crmLeadsEnabled

### Frontend:
- ✅ Query `["/api/crm/leads", { visitaId }]` implementada
- ✅ Handler `handleCreateLeadFromVisita` completo
- ✅ UI Card "Leads desta visita" com 5 estados
- ✅ Dialog form com 4 campos
- ✅ Validacoes (titulo obrigatório, numero campo)
- ✅ Toast feedback
- ✅ Cache invalidation após criar

### Integração:
- ✅ Visita + Entidade + Contacto linkados a Lead
- ✅ Lead criado com contexto de visita
- ✅ UI Visita mostra leads específicos dela
- ✅ UI /admin/leads mostra todos os leads

### UX:
- ✅ Loading states
- ✅ Empty states
- ✅ Error handling
- ✅ Feature toggle (desativado aviso + sem botão)
- ✅ Dialog modal com form controlado

### Test IDs:
- ✅ 8 test IDs em componentes interativos

---

## PROXIMOS PASSOS (Fora Escopo)

1. **Detalhe de Lead**
   - Click lead → Abre detalhe/edit modal
   - Edit fields
   - Delete lead

2. **Sync Odoo Leads**
   - Quando lead criado, sincronizar com Odoo
   - Mostrar odooLeadId em card

3. **Bulk Actions**
   - Selecionar múltiplos leads
   - Mudar estado em massa
   - Delete em massa

4. **Filtros**
   - Por estado (Novo, Ganho, Perdido)
   - Por marca
   - Por valor (>X, <X)

5. **Analytics**
   - Leads por estado (pie chart)
   - Leads por marca (bar chart)
   - Valor total previsto

---

## SUMARIO FINAL

**Backend:** Rota GET /api/crm/leads agora suporta filtro visitaId opcional
**Frontend:** Página visita detalhe tem secção "Leads desta visita" com lista + dialog criar lead
**UX:** 5 estados (desativado, loading, empty, dados, criando)
**Validacoes:** Titulo obrigatório, numero campo valor, feature toggle respected
**Cache:** Query key ["/api/crm/leads", { visitaId }] permite listas independentes por visita

SISTEMA PRONTO PARA TESTES!

Workflow: RUNNING
App: Responsive, leads carregam por visita
Navegação: Fluida entre Visita → Criar Lead → Lista atualiza
Query Cache: Eficiente com cache key visitaId

---

Data: 26 Novembro 2025
Status Final: PRONTO PARA TESTES E PROXIMAS FASES
Referencia: RELATORIO-CRM-LEADS-VISITA-STEP1.md
