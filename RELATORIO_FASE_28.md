# FASE 28 – Melhorias de UX e Ferramentas de Admin (Onboarding, Activity Log, Debug)

## 🎯 Objetivo
Melhorar a experiência de primeira utilização, dar visibilidade ao histórico de alterações, e fornecer ferramentas de troubleshooting para admins.

---

## ✅ Features Implementadas

### 1️⃣ **Onboarding & Dicas (UX)**

#### Dashboard Tip Card
- **Onde**: Topo do Dashboard, antes dos cards de stats
- **Conteúdo**: "Dica: Aqui encontras um resumo do teu dia. Usa os filtros e os relatórios PDF/PRO para acompanhar o teu desempenho."
- **UI**: Card azul não-intrusivo com ícone Lightbulb
- **Ação**: Botão "X" para descartar
- **Persistência**: Guardado em localStorage + userSettings.onboarding.seenDashboardTips
- **Comportamento**: Aparece apenas primeira vez (localStorage check)
- **Handler**: `handleDismissDashboardTip()` - faz PATCH para `/api/user/settings`

#### Future IA Tip (Estrutura Preparada)
- Campo `userSettings.onboarding.seenVisitsTips` já estruturado
- Pronto para implementação em VisitaDetail (FASE 29)

---

### 2️⃣ **Activity Log (Histórico de Alterações)**

#### VisitaDetail - "Histórico desta Visita"
**Card novo** antes dos PDFs:

| Campo | Descrição |
|-------|-----------|
| Criação | "Criada por [userId] em [data]" |
| Follow-ups | "Follow-up de visita anterior" + ID |
| Próxima Visita | "Próxima visita agendada para [data]" |
| Tarefas | Lista compacta: titulo, status (✓/○), vence em |

**Dados usados**: `visita.createdByUserId`, `visitaAnteriorId`, `proximaVisita`, `tarefas[]`

#### TarefaDetail - "Histórico da Tarefa"
**Card novo** antes de Microsoft Planner:

| Campo | Descrição |
|-------|-----------|
| Criação | "Criada por [userId]" |
| Estado | "Estado atual: ✓ Concluída / ○ Pendente" |
| Vencimento | "Vence em [data]" |
| Visita | "Relacionada com uma visita" (se visitaId presente) |

**Dados usados**: `tarefa.createdByUserId`, `status`, `dueDate`, `visitaId`

---

### 3️⃣ **Página de Debug/Admin** (`/admin/debug`)

#### Rota & Segurança
- **Path**: `/admin/debug` (protegida por AdminRoute)
- **RBAC**: `requireAdmin` middleware
- **Acesso**: Apenas admins
- **Agents**: Recebem 404 NotFound

#### Endpoint Backend
**`GET /api/admin/debug`**:

```json
{
  "appVersion": "1.0.0",
  "timestamp": "2025-11-24T10:00:00Z",
  "database": { "ok": true },
  "stats": {
    "usersActive": 3,
    "entidades": 120,
    "contactos": 340,
    "visitasTotal": 1500,
    "visitasLast30Days": 120,
    "tarefasTotal": 300,
    "tarefasAtraso": 25
  },
  "settings": {
    "mostrarGPS": true,
    "ia": {
      "visitSummaryEnabled": true,
      "taskSuggestionsEnabled": true,
      "dashboardInsightsEnabled": true
    }
  },
  "integrations": {
    "microsoft": "não configurado",
    "google": "não configurado"
  }
}
```

#### UI Components
1. **Estado da Aplicação**
   - Versão (badge)
   - Data/hora geração
   - DB status (badge verde/vermelho)

2. **Estatísticas da Empresa**
   - Grid 4-cols: Utilizadores, Entidades, Contactos, Visitas(Total)
   - Grid 3-cols: Visitas(30d), Tarefas(Total), Tarefas em Atraso

3. **Configurações Relevantes**
   - GPS (Ativo/Inativo)
   - IA: Resumo Visitas, Sugestões Tarefas, Dashboard Insights

4. **Integrações**
   - Microsoft (status textual)
   - Google (status textual)

#### Integração com Navegação
- **AdminDashboard**: Novo Card "Ferramentas de Admin" com botão "Debug / Estado da Aplicação"
- **Cor**: Amber (diferenciada das outras seções)
- **Handler**: `onClick={() => setLocation("/admin/debug")}`

---

## 📁 Arquivos Criados/Modificados

### ✨ Novos
- `client/src/pages/AdminDebug.tsx` (270 linhas) - Página de debug UI
- `RELATORIO_FASE_28.md` (este ficheiro) - Documentação

### 📝 Modificados
| Arquivo | Mudanças | Status |
|---------|----------|--------|
| `client/src/App.tsx` | +import AdminDebug, +rota /admin/debug | Editado |
| `client/src/pages/Dashboard.tsx` | +onboarding tip card logic | Editado |
| `client/src/pages/VisitaDetail.tsx` | +Activity Log card | Editado |
| `client/src/pages/TarefaDetail.tsx` | +Activity Log card | Editado |
| `client/src/pages/AdminDashboard.tsx` | +Admin Tools card + link | Editado |
| `server/routes.ts` | +GET /api/admin/debug endpoint (~60 lin) | Editado |
| `replit.md` | +FASE 28 documentation | Atualizado |

---

## 🎯 Fluxos de Teste

### Onboarding Dashboard
1. Limpar localStorage: `localStorage.removeItem("seenDashboardTips")`
2. Entrar no Dashboard
3. ✓ Ver card azul com dica
4. ✓ Clicar "X" - desaparece
5. ✓ Recarregar página - não aparece mais

### Activity Log - VisitaDetail
1. Abrir qualquer visita
2. Scroll até final
3. ✓ Ver card "Histórico desta Visita"
4. ✓ Ver info criação, follow-ups, próxima visita
5. ✓ Ver tarefas relacionadas com status

### Activity Log - TarefaDetail
1. Abrir qualquer tarefa
2. Scroll até Microsoft Planner section
3. ✓ Ver card "Histórico da Tarefa" acima
4. ✓ Ver criação, estado, vencimento

### Debug Page (Admin-only)
1. **Como Admin**:
   - Entrar AdminDashboard
   - ✓ Ver "Ferramentas de Admin" card
   - ✓ Clicar "Debug / Estado da Aplicação"
   - ✓ Ver página com 4 cards: App, Stats, Settings, Integrations
   - ✓ Dados aparecem corretos (users, entities, tasks, etc)
   - ✓ Voltar com botão ← no header

2. **Como Agent**:
   - Tentar acessar `/admin/debug` via URL
   - ✓ Receber 404 NotFound
   - ✓ Não ver link na navegação

---

## 🔐 Segurança & RBAC

| Componente | RBAC | Detalhe |
|-----------|------|---------|
| Onboarding Tip | ✓ Agents+Admins | Aparece para todos |
| Activity Log | ✓ Agents+Admins | Apenas dono/relacionado vê |
| Debug Page | ✓ Admins Only | requireAdmin middleware |
| Debug Endpoint | ✓ Admins Only | requireAdmin middleware |

---

## 📊 Dados Agregados (Debug Endpoint)

**Cálculos**:
- `usersActive`: Contagem via `storage.getUsersByEmpresa(empresaId)`
- `visitasLast30Days`: Filter visitas com `dataVisita >= now()-30d`
- `tarefasAtraso`: Filter tarefas `status='pending' AND dueDate < now()`
- **Settings**: Lê direto do `empresa.uiSettings`

---

## 🎨 Design Decisions

✅ **Onboarding**: Card azul simples, não-modal, dismissível
✅ **Activity Log**: Formato bullet-point, compacto, legível
✅ **Debug**: Grid/cards responsive, badges para status
✅ **Color Coding**: Amber para admin tools (diferenciação)

---

## ✨ Destaques Técnicos

✅ **Performance**:
- Onboarding: localStorage check (sem query)
- Activity Log: Dados já em object (sem fetch extra)
- Debug: Single query aggregation

✅ **UX**:
- Onboarding: Não-intrusivo, dismissível
- Activity Log: Integrado em detail pages
- Debug: Visual feedback (badges, grids)

✅ **Security**:
- Admin-only para debug
- RBAC enforced em rotas
- Sem dados sensíveis expostos

✅ **Maintainability**:
- Estrutura preparada para future IA tips (FASE 29)
- Integrations placeholders prontos para OAuth

---

## 📝 Próximas Fases (Roadmap)

### FASE 29: IA Tips & Advanced Onboarding
- Implementar `seenVisitsTips` em VisitaDetail
- Context-aware tips baseadas em features ativadas

### FASE 30: Enhanced Activity Log
- Tabla audit completa em DB
- Timestamps para cada ação
- User avatars + nomes

### FASE 31: Admin Analytics Dashboard
- Gráficos no /admin/debug
- Trend analysis (30/60/90 dias)
- Alertas automáticos

---

**Status**: ✅ FASE 28 COMPLETA
**Data**: Novembro 24, 2025
**Testes**: ✅ Funcional - Pronto para produção
**RBAC**: ✅ Validado
