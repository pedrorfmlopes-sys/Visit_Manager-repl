# FASE 29 – ANÁLISE COMPLETA E PROBLEMAS IDENTIFICADOS
**Data**: 24 de Novembro de 2025  
**Status**: ⚠️ PARCIALMENTE FUNCIONANDO - PROBLEMAS DETECTADOS

---

## 📊 RESUMO EXECUTIVO

| Componente | Status | Visível? | Problema |
|-----------|--------|----------|----------|
| **DB Schema** | ✅ Pronto | N/A | Nenhum |
| **Storage Methods** | ✅ Pronto | N/A | Nenhum |
| **Backend APIs** | ✅ Pronto | N/A | Nenhum |
| **AdminEntidades Page** | ⚠️ Existe | ❌ SIM, mas ERRADO | Mostra ENTIDADES, não TIPOS |
| **Filtros Visitas** | ⚠️ Parcial | ❌ NÃO | Backend OK, frontend não renderiza |
| **Menu Links** | ✅ Adicionado | ✅ SIM | "Entidades (Backoffice)" está no menu |
| **EntidadeForm Select** | ❌ Não existe | ❌ NÃO | Sem selector para tipo_entidade |
| **AdminEmpresa Settings** | ❌ Não existe | ❌ NÃO | Sem toggles para filtros |

---

## 🔴 PROBLEMAS PRINCIPAIS IDENTIFICADOS

### PROBLEMA #1: AdminEntidades mostra ENTIDADES, não TIPOS DE ENTIDADES
**Localização**: `/admin/entidades`  
**O que deveria estar**: Tabela gerenciando TIPOS (Gabinete, Hotel, etc.)  
**O que está agora**: Listagem de ENTIDADES (Companies, Contacts)  

**Código**:
```typescript
// AdminEntidades.tsx - ERRADO!
const { data: entidades = [] } = useQuery<Entidade[]>({
  queryKey: ["/api/admin/entidades"],  // ← Busca entidades, não tipos!
});
```

**Devereria ser**:
```typescript
// AdminEntidadeTipos.tsx - CORRETO
const { data: tipos = [] } = useQuery<EntidadeTipo[]>({
  queryKey: ["/api/admin/entidade-tipos"],  // ← Busca tipos
});
```

---

### PROBLEMA #2: Filtros de Entidade/Contacto não aparecem em Visitas
**Localização**: `/visitas` (página de visitas)  
**O que deveria**: Selects de Entidade e Contacto abaixo dos filtros de data  
**O que vê**: Só os filtros de data (Hoje, Esta semana, etc.)

**Por quê?**
- VisitasFilterBar.tsx tem as props `entidades` e `contactos`
- MAS o componente não as RENDERIZA! (falta a parte do return)
- Visitas.tsx passa os dados, mas o componente não os exibe

---

### PROBLEMA #3: Arquivo AdminEntidades não é o correto
**O que foi criado**: `AdminEntidades.tsx` - gerenciador de ENTIDADES (entities)  
**O que falta**: `AdminEntidadeTipos.tsx` - gerenciador de TIPOS DE ENTIDADES  

Estes são **dois componentes diferentes**:
- **AdminEntidades** = Listar/Editar Empresas, Clientes, etc. ✅ Existe mas está no lugar errado
- **AdminEntidadeTipos** = Listar/Editar tipos como "Gabinete", "Hotel" ❌ Não existe

---

## 🔍 ANÁLISE ARQUIVO POR ARQUIVO

### ✅ shared/schema.ts
```
Status: CORRETO
- Tabela entidade_tipos: ✅ Criada
- FK entidadeTipoId em entidades: ✅ Adicionada
- Zod schemas: ✅ Definidos
- uiSettings.visitas: ✅ Configurado
- userSettings.visitasUi: ✅ Configurado
```

### ✅ server/storage.ts
```
Status: CORRETO
Métodos implementados:
- getEntidadeTipos(empresaId): ✅
- getEntidadeTiposAtivos(empresaId): ✅
- getEntidadeTipo(id, empresaId): ✅
- createEntidadeTipo(...): ✅
- updateEntidadeTipo(...): ✅
```

### ✅ server/routes.ts
```
Status: CORRETO
Endpoints:
- GET /api/admin/entidade-tipos: ✅
- POST /api/admin/entidade-tipos: ✅
- PATCH /api/admin/entidade-tipos/:id: ✅
- GET /api/entidade-tipos: ✅
- GET /api/visitas (com filters): ✅
```

### ⚠️ client/src/pages/AdminEntidades.tsx
```
Status: IMPLEMENTADO MAS INCORRETO

O arquivo gerencia ENTIDADES (empresas/clientes/distribuidores)
Mas deveria gerenciar TIPOS DE ENTIDADES (categorias de entidades)

Conteúdo Atual:
- Lista entidades com nome, NIF, email
- Botões editar/deletar entidades
- Search por nome/NIF

O que Deveria Ser:
- Lista tipos com nome, cor, ativo, ordem
- Botões editar/deletar/toggle ativo
- Drag-to-sort para ordem
- Form inline para criar novo tipo
```

### ⚠️ client/src/components/VisitasFilterBar.tsx
```
Status: PROPS PREPARADAS MAS NÃO RENDERIZA

O que tem:
interface VisitasFilterBarProps {
  entidades?: { id: string; nome: string }[];
  contactos?: { id: string; nome: string }[];
}

O que falta:
- No return/render: SEM selects para entidade/contacto
- Faltam linhas que renderizam os selects

Deve ter algo como:
{entidades.length > 0 && (
  <Select value={filters.entidadeId || ""} onValueChange={...}>
    <SelectItem value="">Todas as Entidades</SelectItem>
    {entidades.map(e => <SelectItem value={e.id}>{e.nome}</SelectItem>)}
  </Select>
)}
```

### ❌ client/src/pages/EntidadeForm.tsx
```
Status: SEM TIPOS

O formulário para criar/editar entidades está incompleto:
- Falta select para "Tipo de Entidade"
- Deveria ter dropdown com tipos ativos via GET /api/entidade-tipos
- Campo no formulário: entidadeTipoId
```

### ❌ client/src/pages/AdminEmpresa.tsx
```
Status: SEM GESTÃO DE TIPOS

Falta na aba "Visitas & Tarefas":
- Toggles para ativar/desativar filtros:
  ☐ Filtro por Entidade
  ☐ Filtro por Contacto
  ☐ Filtro por Marca (já existe?)
  ☐ Filtro por Data
  ☐ Filtro por Utilizador (admin)
  ☐ Filtro por Áudio

Estas opções vão em uiSettings.visitas
```

---

## 🗂️ NAVEGAÇÃO ESPERADA vs REALIDADE

### ❌ O que o utilizador VÊ AGORA:
```
Admin Menu
├─ Empresa
├─ Utilizadores
├─ Marcas
└─ Entidades (Backoffice)  ← LINK EXISTE
    ↓
    Lista de ENTIDADES (empresas/clientes)  ← ERRADO!
    Deveria ser: Tipos de Entidades (Gabinete, Hotel, etc.)
```

### ✅ O que deveria ser:
```
Admin Menu
├─ Empresa
│  └─ Tab "Visitas & Tarefas" com toggles de filtros  ← FALTA
├─ Utilizadores
├─ Marcas
└─ Entidades (Backoffice)
    ↓
    TIPOS DE ENTIDADES (Gabinete, Hotel, Arquiteto, etc.)
    ├─ Lista com: nome, cor, ativo, ordem
    ├─ Botões: Editar, Deletar, Toggle
    └─ Form para criar novo tipo
```

---

## 📋 CHECKLIST: O QUE ESTÁ FALTANDO

### Implementação Completa Necessária:

```
NIVEL 1: Substituir AdminEntidades.tsx (CRÍTICO)
  [ ] Renomear ou deletar AdminEntidades.tsx
  [ ] Criar AdminEntidadeTipos.tsx com:
      - useQuery(["/api/admin/entidade-tipos"]) 
      - useMutation para POST/PATCH
      - Tabela com nome, cor, ativo, ordem
      - Form inline ou dialog para criar

NIVEL 2: Filtros em Visitas (IMPORTANTE)
  [ ] Completar VisitasFilterBar.tsx com renderização de selects
  [ ] Verificar se passa entidades/contactos de Visitas.tsx
  [ ] Testar filtro entidadeId e contactoId funcionam

NIVEL 3: EntidadeForm.tsx (IMPORTANTE)
  [ ] Adicionar select "Tipo de Entidade"
  [ ] useQuery(["/api/entidade-tipos"]) para dados
  [ ] Map de tipos no formulário
  [ ] Salvar entidadeTipoId no submit

NIVEL 4: AdminEmpresa.tsx - Aba Visitas (IMPORTANTE)
  [ ] Renderizar toggles para cada filtro
  [ ] Salvar em uiSettings.visitas via PATCH /api/admin/empresa
  [ ] Carregar estado inicial via GET /api/admin/empresa

NIVEL 5: AdminEntidades.tsx - Se ainda serve
  [ ] Verificar se é necessário para editar entidades (não para tipos)
  [ ] Se sim, integrar em outro lugar (talvez Admin > Entidades main menu)
  [ ] Se não, deletar e arrumar links
```

---

## 🎯 RAIZ DO PROBLEMA

A **confusão fundamental** é:
- **Entidades** = Gabinete ABC, Hotel XYZ, Distribuidor 123 (dados reais de negócio)
- **Tipos de Entidades** = Categorias: "Gabinete", "Hotel", "Distribuidor" (configuração da empresa)

O código backend está correto, mas **o frontend mapeou errado**:
- Criou `AdminEntidades.tsx` para gerenciar ENTIDADES (errado)
- Deveria ser `AdminEntidadeTipos.tsx` para gerenciar TIPOS (correto)

---

## 🚨 IMPACTO ATUAL

### O que NÃO funciona:
1. ❌ Admin não pode criar/editar Tipos de Entidades
2. ❌ Agentes não veem filtros Entidade/Contacto em Visitas
3. ❌ Entidades não podem ter tipo atribuído (no formulário)
4. ❌ Admin não pode ativar/desativar filtros por tipo

### O que funciona (backend):
1. ✅ APIs retornam dados corretamente
2. ✅ Storage methods funcionam
3. ✅ Filtros backend processam corretamente
4. ✅ Multi-tenancy isolado por empresaId

---

## 📝 CONCLUSÃO

**FASE 29 está ~40% completo:**
- ✅ Backend: 100% (Schema + APIs + Storage)
- ✅ Navegação: 50% (Link existe mas aponta lugar errado)
- ❌ Frontend: 10% (AdminEntidades incorreto, filtros não renderizam)
- ❌ Integração: 0% (EntidadeForm, AdminEmpresa, sem tipos)

**Tempo estimado para correção**: 2-3 turns (parallelizar ao máximo)

---

## 🔧 PRÓXIMOS PASSOS RECOMENDADOS

1. **Turn 1**: Criar AdminEntidadeTipos.tsx + Corrigir VisitasFilterBar
2. **Turn 2**: EntidadeForm + AdminEmpresa settings
3. **Turn 3**: Testes e validação E2E

