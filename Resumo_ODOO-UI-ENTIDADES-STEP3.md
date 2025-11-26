# Resumo Odoo / STEP: UI Entidades – Remover Ligação ao Parceiro

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Na página de detalhe da Entidade, permitir remover a ligação ao parceiro Odoo usando:
- **Endpoint:** `POST /api/entidades/:id/odoo-link` com `{"odooPartnerId": null}`
- **UI:** Novo botão "Remover ligação" discreto mas claro
- **Sem alterações ao backend** - apenas UI + chamadas ao endpoint existente

---

## ✅ Trabalho Realizado

### 1. Função handleUnlinkOdooPartnerFromEntidade()

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx` (linhas 486-527)

**Assinatura:**
```typescript
const handleUnlinkOdooPartnerFromEntidade = async () => {
```

**Fluxo:**

```typescript
// 1. Validação: entidade existe?
if (!entidade?.id) return;

try {
  // 2. POST /api/entidades/:id/odoo-link com odooPartnerId: null
  const response = await fetch(`/api/entidades/${entidade.id}/odoo-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ odooPartnerId: null }),
  });

  // 3. Validação: sucesso?
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // 4. Invalidar cache React Query
  queryClient.invalidateQueries({ queryKey: ["/api/entidades", entidadeId] });
  
  // 5. Limpar TODO o estado Odoo local
  setOdooPartner(null);
  setOdooPartnerError(null);
  setOdooNotConfigured(false);
  setOdooSearchOpen(false);
  setOdooSearchResults([]);
  setOdooSearchTerm("");
  setOdooSearchError(null);
  setOdooSearchNotConfigured(false);

  // 6. Toast de sucesso
  toast({
    title: "Ligação removida",
    description: "A entidade deixou de estar ligada ao parceiro Odoo.",
  });
} catch (error) {
  // 7. Erro
  console.error("[Odoo] Error unlinking partner from entidade:", error);
  setOdooPartnerError("Erro ao remover ligação ao parceiro Odoo.");
  toast({
    title: "Erro",
    description: "Não foi possível remover a ligação ao parceiro Odoo.",
    variant: "destructive",
  });
}
```

**Key Features:**
- ✅ POST com `odooPartnerId: null`
- ✅ Limpeza COMPLETA de todos os 8 estados Odoo
- ✅ React Query: `invalidateQueries()` para refrescar entidade
- ✅ Dupla feedback: Toast de sucesso + Toastde erro
- ✅ Logging para debugging

### 2. UI: Botões "Ver detalhes" + "Remover ligação"

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx` (linhas 963-993)

**Antes (STEP2):**
```
┌───────────────────────────────────────────────────────┐
│ Ligado ao parceiro Odoo #123  [Ver detalhes...]      │
└───────────────────────────────────────────────────────┘
```

**Agora (STEP3):**
```
┌───────────────────────────────────────────────────────┐
│ Ligado ao parceiro Odoo #123                          │
│                                                       │
│ [Ver detalhes do parceiro] [Remover ligação]         │
└───────────────────────────────────────────────────────┘
```

**Código:**
```tsx
<p className="text-sm">
  <span className="text-muted-foreground">Ligado ao parceiro Odoo </span>
  <span className="font-medium" data-testid="text-odoo-partner-id">
    #{entidade.odooPartnerId}
  </span>
</p>

<div className="mt-2 flex flex-wrap items-center gap-2">
  <Button
    size="sm"
    variant="outline"
    onClick={handleFetchOdooPartner}
    disabled={odooPartnerLoading}
    data-testid="button-odoo-fetch-partner"
  >
    {odooPartnerLoading ? (
      <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
    ) : null}
    Ver detalhes do parceiro
  </Button>

  <Button
    size="sm"
    variant="ghost"
    className="text-destructive"
    onClick={handleUnlinkOdooPartnerFromEntidade}
    data-testid="button-odoo-unlink-partner"
  >
    Remover ligação
  </Button>
</div>
```

**Estilos:**
- `variant="outline"` + `size="sm"`: Botão primário (Ver detalhes)
- `variant="ghost"` + `text-destructive`: Botão secundário/discreto (Remover)
- `gap-2`: Espaço entre botões
- `flex-wrap`: Responsivo em ecrãs pequenos

---

## 📁 Ficheiros Editados

| Ficheiro | Linhas | Mudança |
|----------|--------|---------|
| `client/src/pages/EntidadeDetail.tsx` | 486-527 | Função `handleUnlinkOdooPartnerFromEntidade()` |
| `client/src/pages/EntidadeDetail.tsx` | 963-993 | UI: 2 botões lado a lado + layout flex |

---

## 🧪 Test IDs

| Elemento | Test ID | Tipo |
|----------|---------|------|
| Botão "Ver detalhes" | `button-odoo-fetch-partner` | Interactive |
| Botão "Remover ligação" | `button-odoo-unlink-partner` | Interactive |

---

## 🔌 Endpoint Consumido

### POST /api/entidades/:id/odoo-link

**Chamada (Unlink):**
```bash
POST /api/entidades/123/odoo-link
Content-Type: application/json

{
  "odooPartnerId": null
}
```

**Sucesso (HTTP 200):**
```json
{
  "success": true,
  "entidadeId": "123",
  "odooPartnerId": null
}
```

---

## ✅ Critérios de Aceitação

- [x] Função `handleUnlinkOdooPartnerFromEntidade()` criada
- [x] POST /api/entidades/:id/odoo-link com `{ odooPartnerId: null }`
- [x] React Query: `invalidateQueries()` para refrescar entidade
- [x] Limpeza completa de 8 estados Odoo
- [x] Toast de sucesso: "Ligação removida"
- [x] Toast de erro: "Não foi possível remover"
- [x] Botão "Ver detalhes do parceiro" mantém (outline + sm)
- [x] Botão "Remover ligação" adicionado (ghost + text-destructive)
- [x] Layout flex-wrap para responsividade
- [x] Test IDs: `button-odoo-fetch-partner`, `button-odoo-unlink-partner`
- [x] TypeScript: Sem erros
- [x] Servidor reiniciado

---

## 🚀 Fluxo de Utilização

```
1. Utilizador abre detalhe de Entidade LIGADA ao Odoo
   ├─ Card "Odoo" mostra "Ligado ao parceiro Odoo #123"
   ├─ Botão: "Ver detalhes do parceiro"
   └─ Botão: "Remover ligação" ← novo!
   ↓
2. Utilizador clica em "Remover ligação"
   ├─ UI: Desabilita botão (opcional)
   ├─ Backend: POST /api/entidades/:id/odoo-link
   │           body: { odooPartnerId: null }
   ↓
3. Sucesso na remoção
   ├─ queryClient.invalidateQueries() → refetch entidade
   ├─ Todo o estado Odoo limpo
   ├─ Toast: "Ligação removida"
   ├─ Card volta ao estado "não ligado"
   │   └─ Mostra botão "Ligar a Odoo" novamente
   └─ Detalhes do parceiro desaparecem
```

---

## 🎨 User Experience

**Quando ligado:**
```
┌─────────────────────────────────────────────┐
│ Odoo                                        │
├─────────────────────────────────────────────┤
│ Ligado ao parceiro Odoo #123                │
│                                             │
│ [Ver detalhes do parceiro] [Remover ligação]│
│                                             │
│ Nome: Empresa A                             │
│ Email: contato@empresa-a.com                │
│ Telefone: 915000000                         │
│ ...                                         │
└─────────────────────────────────────────────┘
```

**Após clicar "Remover ligação":**
```
┌─────────────────────────────────────────────┐
│ Odoo                                        │
├─────────────────────────────────────────────┤
│ Esta entidade ainda não está ligada...      │
│                                             │
│ [Ligar a Odoo]                              │
└─────────────────────────────────────────────┘

(Toast no canto inferior)
"✓ Ligação removida - A entidade deixou de estar ligada..."
```

---

## 📊 Stack Odoo Completa (STEP1+2+3)

```
Odoo Integration UI - Entidades
├─ STEP1: Visualização ✅
│  └─ Card "Odoo" + Botão "Ver detalhes" + Dados do parceiro
├─ STEP2: Pesquisa e Ligação ✅
│  └─ Dialog pesquisa + Lista de parceiros + Link
└─ STEP3: Remover Ligação ✅
   └─ Botão "Remover ligação" + Unlink

Próximas fases:
├─ ⏳ STEP4: Sincronização bidirecional
├─ ⏳ STEP5: Gestão de conflitos
└─ ⏳ STEP6: UI para Contactos (similar)
```

---

## ✅ Status de Compilação

✅ **TypeScript:** Sem erros  
✅ **React:** JSX válido  
✅ **Handlers:** 3 funções (fetch, link, unlink) completas  
✅ **UI:** 2 botões lado a lado com estilos apropriados  
✅ **Test IDs:** Todos os elementos marcados  
✅ **API Integration:** Fetch com credenciais  
✅ **State Management:** 8 estados limpos corretamente  
✅ **Servidor:** Reiniciado sem erros  

---

## 🧪 Casos de Teste

### Teste 1: Remover Ligação com Sucesso
```
1. Abrir Entidade LIGADA ao Odoo
2. Card mostra "Ligado ao parceiro Odoo #123"
3. Clicar em "Remover ligação"
4. ✅ Ver POST /api/entidades/:id/odoo-link no DevTools
5. ✅ Toast: "Ligação removida - A entidade deixou de estar..."
6. ✅ Card volta para estado não ligado
7. ✅ Botão "Ligar a Odoo" reaparece
8. ✅ Dados do parceiro desaparecem
```

### Teste 2: Erro ao Remover
```
1. Desconfigurar/desligar backend
2. Clicar em "Remover ligação"
3. ✅ Toast de erro: "Não foi possível remover a ligação..."
4. ✅ Card mantém estado (não quebra)
5. ✅ Pode tentar novamente
```

---

## 📝 Notas Técnicas

1. **JSON: null vs undefined:** Enviamos `{ odooPartnerId: null }` (null explícito, não undefined)
2. **Limpeza de estado:** Todos os 8 estados são resetados, não apenas odooPartner
3. **Responsividade:** `flex-wrap` garante que botões não quebram em ecrãs pequenos
4. **Styling:** `text-destructive` em `ghost` botão é discreto mas claro (não agressivo)
5. **Feedback:** Dupla confirmação (Toast + UI update) para ação destrutiva
6. **Logging:** Console.error para debugging
7. **React Query:** `invalidateQueries` força refetch automático

---

## 🏗️ Fluxo de Ligação Completo (3 STEPs)

```
STEP1: Visualização
┌─────────────────────────────────┐
│ Odoo                            │
├─────────────────────────────────┤
│ Não ligado                      │
│ "A ligação será configurada..." │
└─────────────────────────────────┘

STEP2: Pesquisa + Ligação
┌──────────────────────────────────┐
│ Odoo                             │
├──────────────────────────────────┤
│ [Ligar a Odoo] ← botão           │
│   ↓ abre Dialog                  │
│   [Pesquisa] [Resultados...]     │
│   ↓ seleciona                    │
│ Ligado ao parceiro Odoo #123     │
│ [Ver detalhes]                   │
└──────────────────────────────────┘

STEP3: Remover Ligação
┌───────────────────────────────────────────┐
│ Odoo                                      │
├───────────────────────────────────────────┤
│ Ligado ao parceiro Odoo #123              │
│ [Ver detalhes] [Remover ligação]         │
│              ↓ clica                      │
│ (Voltar a STEP1)                          │
└───────────────────────────────────────────┘
```

---

**Status Final: ✅ REMOVER LIGAÇÃO ODOO - COMPLETA E FUNCIONAL**

Ciclo completo pronto: Visualizar → Pesquisar → Ligar → Desligar 🎯

A UI Odoo para Entidades está 100% funcional. Próximo: Sincronização bidirecional! 🚀
