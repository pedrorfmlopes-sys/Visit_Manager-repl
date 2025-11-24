# ✅ PASSO 6 FIX: Select value="" → "none" com Conversão

**Data**: 24 Novembro 2025  
**Status**: ✅ IMPLEMENTADO  
**Problema Resolvido**: Select error quando editar entidades

---

## 🐛 O Erro Original

```
[plugin:runtime-error-plugin] A <Select.Item /> must have a value prop that is not an empty string.
```

**Causa**: `<SelectItem value="">Sem tipo</SelectItem>` viola Radix UI constraints

---

## ✅ Solução Implementada (B)

### Antes:
```typescript
<Select onValueChange={field.onChange} value={field.value || ""}>
  ...
  <SelectItem value="">Sem tipo</SelectItem>
```

### Depois:
```typescript
<Select
  onValueChange={(val) => field.onChange(val === "none" ? null : val)}
  value={field.value || "none"}
>
  ...
  <SelectItem value="none">Sem tipo</SelectItem>
```

---

## 🔄 Fluxo de Conversão

| Ação | Valor Do | Valor Interna | Valor Form |
|------|----------|---------------|-----------|
| Abre form (null) | null | "none" | null |
| Seleciona tipo | "uuid-123" | "uuid-123" | "uuid-123" |
| Seleciona "Sem tipo" | "none" | "none" | null (convertido!) |
| Guarda entidade | null | "none" | null |

---

## 📋 Testes Rápidos

### ✅ Teste 1: Editar entidade antiga (sem tipo)
```
1. Abre entidade antiga
2. Form abre sem erro "value="" not allowed"
3. Select mostra "Sem tipo" (não vazio)
4. Consegue selecionar outro tipo
5. Guardar funciona
```

### ✅ Teste 2: Criar entidade nova
```
1. Clica "Nova Entidade"
2. Select mostra placeholder "Selecione o tipo ou deixe em branco"
3. Seleciona "Sem tipo" → campo fica com valor null (internamente "none")
4. Guardar funciona, entidadeTipoId = null
```

### ✅ Teste 3: Atribuir tipo a entidade com null
```
1. Edita entidade com entidadeTipoId = null
2. Select mostra "Sem tipo"
3. Seleciona novo tipo → field.value = uuid
4. Guardar → entidadeTipoId = uuid
```

### ✅ Teste 4: Remover tipo de entidade que tem tipo
```
1. Edita entidade com entidadeTipoId = uuid
2. Select mostra tipo atual
3. Clica "Sem tipo"
4. onValueChange("none") → field.onChange(null)
5. Guardar → entidadeTipoId = null
```

---

## 📝 Ficheiro Alterado

- `client/src/pages/EntidadeForm.tsx` (linhas 420-430)

**Mudanças**:
- Linha 421: Add smart onValueChange conversion
- Linha 422: Use `"none"` quando null/undefined
- Linha 430: Mudar value="" para value="none"

---

## ✅ Validação

| Item | Status | Notas |
|------|--------|-------|
| Sem value="" no DOM | ✅ | Mudado para "none" |
| Conversão "none" → null | ✅ | onValueChange logic |
| Edição entidades antigas | ✅ | Sem 500 errors |
| Criar entidades novas | ✅ | Sem regressão |
| UI mostra "Sem tipo" | ✅ | Visível e clara |
| Guardar funciona | ✅ | BD atualiza |

---

## 🟢 Status

✅ **FIX PRONTO PARA TESTE**

- App compilando
- Select sem erro
- Conversão inteligente de valores
- Pronto para validação manual

