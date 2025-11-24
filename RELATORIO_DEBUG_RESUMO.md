# 📋 RESUMO DE CORREÇÕES – Gravação de Tipo & IA no Nome

**Data**: 24 Novembro 2025  
**Status**: ✅ Correções aplicadas, pronto para teste prático

---

## 🔧 Problema 1: Gravação do Tipo de Entidade Continua Errada

### Problema Identificado:
No `EntidadeForm.tsx`, o form tinha:
```typescript
const form = useForm<InsertEntidade>({
  defaultValues: entidade || {...},
  values: entidade,  // ← CULPADO! Sobrescrevia defaultValues a cada render
});
```

Quando `entidade` chegava do backend, o campo `values` sobrescrevia tudo, mas SE `entidade` ainda estava undefined, ficava undefined.
**Resultado**: Form não sincronizava com dados da edição, enviava valores errados ou undefined.

### ✅ Correção Aplicada:
1. **Removi `values: entidade`** ❌ → agora só tem `defaultValues`
2. **Adicionei `useEffect` com `form.reset()`** ✅ → quando entidade chega, reseta todos os campos corretamente
3. **Adicionei logs no `updateMutation`** ✅ → vê o que está a ser enviado
4. **Adicionei import de `useEffect`** ✅ 

**Arquivo**: `client/src/pages/EntidadeForm.tsx`

**Código corrigido:**
```typescript
// ANTES (errado):
values: entidade,

// DEPOIS (correto):
// useEffect que sincroniza form quando entidade chega
useEffect(() => {
  if (entidade) {
    form.reset({
      entidadeTipoId: entidade.entidadeTipoId ?? null,
      nome: entidade.nome,
      // ... todos os campos
    });
  }
}, [entidade, form]);
```

---

## 🤖 Problema 2: Pesquisa por IA no Nome não Devolve Resultados

### Problema Identificado:
A rota `/api/enrichment/pt-intelligent-search` EXIGIA `tipoEntidade` como string:
```typescript
if (!tipoEntidade || typeof tipoEntidade !== 'string') {
  return res.json({
    fuzzyMatches: [],
    googleResults: [],
    enrichmentSource: 'disabled',
  });
}
```

**Resultado**: Ao criar entidade nova (sem tipo escolhido ainda), a pesquisa retornava vazio.

### ✅ Correção Aplicada:
1. **Fiz `tipoEntidade` opcional** ✅ → pesquisa continua mesmo sem tipo
2. **Melhorei validação** ✅ → só bloqueia se `tipoEntidade` vier e NOT for string
3. **Adicionei logs completos** ✅ → pode ver cada passo

**Arquivo**: `server/routes.ts` (linhas 1985-2035)

**Código corrigido:**
```typescript
// ANTES (errado):
if (!tipoEntidade || typeof tipoEntidade !== 'string') {
  return res.json({ ... disabled ... });
}

// DEPOIS (correto):
// tipoEntidade é opcional
if (tipoEntidade && typeof tipoEntidade !== 'string') {
  console.log('[PT-Search] tipoEntidade veio mas não é string, ignorando:', tipoEntidade);
}
```

---

## 📊 Logs Adicionados para Debug

### Frontend (Browser Console):
```
[EntidadeForm UPDATE] data a enviar: {...}
[EntidadeForm UPDATE] entidadeTipoId: uuid-123
[DEBUG IA ENTIDADE] request payload: {...}
[DEBUG IA ENTIDADE] response: {...}
```

### Backend (Terminal):
```
[DEBUG ENTIDADE PATCH] body recebido: {...}
[DEBUG ENTIDADE UPDATE] entidadeData recebido: {...}
[DEBUG ENTIDADE UPDATE] entidade gravada na BD: {...}
[DEBUG ENTIDADE GET] entidade retornada com JOIN: {...}
[DEBUG IA ENTIDADE] request payload: {...}
[PT-Search] Calling ptIntelligentSearch with input: {...}
[DEBUG IA ENTIDADE] resposta OpenAI/IA: {...}
```

---

## ✅ Resumo de Arquivos Modificados

| Arquivo | Mudança | Razão |
|---------|---------|-------|
| `client/src/pages/EntidadeForm.tsx` | Remover `values`, adicionar `useEffect` reset | Form sincronização |
| `server/storage.ts` | Adicionar JOIN com `entidadeTipo`, logs | Debug |
| `server/routes.ts` | Adicionar logs PATCH, melhorar validação tipoEntidade | Debug + IA funcionar sem tipo |
| `client/src/components/GoogleCompanySearch.tsx` | Adicionar logs | Debug IA |

---

## 🧪 Próximo Passo: Teste Prático

Vê o ficheiro **DEBUG_TESTE_PRATICO.md** para instruções completas.

**Resumo rápido:**
1. Abre app: http://localhost:5000
2. Abre **Browser DevTools** (F12)
3. Testa edição de entidade (muda tipo)
4. Vê se logs aparecem e se tipo muda corretamente
5. Testa pesquisa IA no nome ("MEO", "Google", etc)
6. Fornece os logs para análise final

---

## 🎯 Se Ainda Houver Problemas:

**Para gravação:**
- Vê se o log `[DEBUG ENTIDADE UPDATE] entidadeTipoId` mostra o valor correcto
- Vê se o log `[DEBUG ENTIDADE GET] entidade retornada` volta com tipo correcto
- Se não, há bug na BD (FK, trigger, ou query)

**Para IA:**
- Vê se o log `[DEBUG IA ENTIDADE] response` tem `googleResults` com dados
- Se vazio, Google Search não achou resultados para esse termo
- Se erro 500, há problema na rota

---

**App pronta para teste!** 🚀

