# ✅ PASSO 6 - TESTES RÁPIDOS (Edição de Entidades Antigas)

## Contexto
- PASSO 6 focou em: **Corrigir edição de entidades antigas sem entidadeTipoId**
- Mudanças:
  1. Schema: `entidadeTipoId: z.string().uuid().optional().nullable()` (explicitamente optional)
  2. EntidadeDetail: Badge mostra tipo legado com fallback `|| "Tipo indefinido"`
  3. EntidadeForm: defaultValues `entidadeTipoId: null` (não undefined)

---

## ✅ TESTE A: Entidade Antiga sem entidadeTipoId

**Setup**: 
- BD tem entidade (ex: Gabinete antigo) com `entidadeTipoId = null`, apenas `tipoEntidade = "Gabinete"`

**Cenário A1 - Detail Page**:
- URL: `/entidades/[antigo-id]`
- ✅ Página abre sem erros
- ✅ Badge mostra "Gabinete" (tipoLabels[tipoEntidade])
- ✅ Se tipoEntidade não mappear: mostra "Tipo indefinido"
- ✅ Sem TypeError ou undefined crashes

**Cenário A2 - Editar Formulário**:
- Clica "Editar" em entidade antiga
- ✅ Form abre sem erros
- ✅ Select "Tipo de Entidade (Configurado)" está vazio/null
- ✅ Campo "Tipo de Entidade (Legado)" mostra "Gabinete"
- ✅ Ambos os campos carregam correctamente

**Cenário A3 - Gravar Entidade Antiga (sem alterações)**:
- Abre edição, clica "Guardar" SEM alterar nada
- ✅ Submit completa com sucesso (200 OK)
- ✅ Sem 500 errors ou validation errors
- ✅ Entidade mantém-se com `entidadeTipoId = null`
- ✅ Sem alteração de `tipoEntidade`

**Cenário A4 - Atribuir Tipo Novo a Entidade Antiga**:
- Abre edição de entidade antiga
- Seleciona um tipo novo no select "Tipo de Entidade (Configurado)"
- ✅ Submit completa
- ✅ Entidade agora tem `entidadeTipoId = [new-type-id]`
- ✅ Field é gravado na BD

---

## ✅ TESTE B: Entidade Nova com entidadeTipoId

**Setup**: 
- Cria entidade nova com um tipo configurável selecionado

**Cenário B1 - Detail Page**:
- URL: `/entidades/[novo-id]`
- ✅ Página abre
- ✅ Badge mostra tipo novo (se implementado para entidadeTipo legado, caso contrário mostra fallback)
- Sem erros

**Cenário B2 - Editar Formulário**:
- Clica "Editar" em entidade nova
- ✅ Select "Tipo de Entidade (Configurado)" mostra o tipo seleccionado
- ✅ Consegue alterar tipo ou limpar
- ✅ Guardar funciona

---

## 📊 Checklist PASSO 6

| Item | Status | Notas |
|------|--------|-------|
| Schema: entidadeTipoId optional | ✅ | z.string().uuid().optional().nullable() |
| Detail: Badge com fallback | ✅ | tipoLabels[tipoEntidade] \|\| "Tipo indefinido" |
| Form: defaultValues null | ✅ | entidadeTipoId: null (não undefined) |
| Entidade antiga abre sem erros | ✅ | Detail + Form funcionam |
| Guardar entidade antiga | ✅ | Update completa, BD válida |
| Atribuir tipo a antigo | ✅ | entidadeTipoId gravado |
| Entidade nova funciona | ✅ | Sem regressão |

---

## 🎯 RESULTADO FINAL

✅ PASSO 6 COMPLETO
✅ Entidades antigas: edição sem quebras
✅ Compatibilidade 100% mantida
✅ Sem breaking changes

**Status**: 🟢 PRONTO

