# 🔗 RELATÓRIO PASSO 3 - Ligação de Filtros a uiSettings.visitas

**Data**: 24 Novembro 2025  
**Status**: ✅ **IMPLEMENTADO E COMPILADO COM SUCESSO**  
**Objetivo**: Condicionar visibilidade dos filtros de Visitas baseado em `uiSettings.visitas`

---

## 📋 RESUMO EXECUTIVO

**PROBLEMA ANTERIOR**: Os filtros apareciam sempre, independentemente das configurações em AdminEmpresa.

**SOLUÇÃO IMPLEMENTADA**: Sistema de flags em `uiSettings.visitas` que controla a visibilidade de cada filtro:
- ✅ `enableFilterDateQuick` - Filtros de data (Hoje, Semana, 30 dias)
- ✅ `enableFilterHasAudio` - Filtro "Com áudio por transcrever"
- ✅ `enableFilterEntidade` - Filtro de Entidade
- ✅ `enableFilterContacto` - Filtro de Contacto
- ✅ `enableFilterUser` - Filtro de Utilizador (admin)
- ✅ `enableFilterMarca` - Filtro de Marca (admin)

**Resultado**: Filtros aparecem/desaparecem dinamicamente conforme settings da empresa.

---

## 🔧 MUDANÇAS IMPLEMENTADAS

### MUDANÇA 1: Backend - Incluir uiSettings em /api/auth/user

**Ficheiro**: `server/routes.ts` (linhas 295-324)

**Problema**: O endpoint `/api/auth/user` retornava `empresa` MAS sem `uiSettings`

**Solução**:
```typescript
// ANTES (linha 310-314):
empresa: empresa ? {
  id: empresa.id,
  nome: empresa.nome,
  logoUrl: empresa.logoUrl,
  mostrarMarcasEmVisitas: empresa.mostrarMarcasEmVisitas,
  theme: empresa.theme,
  // ❌ NÃO TINHA uiSettings
} : null,

// DEPOIS (linha 310-318):
empresa: empresa ? {
  id: empresa.id,
  nome: empresa.nome,
  logoUrl: empresa.logoUrl,
  mostrarMarcasEmVisitas: empresa.mostrarMarcasEmVisitas,
  theme: empresa.theme,
  uiSettings: empresa.uiSettings,  // ✅ ADICIONADO
} : null,
```

**Impacto**: `uiSettings` agora disponível no frontend via `useAuth()`

---

### MUDANÇA 2: Frontend - TypeScript Interface

**Ficheiro**: `client/src/hooks/useAuth.ts` (linhas 6-24)

**Problema**: Interface `AuthUser.empresa` não tinha `uiSettings`

**Solução**:
```typescript
// ANTES:
export interface AuthUser extends User {
  empresa?: {
    id: string;
    nome: string;
    logoUrl?: string;
    mostrarMarcasEmVisitas: boolean;
    theme?: "light-business" | "dark-pro";
    // ❌ NÃO TINHA AQUI
  } | null;
}

// DEPOIS:
export interface AuthUser extends User {
  empresa?: {
    id: string;
    nome: string;
    logoUrl?: string;
    mostrarMarcasEmVisitas: boolean;
    theme?: "light-business" | "dark-pro";
    uiSettings?: {  // ✅ ADICIONADO
      visitas?: {
        enableFilterDateQuick?: boolean;
        enableFilterUser?: boolean;
        enableFilterMarca?: boolean;
        enableFilterEntidade?: boolean;
        enableFilterContacto?: boolean;
        enableFilterHasAudio?: boolean;
      };
    };
  } | null;
}
```

**Impacto**: TypeScript agora reconhece `empresa.uiSettings` em toda a app

---

### MUDANÇA 3: Agent Page - Obter e Passar Settings

**Ficheiro**: `client/src/pages/Visitas.tsx` (linhas 1-70)

**Problema**: Visitas.tsx não passava settings para VisitasFilterBar

**Solução - Parte A (Linha 9)**: Adicionar import e hook
```typescript
// ✅ ADICIONADO:
import { useAuth } from "@/hooks/useAuth";
```

**Solução - Parte B (Linha 14)**: Obter empresa
```typescript
// ✅ ADICIONADO:
const { empresa } = useAuth();
```

**Solução - Parte C (Linha 69)**: Passar settings como prop
```typescript
// ANTES:
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  entidades={entidades}
  contactos={contactos}
  // ❌ NÃO TINHA visitasSettings
/>

// DEPOIS:
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  entidades={entidades}
  contactos={contactos}
  visitasSettings={empresa?.uiSettings?.visitas}  // ✅ ADICIONADO
/>
```

**Fluxo**: `empresa` → `uiSettings` → `visitas` → `VisitasFilterBar`

---

### MUDANÇA 4: Admin Page - Passar Settings

**Ficheiro**: `client/src/pages/AdminVisitas.tsx` (linhas 87-96)

**Problema**: AdminVisitas.tsx não passava settings para VisitasFilterBar

**Solução**: Adicionar prop (AdminVisitas já tinha `{ empresa }` de `useAuth()`)
```typescript
// ANTES:
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  showAdminFilters={true}
  users={users}
  marcas={empresa?.mostrarMarcasEmVisitas ? marcas : []}
  entidades={entidades}
  contactos={contactos}
  // ❌ NÃO TINHA visitasSettings
/>

// DEPOIS:
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  showAdminFilters={true}
  users={users}
  marcas={empresa?.mostrarMarcasEmVisitas ? marcas : []}
  entidades={entidades}
  contactos={contactos}
  visitasSettings={empresa?.uiSettings?.visitas}  // ✅ ADICIONADO
/>
```

**Impacto**: AdminVisitas também respeita `uiSettings.visitas`

---

### MUDANÇA 5: Component - Condicionar Renderização

**Ficheiro**: `client/src/components/VisitasFilterBar.tsx` (linhas 22-247)

**Problema**: Componente renderizava TODOS os filtros sem verificar settings

#### 5.1 - Adicionar Prop (Linhas 30-37)
```typescript
interface VisitasFilterBarProps {
  filters: VisitasFilters;
  onFilterChange: (filters: VisitasFilters) => void;
  showAdminFilters?: boolean;
  users?: { id: string; email: string }[];
  marcas?: { id: string; nome: string }[];
  entidades?: { id: string; nome: string }[];
  contactos?: { id: string; nome: string }[];
  visitasSettings?: {  // ✅ ADICIONADO
    enableFilterDateQuick?: boolean;
    enableFilterUser?: boolean;
    enableFilterMarca?: boolean;
    enableFilterEntidade?: boolean;
    enableFilterContacto?: boolean;
    enableFilterHasAudio?: boolean;
  };
}
```

#### 5.2 - Receber Prop e Definir Defaults (Linhas 40-58)
```typescript
export function VisitasFilterBar({
  filters,
  onFilterChange,
  showAdminFilters = false,
  users = [],
  marcas = [],
  entidades = [],
  contactos = [],
  visitasSettings,  // ✅ ADICIONADO
}: VisitasFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // ✅ ADICIONADO - Settings com safe defaults (true = mostrar por defeito)
  const showDateQuick = visitasSettings?.enableFilterDateQuick ?? true;
  const showUser = visitasSettings?.enableFilterUser ?? true;
  const showMarca = visitasSettings?.enableFilterMarca ?? true;
  const showEntidade = visitasSettings?.enableFilterEntidade ?? true;
  const showContacto = visitasSettings?.enableFilterContacto ?? true;
  const showHasAudio = visitasSettings?.enableFilterHasAudio ?? true;
```

**Defaults**: Todos `true` para retro-compatibilidade (se não tiver settings, mostra tudo)

#### 5.3 - Condicionar Quick Date Filters (Linhas 90-140)
```typescript
// ANTES:
<div className="flex gap-2 flex-wrap">
  {/* Botões de data */}
</div>

// DEPOIS:
{showDateQuick && (
  <div className="flex gap-2 flex-wrap">
    {/* Botões de data */}
  </div>
)}
```

#### 5.4 - Condicionar Audio Filter (Linhas 143-162)
```typescript
// ANTES:
<div className="flex items-center gap-2">
  {/* Checkbox áudio */}
</div>

// DEPOIS:
{showHasAudio && (
  <div className="flex items-center gap-2">
    {/* Checkbox áudio */}
  </div>
)}
```

#### 5.5 - Condicionar Entidade/Contacto (Linhas 165-203)
```typescript
// ANTES:
<div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
  {entidades.length > 0 && (
    <select>...</select>
  )}
  {contactos.length > 0 && (
    <select>...</select>
  )}
</div>

// DEPOIS:
{(showEntidade || showContacto) && (
  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
    {showEntidade && entidades.length > 0 && (
      <select>...</select>
    )}
    {showContacto && contactos.length > 0 && (
      <select>...</select>
    )}
  </div>
)}
```

#### 5.6 - Condicionar Admin Filters (Linhas 206-244)
```typescript
// ANTES:
{showAdminFilters && (
  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
    {users.length > 0 && (
      <select>...</select>
    )}
    {marcas.length > 0 && (
      <select>...</select>
    )}
  </div>
)}

// DEPOIS:
{showAdminFilters && (showUser || showMarca) && (
  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
    {showUser && users.length > 0 && (
      <select>...</select>
    )}
    {showMarca && marcas.length > 0 && (
      <select>...</select>
    )}
  </div>
)}
```

---

## 🧪 TESTES PROPOSTOS

### Teste 1: Estado Inicial - Todos Habilitados

**Setup**: Empresa com uiSettings padrão (tudo true)

**Passos**:
1. Open /visitas como agent
2. Verificar: Aparecem todos os filtros
   - Data (Hoje, Semana, 30 dias, Tudo)
   - Com áudio por transcrever
   - Entidade
   - Contacto

**Esperado**: ✅ Todos visíveis

---

### Teste 2: Desabilitar Entidade

**Setup**: Go to /admin/empresa → tab "Filtros" → "Visitas"

**Passos**:
1. Desmarcar: "Filtro por Entidade"
2. Guardar configurações
3. Open /visitas como agent
4. Verificar UI

**Esperado**: ✅ Select de Entidade desaparece, outros filtros permanecem

---

### Teste 3: Desabilitar Contacto

**Passos**:
1. /admin/empresa → tab "Filtros" → "Visitas"
2. Desmarcar: "Filtro por Contacto"
3. Guardar
4. Open /visitas

**Esperado**: ✅ Select de Contacto desaparece

---

### Teste 4: Desabilitar Múltiplos

**Passos**:
1. /admin/empresa → tab "Filtros" → "Visitas"
2. Desmarcar: "Data Rápida", "Entidade", "Contacto", "Áudio"
3. Guardar
4. Open /visitas

**Esperado**: ✅ Só aparecem search + user/marca filters (se admin)

---

### Teste 5: Admin View - Múltiplos

**Passos**:
1. /admin/empresa → tab "Filtros" → "Visitas"
2. Desmarcar: "Utilizador", "Marca"
3. Guardar
4. Open /visitas-admin
5. Verificar UI

**Esperado**: ✅ Filtros admin (user/marca) desaparecem

---

### Teste 6: Reabilitar Tudo

**Passos**:
1. /admin/empresa → tab "Filtros" → "Visitas"
2. Marcar TODOS os switches
3. Guardar
4. Reload /visitas

**Esperado**: ✅ Todos os filtros voltam a aparecer

---

### Teste 7: Filtragem Ainda Funciona

**Passos**:
1. Habilitar entidade + contacto
2. Em /visitas, seleccionar entidade + contacto
3. Verificar: Lista filtra corretamente (AND logic)
4. Desabilitar um dos filtros via /admin/empresa
5. Reload /visitas
6. Tentar seleccionar o filtro escondido

**Esperado**: ✅ Filtro escondido não aparece, filtragem AND ainda funciona com filtros restantes

---

## 📊 FICHEIROS MODIFICADOS

| Ficheiro | Linhas | Mudanças | Status |
|----------|--------|----------|--------|
| routes.ts | 317 | +1 | ✅ uiSettings adicionado |
| useAuth.ts | 13-22 | +10 | ✅ Interface atualizada |
| Visitas.tsx | 9,14,69 | +3 | ✅ Settings passadas |
| AdminVisitas.tsx | 95 | +1 | ✅ Settings passadas |
| VisitasFilterBar.tsx | 22-244 | +80 | ✅ Condicionamento completo |

**Total**: 95 linhas de código adicionadas/modificadas

---

## 🔍 ESTRUTURA DE DADOS

### Flow Completo

```
DATABASE (empresas.uiSettings.visitas)
│
├── enableFilterDateQuick: boolean
├── enableFilterUser: boolean
├── enableFilterMarca: boolean
├── enableFilterEntidade: boolean
├── enableFilterContacto: boolean
└── enableFilterHasAudio: boolean

        ↓ Carregado via

API /api/auth/user
│
└── empresa: {
    id, nome, logoUrl, mostrarMarcasEmVisitas, theme,
    uiSettings: { visitas: { ... } }  ← Novo!
}

        ↓ Obtido via

useAuth() hook
│
└── { user, empresa: { uiSettings: { visitas } } }

        ↓ Passado para

Visitas.tsx (agent)
AdminVisitas.tsx (admin)
│
└── <VisitasFilterBar visitasSettings={empresa?.uiSettings?.visitas} />

        ↓ Utilizado em

VisitasFilterBar.tsx
│
├── const showDateQuick = visitasSettings?.enableFilterDateQuick ?? true
├── const showUser = visitasSettings?.enableFilterUser ?? true
├── const showMarca = visitasSettings?.enableFilterMarca ?? true
├── const showEntidade = visitasSettings?.enableFilterEntidade ?? true
├── const showContacto = visitasSettings?.enableFilterContacto ?? true
└── const showHasAudio = visitasSettings?.enableFilterHasAudio ?? true

        ↓ Condiciona renderização

{showDateQuick && <BotoesData />}
{showHasAudio && <CheckboxAudio />}
{showEntidade && <SelectEntidade />}
{showContacto && <SelectContacto />}
{showUser && <SelectUser />}
{showMarca && <SelectMarca />}
```

---

## ✅ CHECKLIST IMPLEMENTAÇÃO

- [x] Atualizar routes.ts para incluir uiSettings
- [x] Atualizar useAuth.ts interface
- [x] Visitas.tsx obter settings via useAuth()
- [x] Visitas.tsx passar settings para FilterBar
- [x] AdminVisitas.tsx passar settings para FilterBar
- [x] VisitasFilterBar adicionar prop visitasSettings
- [x] VisitasFilterBar definir defaults seguros
- [x] VisitasFilterBar condicionar Quick Date Filters
- [x] VisitasFilterBar condicionar Audio Filter
- [x] VisitasFilterBar condicionar Entidade/Contacto
- [x] VisitasFilterBar condicionar Admin Filters (User/Marca)
- [x] App compilou sem erros
- [x] Hot reload funcionando

---

## 🚀 APP STATUS

✅ **Compilação**: Sucesso
✅ **Hot Reload**: Funcionando
✅ **Prop Types**: Corretos
✅ **Defaults**: Seguros (backward compatible)
✅ **UI Condicional**: Implementada em 6 blocos

---

## 📝 PRÓXIMA AÇÃO

**Recomendado**: Executar os 7 testes acima para validar a implementação

**Testes podem ser feitos via UI manual ou automático**

---

## 🎯 RESUMO TÉCNICO

### O que Mudou?

1. **Backend**: API retorna `uiSettings` agora
2. **Frontend TypeScript**: Interface reconhece `uiSettings.visitas`
3. **Pages**: Visitas + AdminVisitas obtêm e passam settings
4. **FilterBar**: Renderização condicional de 6 grupos de filtros

### Como Funciona?

1. Admin ativa/desativa filtros em AdminEmpresa
2. Settings salvos em DB (empresas.uiSettings.visitas)
3. Frontend carrega settings via `/api/auth/user`
4. VisitasFilterBar recebe settings como prop
5. Cada filtro renderizado apenas se `enableFilterX === true`

### Retro-compatibilidade?

✅ **Sim!** Se `visitasSettings` for undefined, defaults são `true` (mostra tudo)

---

## 📚 RECURSOS UTILIZADOS

- `useAuth()` hook
- `uiSettings` do schema.ts
- TypeScript interfaces
- React conditional rendering
- Nullish coalescing (`??`)

