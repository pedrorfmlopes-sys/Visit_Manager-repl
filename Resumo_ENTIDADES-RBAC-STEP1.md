# Relatório: ENTIDADES-RBAC-STEP1 (Modelo Correto, Sem Remendos)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager  
**Status:** ✅ **IMPLEMENTAÇÃO COMPLETA**

---

## 🎯 Objetivo

Centralizar as regras de acesso a Entidades (admin vs agent) num único local (`buildEntidadeAccessWhere`), garantindo que:
- A lista e o detalhe usam exactamente a mesma lógica de permissões
- Eliminar erros "Entidade não encontrada" causados por inconsistências
- Preparar o padrão para reutilização em Visitas e Tarefas

---

## ✅ O QUE FOI FEITO

### 1. Centralizar a Regra de Acesso (DONE) ✅

**Ficheiro:** `server/storage.ts` (linha 227)

Criei função helper `buildEntidadeAccessWhere`:

```typescript
private buildEntidadeAccessWhere(empresaId: string, userId: string, userRole: 'admin' | 'agent') {
  if (userRole === 'admin') {
    // Admin vê todas as entidades da empresa
    return eq(entidades.empresaId, empresaId);
  }

  // Agent: só entidades da empresa em que é criador ou assigned
  return and(
    eq(entidades.empresaId, empresaId),
    or(
      eq(entidades.createdByUserId, userId),
      eq(entidades.assignedUserId, userId)
    )
  );
}
```

**Benefício:** Regra RBAC num único sítio, sem duplicação.

---

### 2. Refactorizar `getEntidade()` (DONE) ✅

**Antes:**
```typescript
if (userRole === 'admin') {
  whereClause = and(eq(entidades.id, id), eq(entidades.empresaId, empresaId));
} else {
  whereClause = and(eq(entidades.id, id), eq(entidades.empresaId, empresaId), or(...));
}
```

**Depois:**
```typescript
const baseWhere = this.buildEntidadeAccessWhere(empresaId, userId, userRole);
const whereClause = and(eq(entidades.id, id), baseWhere);
```

**Resultado:** Lógica RBAC centralizada, mais legível, sem duplicação.

---

### 3. Refactorizar `getEntidades()` (DONE) ✅

**Antes:**
```typescript
if (userRole === 'agent') {
  whereClause = and(eq(entidades.empresaId, empresaId), or(...));
} else {
  whereClause = eq(entidades.empresaId, empresaId);
}
```

**Depois:**
```typescript
const baseWhere = this.buildEntidadeAccessWhere(empresaId, userId, userRole);
return db.query.entidades.findMany({ where: baseWhere, ... });
```

**Resultado:** Uma única fonte de verdade para RBAC.

---

### 4. Corrigir 7 Calls a `getAllEntidades()` (DONE) ✅

**Problema:** 7 rotas PDF passavam parâmetros errados (faltava `empresaId`)

**Linhas Corrigidas:**
| Rota | Antes | Depois |
|------|-------|--------|
| Line 2859 | `getAllEntidades(targetUserId, userRole)` | `getAllEntidades(empresaId, targetUserId, userRole)` |
| Line 2911 | `getAllEntidades(targetUserId, userRole)` | `getAllEntidades(empresaId, targetUserId, userRole)` |
| Line 2965 | `getAllEntidades(userId, userRole)` | `getAllEntidades(empresaId, userId, userRole)` |
| Line 3015 | `getAllEntidades(userId, userRole)` | `getAllEntidades(empresaId, userId, userRole)` |
| Line 3061 | `getAllEntidades(userId, userRole)` | `getAllEntidades(empresaId, userId, userRole)` |
| Line 3114 | `getAllEntidades(userId, userRole)` | `getAllEntidades(empresaId, userId, userRole)` |
| Line 3165 | `getAllEntidades(userId, userRole)` | `getAllEntidades(empresaId, userId, userRole)` |

**Também adicionei:** `const { userId, userRole, empresaId }` em cada rota (estava faltando `empresaId`).

---

## 📊 Resumo de Mudanças

### Ficheiros Editados

**1. server/storage.ts**
- ✅ Adicionado helper `buildEntidadeAccessWhere()` (linhas 227-242)
- ✅ Refactorizado `getEntidades()` para usar helper (linhas 245-257)
- ✅ Refactorizado `getEntidade()` para usar helper (linhas 259-280)

**2. server/routes.ts**
- ✅ Corrigida rota `/api/pdf/agente/:id/relatorio-mensal` (linha 2843, 2859)
- ✅ Corrigida rota `/api/pdf/agente/:id/relatorio-semanal` (linha 2897, 2911)
- ✅ Corrigida rota `/api/pdf/empresa/relatorio-mensal` (linha 2948, 2965)
- ✅ Corrigida rota `/api/pdf/reports/monthly/agent` (linha 3004, 3015)
- ✅ Corrigida rota `/api/pdf/reports/weekly/agent` (linha 3052, 3061)
- ✅ Corrigida rota `/api/pdf/reports/monthly/company` (linha 3098, 3114)
- ✅ Corrigida rota `/api/pdf/reports/weekly/company` (linha 3151, 3165)

### Total de Edits
- **1 helper adicionado**
- **2 funções refactorizadas**
- **7 rotas corrigidas**

---

## 🎯 Resultado Final

### ✅ Centralização RBAC
- Uma única função `buildEntidadeAccessWhere()` controla todas as permissões
- Sem duplicação de lógica
- Fácil de manter e testar

### ✅ Consistência Lista/Detalhe
- `getEntidades()` e `getEntidade()` usam **exatamente a mesma** lógica RBAC
- Se uma entidade aparece na lista, o detalhe abre (sem "não encontrada")
- Admin vê tudo, Agent vê apenas criado/atribuído

### ✅ Padrão Reutilizável
- `buildEntidadeAccessWhere()` pode ser copiado para `buildVisitaAccessWhere()` e `buildTarefaAccessWhere()`
- Modelo pronto para Visitas e Tarefas

### ✅ 7 Rotas PDF Corrigidas
- Todas as rotas de relatório agora passam `empresaId` correctamente
- Sem mais erros de parâmetros

---

## 🧪 Status de Testes

**Workflow restarted:** ✅ Em execução

**Próximos testes (manual em browser):**
1. Ir à lista de Entidades
2. Clicar em 3-5 cards
3. Confirmar que detalhe abre sem erro "Entidade não encontrada"
4. Testar com Admin e Agent accounts

---

## 📌 Próximos Passos

### STEP 2 (Recomendado)
Aplicar o mesmo padrão a **Visitas** e **Tarefas**:
- Criar `buildVisitaAccessWhere()`
- Refactorizar `getVisita()` e `getVisitas()`
- Refactorizar `getTarefa()` e `getTarefas()`

### Benefícios
- Eliminação de duplicação RBAC em toda a aplicação
- Consistência garantida entre lista e detalhe
- Código mais fácil de manter

---

## ✅ Validação

| Aspecto | Status |
|---------|--------|
| Helper centralizado | ✅ Implementado |
| getEntidade refactorizado | ✅ Implementado |
| getEntidades refactorizado | ✅ Implementado |
| 7 rotas corrigidas | ✅ Implementado |
| empresaId em todas rotas | ✅ Adicionado |
| Workflow restartado | ✅ Em execução |

---

## 📝 Notas

1. **Sem mudanças no IStorage interface** - Assinaturas mantêm-se iguais, apenas implementação interna mudou
2. **Backward compatible** - Código que chama `getEntidades()` e `getEntidade()` funciona sem mudanças
3. **buildEntidadeAccessWhere privado** - Apenas usado internamente na Storage class
4. **Logs mantidos** - Console.logs já existentes em `getEntidade()` foram preservados

---

## 🏁 Conclusão

**ENTIDADES-RBAC-STEP1 foi implementado com sucesso!**

Conseguimos:
- ✅ Centralizar regra RBAC num único helper
- ✅ Refactorizar `getEntidade()` e `getEntidades()` para usar helper
- ✅ Corrigir 7 rotas PDF com parâmetros errados
- ✅ Garantir consistência entre lista e detalhe

**Próximo:** Esperar resultado de testes, depois aplicar padrão a Visitas e Tarefas.

---

**Status Final: ✅ IMPLEMENTAÇÃO COMPLETA - PRONTO PARA TESTES**
