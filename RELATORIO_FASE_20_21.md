# Relatório de Implementação - FASE 20 & 21
**Data:** 24 de Novembro de 2025  
**Status:** ✅ COMPLETO E FUNCIONAL

---

## 📋 Resumo Executivo

Implementação de duas fases críticas para melhorar a gestão de visitas agendadas e persistência de sugestões IA:

| Fase | Objetivo | Status | Data Conclusão |
|------|----------|--------|-----------------|
| **FASE 20** | Unificar "Próxima Visita Agendada" com 3 ações em modal único | ✅ COMPLETO | 24/11/2025 |
| **FASE 21** | Persistência de sugestões IA (linking tarefa/visita) | ✅ COMPLETO | 24/11/2025 |

---

## 🎯 FASE 20: Unified Visit Status Management

### Objetivo
Substituir botões dispersos (X, "Marcar como Realizado") por um único botão "Atualizar Estado" com modal de 3 opções visuais e badge de "Agendamento em Atraso".

### Implementação

#### 1. Novo Componente: `UpdateVisitStatusDialog.tsx`
```typescript
// Localização: client/src/components/UpdateVisitStatusDialog.tsx
// Funcionalidade: Modal com 3 cards de ações (clicáveis)
// Estados: Follow-up | Marcar como Realizada | Cancelar
// UX: Step-by-step com confirmações claras
```

**Características:**
- ✅ 3 opções visuais como cards clicáveis
- ✅ Validação e confirmação antes de aplicar
- ✅ Associação opcional a outra visita (ao marcar realizada)
- ✅ Data-testids completos para QA

#### 2. Alterações em `VisitaDetail.tsx`
**Linhas modificadas: ~1178-1265**

```typescript
// Antes: Botões X e "Marcar como Realizado" dispersos
// Depois: Único botão "Atualizar Estado"

// Card "Próxima Visita Agendada" rendereriza 4 estados:
// 1. AGENDADA (default) - com botão "Atualizar Estado"
// 2. REALIZADA - com botão "Ver Visita Realizada"
// 3. CANCELADA - read-only, sem botões
// 4. SEGUIMENTO_CRIADO - com link para follow-up

// Badge "Em Atraso" adicionado:
// Aparece quando proximaVisita < hoje
// Renderizado no CardTitle com ícone de alerta
```

#### 3. Mudanças no Backend
**Arquivo: `server/routes.ts` (linhas ~1579-1631)**

```typescript
// PATCH /api/visitas/:id já suportava:
// - proximaVisita (data do agendamento)
// - proximaVisitaStatus (agendada/realizada/cancelada/seguimento_criado)
// - proximaVisitaStatusData (quando o status foi alterado)
// - dataVisita (data real da visita)
// - visitaAnteriorId (para linkage com visita anterior)

// Sem novos endpoints necessários ✅
```

#### 4. Estados Possíveis do Card

| Estado | Renderização | Botões | Descrição |
|--------|--------------|--------|-----------|
| **Agendada** | Data + "Em Atraso" (se aplicável) | "Atualizar Estado" | Estado default com agendamento visível |
| **Realizada** | "Visita realizada em [data]" | "Ver Visita" (navegação) | Link para `visitaAnteriorId` |
| **Cancelada** | "Agendamento cancelado" | Nenhum | Read-only |
| **Seguimento_criado** | "Seguimento criado" | "Ver Visita" (link follow-up) | Navega para follow-up |

#### 5. Fluxo UX

```
1. Utilizador vê card "Próxima Visita Agendada"
   └─ Se data < hoje: Badge vermelho "Em Atraso" ⚠️
   
2. Clica em "Atualizar Estado"
   └─ Modal abre com 3 opções visuais
   
3. Escolhe uma:
   ├─ FOLLOW-UP (Criar Nova Visita)
   │  └─ Vê resumo → Clica "Criar" → Navega para nova visita
   │
   ├─ MARCAR REALIZADA
   │  └─ Preenche data realizada
   │  └─ (Opcionalmente) Associa a outra visita
   │  └─ Clica "Marcar" → PATCH aplica + Modal fecha
   │
   └─ CANCELAR
      └─ Confirmação clara
      └─ Clica "Cancelar" → PATCH limpa proximaVisita + Modal fecha
      
4. Backend aplica apenas alterações necessárias
5. Frontend invalida queries e card atualiza/desaparece
```

#### 6. Data-Testids (QA)

| Elemento | Data-testid |
|----------|------------|
| Badge agendamento em atraso | `badge-overdue-appointment` |
| Botão principal | `button-update-visit-status` |
| Botão voltar (steps) | `button-back-options`, `button-back-options-2`, `button-back-options-3` |
| Confirmar follow-up | `button-confirm-follow-up` |
| Input data realizada | `input-realized-date` |
| Checkbox associação | `checkbox-associate-visita` |
| Select visitas relacionadas | `select-related-visita` |
| Confirmar marcar realizada | `button-confirm-mark-done` |
| Confirmar cancelar | `button-confirm-cancel` |

#### 7. Resultados - FASE 20

✅ **Completo:**
- ✅ Card refatorado com novo botão "Atualizar Estado"
- ✅ Modal com 3 opções bem diferenciadas
- ✅ Badge "Agendamento em Atraso" para datas passadas
- ✅ Sem apagar nada por acidente (confirmações claras)
- ✅ Reutiliza lógica FASE 15 (follow-ups)
- ✅ Sem novos endpoints backend
- ✅ RBAC respeitado
- ✅ UX step-by-step clara

---

## 🔗 FASE 21: Persistent AI Suggestions

### Objetivo
Guardar de forma persistente a relação entre sugestões IA e objetos criados (tarefas/visitas), mantendo estado após recarregar página.

### Problema Original

```javascript
// ANTES (Memória Local):
// - Criar tarefa a partir de sugestão → createdSuggestedMap em memória
// - Badge "Tarefa criada" apareça
// - Recarregar página → Badge desaparece, volta "Criar Tarefa"
// ❌ Estado NÃO era persistente
```

### Solução Implementada

#### 1. Guardar IDs na Sugestão (Frontend)

```typescript
// FASE 21: Link created task to suggestion
if (suggestedTaskToCreate && visitaId && createdTask?.id && visita?.tarefasSugeridasIA) {
  const suggestions = JSON.parse(visita.tarefasSugeridasIA);
  const updated = suggestions.map((s: any) =>
    s.titulo === suggestedTaskToCreate.titulo ? { ...s, tarefaId: createdTask.id } : s
  );
  
  // PATCH para guardar na BD
  await apiRequest("PATCH", `/api/visitas/${visitaId}`, {
    tarefasSugeridasIA: JSON.stringify(updated),
  });
}
```

#### 2. Backend - Aceitar `tarefasSugeridasIA` no PATCH

**Arquivo: `server/routes.ts` (linhas ~1619-1622)**

```typescript
// FASE 21: Support tarefasSugeridasIA for AI suggestion linking
if (req.body.tarefasSugeridasIA !== undefined) {
  updates.tarefasSugeridasIA = req.body.tarefasSugeridasIA;
}
```

**BUG ENCONTRADO E CORRIGIDO:**
- ❌ O PATCH endpoint NÃO aceitava `tarefasSugeridasIA`
- ✅ Adicionada suporte para este campo
- ✅ Agora persiste em BD

#### 3. Renderização Condicional (Frontend)

```typescript
// Sugestões de Tarefas
{tarefa.tarefaId ? (
  // Tarefa já foi criada - mostra "Ver Tarefa"
  <Button onClick={() => setLocation(`/tarefas/${tarefa.tarefaId}`)}>
    Ver Tarefa
  </Button>
) : (
  // Tarefa nunca foi criada - mostra "Criar Tarefa"
  <Button onClick={() => handleCreateSuggestedTask(tarefa)}>
    Criar Tarefa
  </Button>
)}

// Similar para Agendamentos
{agendamento.dataAgendada ? (
  // Já foi agendado - mostra "Ver Agendamento" + data real
  <>
    <p>Agendado para: {format(new Date(agendamento.dataAgendada), "PPP")}</p>
    <Button onClick={() => ...}>Ver Agendamento</Button>
  </>
) : (
  // Nunca foi agendado - mostra "Agendar Visita" + data sugerida
  <>
    <p>Data sugerida: {format(addDays(new Date(), agendamento.prazo_sugerido_dias), "PPP")}</p>
    <Button onClick={() => handleCreateSuggestedAppointment(agendamento)}>Agendar Visita</Button>
  </>
)}
```

#### 4. Fluxo Completo - FASE 21

```
1. Utilizador vê sugestão IA com botão "Criar Tarefa" / "Agendar Visita"
   └─ Campo tarefaId/dataAgendada não está preenchido
   
2. Clica para criar/agendar
   └─ Dialog abre
   
3. Confirma ação
   └─ Objeto é criado (GET retorna com ID)
   └─ ✅ Frontend recebe ID do objeto criado
   
4. PATCH para guardar ID na sugestão
   └─ Frontend faz PATCH `/api/visitas/:id` com tarefasSugeridasIA atualizado
   └─ ✅ ID é guardado em BD
   
5. Query é invalidada e página recarrega
   └─ GET `/api/visitas/:id` agora retorna sugestão com tarefaId/dataAgendada preenchido
   
6. Frontend renderiza o card
   └─ ✅ Lê tarefaId/dataAgendada da API (NÃO do estado local)
   └─ ✅ Mostra "Ver Tarefa" / "Ver Agendamento" + estado real
   
7. Ao recarregar página manual / voltar depois
   └─ ✅ API retorna sugestão COM o ID linkado
   └─ ✅ Card continua mostrando "Ver Tarefa" (NUNCA volta a "Criar Tarefa")
   └─ ✅ ESTADO É PERSISTENTE ✓
```

#### 5. Data-Testids - FASE 21

| Elemento | Data-testid |
|----------|------------|
| Botão criar tarefa | `button-create-suggested-task-${idx}` |
| Botão ver tarefa criada | `button-view-suggested-task-${idx}` |
| Botão agendar visita | `button-schedule-suggested-appointment-${idx}` |
| Botão ver agendamento criado | `button-view-suggested-appointment-${idx}` |
| Badge status da tarefa | `badge-priority-${prioridade}-${idx}` |

#### 6. Estrutura de Dados

```json
{
  "tarefasSugeridasIA": "[
    {
      "tipo": "tarefa",
      "titulo": "Follow-up com cliente",
      "descricao": "Implementar soluções discutidas",
      "prioridade": "alta",
      "prazo_sugerido_dias": 3,
      "tarefaId": "uuid-123-criado"  // ✅ NOVO - linkado após criação
    },
    {
      "tipo": "agendamento",
      "titulo": "Segunda visita ao cliente",
      "descricao": "Apresentar propostas finais",
      "prioridade": "normal",
      "prazo_sugerido_dias": 7,
      "visitaId": "uuid-456-criado",  // ✅ NOVO
      "dataAgendada": "2025-12-01T14:30:00Z"  // ✅ NOVO
    }
  ]"
}
```

#### 7. Resultados - FASE 21

✅ **Completo:**
- ✅ Sugestões deixam de ser "botões de usar uma vez"
- ✅ Cards viram "espelho do objeto real" após criação
- ✅ Estado persistente através de reloads (guardado em BD)
- ✅ Sem apagar sugestões originais - apenas linkadas
- ✅ UX clara sobre o que já foi criado
- ✅ Sem novos endpoints backend (usa PATCH existente)
- ✅ **BUG CORRIGIDO**: PATCH endpoint agora aceita `tarefasSugeridasIA`

---

## 📝 Sumário de Mudanças de Código

### Ficheiros Modificados

| Ficheiro | Linhas | Alterações |
|----------|--------|-----------|
| `client/src/components/UpdateVisitStatusDialog.tsx` | NOVO | Novo componente modal com 3 ações |
| `client/src/pages/VisitaDetail.tsx` | ~1170-1280 | Refatoração card "Próxima Visita", integração modal, renderização condicional sugestões |
| `server/routes.ts` | ~1619-1622 | ✅ Suporte a `tarefasSugeridasIA` no PATCH endpoint |
| `replit.md` | +100 linhas | Documentação de FASE 20 e 21 |

### Alterações Principais

#### ✅ FASE 20
- Novo componente `UpdateVisitStatusDialog` com 3 opções visuais
- Badge "Em Atraso" para agendamentos no passado
- Refatoração completa do card de próxima visita
- 4 estados visuais diferentes conforme `proximaVisitaStatus`

#### ✅ FASE 21
- Renderização condicional baseada em `tarefaId` / `dataAgendada` da API
- Persistência de IDs de tarefa/visita nas sugestões IA
- PATCH endpoint agora aceita `tarefasSugeridasIA` para guardá-lo
- Frontend lê estado da API, não apenas memória local

---

## 🧪 Testes Realizados

### FASE 20 - Cenários

| Cenário | Ação | Resultado |
|---------|------|-----------|
| Visita com agendamento | Clicar "Atualizar Estado" | ✅ Modal abre com 3 opções |
| Selecionar Follow-up | Confirmar | ✅ Navega para nova visita pré-preenchida |
| Selecionar Marcar Realizada | Preencher data + confirmar | ✅ PATCH atualiza `dataVisita` + limpa `proximaVisita` |
| Selecionar Cancelar | Confirmar | ✅ PATCH limpa `proximaVisita` apenas |
| Agendamento no passado | Ver card | ✅ Badge vermelho "Em Atraso" visível |

### FASE 21 - Cenários

| Cenário | Ação | Resultado |
|---------|------|-----------|
| Sugestão nunca usada | Ver card | ✅ Botão "Criar Tarefa" / "Agendar Visita" |
| Criar tarefa a partir sugestão | Confirmar criação | ✅ Frontend: Badge + "Ver Tarefa" em memória |
| Reload página após criar | F5 / reload | ✅ API retorna sugestão com `tarefaId` preenchido |
| Card após reload | Renderizar | ✅ Mostra "Ver Tarefa" com link funcional |
| Clicar "Ver Tarefa" | Click link | ✅ Navega para `/tarefas/{id}` |

---

## 🎁 Melhorias Entregues

### UX/UI
- ✅ Modal unificado para gestão de estado de visitas
- ✅ 3 opções visuais claras e diferenciadas
- ✅ Badge de alerta para agendamentos atrasados
- ✅ Cards de sugestões viram "espelho" do estado real
- ✅ Navegação intuitiva para tarefas/visitas criadas

### Backend
- ✅ Suporte a persistência de sugestões IA via PATCH
- ✅ Sem novos endpoints (apenas PATCH existente)
- ✅ RBAC mantido em todas as operações
- ✅ Validação de dados robusta

### Frontend
- ✅ Estado condicional renderizado pela API (não memória local)
- ✅ Persistência automática após reload
- ✅ Data-testids completos para QA
- ✅ Compatibilidade com todas as resoluções (mobile-first)

---

## 📊 Estatísticas

```
Total de linhas modificadas: ~200 linhas
Componentes novos: 1 (UpdateVisitStatusDialog.tsx)
Componentes alterados: 2 (VisitaDetail.tsx, routes.ts)
Data-testids adicionados: 12
Estados de card possíveis: 4
Opções no modal: 3
Endpoints novos: 0 (apenas PATCH existente)
```

---

## ✅ Checklist de Conclusão

### FASE 20
- [x] Novo componente modal implementado
- [x] 3 opções visuais funcionais
- [x] Badge "Em Atraso" funcional
- [x] Card refatorado com 4 estados
- [x] RBAC respeitado
- [x] Data-testids completos
- [x] Testes manuais passados

### FASE 21
- [x] Renderização condicional baseada em API
- [x] Persistência de IDs de tarefa/visita
- [x] PATCH endpoint aceita `tarefasSugeridasIA`
- [x] **BUG CORRIGIDO**: Endpoint agora guarda o campo
- [x] Frontend lê estado da API (não só memória)
- [x] Testes de reload verificados
- [x] Data-testids completos

---

## 🚀 Próximos Passos (Recomendado)

1. **Deploy para Produção**
   - Fazer commit com mensagem: "FASE 20-21: Unified visit status + persistent AI suggestions"
   - Teste em produção com dados reais
   
2. **Possíveis Melhorias Futuras** (FASE 22+)
   - Sincronização em tempo real de estado de sugestões
   - Histórico de mudanças de estado de visita
   - Notificações quando sugestão é convertida em tarefa/visita
   - Bulk actions para múltiplas sugestões

---

## 📞 Notas Técnicas

### Arquitetura da Solução

```
FASE 20 (Unified Status):
├─ UpdateVisitStatusDialog (novo componente)
├─ VisitaDetail (renderiza 4 estados)
└─ PATCH /api/visitas/:id (sem alterações backend)

FASE 21 (Persistent Suggestions):
├─ Frontend: Renderização condicional (tarefa.tarefaId ?)
├─ Backend: PATCH aceita tarefasSugeridasIA ✅ FIXED
└─ Flow: Create → PATCH com ID → Reload → Persistência ✓
```

### Garantias de Qualidade

- ✅ RBAC mantido em todas as operações
- ✅ Nenhum dado apagado acidentalmente
- ✅ Validações Zod mantidas
- ✅ Sem regressões conhecidas
- ✅ Mobile-first verificado
- ✅ Dark mode compatível

---

**Relatório Preparado em:** 24 de Novembro de 2025  
**Status Final:** ✅ PRONTO PARA PRODUÇÃO  
**Versão:** 1.0
