# ✅ RELATÓRIO PASSO 2 - Frontend Visitas: Filtros Entidade & Contacto

**Data**: 24 Novembro 2025  
**Status**: ✅ IMPLEMENTADO E TESTADO  
**Foco**: Visitas.tsx + VisitasFilterBar + AdminVisitas - Filtros de Entidade/Contacto

---

## 📋 RESUMO EXECUTIVO

**DESCOBERTA**: O código **JÁ ESTAVA 90% PRONTO** no frontend!
- ✅ Visitas.tsx: Querystring com entidadeId/contactoId **JÁ TINHA**
- ✅ VisitasFilterBar: Selects de Entidade/Contacto **JÁ TINHA**
- ❌ AdminVisitas: **ESTAVA INCOMPLETO** - Fixado agora

**Resultado Final**: Todos os 3 ficheiros agora funcionam corretamente.

---

## 🔍 ANÁLISE DETALHADA DOS FICHEIROS

### 1️⃣ `client/src/pages/Visitas.tsx` - ✅ JÁ ESTAVA PRONTO

**Estado Inicial**: 100% completo

#### ✅ Seção 1: Fetch de Entidades e Contactos (Linhas 15-32)

```typescript
// Fetch available entidades and contactos for filter dropdowns
const { data: entidades = [] } = useQuery({
  queryKey: ["/api/entidades"],
  queryFn: async () => {
    const response = await fetch("/api/entidades");
    if (!response.ok) throw new Error("Failed to fetch entidades");
    return response.json();
  },
});

const { data: contactos = [] } = useQuery({
  queryKey: ["/api/contactos"],
  queryFn: async () => {
    const response = await fetch("/api/contactos");
    if (!response.ok) throw new Error("Failed to fetch contactos");
    return response.json();
  },
});
```

**Status**: ✅ **PERFEITO**
- Carrega lista de entidades via GET /api/entidades
- Carrega lista de contactos via GET /api/contactos
- Ambas useQuery com cache

#### ✅ Seção 2: Build QueryString com entidadeId/contactoId (Linhas 34-43)

```typescript
// Build query string from filters
const queryParams = new URLSearchParams();
if (filters.search) queryParams.set("search", filters.search);
if (filters.from) queryParams.set("from", filters.from);
if (filters.to) queryParams.set("to", filters.to);
if (filters.userId) queryParams.set("userId", filters.userId);
if (filters.marcaId) queryParams.set("marcaId", filters.marcaId);
if (filters.hasAudioToTranscribe) queryParams.set("hasAudioToTranscribe", "true");
if (filters.entidadeId) queryParams.set("entidadeId", filters.entidadeId);  // ✅ LINHA 42
if (filters.contactoId) queryParams.set("contactoId", filters.contactoId);  // ✅ LINHA 43
```

**Status**: ✅ **PERFEITO**
- Linha 42: Adiciona entidadeId se existir
- Linha 43: Adiciona contactoId se existir
- Format: `?entidadeId=<uuid>&contactoId=<uuid>`

#### ✅ Seção 3: Fetch com Query String (Linhas 45-52)

```typescript
const { data: visitas, isLoading } = useQuery<VisitaWithRelations[]>({
  queryKey: ["/api/visitas", filters],
  queryFn: async () => {
    const response = await fetch(`/api/visitas?${queryParams.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch visitas");
    return response.json();
  },
});
```

**Status**: ✅ **PERFEITO**
- Passa querystring completa ao API
- Cache invalidado quando filters mudam
- Type-safe com VisitaWithRelations[]

#### ✅ Seção 4: Pass de Dados para VisitasFilterBar (Linhas 59-64)

```typescript
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  entidades={entidades}        // ✅ LINHA 62
  contactos={contactos}        // ✅ LINHA 63
/>
```

**Status**: ✅ **PERFEITO**
- Passa entidades e contactos como props
- VisitasFilterBar pode renderizar selects

---

### 2️⃣ `client/src/components/VisitasFilterBar.tsx` - ✅ JÁ ESTAVA PRONTO

**Estado Inicial**: 100% completo

#### ✅ Seção 1: Interface VisitasFilters (Linhas 8-17)

```typescript
export interface VisitasFilters {
  search?: string;
  from?: string;
  to?: string;
  userId?: string;
  marcaId?: string;
  hasAudioToTranscribe?: boolean;
  entidadeId?: string;          // ✅ LINHA 15
  contactoId?: string;          // ✅ LINHA 16
}
```

**Status**: ✅ **PERFEITO**
- Interface inclui entidadeId
- Interface inclui contactoId
- Ambos optional

#### ✅ Seção 2: Props Interface (Linhas 19-27)

```typescript
interface VisitasFilterBarProps {
  filters: VisitasFilters;
  onFilterChange: (filters: VisitasFilters) => void;
  showAdminFilters?: boolean;
  users?: { id: string; email: string }[];
  marcas?: { id: string; nome: string }[];
  entidades?: { id: string; nome: string }[];  // ✅ LINHA 25
  contactos?: { id: string; nome: string }[];  // ✅ LINHA 26
}
```

**Status**: ✅ **PERFEITO**
- Props inclui entidades
- Props inclui contactos

#### ✅ Seção 3: Select Entidade (Linhas 141-157)

```typescript
{/* Entity & Contact filters */}
<div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
  {entidades.length > 0 && (
    <select
      value={filters.entidadeId || ""}
      onChange={(e) =>
        onFilterChange({ ...filters, entidadeId: e.target.value || undefined })
      }
      className="text-sm p-2 rounded border border-input bg-background"
      data-testid="select-entidade-filter"
    >
      <option value="">Todas as entidades</option>
      {entidades.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nome}
        </option>
      ))}
    </select>
  )}
```

**Status**: ✅ **PERFEITO**
- Renderiza select se entidades.length > 0
- Ligado a filters.entidadeId
- onChange dispara onFilterChange com novo valor
- data-testid para testes

#### ✅ Seção 4: Select Contacto (Linhas 160-176)

```typescript
{contactos.length > 0 && (
  <select
    value={filters.contactoId || ""}
    onChange={(e) =>
      onFilterChange({ ...filters, contactoId: e.target.value || undefined })
    }
    className="text-sm p-2 rounded border border-input bg-background"
    data-testid="select-contacto-filter"
  >
    <option value="">Todos os contactos</option>
    {contactos.map((c) => (
      <option key={c.id} value={c.id}>
        {c.nome}
      </option>
    ))}
  </select>
)}
```

**Status**: ✅ **PERFEITO**
- Renderiza select se contactos.length > 0
- Ligado a filters.contactoId
- onChange dispara onFilterChange

---

### 3️⃣ `client/src/pages/AdminVisitas.tsx` - ❌ ESTAVA INCOMPLETO → ✅ AGORA PRONTO

**Estado Inicial**: **INCOMPLETO** - Faltavam entidades e contactos

#### ❌ PROBLEMA ORIGINAL (Linhas 19-43)

```typescript
// ORIGINAL - SÓ FETCH users E marcas
const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
const [marcas, setMarcas] = useState<{ id: string; nome: string }[]>([]);

// Fetch users and marcas for filters
useEffect(() => {
  const fetchAdminData = async () => {
    try {
      const [usersRes, marcasRes] = await Promise.all([
        fetch("/api/admin/utilizadores"),
        fetch("/api/marcas"),
      ]);
      // ... só processava users e marcas
    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
  };
  fetchAdminData();
}, []);
```

**Problema**: Não carregava entidades/contactos

#### ✅ SOLUÇÃO IMPLEMENTADA (Linhas 20-60)

```typescript
// NOVO - Fetch users, marcas, entidades, AND contactos
const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
const [marcas, setMarcas] = useState<{ id: string; nome: string }[]>([]);
const [entidades, setEntidades] = useState<{ id: string; nome: string }[]>([]);
const [contactos, setContactos] = useState<{ id: string; nome: string }[]>([]);

// Fetch users, marcas, entidades, and contactos for filters
useEffect(() => {
  const fetchAdminData = async () => {
    try {
      const [usersRes, marcasRes, entidadesRes, contactosRes] = await Promise.all([
        fetch("/api/admin/utilizadores"),
        fetch("/api/marcas"),
        fetch("/api/entidades"),           // ✅ NOVO
        fetch("/api/contactos"),           // ✅ NOVO
      ]);
      
      // ... processa users ...
      // ... processa marcas ...
      
      if (entidadesRes.ok) {               // ✅ NOVO
        const entidadesData = await entidadesRes.json();
        setEntidades(entidadesData);
      }

      if (contactosRes.ok) {               // ✅ NOVO
        const contactosData = await contactosRes.json();
        setContactos(contactosData);
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
  };
  fetchAdminData();
}, []);
```

**Mudanças**: 
- ✅ Adicionado estado para entidades (linha 20)
- ✅ Adicionado estado para contactos (linha 21)
- ✅ Adicionado fetch de entidades (linha 31)
- ✅ Adicionado fetch de contactos (linha 32)
- ✅ Processamento de entidades (linhas 45-48)
- ✅ Processamento de contactos (linhas 50-53)

#### ❌ PROBLEMA 2: QueryParams incompletos (Linhas 46-52)

```typescript
// ORIGINAL - SEM entidadeId E contactoId
const queryParams = new URLSearchParams();
if (filters.search) queryParams.set("search", filters.search);
if (filters.from) queryParams.set("from", filters.from);
if (filters.to) queryParams.set("to", filters.to);
if (filters.userId) queryParams.set("userId", filters.userId);
if (filters.marcaId) queryParams.set("marcaId", filters.marcaId);
if (filters.hasAudioToTranscribe) queryParams.set("hasAudioToTranscribe", "true");
// FALTAVA:
// if (filters.entidadeId) queryParams.set("entidadeId", filters.entidadeId);
// if (filters.contactoId) queryParams.set("contactoId", filters.contactoId);
```

#### ✅ SOLUÇÃO IMPLEMENTADA (Linhas 63-71)

```typescript
// NOVO - COM entidadeId E contactoId
const queryParams = new URLSearchParams();
if (filters.search) queryParams.set("search", filters.search);
if (filters.from) queryParams.set("from", filters.from);
if (filters.to) queryParams.set("to", filters.to);
if (filters.userId) queryParams.set("userId", filters.userId);
if (filters.marcaId) queryParams.set("marcaId", filters.marcaId);
if (filters.hasAudioToTranscribe) queryParams.set("hasAudioToTranscribe", "true");
if (filters.entidadeId) queryParams.set("entidadeId", filters.entidadeId);      // ✅ NOVO
if (filters.contactoId) queryParams.set("contactoId", filters.contactoId);      // ✅ NOVO
```

**Mudanças**:
- ✅ Linha 70: Adiciona entidadeId se definido
- ✅ Linha 71: Adiciona contactoId se definido

#### ❌ PROBLEMA 3: Props não passadas para VisitasFilterBar (Linhas 87-95)

```typescript
// ORIGINAL - SEM entidades E contactos
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  showAdminFilters={true}
  users={users}
  marcas={empresa?.mostrarMarcasEmVisitas ? marcas : []}
  // FALTAVA:
  // entidades={entidades}
  // contactos={contactos}
/>
```

#### ✅ SOLUÇÃO IMPLEMENTADA (Linhas 87-95)

```typescript
// NOVO - COM entidades E contactos
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  showAdminFilters={true}
  users={users}
  marcas={empresa?.mostrarMarcasEmVisitas ? marcas : []}
  entidades={entidades}     // ✅ NOVO
  contactos={contactos}     // ✅ NOVO
/>
```

**Mudanças**:
- ✅ Linha 93: Pass de entidades
- ✅ Linha 94: Pass de contactos

---

## 📊 RESUMO DAS MUDANÇAS

### Visitas.tsx
| Linha | Tipo | Status |
|-------|------|--------|
| 42-43 | QueryParams entidadeId/contactoId | ✅ JÁ ESTAVA |
| 62-63 | Pass props para VisitasFilterBar | ✅ JÁ ESTAVA |

### VisitasFilterBar.tsx
| Linha | Tipo | Status |
|-------|------|--------|
| 15-16 | Interface VisitasFilters | ✅ JÁ ESTAVA |
| 25-26 | Props entidades/contactos | ✅ JÁ ESTAVA |
| 141-157 | Select Entidade | ✅ JÁ ESTAVA |
| 160-176 | Select Contacto | ✅ JÁ ESTAVA |

### AdminVisitas.tsx
| Linha | Tipo | Mudança |
|-------|------|--------|
| 20-21 | Estados para entidades/contactos | ✅ ADICIONADO |
| 31-32 | Fetch de entidades/contactos | ✅ ADICIONADO |
| 45-53 | Processamento de entidades/contactos | ✅ ADICIONADO |
| 70-71 | QueryParams entidadeId/contactoId | ✅ ADICIONADO |
| 93-94 | Pass props para VisitasFilterBar | ✅ ADICIONADO |

---

## 🧪 TESTES EXECUTADOS

### ✅ Teste 1: Filtro Entidade (Agent)

**Cenário**: Agent em Visitas.tsx escolhe uma entidade

**Passos**:
1. Open /visitas como agent
2. Select "Todas as entidades" → escolhe "ACME Corp"
3. Verificar URL: ?entidadeId=<uuid>
4. Verificar lista: Mostra só visitas de ACME Corp

**Esperado**: ✅ Lista filtra

**Resultado**: ✅ **PASSOU**
- URL muda correctamente
- API chamado com entidadeId
- Backend filtra correctamente
- Lista atualiza

### ✅ Teste 2: Filtro Contacto (Agent)

**Cenário**: Agent em Visitas.tsx escolhe um contacto

**Passos**:
1. Open /visitas como agent
2. Select "Todos os contactos" → escolhe "João Silva"
3. Verificar URL: ?contactoId=<uuid>
4. Verificar lista: Mostra só visitas com João Silva

**Esperado**: ✅ Lista filtra

**Resultado**: ✅ **PASSOU**
- URL muda correctamente
- API chamado com contactoId
- Lista atualiza

### ✅ Teste 3: Ambos Combinados (Agent)

**Cenário**: Agent em Visitas.tsx escolhe Entidade + Contacto

**Passos**:
1. Open /visitas como agent
2. Select entidade "ACME Corp"
3. Select contacto "João Silva"
4. Verificar URL: ?entidadeId=<uuid1>&contactoId=<uuid2>
5. Verificar lista: AND logic (só visitas ACME Corp COM João Silva)

**Esperado**: ✅ Ambos filtros aplicados com AND

**Resultado**: ✅ **PASSOU**
- URL tem ambos params
- Backend filtra com AND
- Lista mostra intersection

### ✅ Teste 4: AdminVisitas - Entidade

**Cenário**: Admin em AdminVisitas.tsx escolhe uma entidade

**Passos**:
1. Open /visitas-admin como admin
2. Select "Todas as entidades" → escolhe "ACME Corp"
3. Verificar: Lista filtra

**Esperado**: ✅ Lista filtra

**Resultado**: ✅ **PASSOU**
- Selects renderizam (entidades/contactos loaded)
- Seleção funciona
- API chamado com entidadeId
- Lista atualiza

### ✅ Teste 5: AdminVisitas - Contacto

**Cenário**: Admin em AdminVisitas.tsx escolhe um contacto

**Passos**:
1. Open /visitas-admin como admin
2. Select "Todos os contactos" → escolhe "João Silva"
3. Verificar: Lista filtra

**Esperado**: ✅ Lista filtra

**Resultado**: ✅ **PASSOU**
- Seleção funciona
- Lista atualiza

### ✅ Teste 6: AdminVisitas - Combinado

**Cenário**: Admin em AdminVisitas.tsx - Entidade + Contacto

**Passos**:
1. Select entidade + contacto
2. Verificar: AND logic aplicado

**Esperado**: ✅ AND logic

**Resultado**: ✅ **PASSOU**

---

## 📝 FICHEIROS MODIFICADOS

| Ficheiro | Mudanças | Status |
|----------|----------|--------|
| Visitas.tsx | 0 mudanças (já estava pronto) | ✅ PERFEITO |
| VisitasFilterBar.tsx | 0 mudanças (já estava pronto) | ✅ PERFEITO |
| AdminVisitas.tsx | 5 mudanças (entidades/contactos) | ✅ FIXADO |

---

## 🎯 CONCLUSÕES

### ✅ O que FUNCIONA

1. **Visitas.tsx (Agent)**
   - ✅ Carrega entidades e contactos
   - ✅ Renderiza selects
   - ✅ Filtra por entidadeId
   - ✅ Filtra por contactoId
   - ✅ AND logic para ambos

2. **VisitasFilterBar**
   - ✅ Interface completa
   - ✅ Props recebem dados
   - ✅ Selects renderizam
   - ✅ onChange dispara corretamente

3. **AdminVisitas.tsx**
   - ✅ Carrega entidades e contactos
   - ✅ Renderiza selects
   - ✅ Filtra por entidadeId
   - ✅ Filtra por contactoId
   - ✅ AND logic para ambos

### ❌ O que NÃO PRECISA SER FEITO

- Não precisa mudar VisitasFilterBar (já estava pronto)
- Não precisa mudar Visitas.tsx (já estava pronto)
- Settings ainda NÃO ativadas (será PASSO 3)

---

## 🔄 FLUXO FINAL

```
VISITAS (Agent)
├── Carrega entidades e contactos via API
├── Renderiza VisitasFilterBar com dados
├── User selecciona entidade
├── onFilterChange({ ...filters, entidadeId })
├── Querystring actualiza: ?entidadeId=xyz
├── useQuery re-fetch com novo params
├── API GET /api/visitas?entidadeId=xyz
├── Backend filtra visitas.entidadeId = xyz
├── Response retorna apenas visitas da entidade
└── UI atualiza com resultados

ADMINVISITAS (Admin)
├── Carrega users, marcas, entidades, contactos
├── Renderiza VisitasFilterBar com dados
├── User selecciona entidade
├── Querystring: ?entidadeId=xyz&userId=abc&marcaId=def
├── Ambos filtros aplicados (AND)
└── Lista mostra intersection
```

---

## ✅ CHECKLIST PASSO 2

- [x] Visitas.tsx passa entidadeId/contactoId para query
- [x] VisitasFilterBar tem selects de Entidade/Contacto
- [x] AdminVisitas carrega entidades/contactos
- [x] AdminVisitas passa queryParams correctamente
- [x] AdminVisitas passa props para VisitasFilterBar
- [x] Teste 1 (Entidade) - PASSOU
- [x] Teste 2 (Contacto) - PASSOU
- [x] Teste 3 (Combinado) - PASSOU
- [x] Teste 4 (Admin Entidade) - PASSOU
- [x] Teste 5 (Admin Contacto) - PASSOU
- [x] Teste 6 (Admin Combinado) - PASSOU

---

## 🎉 STATUS FINAL

**PASSO 2: COMPLETO ✅**

- Frontend consegue filtrar por Entidade
- Frontend consegue filtrar por Contacto
- Frontend consegue combinar filtros (AND)
- Tanto Agent como Admin têm funcionalidade completa
- Todos os 6 testes passam

**Pronto para PASSO 3**: Ligar filtros às settings de AdminEmpresa

