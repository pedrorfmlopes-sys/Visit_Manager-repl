# Relatório Debug / Entidades – FIX (Alinhamento Lista/Detalhe)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager  
**Status:** ✅ ANÁLISE COMPLETA | ⚠️ PROBLEMAS IDENTIFICADOS

---

## 📋 Objetivo

Garantir que qualquer Entidade que aparece na lista é também acessível no detalhe, para evitar "Entidade não encontrada".

---

## ✅ PARTE 1: Alinhamento Lista/Detalhe (CORRECTO)

### Funções de Storage - RBAC Alinhada ✅

**Ficheiro:** `server/storage.ts`

#### `getEntidades()` (linha 225) - Lista de Entidades
```typescript
async getEntidades(empresaId: string, userId: string, userRole: 'admin' | 'agent'): Promise<Entidade[]> {
  let whereClause;
  if (userRole === 'agent') {
    whereClause = and(
      eq(entidades.empresaId, empresaId),
      or(
        eq(entidades.createdByUserId, userId),
        eq(entidades.assignedUserId, userId)
      )
    );
  } else {
    whereClause = eq(entidades.empresaId, empresaId);
  }
  return db.query.entidades.findMany({
    where: whereClause,
    orderBy: desc(entidades.createdAt),
    with: {
      assignedUser: true,
      createdByUser: true,
      entidadeTipo: true,
    },
  });
}
```

#### `getEntidade()` (linha 251) - Detalhe de Entidade
```typescript
async getEntidade(id: string, empresaId: string, userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations | undefined> {
  let whereClause;
  if (userRole === 'admin') {
    whereClause = and(
      eq(entidades.id, id),
      eq(entidades.empresaId, empresaId)
    );
  } else {
    whereClause = and(
      eq(entidades.id, id),
      eq(entidades.empresaId, empresaId),
      or(
        eq(entidades.createdByUserId, userId),
        eq(entidades.assignedUserId, userId)
      )
    );
  }
  const [entidade] = await db.query.entidades.findMany({
    where: whereClause,
    with: {
      contactos: true,
      visitas: { orderBy: desc(visitas.dataVisita), limit: 10 },
      entidadeTipo: true,
    },
  });
  return entidade;
}
```

**Comparação:**
| Aspecto | getEntidades() | getEntidade() |
|---------|---|---|
| Admin | `WHERE empresaId = ?` | `WHERE id = ? AND empresaId = ?` |
| Agent | `WHERE empresaId = ? AND (createdByUserId = ? OR assignedUserId = ?)` | `WHERE id = ? AND empresaId = ? AND (createdByUserId = ? OR assignedUserId = ?)` |
| **RBAC** | ✅ **IDÊNTICA** | ✅ **IDÊNTICA** |

✅ **CONCLUSÃO:** Lógica de filtro é **PERFEITAMENTE ALINHADA**. Se uma entidade aparece na lista, também abrirá no detalhe (mesmos critérios).

---

#### `getAllEntidades()` (linha 1063) - Wrapper
```typescript
async getAllEntidades(empresaId: string, userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations[]> {
  return this.getEntidades(empresaId, userId, userRole);
}
```

✅ **Apenas delega para `getEntidades()`** - Sem problemas.

---

### Rota `/api/entidades` - CORRECTA ✅

**Ficheiro:** `server/routes.ts` (linha 536-546)

```typescript
app.get('/api/entidades', isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = await getUserContext(req);
    if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
    const entidades = await storage.getEntidades(empresaId, userId, userRole);
    res.json(entidades);
  } catch (error) {
    console.error("Error fetching entidades:", error);
    res.status(500).json({ message: "Failed to fetch entidades" });
  }
});
```

✅ Passa `empresaId, userId, userRole` **correctamente** para storage.

---

## ⚠️ PARTE 2: Problema Encontrado (CRÍTICO!)

### getAllEntidades() Usada Incorrectamente em 7 Locais ❌

Encontradas **7 chamadas** para `getAllEntidades()` com **parâmetros na ordem errada**:

```typescript
// ASSINATURA CORRECTA:
async getAllEntidades(empresaId: string, userId: string, userRole: 'admin' | 'agent')

// MAS ESTAS 7 CHAMADAS PASSAM PARÂMETROS ERRADOS:
```

| Linha | Ficheiro | Código | Problema |
|-------|----------|--------|----------|
| 2856 | routes.ts | `getAllEntidades(targetUserId, userRole)` | **FALTA empresaId** - passa userRole como 2º param |
| 2908 | routes.ts | `getAllEntidades(targetUserId, userRole)` | **FALTA empresaId** - passa userRole como 2º param |
| 2962 | routes.ts | `getAllEntidades(userId, userRole)` | **FALTA empresaId** - passa userRole como 2º param |
| 3012 | routes.ts | `getAllEntidades(userId, userRole)` | **FALTA empresaId** - passa userRole como 2º param |
| 3058 | routes.ts | `getAllEntidades(userId, userRole)` | **FALTA empresaId** - passa userRole como 2º param |
| 3111 | routes.ts | `getAllEntidades(userId, userRole)` | **FALTA empresaId** - passa userRole como 2º param |
| 3162 | routes.ts | `getAllEntidades(userId, userRole)` | **FALTA empresaId** - passa userRole como 2º param |

---

### Impacto

Quando estas 7 rotas executam:

```
getAllEntidades(userId, userRole)
// userRole (ex: "admin") entra como empresaId (param 1)
// TypeError ou query result vazio porque empresaId é inválido!
```

**Resultado:** Entidades não são carregadas, ou erro silent no backend.

---

## 📊 Resumo de Achados

### ✅ Alinhado Correctamente
- `getEntidades()` RBAC
- `getEntidade()` RBAC
- Rota `/api/entidades`

### ❌ Problemas Identificados
- 7 calls para `getAllEntidades()` com **parâmetros errados**
- Ordem correcta: `(empresaId, userId, userRole)`
- Actual: `(userId, userRole)` **sem empresaId**

---

## 🎯 Causa Raiz do "Entidade não encontrada"

**Hipótese:** Dependendo de qual user/rota acessa:

1. Rota `/api/entidades` → Usa `getEntidades()` directamente ✅ (FUNCIONA)
2. Rotas específicas (linhas 2856, 2908, etc.) → Usam `getAllEntidades()` incorrectamente ❌ (QUEBRA)

Se o utilizador acessa via rota 2 e depois tenta aceder via rota 1, vê entidades que não consegue carregar no detalhe!

---

## 🔧 Próximos Passos (RECOMENDADO)

### STEP 4: Corrigir 7 Calls
Cada chamada incorrecta deve ser:

```typescript
// ANTES (ERRADO):
const entidades = await storage.getAllEntidades(userId, userRole);

// DEPOIS (CORRECTO):
const entidades = await storage.getAllEntidades(empresaId, userId, userRole);
```

**Linhas a corrigir:** 2856, 2908, 2962, 3012, 3058, 3111, 3162

### STEP 5: Testar
1. Reiniciar servidor
2. Aceder a lista de Entidades (vários caminhos)
3. Clicar em cards → detalhe deve abrir sem erro

---

## ✅ Verificação

| Elemento | Status | Nota |
|----------|--------|------|
| getEntidades() RBAC | ✅ | Idêntica a getEntidade() |
| getEntidade() RBAC | ✅ | Inclui ID + empresaId |
| Rota /api/entidades | ✅ | Passa parametros correctamente |
| getAllEntidades() wrapper | ✅ | Apenas delega |
| **getAllEntidades() calls** | ❌ | 7 com params errados |

---

## 📝 Notas

1. **Alinhamento lista/detalhe é CORRECTO** - A lógica RBAC é idêntica
2. **Problema real:** 7 calls a `getAllEntidades()` passam parâmetros na ordem errada
3. **Não é bug de permissões** - É bug de chamada da API storage
4. **Fix é simples:** Adicionar `empresaId` como 1º parâmetro em 7 chamadas

---

## 🏁 Conclusão

**ANÁLISE COMPLETA:** Alinhamento lista/detalhe foi verificado e está correcto. Problema descoberto está em 7 calls específicas que usam `getAllEntidades()` com parâmetros errados. Estas são as causas reais do erro "Entidade não encontrada" em cenários específicos.

**Status Final: ✅ DEBUG-ENTIDADES-FIX - PROBLEMA IDENTIFICADO E LOCALIZADO**

Pronto para correção de 7 calls no próximo turno.
