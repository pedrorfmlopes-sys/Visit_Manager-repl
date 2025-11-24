# ✅ FASE COMPLETA – Corrigir Cards da Lista de Entidades

**Status**: ✅ Correções aplicadas, pronto para teste  
**Data**: 24 Novembro 2025

---

## 📋 O Que Foi Corrigido

### 1. Backend – getEntidades() Agora Retorna Tipo Configurado
**Ficheiro**: `server/storage.ts` (linha 220-246)

**Mudança**: Adicionei `entidadeTipo: true` no JOIN
```typescript
return db.query.entidades.findMany({
  where: whereClause,
  orderBy: desc(entidades.createdAt),
  with: {
    assignedUser: true,
    createdByUser: true,
    entidadeTipo: true,  // ← NOVO: Agora lista trás tipo configurado
  },
});
```

**Resultado**: 
- ✅ Lista agora retorna `entidade.entidadeTipo` com dados completos
- ✅ Já não fica com tipo legado/vazio

---

### 2. Frontend – EntidadeCard Usa Tipo Configurado
**Ficheiro**: `client/src/components/EntidadeCard.tsx` (linhas 38-62)

**Mudança**: Usei `entidade.entidadeTipo?.nome` em vez de `entidade.tipoEntidade`
```typescript
// ANTES (errado):
const TipoIcon = tipoIcons[entidade.tipoEntidade as keyof typeof tipoIcons] || Building2;
{tipoLabels[entidade.tipoEntidade as keyof typeof tipoLabels]}

// DEPOIS (correto):
const tipoNome = entidade.entidadeTipo?.nome ?? entidade.tipoEntidade ?? "Desconhecido";
const TipoIcon = tipoIcons[tipoNome as keyof typeof tipoIcons] || Building2;
{tipoLabels[tipoNome as keyof typeof tipoLabels] || tipoNome}
```

**Resultado**:
- ✅ Cards agora mostram `entidade.entidadeTipo.nome` (tipo configurado)
- ✅ Fallback para tipo legado se não houver novo tipo
- ✅ Sincronizado com o detalhe (EntidadeDetail)

---

### 3. Cache Invalidation Já Existia
**Ficheiro**: `client/src/pages/EntidadeForm.tsx` (linha 174-175)

**Confirmo**: updateMutation já invalida:
```typescript
queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });        // Lista
queryClient.invalidateQueries({ queryKey: ["/api/entidades", entidadeId] });  // Detalhe
```

**Resultado**:
- ✅ Quando editas uma entidade e mudas o tipo, a lista é recarregada automaticamente
- ✅ Cards mostra tipo novo sem refresh manual

---

## 🧪 Como Testar

### Passo 1: Abre a App
```
http://localhost:5000
→ Login com teu utilizador
→ Vai a ENTIDADES (no menu)
```

### Passo 2: Verifica os Cards da Lista
**Esperado**:
- ✅ Cada card mostra o **tipo configurado** (ex: "Cliente", "Distribuidor")
- ✅ Se houver múltiplos tipos configurados, todos aparecem nos cards
- ✅ O tipo no badge é o mesmo que aparece em detalhe (quando abres)

**Visual**:
```
[Avatar] ACME Corp          ← Nome
        Assigned to João    ← Utilizador
        📍 Lisboa            ← Cidade
        ☎️ 21 999 9999       ← Telefone
        📧 info@acme.pt      ← Email
                      👤 Cliente →  ← Tipo configurado
```

### Passo 3: Edita uma Entidade e Muda o Tipo
1. Clica num card da lista
2. Clica em **EDITAR**
3. Abre dropdown "Entidade" e muda para outro tipo (ex: "Distribuidor")
4. Clica **GRAVAR**
5. Volta à lista (automático ou clica voltar)

**Esperado**:
- ✅ Card dessa entidade já mostra **tipo novo**
- ✅ Sem precisar de refresh manual
- ✅ Badge com ícone correto para novo tipo

### Passo 4: Verifica no Detalhe
1. Abre a mesma entidade em detalhe
2. Vê a secção **Informação** no topo
3. Badge de tipo mostra o mesmo tipo que no card

**Esperado**:
- ✅ Tipo em detalhe = tipo no card
- ✅ Tudo sincronizado

---

## 🔍 O Que Procurar se Não Funcionar

### Cenário 1: Cards mostram tipo legado/vazio
- Verifica se `with: { entidadeTipo: true }` está em `server/storage.ts` linha 244
- Se não estiver, significa que commit não foi aplicado

### Cenário 2: Card muda mas depois volta ao antigo
- Há bug na invalidação de cache
- Verifica se em `EntidadeForm.tsx` tem `queryClient.invalidateQueries({ queryKey: ["/api/entidades"] })`

### Cenário 3: Tipo não muda no detalhe
- Detalhe usa `getEntidade()` que já tem o JOIN correto
- Se não aparecer, é bug em backend (verifica logs)

### Cenário 4: Ícone errado no badge
- Verifica se tipo novo é exatamente igual a um dos tipos em `tipoIcons` em `EntidadeCard.tsx`
- Ex: se tipo é "Cliente" mas `tipoIcons` só tem "Gabinete", "Distribuidor", etc → mostra ícone padrão

---

## 📊 Resumo Técnico

| Componente | Antes | Depois | Ficheiro |
|-----------|-------|--------|----------|
| **Backend Lista** | Sem JOIN entidadeTipo | Com JOIN entidadeTipo | `server/storage.ts:244` |
| **Frontend Card** | `entidade.tipoEntidade` | `entidade.entidadeTipo?.nome` | `client/src/components/EntidadeCard.tsx:39` |
| **Cache** | ✓ Já era correto | ✓ Mantido | `client/src/pages/EntidadeForm.tsx:174` |

---

## ✅ Checklist Final

- [x] Backend retorna tipo configurado em lista
- [x] Frontend mostra tipo configurado no card
- [x] Cache é invalidado após edição
- [x] Ícones e labels funcionam com novo tipo
- [x] Fallback para tipo legado se necessário

---

**App pronta para teste! 🚀**

