# ✅ RELATÓRIO PASSO 4 - Ligação Filtros de TAREFAS a uiSettings.tarefas

**Data**: 24 Novembro 2025  
**Status**: ✅ **IMPLEMENTADO E COMPILADO COM SUCESSO**  
**Objetivo**: Condicionar visibilidade dos filtros de Tarefas baseado em `uiSettings.tarefas`

---

## 📋 RESUMO EXECUTIVO

**Contexto**: PASSO 3 completou a ligação de filtros VISITAS. PASSO 4 aplica o **mesmo padrão** a TAREFAS.

**Resultado**: Filtros de Tarefas agora respeitam `uiSettings.tarefas` da empresa.

**Flags Implementadas**:
- ✅ `enableFilterStatus` - Filtro Status (Todas/Pendentes/Concluídas)
- ✅ `enableFilterOverdue` - Checkbox "Apenas em atraso"
- ✅ `enableFilterAssignedUser` - Filtro "Atribuído a" (admin)
- ✅ `enableFilterEntidade` - Filtro de Entidade (admin)
- ✅ `enableFilterVisita` - (Para futura expansão; não usado ainda em Tarefas)

---

## 🔧 MUDANÇAS IMPLEMENTADAS

### MUDANÇA 1: Tarefas.tsx (Agent Page)

**Ficheiro**: `client/src/pages/Tarefas.tsx`

**O que foi feito**:
1. Adicionar import `useAuth` (linha 9)
2. Obter `empresa` via `useAuth()` (linha 14)
3. Passar `tarefasSettings={empresa?.uiSettings?.tarefas}` ao TarefasFilterBar (linha 45)

**Código**:
```typescript
// ANTES:
import { useLocation } from "wouter";
import { TarefasFilterBar, type TarefasFilters } from "@/components/TarefasFilterBar";
import type { TarefaWithRelations } from "@shared/schema";

export default function Tarefas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<TarefasFilters>({});
  // ... sem useAuth

// DEPOIS:
import { useLocation } from "wouter";
import { TarefasFilterBar, type TarefasFilters } from "@/components/TarefasFilterBar";
import type { TarefaWithRelations } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";  // ✅ NOVO

export default function Tarefas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<TarefasFilters>({});
  const { empresa } = useAuth();  // ✅ NOVO

  // ...
  <TarefasFilterBar 
    filters={filters}
    onFilterChange={setFilters}
    tarefasSettings={empresa?.uiSettings?.tarefas}  // ✅ NOVO
  />
```

---

### MUDANÇA 2: AdminTarefas.tsx (Admin Page)

**Ficheiro**: `client/src/pages/AdminTarefas.tsx`

**O que foi feito**:
1. Adicionar import `useAuth` (linha 9)
2. Obter `empresa` via `useAuth()` (linha 16)
3. Passar `tarefasSettings={empresa?.uiSettings?.tarefas}` ao TarefasFilterBar (linha 76)

**Código**:
```typescript
// ANTES:
export default function AdminTarefas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<TarefasFilters>({});
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [entidades, setEntidades] = useState<{ id: string; nome: string }[]>([]);

  // ... sem useAuth

// DEPOIS:
import { useAuth } from "@/hooks/useAuth";  // ✅ NOVO

export default function AdminTarefas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<TarefasFilters>({});
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [entidades, setEntidades] = useState<{ id: string; nome: string }[]>([]);
  const { empresa } = useAuth();  // ✅ NOVO

  // ...
  <TarefasFilterBar 
    filters={filters}
    onFilterChange={setFilters}
    showAdminFilters={true}
    users={users}
    entidades={entidades}
    tarefasSettings={empresa?.uiSettings?.tarefas}  // ✅ NOVO
  />
```

---

### MUDANÇA 3: TarefasFilterBar.tsx (Component - Interface)

**Ficheiro**: `client/src/components/TarefasFilterBar.tsx`

**O que foi feito**: Adicionar nova prop com tipo correto (linhas 25-31)

**Código**:
```typescript
interface TarefasFilterBarProps {
  filters: TarefasFilters;
  onFilterChange: (filters: TarefasFilters) => void;
  showAdminFilters?: boolean;
  users?: { id: string; email: string }[];
  entidades?: { id: string; nome: string }[];
  tarefasSettings?: {  // ✅ NOVO
    enableFilterStatus?: boolean;
    enableFilterOverdue?: boolean;
    enableFilterAssignedUser?: boolean;
    enableFilterEntidade?: boolean;
    enableFilterVisita?: boolean;
  };
}
```

---

### MUDANÇA 4: TarefasFilterBar.tsx (Component - Defaults)

**Ficheiro**: `client/src/components/TarefasFilterBar.tsx`

**O que foi feito**: Adicionar prop ao destruidor e definir defaults seguros (linhas 40-51)

**Código**:
```typescript
export function TarefasFilterBar({
  filters,
  onFilterChange,
  showAdminFilters = false,
  users = [],
  entidades = [],
  tarefasSettings,  // ✅ NOVO
}: TarefasFilterBarProps) {
  const handleClear = () => {
    onFilterChange({});
  };
  
  // Settings with safe defaults (true = show by default)  ✅ NOVO
  const showStatus = tarefasSettings?.enableFilterStatus ?? true;
  const showOverdue = tarefasSettings?.enableFilterOverdue ?? true;
  const showAssignedUser = tarefasSettings?.enableFilterAssignedUser ?? true;
  const showEntidade = tarefasSettings?.enableFilterEntidade ?? true;
  const showVisita = tarefasSettings?.enableFilterVisita ?? true;
```

---

### MUDANÇA 5: TarefasFilterBar.tsx (Component - Condicionar Status)

**Ficheiro**: `client/src/components/TarefasFilterBar.tsx`

**O que foi feito**: Envolver bloco de Status com condicional `{showStatus && (...)}` (linhas 71-110)

**Antes**:
```typescript
<div className="flex gap-2 flex-wrap">
  <Button ...>Todas</Button>
  <Button ...>Pendentes</Button>
  <Button ...>Concluídas</Button>
  // ...
</div>
```

**Depois**:
```typescript
{showStatus && (
  <div className="flex gap-2 flex-wrap">
    <Button ...>Todas</Button>
    <Button ...>Pendentes</Button>
    <Button ...>Concluídas</Button>
    // ...
  </div>
)}
```

---

### MUDANÇA 6: TarefasFilterBar.tsx (Component - Condicionar Overdue)

**Ficheiro**: `client/src/components/TarefasFilterBar.tsx`

**O que foi feito**: Envolver bloco Overdue com condicional `{showOverdue && (...)}` (linhas 113-132)

**Antes**:
```typescript
<div className="flex items-center gap-2">
  <input type="checkbox" id="overdue-filter" ... />
  <label>Apenas em atraso</label>
</div>
```

**Depois**:
```typescript
{showOverdue && (
  <div className="flex items-center gap-2">
    <input type="checkbox" id="overdue-filter" ... />
    <label>Apenas em atraso</label>
  </div>
)}
```

---

### MUDANÇA 7: TarefasFilterBar.tsx (Component - Condicionar Admin Filters)

**Ficheiro**: `client/src/components/TarefasFilterBar.tsx`

**O que foi feito**: Condicionar User + Entidade selects com `{showAdminFilters && (showAssignedUser || showEntidade) && (...)}` (linhas 135-173)

**Antes**:
```typescript
{showAdminFilters && (
  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
    {users.length > 0 && (
      <select>...</select>
    )}
    {entidades.length > 0 && (
      <select>...</select>
    )}
  </div>
)}
```

**Depois**:
```typescript
{showAdminFilters && (showAssignedUser || showEntidade) && (
  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
    {showAssignedUser && users.length > 0 && (
      <select>...</select>
    )}
    {showEntidade && entidades.length > 0 && (
      <select>...</select>
    )}
  </div>
)}
```

---

## 🧪 5 TESTES PROPOSTOS

### Teste 1 – Status

**Setup**: 
1. Go to `/admin/empresa` → tab "Filtros" → "Tarefas"
2. Desmarcar: "Filtro Status (Todas/Pendentes/Concluídas)"
3. Guardar

**Passos**:
1. Open `/tarefas` como agent
2. Verificar UI

**Esperado**: ✅ Botões "Todas/Pendentes/Concluídas" desaparecem

---

### Teste 2 – Em atraso

**Setup**:
1. Voltar a marcar "Filtro Status"
2. Desmarcar "Filtro Apenas em atraso"
3. Guardar

**Passos**:
1. Reload `/tarefas`

**Esperado**: ✅ Checkbox "Apenas em atraso" desaparece

---

### Teste 3 – Atribuído a (Admin)

**Setup**:
1. Desmarcar "Filtro Atribuído a"
2. Guardar

**Passos**:
1. Open `/tarefas-admin` (AdminTarefas) ou `/tarefas` via admin view
2. Verificar filtros admin

**Esperado**: ✅ Select "Todos os utilizadores" desaparece

---

### Teste 4 – Entidade (Admin)

**Setup**:
1. Desmarcar "Filtro por Entidade"
2. Guardar

**Passos**:
1. Reload view admin de tarefas

**Esperado**: ✅ Select de "Todas as entidades" desaparece

---

### Teste 5 – Reabilitar Tudo

**Setup**:
1. Marcar TODOS os switches em "Filtros → Tarefas"
2. Guardar

**Passos**:
1. Reload `/tarefas` (agent e admin)

**Esperado**: ✅ Todos os filtros voltam a aparecer e funcionam normalmente

---

## 📊 FICHEIROS MODIFICADOS

| Ficheiro | Linhas | Mudanças | Status |
|----------|--------|----------|--------|
| Tarefas.tsx | 9, 14, 45 | +3 | ✅ |
| AdminTarefas.tsx | 9, 16, 76 | +3 | ✅ |
| TarefasFilterBar.tsx | 25-31, 40-51, 71-110, 113-132, 135-173 | +60 | ✅ |

**Total**: 66 linhas modificadas/adicionadas

---

## ✅ ESTRUTURA DE DADOS

### uiSettings.tarefas (em DB)
```json
{
  "enableFilterStatus": true,
  "enableFilterOverdue": true,
  "enableFilterAssignedUser": true,
  "enableFilterEntidade": true,
  "enableFilterVisita": true
}
```

### Flow Completo
```
DB: empresas.uiSettings.tarefas
   ↓
API /api/auth/user retorna empresa.uiSettings
   ↓
useAuth() em Tarefas.tsx / AdminTarefas.tsx
   ↓
Passa tarefasSettings para TarefasFilterBar
   ↓
TarefasFilterBar renderiza blocos condicionalmente
```

---

## 🎯 PADRÃO REPLICADO

**PASSO 3 (Visitas)** → **PASSO 4 (Tarefas)**

Mesma estrutura:
1. ✅ Backend: uiSettings incluído em `/api/auth/user`
2. ✅ TypeScript: Interface com flags
3. ✅ Pages: Obter settings via `useAuth()`
4. ✅ Component: Aceitar prop e condicionar renderização

---

## ✅ COMPILAÇÃO & STATUS

| Item | Status |
|------|--------|
| Tarefas.tsx | ✅ Compilado |
| AdminTarefas.tsx | ✅ Compilado |
| TarefasFilterBar.tsx | ✅ Compilado |
| Hot Reload | ✅ Funcionando |
| Defaults | ✅ Seguros (backward compatible) |
| Retro-compatibilidade | ✅ Sim |

---

## 📝 PRÓXIMAS AÇÕES (Recomendadas)

1. **Testes manuais**: Executar os 5 testes acima
2. **Validação**: Confirmar filtros aparecem/desaparecem conforme settings
3. **Documentação**: Atualizar `replit.md` com FASE 29 PASSO 4 concluído

---

## 🎉 RESUMO

✅ PASSO 4 concluído com sucesso  
✅ Filtros de Tarefas respeitam `uiSettings.tarefas`  
✅ Mesmo padrão de Visitas aplicado  
✅ 66 linhas adicionadas/modificadas  
✅ App compilou e hot reload funcionando  

**Pronto para testar!**

