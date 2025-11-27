# RESUMO: CRM LEADS DETAIL PAGE - STEP 1

**Data**: 27 Novembro 2025  
**Objetivo**: Implementar página de detalhe para cada Lead com edição inline e navegação a partir da lista  
**Status**: ✅ COMPLETO

---

## 📋 REQUISITOS CUMPRIDOS

### 1. Backend - Rotas GET e PATCH ✅
**Ficheiro**: `server/routes/crmLeads.ts`

- **GET /api/crm/leads/:id** (linhas 62-91)
  - Carrega um lead específico
  - Validação de empresaId e autenticação
  - Resposta: `{ lead: Lead }` ou erro 404
  - Suporta "notEnabled" flag

- **PATCH /api/crm/leads/:id** (linhas 174-232)
  - Atualiza campos: titulo, descricao, marca, estado, valorPrevisto, moeda, responsavelUserId, odooLeadId
  - Validação incremental (apenas campos fornecidos são atualizados)
  - Retorna lead atualizado

**Status**: ✅ JÁ EXISTIA - Confirmado e validado

---

### 2. Frontend - Página de Detalhe `/admin/leads/:id` ✅
**Ficheiro**: `client/src/pages/AdminLeadDetailPage.tsx` (272 linhas)

#### Componente Principal: `AdminLeadDetailPage()`
- Lê paramétro `:id` da rota via `useRoute("/admin/leads/:id")`
- Faz GET `/api/crm/leads/:id` via TanStack Query
- Estados: loading, error, notEnabled, success
- Renderiza `LeadDetailForm` com dados do lead

#### Estados Renderizados:
1. **ID inválido**: Mensagem + botão "Voltar à lista"
2. **Loading**: Spinner + mensagem "A carregar lead..."
3. **Erro**: Mensagem de erro + botão voltar
4. **notEnabled**: Alerta "Módulo desativado"
5. **Sucesso**: Formulário preenchido

#### Componente Formulário: `LeadDetailForm()`

**Form State**:
```typescript
{
  titulo: string
  descricao: string
  marca: string
  estado: string ("novo" | "em_analise" | "proposta_enviada" | "ganho" | "perdido")
  valorPrevisto: string (numérico)
  moeda: string
}
```

**Campos Editáveis**:
1. **Título*** - Input obrigatório (valida Save)
2. **Descrição** - Textarea 3 linhas
3. **Marca** - Input texto
4. **Estado** - Select dropdown (5 opções)
5. **Valor previsto** - Input number (0-999999.99)
6. **Moeda** - Input texto (default: EUR)

**Funcionalidades**:
- ✅ Estados "A guardar..." durante PATCH
- ✅ Toast sucesso: "Lead atualizado - Os dados do lead foram guardados com sucesso."
- ✅ Toast erro com mensagem detalhada
- ✅ Botão Guardar desativado se título vazio ou em loading
- ✅ Botão Cancelar volta a `/admin/leads`
- ✅ Header sticky com breadcrumb (ArrowLeft + Título + data criação)

**Data-testid**:
- `card-lead-form` - Card principal
- `input-titulo`, `textarea-descricao`, `input-marca` - Campos de texto
- `select-estado`, `input-valor-previsto`, `input-moeda` - Campos específicos
- `button-voltar`, `button-guardar`, `button-cancelar` - Botões

---

### 3. Cache Invalidation ✅

Após PATCH bem-sucedido, invalida **5 query keys**:

```typescript
["/api/crm/leads"]                              // Lista geral
["/api/crm/leads", lead.id]                     // Este lead
["/api/crm/leads", { visitaId: lead.visitaId }] // Filtro por visita
["/api/crm/leads", { entidadeId: lead.entidadeId }] // Filtro por entidade
["/api/crm/leads", { contactoId: lead.contactoId }] // Filtro por contacto
```

**Resultado**: Todas as páginas que mostram leads (lista, visita, entidade, contacto) atualizam automaticamente após guardar.

---

### 4. Lista Clicável `/admin/leads` ✅
**Ficheiro**: `client/src/pages/AdminLeadsPage.tsx`

- **Linha 135**: Cada `<tr>` tem classe `cursor-pointer hover:bg-muted`
- **Linha 135**: `onClick={() => navigate(\`/admin/leads/${lead.id}\`)}`
- **data-testid**: `row-lead-{id}` para cada linha
- Coluna "Ações" não necessária (toda a linha é clicável)

**Status**: ✅ JÁ EXISTIA - Confirmado

---

### 5. Rota Frontend `/admin/leads/:id` ✅
**Ficheiro**: `client/src/App.tsx`

- **Linha 140**: 
```typescript
<Route path="/admin/leads/:id" component={() => <AdminRoute component={AdminLeadDetailPage} />} />
```
- Protegida por `AdminRoute` (apenas admins)
- Carrega AdminLeadDetailPage dinamicamente

**Status**: ✅ JÁ EXISTIA - Confirmado

---

## 🧪 FLUXO DE TESTE VALIDADO

### Passo 1: Listar Leads
```
GET /admin/leads
→ Carrega AdminLeadsPage
→ Mostra tabela com dados
→ Cada linha: cursor-pointer hover:bg-muted
```

### Passo 2: Clicar numa Linha
```
onClick → useLocation("/admin/leads/{id}")
→ React Router navega para /admin/leads/{id}
→ AdminLeadDetailPage renderiza
→ useRoute obtém {id}
```

### Passo 3: Carregar Dados
```
queryKey: ["/api/crm/leads", "{id}"]
→ fetch GET /api/crm/leads/{id}
→ JSON: { lead: {...} }
→ Form state preenchido com valores do lead
```

### Passo 4: Editar + Guardar
```
Utilizador:
1. Altera titulo, estado, valor, etc.
2. Clica "Guardar alterações"

App:
3. Valida: titulo.trim() !== ""
4. fetch PATCH /api/crm/leads/{id} com body
5. Resposta: { success: true, lead: {...} }
6. Toast sucesso exibido
7. queryClient.invalidateQueries 5 chaves
8. Páginas relacionadas atualizam automaticamente
```

### Passo 5: Voltar à Lista
```
Botão "Cancelar" → setLocation("/admin/leads")
→ Lista atualizada com novos valores
```

---

## 📁 FICHEIROS AFETADOS

| Ficheiro | Alterações | Status |
|----------|-----------|--------|
| `server/routes/crmLeads.ts` | GET /:id, PATCH /:id | ✅ Validado |
| `client/src/pages/AdminLeadsPage.tsx` | Linhas clicáveis | ✅ Validado |
| `client/src/pages/AdminLeadDetailPage.tsx` | Página completa (272 linhas) | ✅ Validado |
| `client/src/App.tsx` | Rotas /admin/leads/:id | ✅ Validado |

---

## 🔍 DETALHES TÉCNICOS

### Tipos TypeScript
```typescript
type Lead = {
  id: string;
  titulo: string;
  descricao: string | null;
  marca: string | null;
  estado: string;
  valorPrevisto: number | null;  // ⚠️ número no BE, string no formulário
  moeda: string | null;
  entidadeId: string;
  contactoId: string;
  visitaId: string | null;
  odooLeadId: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### Validação
- **Backend**: `insertLeadSchema.safeParse()` no POST
- **Frontend**: Validação de `titulo.trim()` não vazio
- **Conversão**: String → Number para `valorPrevisto` no PATCH

### Tratamento de Erros
- 404: "Lead não encontrado"
- 400: "Validação falhou"
- 500: "Erro ao obter/atualizar lead"
- notEnabled: Renderização específica com mensagem

---

## ✅ CHECKLIST FINAL

- [x] GET /api/crm/leads/:id implementado e funcionando
- [x] PATCH /api/crm/leads/:id implementado e funcionando
- [x] AdminLeadDetailPage.tsx criado com 272 linhas
- [x] Página renderiza todos os 6 campos editáveis
- [x] Form state gerido com useState
- [x] PATCH request com body correto
- [x] Toast notifications (sucesso/erro)
- [x] Cache invalidation 5 keys
- [x] AdminLeadsPage tem linhas clicáveis
- [x] Rota /admin/leads/:id configurada em App.tsx
- [x] AdminRoute protection aplicada
- [x] Data-testid em todos elementos interativos
- [x] Estados de loading/erro/notEnabled
- [x] Navegação breadcrumb (ArrowLeft)
- [x] Botões Cancelar/Guardar funcionais

---

## 🚀 PRÓXIMOS PASSOS (Recomendado)

Quando desejar adicionar mais funcionalidades:

1. **RELAÇÃO COM ENTIDADE/CONTACTO**: Mostrar nomes em vez de IDs
2. **VISITA ASSOCIADA**: Carregar dados da visita relacionada (se visitaId existir)
3. **BULK EDIT**: Editar múltiplos leads em simultâneo
4. **EXPORT**: Exportar leads para CSV/PDF
5. **FILTROS AVANÇADOS**: Filtrar por estado, marca, data criação
6. **HISTÓRICO**: Mostrar alterações anteriores do lead
7. **RESPONSÁVEL**: Atribuir lead a utilizador específico (já existe campo)

---

## 📞 SUPORTE

**Erros Comuns**:
- "Lead não encontrado" → Verificar ID na URL
- "Módulo desativado" → Ativar `crmLeadsEnabled` em Empresa > CRMs
- "Erro ao guardar" → Verificar logs do servidor para detalhes

**Logs Úteis**:
- Backend: `[CRM Leads] GET /:id error:` ou `PATCH /:id error:`
- Frontend: Console tem mensagens de erro detalhadas

---

**Fim do Resumo**
