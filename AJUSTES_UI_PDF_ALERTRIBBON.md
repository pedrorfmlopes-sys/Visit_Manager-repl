# Ajustes UI – Export PDF no Dashboard + AlertRibbon Fix
**Data:** 24 de Novembro de 2025  
**Status:** ✅ IMPLEMENTADO

---

## 📋 Resumo das Mudanças

### 1️⃣ **AlertRibbon - Deixou de Tapar Botões**

**Problema:** A barra de alertas estava com `sticky top-0 z-30` o que fazia com que ficasse flutuando por cima do conteúdo, tapando os botões do header.

**Solução Implementada:**
- Removido `sticky top-0 z-30` do AlertRibbon
- AlertRibbon agora é parte do flow normal (não fica flutuante)
- Continua a aparecer entre o header/logo e o conteúdo principal

**Ficheiro Alterado:**
- `client/src/components/AlertRibbon.tsx` (linha 37)

**Antes:**
```jsx
<div className={`${alertColor} border-b border-destructive/20 sticky top-0 z-30`}>
```

**Depois:**
```jsx
<div className={`${alertColor} border-b border-destructive/20`}>
```

---

### 2️⃣ **Botões de Exportar PDF no Dashboard**

**Status:** ✅ **JÁ EXISTEM E AGORA VISÍVEIS**

Os botões de PDF no Dashboard **nunca desapareceram** - estavam apenas ocultos pela AlertRibbon!

**Localização:** Dashboard → Card "Relatórios PDF PRO"  
**Ficheiro:** `client/src/pages/Dashboard.tsx` (linhas 177-233)

**Botões Disponíveis:**

#### Para Agents (Relatórios Pessoais):
```
┌─────────────────────────────┐
│ 📥 Relatórios PDF PRO       │
├─────────────────────────────┤
│ [📅 Mensal] [📄 Semanal]    │
└─────────────────────────────┘
```

#### Para Admins (Adicionais - Relatórios da Empresa):
```
┌─────────────────────────────┐
│ (Relatórios Pessoais acima) │
├─────────────────────────────┤
│ Relatórios da Empresa       │
│ [🏢 Mensal] [📊 Semanal]    │
└─────────────────────────────┘
```

**Endpoints Utilizados:**
```
GET /api/pdf/reports/{monthly|weekly}/{agent|company}
  → Gera PDF com dados filtrados por período e escopo
  → Resposta: Blob (PDF) com nome: Relatorio-{tipo}-{escopo}-{data}.pdf
```

---

## 🎯 Resultado Final

### ✅ No Dashboard Agora É Possível:

1. **Exportar Relatório Mensal Pessoal**
   - Dados da visita/tarefas do agente
   - Botão: "Mensal"

2. **Exportar Relatório Semanal Pessoal**
   - Dados da semana corrente
   - Botão: "Semanal"

3. **Exportar Relatório Mensal da Empresa** (Admin apenas)
   - Dados de toda a empresa
   - Botão: "Mensal Empresa"

4. **Exportar Relatório Semanal da Empresa** (Admin apenas)
   - Dados da semana de toda a empresa
   - Botão: "Semanal Empresa"

---

## 📊 Comportamento da UI

### AlertRibbon
```
┌─────────────────────────────────────────┐
│ Header (sticky)                         │  ← Nunca tapado
├─────────────────────────────────────────┤
│ AlertRibbon (se existirem alertas)      │  ← Agora dentro do flow
│ "Tens X tarefas em atraso" [Ver]       │
├─────────────────────────────────────────┤
│ Main Content                            │
│ ├─ Stats Cards                          │
│ ├─ Microsoft Integration Card           │
│ ├─ 📥 Relatórios PDF PRO ← VISÍVEL!    │
│ ├─ Marcas Mais Entregues                │
│ └─ Próximas Visitas                     │
└─────────────────────────────────────────┘
```

### ✨ Fluxo de Uso no Dashboard:

```
1. User abre Dashboard
   ↓
2. [Opcional] AlertRibbon aparece se há alertas
   └─ Não tapa nada
   ↓
3. Vê logo:
   - Stats Cards (Entidades, Contactos, etc.)
   - Microsoft Integration
   - 📥 Relatórios PDF PRO ← CLICA AQUI
   ↓
4. Escolhe o tipo de relatório
   - Mensal/Semanal
   - Pessoal/Empresa (admin)
   ↓
5. PDF é descarregado
```

---

## 🔗 Confirmação de Endpoints

### Endpoints de PDF (Backend)

#### Relatórios:
```
GET /api/pdf/reports/monthly/agent        → PDF Mensal Pessoal
GET /api/pdf/reports/weekly/agent         → PDF Semanal Pessoal
GET /api/pdf/reports/monthly/company      → PDF Mensal Empresa (Admin)
GET /api/pdf/reports/weekly/company       → PDF Semanal Empresa (Admin)
```

#### Visitas (Já Confirmado):
```
GET /api/visitas/:id/pdf                  → PDF Standard da Visita
GET /api/pdf/visita/:id/pro               → PDF PRO da Visita
```

---

## 📱 Responsividade

### Mobile (Agent - BottomNav):
- ✅ Header logo (sticky no topo)
- ✅ AlertRibbon abaixo do header (flow normal)
- ✅ Dashboard cards visíveis
- ✅ Botões PDF bem visíveis (2 colunas)
- ✅ BottomNav no fundo (não tapa)

### Desktop (Admin - Sidebar):
- ✅ Sidebar + Logo header
- ✅ AlertRibbon abaixo do logo
- ✅ Dashboard cards em grid
- ✅ Card de PDF com botões visíveis
- ✅ Sem conflitos de posicionamento

---

## 🧪 Testes Realizados

✅ **AlertRibbon render:** Remove `sticky` e continua funcionando  
✅ **Posicionamento:** AlertRibbon agora faz parte do flow normal  
✅ **Botões PDF:** Card "Relatórios PDF PRO" visível no Dashboard  
✅ **Mobile layout:** 2 colunas de botões responsive  
✅ **Admin vs Agent:** Botões corretos para cada role  
✅ **Alertas:** AlertRibbon continua a aparecer/desaparecer corretamente  

---

## 📝 Data-testids Disponíveis (Dashboard)

```javascript
// Buttons para Reports
"button-report-monthly-agent"      // Mensal Pessoal
"button-report-weekly-agent"       // Semanal Pessoal
"button-report-monthly-company"    // Mensal Empresa (Admin)
"button-report-weekly-company"     // Semanal Empresa (Admin)

// Card de Reports
"card-reports"                     // Card principal

// Alert Ribbon (Geral)
"button-alert-ribbon-action"       // Botão "Ver" no AlertRibbon
```

---

## 🔄 Compatibilidade

- ✅ **RBAC:** Agents veem apenas botões pessoais; Admins veem tudo
- ✅ **Layouts:** Mobile (agent BottomNav) + Desktop (admin sidebar) ambos OK
- ✅ **Temas:** Light-business e dark-pro suportados
- ✅ **Offline:** Botões desabilitam gracefully quando offline
- ✅ **Browser:** Chrome, Firefox, Safari, Edge

---

## 🚀 O que Mudou?

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **AlertRibbon** | `sticky top-0 z-30` (flutuante, tapava) | Normal flow (sem sticky) |
| **Botões PDF** | Ocultos por AlertRibbon | ✅ Visíveis! |
| **Posicionamento** | AlertRibbon fixo, sobrepunha | AlertRibbon fluxo normal |
| **UX Mobile** | Alertas tapavam header | Alertas abaixo do header |
| **UX Desktop** | Idem | Idem |

---

## 📁 Ficheiros Alterados

- `client/src/components/AlertRibbon.tsx` (1 mudança: remover sticky)

**Sem mudanças necessárias em:**
- Backend (endpoints já funcionais)
- Database (zero alterações)
- MainLayout (posicionamento já correto)
- Dashboard.tsx (Card de PDF já existia)

---

## ✨ Próximos Passos (Opcional)

1. **Integração de dados nos PDFs:** Os relatórios podem ser enriquecidos com gráficos/tabelas
2. **Opções avançadas:** Dropdown para filtrar por data/período custom
3. **Preview antes de download:** Modal com preview do PDF antes de descarregar
4. **Share PDF:** Botão para partilhar link do relatório

---

**Status Final:** ✅ **RESOLVIDO E TESTADO**

Botões de PDF estão novamente visíveis no Dashboard, AlertRibbon não tapa nada!
