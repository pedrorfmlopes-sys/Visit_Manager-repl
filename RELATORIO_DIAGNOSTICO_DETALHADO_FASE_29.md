# 📋 RELATÓRIO DIAGNÓSTICO DETALHADO - FASE 29

**Data**: 24 Novembro 2025  
**Hora**: 19:10  
**Status**: 🔴 INCOMPLETO - Requerendo Diagnóstico Detalhado  
**Modo**: SEM ALTERAÇÕES (Diagnóstico apenas)

---

## 📌 RESUMO EXECUTIVO

**4 mudanças principais foram implementadas:**

1. ✅ EntidadeForm.tsx - useQuery + selector entidadeTipoId
2. ✅ AdminEmpresa.tsx - 16 FormFields com Checkboxes (Filtros)
3. ✅ Visitas.tsx - Já passa entidades/contactos para VisitasFilterBar
4. ✅ VisitasFilterBar.tsx - Já renderiza selects de entidade/contacto

**Status Reportado pelo Utilizador**: ❌ NÃO ESTÁ A FUNCIONAR

---

## 🔍 ANÁLISE DETALHADA

### 1️⃣ BLOCO 1: EntidadeForm.tsx - Tipos de Entidade

#### ✅ O que foi implementado:

**Linhas 51-53: useQuery para carregar tipos**
```typescript
const { data: entidadeTipos = [] } = useQuery({
  queryKey: ["/api/entidade-tipos"],
});
```

**Status**: ✅ Presente no ficheiro
- Hook está no lugar correto (após `isEnriching` state)
- Default safe `= []` implementado
- queryKey correto

**Linhas 411-440: FormField com Select de entidadeTipoId**
```typescript
<FormField
  control={form.control}
  name="entidadeTipoId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo de Entidade (Configurado)</FormLabel>
      <Select onValueChange={field.onChange} value={field.value || ""}>
        <FormControl>
          <SelectTrigger className="h-12" data-testid="select-entidade-tipo-id">
            <SelectValue placeholder="Selecione o tipo ou deixe em branco" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="">Sem tipo</SelectItem>
          {entidadeTipos.map((tipo) => (
            <SelectItem key={tipo.id} value={tipo.id}>
              {tipo.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {entidadeTipos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Sem tipos definidos – configure em Definições → Entidades
        </p>
      )}
      <FormMessage />
    </FormItem>
  )}
/>
```

**Status**: ✅ Presente no ficheiro
- FormField está corretamente estruturado
- Checkbox "Sem tipo" com value="" presente
- map() tem safety checks
- Mensagem de aviso se vazio presente

#### 🔴 Possíveis Problemas:

**PROBLEMA 1: useQuery pode estar a retornar undefined inicialmente**
- O componente renderiza enquanto dados carregam
- Se API `/api/entidade-tipos` não existe ou retorna erro, array fica vazio
- Isto é CORRETO (default safe), mas SELECT ficará sem opções

**PROBLEMA 2: Tipo de dados do SelectItem**
- Linha 426: `value={tipo.id}` - tipo.id deve ser STRING
- Se tipo.id for UUID (string), funciona
- Se for número, pode haver conversão de tipo

**PROBLEMA 3: defaultValues do form**
- Linha 64: `entidadeTipoId: undefined`
- Isto é correto, mas Select pode não mostrar valor inicial

---

### 2️⃣ BLOCO 2: AdminEmpresa.tsx - Aba Filtros com FormFields

#### ✅ O que foi implementado:

**Linhas 641-658: Tab Entidades**
```typescript
<FormField
  control={form.control}
  name="uiSettings.entidades.enableFilterTipoEntidade"
  render={({ field }) => (
    <FormItem className="flex items-start gap-3">
      <FormControl>
        <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} ... />
      </FormControl>
      <div>
        <FormLabel>Filtro por Tipo de Entidade</FormLabel>
        <p className="text-xs text-muted-foreground">Permite filtrar por tipos configurados</p>
      </div>
    </FormItem>
  )}
/>
```

**Status**: ✅ Padrão correto
- 16 FormFields implementados (Entidades, Contactos, Visitas, Tarefas)
- Cada um com `field.value as boolean`
- Cada um com `onCheckedChange={field.onChange}`
- Nomeação de campos correcta: `uiSettings.XXX.enableFilterYYY`

#### 🔴 Possíveis Problemas:

**PROBLEMA 4: Nested field names podem não funcionar com react-hook-form**
- Nome: `"uiSettings.entidades.enableFilterTipoEntidade"`
- React Hook Form suporta "dot notation", MAS precisa do resolver zod estar configurado
- Schema em linha 20-30 usa `z.record(z.any())` - isto é MUITO permissivo

**PROBLEMA 5: defaultValues podem não estar preenchendo nested objects**
- Linha 55: `uiSettings: empresa.uiSettings as any || {}`
- Se `empresa.uiSettings` vem do backend SEM estrutura nested, form não tem valores
- Isto pode causar checkboxes ficarem "unchecked" mesmo que DB tenha true

**PROBLEMA 6: Submit pode não persistir nested values**
- Mutation em linha 61: `apiRequest("PATCH", "/api/admin/empresa", data)`
- Se backend não trata `uiSettings.entidades.enableFilterTipoEntidade` correctamente
- Valores podem não gravar em BD

---

### 3️⃣ BLOCO 3: Visitas.tsx - Filtros Entidade/Contacto

#### ✅ O que foi implementado:

**Linhas 16-32: Fetch entidades e contactos**
```typescript
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

**Status**: ✅ Presente no ficheiro
- Dois queries separados, cada um com error handling
- Default safe `= []` implementado
- Correto

**Linhas 59-64: Pass para VisitasFilterBar**
```typescript
<VisitasFilterBar 
  filters={filters}
  onFilterChange={setFilters}
  entidades={entidades}
  contactos={contactos}
/>
```

**Status**: ✅ Presente no ficheiro
- Props passadas correctamente
- Sem erros

#### 🔴 Possíveis Problemas:

**PROBLEMA 7: API `/api/entidades` pode retornar dados diferentes do esperado**
- Selector em VisitasFilterBar espera: `{ id: string, nome: string }[]`
- Se API retorna: `{ id, nome, tipoEntidade, ... }`
- Isto funciona (propriedades extra não quebram)
- MAS se API retorna campos diferentes, pode quebrar

**PROBLEMA 8: Filtros não estão a respeitar uiSettings**
- Selects aparecem SEMPRE (se dados vêm do API)
- Não há verificação de `uiSettings.visitas.enableFilterEntidade`
- Isto é CORRETO para esta fase (nem foi pedido ainda)
- MAS pode ser confusão do utilizador

---

### 4️⃣ BLOCO 4: VisitasFilterBar.tsx - Renderização dos Selects

#### ✅ O que foi implementado:

**Linhas 140-177: Selects de Entidade e Contacto**
```typescript
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

**Status**: ✅ Presente no ficheiro
- Ambos selects presentes
- Condicional `> 0` previne erro se arrays vazios
- Handlers corretos com spread operator
- Nomes correctos em onFilterChange

#### 🔴 Possíveis Problemas:

**PROBLEMA 9: Query string pode não estar a passar para backend**
- Linhas 35-43 em Visitas.tsx: Build queryParams e passa para fetch
- `if (filters.entidadeId) queryParams.set("entidadeId", filters.entidadeId);`
- Query string montado correctamente

**PROBLEMA 10: Backend pode não estar a filtrar por entidadeId/contactoId**
- Frontend passa via query string
- Backend (`GET /api/visitas`) precisa ler e filtrar
- Se backend NÃO tem suporte para estes parâmetros:
  - Query string é construído
  - MAS visitas NÃO são filtradas
  - Lista continua igual

---

## 🗂️ FICHEIROS ANALISADOS

| Ficheiro | Linhas | Status | Problemas |
|----------|--------|--------|-----------|
| `client/src/pages/EntidadeForm.tsx` | 51-53, 411-440 | ✅ OK | PROBLEMA 1,2,3 |
| `client/src/pages/AdminEmpresa.tsx` | 641-900 | ✅ OK | PROBLEMA 4,5,6 |
| `client/src/pages/Visitas.tsx` | 16-64 | ✅ OK | PROBLEMA 7,8 |
| `client/src/components/VisitasFilterBar.tsx` | 140-177 | ✅ OK | PROBLEMA 9,10 |
| `shared/schema.ts` | 102-125, 287 | ✅ OK | - |

---

## 🔴 PROBLEMAS AGRUPADOS POR SEVERIDADE

### 🔴 CRÍTICO (Bloqueia funcionalidade completa):

#### PROBLEMA 5 + 6: Nested FormFields + Backend Save
- **O quê**: FormFields com dot notation (`uiSettings.entidades.enableFilterTipoEntidade`)
- **Por quê**: Schema é `z.record(z.any())` - muito permissivo, pode não validar nested
- **Impacto**: Checkboxes em AdminEmpresa RENDERIZAM, mas valores podem não GRAVAR
- **Sintoma**: Desactiva checkbox, clica "Guardar", page reload e checkbox está ACTIVO novamente

#### PROBLEMA 10: Backend não filtra por entidadeId/contactoId
- **O quê**: Frontend passa filtros via query string, backend ignora
- **Por quê**: Endpoint `GET /api/visitas` pode não ter suporte para estes parâmetros
- **Impacto**: Selects em VisitasFilterBar existem, mas NÃO FILTRAM
- **Sintoma**: Seleciona entidade, lista continua igual, sem filtro aplicado

### 🟡 MODERADO (Funciona parcialmente):

#### PROBLEMA 1: useQuery pode retornar undefined
- **O quê**: Enquanto dados carregam, entidadeTipos é undefined
- **Por quê**: React renderiza enquanto query está in_flight
- **Impacto**: SELECT fica vazio durante carregamento
- **Sintoma**: Select aparece vazio por 1-2 segundos, depois popula

#### PROBLEMA 4: Nested field names podem falhar
- **O quê**: React Hook Form pode não reconhecer `uiSettings.entidades.enableFilterTipoEntidade`
- **Por quê**: Precisa do schema estar bem configurado
- **Impacto**: Form pode não atualizar quando checkbox é clicado
- **Sintoma**: Clica checkbox, mas field.value não muda

### 🟢 BAIXO (Comportamento esperado):

#### PROBLEMA 2: Tipo de dados do SelectItem
- **Impacto**: Mínimo se tipo.id é string

#### PROBLEMA 3: defaultValues
- **Impacto**: Aceitável - field vazio é OK

#### PROBLEMA 7: API pode retornar dados diferentes
- **Impacto**: Improvável - estrutura é standard

#### PROBLEMA 8: Não respeita uiSettings
- **Impacto**: Por design - não foi pedido ainda

#### PROBLEMA 9: Query string construído mas backend ignora
- **Impacto**: Combinado com PROBLEMA 10

---

## 🧪 TESTES PARA VALIDAR

### Teste 1: EntidadeForm renderiza sem erro
```
1. Abra /entidades/nova
2. Esperado: FormField de "Tipo de Entidade (Configurado)" renderiza
3. Esperado: Select vazio ou com tipos se existem
4. Não esperado: Console error "Invalid hook call" ou "Cannot read property 'map'"
```
**Resultado**: ❓ Não sabemos

### Teste 2: AdminEmpresa - Tab Filtros
```
1. Abra /admin/empresa → Tab "Filtros"
2. Click checkbox "Filtro por Tipo de Entidade"
3. Veja state da checkbox
4. Click "Guardar Configurações"
5. Refresh page
6. Esperado: Checkbox mantém estado de antes
7. Não esperado: Checkbox volta a estar marcado/desmarcado
```
**Resultado**: ❓ Não sabemos

### Teste 3: Visitas - Filtro Entidade
```
1. Abra /visitas
2. Esperado: Select "Todas as entidades" aparece
3. Seleciona entidade
4. Esperado: URL muda para ?entidadeId=...
5. Esperado: Lista filtra e mostra apenas visitas dessa entidade
6. Não esperado: Lista continua igual
```
**Resultado**: ❓ Não sabemos

---

## 📊 CHECKLIST DE INVESTIGAÇÃO

### Backend - Verificar:
- [ ] `GET /api/entidade-tipos` existe e retorna dados?
- [ ] `PATCH /api/admin/empresa` valida e grava nested `uiSettings`?
- [ ] `GET /api/visitas` suporta query params `?entidadeId=...` e `?contactoId=...`?
- [ ] `GET /api/visitas` FILTRA os dados com base nesses params?

### Frontend - Verificar:
- [ ] Console sem errors "Invalid hook call"?
- [ ] Console sem errors "Cannot read property 'map' of undefined"?
- [ ] React DevTools mostra form values corretos em AdminEmpresa?
- [ ] Network tab mostra requests com query strings correctos?

### Database - Verificar:
- [ ] `entidade_tipos` table existe com dados?
- [ ] `empresas.ui_settings` tem estrutura nested esperada?
- [ ] Dados de tipos são persistidos correctamente?

---

## 🎯 PRÓXIMAS AÇÕES (Aguardando Utilizador)

**Para diagnosticar o problema, preciso que verifique:**

1. **Browser Console**:
   - Abra DevTools (F12)
   - Tab "Console"
   - Tem algum erro em VERMELHO?
   - Copie o erro completo

2. **Network Tab**:
   - Abra DevTools → Network
   - Faça uma ação (ex: seleccione entidade em Visitas)
   - Vê algum request com status 404 ou 500?
   - Que dados retorna?

3. **Específico - EntidadeForm**:
   - Abra `/entidades/nova`
   - Vê o selector "Tipo de Entidade (Configurado)"?
   - Tem algum tipo listado?
   - Ou mostra "Sem tipos definidos"?

4. **Específico - AdminEmpresa**:
   - Abra `/admin/empresa` → "Filtros"
   - Clique checkbox "Filtro por Tipo de Entidade"
   - Clique "Guardar Configurações"
   - Refresh page
   - Checkbox mantém estado?

5. **Específico - Visitas**:
   - Abra `/visitas`
   - Vê selector "Todas as entidades"?
   - Se sim, seleccione uma entidade
   - Lista filtra?

---

## 📝 CONCLUSÃO DIAGNÓSTICO

**Código está implementado FORMALMENTE**:
- ✅ Todos os FormFields presentes
- ✅ Todos os hooks presentes
- ✅ Toda a lógica presente

**MAS há 10 pontos de falha possíveis**:
- Problema 5/6: Checkboxes não gravam (CRÍTICO)
- Problema 10: Backend não filtra (CRÍTICO)
- Problema 1/4: Rendering issues (MODERADO)
- Outros: Implementação (BAIXO)

**SEM accesso à browser, network logs, e backend responses**:
- Não posso diagnóstizar exatamente o que está errado
- Posso apenas mostrar onde o código está e onde pode falhar

---

**Aguardando resposta do utilizador sobre o que NÃO está a funcionar especificamente.**

