# Relatório Debug / Entidades – STEP 2 (Logs + Confirmação empresa/id)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Adicionar logs no backend para perceber por que razão `storage.getEntidade(...)` está a devolver `null` quando se clica num card de Entidade e aparece "Entidade não encontrada".

---

## ✅ Trabalho Realizado

### 1. Logs Adicionados na Rota `/api/entidades/:id`

**Ficheiro:** `server/routes.ts` (linhas 556-571)

```typescript
app.get('/api/entidades/:id', isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = await getUserContext(req);
    if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
    
    // LOG 1: ANTES de chamar storage.getEntidade()
    console.log("[Entidades] GET /api/entidades/:id", {
      paramId: req.params.id,
      userId,
      userRole,
      empresaId,
    });
    
    const entidade = await storage.getEntidade(req.params.id, empresaId, userId, userRole);
    
    // LOG 2: SE entidade for null
    if (!entidade) {
      console.log("[Entidades] storage.getEntidade result is null", {
        paramId: req.params.id,
        userId,
        userRole,
        empresaId,
      });
      return res.status(404).json({ message: "Entidade not found" });
    }
    res.json(entidade);
  } catch (error) {
    console.error("Error fetching entidade:", error);
    res.status(500).json({ message: "Failed to fetch entidade" });
  }
});
```

**O que isto faz:**

| Log | Quando | Informação | Uso |
|-----|--------|-----------|-----|
| `[Entidades] GET /api/entidades/:id` | ANTES do query | paramId, userId, userRole, empresaId | Ver o ID que vem da URL |
| `[Entidades] storage.getEntidade result is null` | QUANDO retorna null | paramId, userId, userRole, empresaId | Confirmar se storage devolveu null |

---

### 2. Logs Adicionados na Função `getEntidade()` (storage.ts)

**Ficheiro:** `server/storage.ts` (linhas 256-296)

```typescript
async getEntidade(id: string, empresaId: string, userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations | undefined> {
  // LOG 1: ANTES da query à BD
  console.log("[storage.getEntidade] called with", {
    id,
    empresaId,
    userId,
    userRole,
  });
  
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
      visitas: {
        orderBy: desc(visitas.dataVisita),
        limit: 10,
      },
      entidadeTipo: true,
    },
  });
  
  // LOG 2: DEPOIS da query à BD
  console.log("[storage.getEntidade] DB result", {
    id,
    empresaId,
    found: !!entidade,
  });
  
  return entidade;
}
```

**O que isto faz:**

| Log | Quando | Informação | Uso |
|-----|--------|-----------|-----|
| `[storage.getEntidade] called with` | ANTES da query | id, empresaId, userId, userRole | Ver os parâmetros que a storage recebeu |
| `[storage.getEntidade] DB result` | DEPOIS da query | id, empresaId, found: true/false | Ver se a BD retornou algo |

---

## 🔍 Como Testar (Próximos Passos - Para o Utilizador)

### Passo 1: Reiniciar o Servidor
```bash
npm run dev
```

### Passo 2: No Browser
1. Abrir a lista de Entidades
2. Abrir DevTools (F12) → separador **Network**
3. Clicar num card de Entidade que dá "Entidade não encontrada"

### Passo 3: Verificar Network
- Procurar a request **GET /api/entidades/:id**
- Notar qual é o **ID** exacto na URL
- Ver o **status** (esperado: 404 se é um erro, 200 se sucesso)
- Ver o **response**: `{ message: "Entidade not found" }`

### Passo 4: Verificar Logs no Replit Console
Procurar estas linhas no console do servidor:

```
[Entidades] GET /api/entidades/:id {
  paramId: "abc123",           ← Este é o ID que o frontend enviou
  userId: "user_xyz",
  userRole: "admin",
  empresaId: "company_456"     ← Esta é a empresa do user
}

[storage.getEntidade] called with {
  id: "abc123",                ← Mesmo ID
  empresaId: "company_456",    ← Mesma empresa
  userId: "user_xyz",
  userRole: "admin"
}

[storage.getEntidade] DB result {
  id: "abc123",
  empresaId: "company_456",
  found: false                 ← ISTO é o problema! BD não retorna nada
}

[Entidades] storage.getEntidade result is null {
  paramId: "abc123",
  userId: "user_xyz",
  userRole: "admin",
  empresaId: "company_456"
}
```

---

## 🎯 O Que os Logs Revelam

### Cenário 1: `found: false`
```
[storage.getEntidade] DB result {
  id: "abc123",
  empresaId: "company_456",
  found: false
}
```
**Interpretação:** A BD não encontrou entidade com este ID + empresaId  
**Causas possíveis:**
- ID não existe na BD
- Entidade pertence a outra empresa
- User não tem permissão (agent sem criação ou atribuição)

### Cenário 2: `found: true` (mas ainda assim erro 404)
```
[storage.getEntidade] DB result {
  id: "abc123",
  empresaId: "company_456",
  found: true
}
```
**Interpretação:** BD encontrou, mas houve erro a processar JOIN  
**Causas possíveis:**
- Erro em algum dos JOINs (contactos, visitas, entidadeTipo)
- Exception lançada

### Cenário 3: `paramId` diferente do esperado
```
[Entidades] GET /api/entidades/:id {
  paramId: "undefined",  ← PROBLEMA!
  ...
}
```
**Interpretação:** URL param não foi lido correctamente  
**Causas possíveis:**
- Bug na navegação do frontend
- Route pattern incorrecta

---

## 📊 Matriz de Diagnosis

| Situação | Log 1 | Log 2 | Log 3 | Log 4 | Diagnóstico |
|----------|-------|-------|-------|-------|-------------|
| Sucesso | ✅ paramId OK | ✅ chamado | ✅ found:true | (sem log) | **Funciona!** |
| BD sem dados | ✅ paramId OK | ✅ chamado | ❌ found:false | ✅ null | **ID/empresa errados** |
| JOIN error | ✅ paramId OK | ✅ chamado | (exception) | (sem log) | **Erro em relacionamentos** |
| Frontend erro | ❌ paramId=undefined | ✅ chamado | ✅ found:false | ✅ null | **Bug no frontend** |

---

## 📁 Ficheiros Modificados

| Ficheiro | Linhas | Mudanças |
|----------|--------|----------|
| `server/routes.ts` | 556-571 | 2 console.log adicionados |
| `server/storage.ts` | 256-296 | 2 console.log adicionados |

**Total:** 2 ficheiros modificados, 4 console.log adicionados (~30 linhas)

---

## ✅ Checklist de Implementação

- [x] Log ANTES de storage.getEntidade() em routes.ts
- [x] Log DEPOIS com result is null em routes.ts
- [x] Log ANTES de query à BD em storage.ts
- [x] Log DEPOIS com found flag em storage.ts
- [x] Logs usam nomes descritivos: `[Entidades]`, `[storage.getEntidade]`
- [x] Logs mostram paramId, empresaId, userId, userRole
- [x] Logs mostram found: true/false
- [x] SEM invenções, exactamente como pedido

---

## 🚀 Próximas Ações

### STEP 3 (Próximo): Interpretar Logs
1. Reproduzir o erro "Entidade não encontrada"
2. Tirar nota dos 4 logs no console
3. Comparar valores de paramId, empresaId
4. Identificar causa raiz:
   - ID não existe?
   - Empresa diferente?
   - Permissões insuficientes?

### STEP 4: Corrigir
Baseado na diagnosis:
- Se ID diferente → corrigir navegação no frontend
- Se empresa diferente → verificar dados de teste
- Se permissões → ajustar RBAC

---

## 📝 Notas Técnicas

1. **Logs estruturados:** Usam objetos JSON para fácil parsing
2. **Nomes únicos:** `[Entidades]` e `[storage.getEntidade]` para identificação
3. **Sem quebra de função:** Logs adicionados sem alterar lógica
4. **Sem invenções:** Exactamente 4 console.log, nada mais
5. **Rastreabilidade:** Podem-se seguir os 4 logs na sequência exacta

---

## ✅ Status de Compilação

✅ **TypeScript:** Sem erros  
✅ **Syntax:** Válido  
✅ **Imports:** Nenhum novo necessário  
✅ **Servidor:** Deve ser restarted com `npm run dev`  

---

## 🏁 Conclusão

**STEP 2 COMPLETA:** Logs adicionados com sucesso em ambas as camadas (routes + storage).

Próximo passo: Reproduzir o erro e observar os logs para identificar a causa raiz do problema "Entidade não encontrada".

---

**Status Final: ✅ DEBUG-ENTIDADES-STEP2 - CONCLUÍDA**

Pronto para diagnosis! 🔍
