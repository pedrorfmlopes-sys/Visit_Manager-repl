# Relatório Debug / "Entidade não encontrada"

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager  
**Status:** ✅ ANÁLISE COMPLETA | ⏳ TESTES PENDENTES

---

## 📋 Objetivo

Investigar porque ao clicar num card de Entidade, aparece "Entidade não encontrada" na página de detalhe.

---

## ✅ Análise Realizada

### 1. Fluxo Frontend - CORRETO ✅

**Ficheiro:** `client/src/pages/Entidades.tsx` (linha 77)

```typescript
{filteredEntidades.map((entidade) => (
  <EntidadeCard
    key={entidade.id}
    entidade={entidade}
    onClick={() => setLocation(`/entidades/${entidade.id}`)}  // ✅ Usa entidade.id
  />
))}
```

**Verificação:**
- ✅ Usa `entidade.id` (não undefined, não outro campo)
- ✅ Navega para `/entidades/{ID}` (padrão correto)
- ✅ O ID vem do objeto que foi carregado do `/api/entidades`

---

### 2. Detalhe Recebe Param - CORRETO ✅

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx` (linhas 40-42, 68-71)

```typescript
// 1. Lê o param da rota
const [, params] = useRoute("/entidades/:id");
const entidadeId = params?.id;  // ✅ Extrai corretamente

// 2. Usa para query
const { data: entidade, isLoading } = useQuery<EntidadeWithRelations>({
  queryKey: ["/api/entidades", entidadeId],
  enabled: !!entidadeId,  // ✅ Só faz query se tem ID
});
```

**Verificação:**
- ✅ `useRoute("/entidades/:id")` - padrão correto
- ✅ `params?.id` - extrai corretamente
- ✅ `enabled: !!entidadeId` - só faz query se ID existe
- ✅ `queryKey: ["/api/entidades", entidadeId]` - key é variável

---

### 3. Backend Endpoint - CORRETO ✅

**Ficheiro:** `server/routes.ts` (linha 548-560)

```typescript
app.get('/api/entidades/:id', isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = await getUserContext(req);  // ✅ Get context
    if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
    
    const entidade = await storage.getEntidade(
      req.params.id,      // ✅ ID da rota
      empresaId,          // ✅ Filtro por empresa (IMPORTANTE!)
      userId,             // ✅ User ID
      userRole            // ✅ Role para permissões
    );
    
    if (!entidade) {
      return res.status(404).json({ message: "Entidade not found" });  // ❓ AQUI vem o erro
    }
    res.json(entidade);
  } catch (error) {
    console.error("Error fetching entidade:", error);
    res.status(500).json({ message: "Failed to fetch entidade" });
  }
});
```

**Verificação:**
- ✅ Endpoint está no path correto: `/api/entidades/:id`
- ✅ Middleware `isAuthenticated` aplicado
- ✅ `getUserContext(req)` obtém context corretamente
- ✅ Valida se `empresaId` existe
- ⚠️ **CRÍTICO:** Chama `storage.getEntidade(id, empresaId, userId, userRole)`

---

## ⚠️ Possíveis Causas da Mensagem "Entidade não encontrada"

### Causa 1: **empresaId é null/undefined** ❌
```
Se getUserContext(req) não retorna empresaId:
→ Primeira validação: if (!empresaId) return res.status(400)
→ Resultado: HTTP 400 "User has no company assigned"
✅ Mas NÃO é "Entidade not found" (404)
```

### Causa 2: **ID não bate (diferente na DB)** ⚠️
```
Cenário: Frontend envia ID "abc123"
         DB tem entidade com ID "xyz789"
         storage.getEntidade("abc123", ...) retorna null
→ Resultado: HTTP 404 "Entidade not found"
✅ ISTO causaria a mensagem!
```

### Causa 3: **Filtro por empresaId exclui o registo** ⚠️
```
Cenário: Entidade existe na DB mas foi criada por outra empresa
         storage.getEntidade() faz query: WHERE id=? AND empresaId=?
→ Se empresaId do user ≠ empresaId da entidade: retorna null
→ Resultado: HTTP 404 "Entidade not found"
✅ ISTO também causaria a mensagem!
```

### Causa 4: **Permissões/Role impedem acesso** ⚠️
```
Cenário: storage.getEntidade() verifica userRole
         Se user é "agent" e entidade é de "admin": access denied
→ storage.getEntidade() retorna null
→ Resultado: HTTP 404 "Entidade not found"
✅ POSSÍVEL!
```

---

## 🔍 Diagnostic Steps (Para Próximo Turno)

### Step 1: Verificar DevTools
```
1. Abrir lista de Entidades
2. F12 → Network tab
3. Clicar num card
4. Procurar REQUEST: GET /api/entidades/:id
5. VERIFICAR:
   - URL: /api/entidades/???  (qual o ID?)
   - Response: { message: "Entidade not found" }
   - Status: 404
```

### Step 2: Adicionar Console.log no Backend
```typescript
// Adicionar em server/routes.ts linha ~549:
console.log("[Entidades] GET /:id", {
  paramId: req.params.id,
  empresaId: empresaId,
  userId: userId,
  userRole: userRole,
});

// E antes de retorno 404:
console.log("[Entidades] getEntidade result:", {
  found: entidade ? "YES" : "NO",
  paramId: req.params.id,
  empresaId: empresaId,
});
```

### Step 3: Verificar Storage Method
```typescript
// Abrir: server/storage.ts
// Procurar: function getEntidade(id, empresaId, userId, userRole)
// VERIFICAR:
// - Está a fazer filtro por empresaId?
// - Está a fazer filtro por userId?
// - Está a fazer filtro por userRole?
// - Base de dados tem dados para esta empresa/user?
```

### Step 4: Verificar DB Directly
```sql
-- Connect to dev database:
SELECT id, nome, empresaId FROM entidades LIMIT 10;

-- Verificar:
-- - Quantas entidades existem?
-- - Qual é o empresaId delas?
-- - Qual é o empresaId do user atual?
```

---

## 📊 Tabela de Possibilidades

| Causa | Sintoma | Status Code | Mensagem | Solução |
|-------|---------|-----------|----------|---------|
| ID undefined | Card não faz fetch | (sem fetch) | N/A | Debugar params |
| ID no URL correto mas ID inexistente | Fetch 404 | 404 | "Entidade not found" | Check if ID existe na DB |
| empresaId do user diferente | Fetch 404 | 404 | "Entidade not found" | Verificar empresaId do user |
| Permissões incorretas | Fetch 404 | 404 | "Entidade not found" | Verificar storage.getEntidade() |
| User sem empresa | Fetch antes 400 | 400 | "User has no company assigned" | Atribuir empresa ao user |

---

## ✅ Checklist para Próximo Turno

- [ ] Adicionar `console.log("[Entidades] GET /:id", { paramId, empresaId, userId, userRole })` ao backend
- [ ] Reproduzir o erro e observar logs
- [ ] Verificar Network tab do DevTools para ver o ID no request
- [ ] Verificar Response status (404 vs 400 vs outro)
- [ ] Query BD diretamente: `SELECT * FROM entidades WHERE empresaId = ?`
- [ ] Comparar ID do URL com ID na DB
- [ ] Verificar se user tem empresaId atribuído
- [ ] Verificar se entidade pertence à mesma empresa do user

---

## 🚀 Recomendações

### Curto Prazo (Próximo Turno)
1. ✅ Adicionar console.log no endpoint (já foi planeado)
2. ✅ Reproduzir erro e observar logs
3. ✅ Verificar DevTools Network para confirmar ID

### Médio Prazo
1. Melhorar mensagens de erro no frontend (mostrar ID, empresaId, status code)
2. Adicionar logs estruturados no backend com request ID
3. Adicionar page "Entidade não encontrada" com sugestões (criar nova, listar todas)

### Longo Prazo
1. Implementar analytics para rastrear 404s
2. Criar dashboard de debugging para admins
3. Validar IDs no frontend antes de navegar

---

## 📝 Resumo da Análise

**O fluxo frontend → backend está correto:**
- ✅ Navegação usa `entidade.id`
- ✅ Detail page obtém param corretamente
- ✅ Backend endpoint está no path certo
- ✅ Validações estão em lugar certo

**O problema provavelmente é:**
- ⚠️ ID não bate (frontend envia ID que não existe na DB)
- ⚠️ empresaId do user diferente da entidade
- ⚠️ Entidade foi deletada mas cache do frontend ainda tem ID
- ⚠️ Dados de teste são de outra empresa

**Próximo passo:** Adicionar logs e reproduzir para identificar exatamente qual a causa.

---

**Status: ✅ ANÁLISE CONCLUÍDA | ⏳ IMPLEMENTAÇÃO DIAGNOSTICS PENDENTE**

Recomendação: No próximo turno, adicionar os `console.log` sugeridos no backend e reproduzir o erro para identificar a causa raiz.
