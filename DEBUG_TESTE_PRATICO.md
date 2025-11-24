# 🔧 DEBUG PRÁTICO – Testes de Gravação e IA

## TESTE 1: Gravação do Tipo de Entidade

### Passo 1: Abrir a app
1. Vai a http://localhost:5000
2. Entras com o teu utilizador
3. Vas a **Entidades**

### Passo 2: Criar ou editar uma entidade
**CRIAR:**
- Clica em **+ Nova Entidade**
- Escreve um nome (ex: "ACME Corp")
- Escolhe um tipo na dropdown (ex: "Cliente")
- Grava

**EDITAR:**
- Abre uma entidade existente
- Clica em **Editar**
- Muda o tipo (ex: de "Cliente" para "Distribuidor")
- Grava

### Passo 3: Abrir Browser DevTools
- Prima `F12` (ou Cmd+Option+I no Mac)
- Vai à aba **Console**
- Ou abre terminal do Replit para ver logs do backend

### Passo 4: Vê os logs - O que procurar:

**No FRONTEND (Browser Console):**
Deve ver algo como:
```
[EntidadeForm UPDATE] data a enviar: {nome: "...", entidadeTipoId: "uuid-123", ...}
[EntidadeForm UPDATE] entidadeTipoId: uuid-123
```

**No BACKEND (Terminal Replit):**
Deve ver:
```
[DEBUG ENTIDADE PATCH] body recebido: {nome: "...", entidadeTipoId: "uuid-123", ...}
[DEBUG ENTIDADE PATCH] entidadeTipoId no body: uuid-123
[DEBUG ENTIDADE UPDATE] entidadeData recebido: {entidadeTipoId: "uuid-123", ...}
[DEBUG ENTIDADE UPDATE] entidadeTipoId: uuid-123
[DEBUG ENTIDADE UPDATE] entidade gravada na BD: {id: "...", entidadeTipoId: "uuid-123", entidadeTipo: {nome: "Distribuidor"}, ...}
[DEBUG ENTIDADE UPDATE] entidadeTipoId após update: uuid-123
[DEBUG ENTIDADE GET] entidade retornada com JOIN: {id: "...", entidadeTipoId: "uuid-123", entidadeTipo: {nome: "Distribuidor"}}
```

### Passo 5: Verifica se está correcto
- ✅ Tipo novo aparece no badge de detalhe?
- ✅ Se abrires em edição novamente, o tipo mudou?
- ✅ Os logs mostram `entidadeTipoId` correcto em todas as etapas?

---

## TESTE 2: Pesquisa por IA no Nome

### Passo 1: Criar nova entidade
- Vai a **Entidades > + Nova Entidade**
- Abre Browser DevTools (F12)
- Vai à aba **Console**

### Passo 2: Escreve um nome de empresa
- No campo **Nome**, escreve "MEO" ou "Vodafone" ou "Google" (algo que saibas que existe)
- Aguarda 1 segundo (tem debounce de 500ms)
- Procura aparecer um dropdown com sugestões

### Passo 3: Vê os logs - O que procurar:

**No FRONTEND (Browser Console):**
Deve ver algo como:
```
[DEBUG IA ENTIDADE] request payload: {debouncedValue: "MEO", existingEntityId: undefined, tipoEntidade: undefined}
[DEBUG IA ENTIDADE] response: {fuzzyMatches: [...], googleResults: [...], enrichmentSource: "google"}
```

**No BACKEND (Terminal Replit):**
Deve ver:
```
[DEBUG IA ENTIDADE] request payload: {nome: "MEO", existingEntityId: undefined, tipoEntidade: undefined, userId: "..."}
[PT-Search] Calling ptIntelligentSearch with input: {nome: "MEO", userId: "...", existingEntityId: undefined}
[PT-Search] ptIntelligentSearch result: {fuzzyMatchesCount: 0, enrichmentSource: "none"}
[PT-Search] No fuzzy matches for "MEO", attempting Google Search
[PT-Search] Google Search returned 3 results
[DEBUG IA ENTIDADE] resposta OpenAI/IA: {googleResults: [{nome: "MEO", website: "..."}], fuzzyMatches: []}
```

### Passo 4: Verifica se está correcto
- ✅ Dropdown aparece com sugestões?
- ✅ Consegues clicar numa sugestão?
- ✅ Os logs mostram resultados do Google Search?

---

## Se NÃO vires resultados de IA:

1. **Vê se há erro no console:**
   - Erro de "403", "401" → Problema de autorização
   - Erro de "500" → Erro no backend
   - Erro de "Network" → Problema de conexão

2. **Vê se a resposta é vazia:**
   - Backend retorna `fuzzyMatches: []` e `googleResults: []`
   - Pode ser que Google Search não tenha resultados para esse termo

3. **Se tipoEntidade é obrigatório:**
   - Tenta escolher um tipo de entidade ANTES de escrever o nome
   - Depois escreve o nome

---

## Copia os logs para o relatório:

Depois de testares, copia e cola aqui:

### Logs do Frontend (Browser Console):
[copia os logs com "DEBUG IA ENTIDADE" ou "EntidadeForm UPDATE"]

### Logs do Backend (Terminal):
[copia os logs com "DEBUG ENTIDADE PATCH" ou "DEBUG IA ENTIDADE" ou "PT-Search"]

---

