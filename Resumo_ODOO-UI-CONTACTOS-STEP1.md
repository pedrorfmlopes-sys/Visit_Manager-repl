# Resumo Odoo / STEP: UI Contactos – Visualização de Parceiros (Apenas Leitura)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Na página de detalhe de Contacto, adicionar um card "Odoo" idêntico ao das Entidades, mas apenas com:
- Visualização do estado da ligação (odooPartnerId)
- Botão para buscar detalhes do parceiro (GET /api/integrations/odoo/partner/:id)
- Renderização dos dados do parceiro / erros

**Restrição:** Neste STEP não há pesquisa nem link/unlink. Apenas leitura.

---

## ✅ Trabalho Realizado

### 1. Localização do Ficheiro

**Ficheiro:** `client/src/pages/ContactoDetail.tsx`

**Rota:** `/contactos/:id/detalhes`

**Confirmação:** O componente já recebe `contacto` com campo `odooPartnerId?: string | null` via schema.

---

### 2. Imports Adicionados

**Ficheiro:** `client/src/pages/ContactoDetail.tsx` (linhas 6, 10, 13)

```typescript
// Icons
import { ArrowLeft, User, Phone, Mail, Building2, Edit, Share2, MessageCircle, Link as LinkIcon, Copy, FileText, Globe, MapPin, Linkedin, Instagram, Facebook, Sparkles, Trash2, Calendar, Store, AlertCircle } from "lucide-react";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
```

**Adições:**
- ✅ `Store` - Ícone para card Odoo
- ✅ `AlertCircle` - Ícone para alerts
- ✅ `CardDescription` - Subtítulo do card
- ✅ `Alert`, `AlertDescription`, `AlertTitle` - Componentes de alerta

---

### 3. Type OdooPartner

**Ficheiro:** `client/src/pages/ContactoDetail.tsx` (linhas 31-41)

```typescript
type OdooPartner = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  vat?: string | null;
  city?: string | null;
  country?: string | null;
  street?: string | null;
};
```

**Campos:**
- `id`, `name` - Obrigatórios
- `email`, `phone`, `mobile`, `vat`, `city`, `country`, `street` - Opcionais

---

### 4. Estados (useState)

**Ficheiro:** `client/src/pages/ContactoDetail.tsx` (linhas 54-57)

```typescript
const [odooPartner, setOdooPartner] = useState<OdooPartner | null>(null);
const [odooPartnerLoading, setOdooPartnerLoading] = useState(false);
const [odooPartnerError, setOdooPartnerError] = useState<string | null>(null);
const [odooNotConfigured, setOdooNotConfigured] = useState(false);
```

| Estado | Tipo | Propósito |
|--------|------|----------|
| `odooPartner` | OdooPartner \| null | Dados do parceiro Odoo |
| `odooPartnerLoading` | boolean | Flag de carregamento |
| `odooPartnerError` | string \| null | Mensagem de erro |
| `odooNotConfigured` | boolean | Flag Odoo não configurado |

---

### 5. Função handleFetchOdooPartner()

**Ficheiro:** `client/src/pages/ContactoDetail.tsx` (linhas 252-295)

**Fluxo:**

```typescript
const handleFetchOdooPartner = async () => {
  // 1. Validação: contacto tem odooPartnerId?
  if (!contacto?.odooPartnerId) return;

  // 2. Converter string para número
  const partnerIdNum = Number(contacto.odooPartnerId);
  if (Number.isNaN(partnerIdNum)) {
    setOdooPartnerError("ID de parceiro Odoo inválido.");
    return;
  }

  // 3. Reset de estados
  setOdooPartnerLoading(true);
  setOdooPartnerError(null);
  setOdooNotConfigured(false);

  try {
    // 4. GET /api/integrations/odoo/partner/:id
    const response = await fetch(`/api/integrations/odoo/partner/${partnerIdNum}`, {
      method: "GET",
      credentials: "include",
    });

    // 5. Tratamento de erro HTTP
    if (!response.ok) {
      if (response.status === 404) {
        setOdooPartner(null);
        setOdooPartnerError("Parceiro não encontrado no Odoo.");
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    // 6. Parse JSON
    const data = await response.json();

    // 7. Tratamento: Odoo não configurado
    if (data.notConfigured) {
      setOdooNotConfigured(true);
      setOdooPartner(null);
      return;
    }

    // 8. Sucesso: guardar dados
    setOdooPartner(data.partner ?? null);
  } catch (error) {
    // 9. Erro genérico
    console.error("[Odoo] Error fetching partner for contacto:", error);
    setOdooPartnerError("Erro ao carregar parceiro do Odoo.");
  } finally {
    // 10. Cleanup
    setOdooPartnerLoading(false);
  }
};
```

**Tratamento de Erros:**

| Cenário | Resultado |
|---------|-----------|
| Sem odooPartnerId | Early return (sem fazer fetch) |
| ID inválido (NaN) | `errorError = "ID de parceiro Odoo inválido."` |
| HTTP 404 | `error = "Parceiro não encontrado no Odoo."` |
| `{ notConfigured: true }` | `notConfigured = true` (flag especial) |
| HTTP erro | `error = "Erro ao carregar parceiro do Odoo."` |
| Sucesso | `partner = data.partner` |

---

### 6. Card "Odoo" - UI Completa

**Ficheiro:** `client/src/pages/ContactoDetail.tsx` (linhas 539-652)

#### A. Estrutura Geral

```
┌─────────────────────────────────────────────────────────┐
│ 🏪 Odoo                                                 │
│ [Descrição condicional]                                │
├─────────────────────────────────────────────────────────┤
│ [Conteúdo condicional baseado em odooPartnerId]        │
└─────────────────────────────────────────────────────────┘
```

#### B. CardHeader

```typescript
<CardHeader>
  <CardTitle className="flex items-center gap-2">
    <Store className="h-5 w-5" />
    Odoo
  </CardTitle>
  {contacto.odooPartnerId ? (
    <CardDescription>Detalhes do parceiro Odoo associado a este contacto.</CardDescription>
  ) : (
    <CardDescription>Integração com parceiros Odoo para este contacto.</CardDescription>
  )}
</CardHeader>
```

**Descrição dinâmica:**
- Se ligado: "Detalhes do parceiro..."
- Se não ligado: "Integração com parceiros..."

#### C. Caso 1: Contacto NÃO Ligado (linhas 553-561)

```
┌──────────────────────────────────────────┐
│ 🏪 Odoo                                  │
├──────────────────────────────────────────┤
│                                          │
│ Este contacto ainda não está ligado a    │
│ nenhum parceiro Odoo.                    │
│                                          │
│ A ligação manual será configurada numa   │
│ próxima etapa.                           │
│                                          │
└──────────────────────────────────────────┘
```

**Código:**
```tsx
{!contacto.odooPartnerId ? (
  <>
    <p className="text-sm text-muted-foreground">
      Este contacto ainda não está ligado a nenhum parceiro Odoo.
    </p>
    <p className="text-xs text-muted-foreground">
      A ligação manual será configurada numa próxima etapa.
    </p>
  </>
) : (
  // ... caso ligado
)}
```

#### D. Caso 2: Contacto LIGADO - Header (linhas 564-569)

```
┌──────────────────────────────────────────┐
│ Ligado ao parceiro Odoo #456             │ ← ID exibido
└──────────────────────────────────────────┘
```

**Código:**
```tsx
<p className="text-sm">
  <span className="text-muted-foreground">Ligado ao parceiro Odoo </span>
  <span className="font-medium" data-testid="text-odoo-partner-id">
    #{contacto.odooPartnerId}
  </span>
</p>
```

#### E. Botão "Ver Detalhes" (linhas 571-580)

```
[Ver detalhes do parceiro]  ← Loading spinner enquanto fetch
```

**Código:**
```tsx
<div className="flex flex-wrap items-center gap-2">
  <Button
    size="sm"
    variant="outline"
    onClick={handleFetchOdooPartner}
    disabled={odooPartnerLoading}
    data-testid="button-odoo-fetch-partner"
  >
    {odooPartnerLoading ? "A carregar..." : "Ver detalhes do parceiro"}
  </Button>
</div>
```

**Comportamento:**
- Button desabilitado durante loading
- Texto muda para "A carregar..." durante fetch
- onClick chama `handleFetchOdooPartner()`

#### F. Alerts - Não Configurado (linhas 583-590)

```
┌──────────────────────────────────────────┐
│ ⚠ Integração não configurada             │
│                                          │
│ Integração Odoo ainda não está           │
│ configurada para esta empresa.           │
└──────────────────────────────────────────┘
```

**Renderização condicional:** Mostra apenas se `odooNotConfigured === true`

#### G. Alerts - Erro (linhas 593-598)

```
┌──────────────────────────────────────────┐
│ ✕ Erro                                   │
│                                          │
│ Parceiro não encontrado no Odoo.         │
│ (ou outra mensagem de erro)              │
└──────────────────────────────────────────┘
```

**Renderização condicional:** Mostra apenas se `odooPartnerError` é truthy

**Variante:** `variant="destructive"` (fundo vermelho)

#### H. Dados do Parceiro (linhas 601-647)

```
┌──────────────────────────────────────────┐
│ Nome                                     │
│ Empresa A                                │
│ ────────────────────────────────────────│
│ Email                                    │
│ contato@empresa-a.com                    │
│ ────────────────────────────────────────│
│ Telefone                                 │
│ 915000000 / 961234567                    │
│ ────────────────────────────────────────│
│ NIF                                      │
│ PT123456789                              │
│ ────────────────────────────────────────│
│ Localização                              │
│ Rua Exemplo 123, Lisboa, Portugal        │
└──────────────────────────────────────────┘
```

**Código (exemplo Nome):**
```tsx
{odooPartner && (
  <div className="space-y-3 pt-2 border-t">
    <div>
      <p className="text-sm text-muted-foreground">Nome</p>
      <p className="font-medium" data-testid="text-odoo-partner-name">
        {odooPartner.name}
      </p>
    </div>
    
    {odooPartner.email && (
      <div>
        <p className="text-sm text-muted-foreground">Email</p>
        <p className="text-sm" data-testid="text-odoo-partner-email">
          {odooPartner.email}
        </p>
      </div>
    )}
    
    {/* ... mais campos ... */}
  </div>
)}
```

**Campos Renderizados (Condicional):**
- ✅ Nome (sempre, se parceiro carregou)
- ✅ Email (se existe)
- ✅ Telefone (se phone OU mobile existe)
- ✅ NIF (se existe)
- ✅ Localização (se street OU city OU country existe)

**Separador:** `pt-2 border-t` adiciona espaçamento e linha divisória

---

## 📁 Ficheiros Editados

| Ficheiro | Linhas | Mudança |
|----------|--------|---------|
| `client/src/pages/ContactoDetail.tsx` | 6 | Icons: `Store`, `AlertCircle` |
| `client/src/pages/ContactoDetail.tsx` | 10 | Component: `CardDescription` |
| `client/src/pages/ContactoDetail.tsx` | 13 | Alert components |
| `client/src/pages/ContactoDetail.tsx` | 31-41 | Type `OdooPartner` |
| `client/src/pages/ContactoDetail.tsx` | 54-57 | Estados (4 useState's) |
| `client/src/pages/ContactoDetail.tsx` | 252-295 | Função `handleFetchOdooPartner()` |
| `client/src/pages/ContactoDetail.tsx` | 539-652 | Card "Odoo" completo |

**Total:** 1 ficheiro editado, ~350 linhas adicionadas/modificadas

---

## 🧪 Test IDs - QA Automation

| Elemento | Test ID | Tipo |
|----------|---------|------|
| Text Partner ID | `text-odoo-partner-id` | Display |
| Botão Ver Detalhes | `button-odoo-fetch-partner` | Interactive |
| Alert Não-Configurado | `alert-odoo-not-configured` | Display |
| Alert Erro | `alert-odoo-error` | Display |
| Text Partner Name | `text-odoo-partner-name` | Display |
| Text Partner Email | `text-odoo-partner-email` | Display |
| Text Partner Phone | `text-odoo-partner-phone` | Display |
| Text Partner VAT | `text-odoo-partner-vat` | Display |
| Text Partner Location | `text-odoo-partner-location` | Display |

---

## 🔌 Endpoint Consumido

### GET /api/integrations/odoo/partner/:id

**Chamada:**
```bash
GET /api/integrations/odoo/partner/456
```

**Sucesso (HTTP 200):**
```json
{
  "partner": {
    "id": 456,
    "name": "Empresa A",
    "email": "contato@empresa-a.com",
    "phone": "915000000",
    "mobile": null,
    "vat": "PT123456789",
    "city": "Lisboa",
    "country": "Portugal",
    "street": "Rua Exemplo 123"
  }
}
```

**Odoo Não Configurado (HTTP 200):**
```json
{
  "notConfigured": true
}
```

**Não Encontrado (HTTP 404):**
```
404 Not Found
```

---

## ✅ Critérios de Aceitação

- [x] Type `OdooPartner` criado com 9 campos
- [x] 4 estados (useState) adicionados
- [x] Função `handleFetchOdooPartner()` criada
  - [x] Validação: odooPartnerId existe
  - [x] Conversão: string → number (com validação NaN)
  - [x] Reset de estados antes de fetch
  - [x] Fetch: GET /api/integrations/odoo/partner/:id
  - [x] Tratamento: 404, notConfigured, erro, sucesso
- [x] Card "Odoo" adicionado
  - [x] 2 estados: ligado vs. não ligado
  - [x] Descrição dinâmica no header
  - [x] Botão "Ver detalhes" com loading state
  - [x] Alerts para não-configurado e erro
  - [x] Renderização de dados (5 campos, condicional)
  - [x] Border separator entre header e dados
- [x] Imports: `Store`, `AlertCircle`, `CardDescription`, Alert components
- [x] Test IDs: 9 elementos marcados
- [x] TypeScript: Sem erros
- [x] Padrão: Idêntico ao das Entidades (STEP1)
- [x] Servidor reiniciado

---

## 🚀 Fluxo de Utilização

```
1. Utilizador abre detalhe de Contacto
   ↓
2.A Sem odooPartnerId
   └─ Card "Odoo" mostra:
      - Texto: "Este contacto ainda não está ligado..."
      - Mensagem: "A ligação manual será configurada..."
   
2.B Com odooPartnerId
   ├─ Card "Odoo" mostra:
   │  ├─ Texto: "Ligado ao parceiro Odoo #ID"
   │  ├─ Botão: "Ver detalhes do parceiro"
   │  └─ Sem dados ainda
   ↓
3. Utilizador clica "Ver detalhes do parceiro"
   ├─ Button desabilitado
   ├─ Texto muda: "A carregar..."
   ├─ GET /api/integrations/odoo/partner/ID
   ↓
4.A Sucesso
   ├─ Dados carregam abaixo do botão
   ├─ Nome, Email, Telefone, NIF, Localização
   └─ Button reabilitado
   
4.B Não encontrado (404)
   ├─ Alert: "Parceiro não encontrado no Odoo."
   └─ Button reabilitado
   
4.C Não configurado
   ├─ Alert: "Integração Odoo ainda não está configurada..."
   └─ Button reabilitado
   
4.D Erro genérico
   ├─ Alert: "Erro ao carregar parceiro do Odoo."
   └─ Button reabilitado
```

---

## 🎨 UI/UX Implementada

**Estado: Não Ligado**
```
┌────────────────────────────────────────────┐
│ 🏪 Odoo                                    │
│ Integração com parceiros Odoo...           │
├────────────────────────────────────────────┤
│                                            │
│ Este contacto ainda não está ligado a      │
│ nenhum parceiro Odoo.                      │
│                                            │
│ A ligação manual será configurada numa     │
│ próxima etapa.                             │
│                                            │
└────────────────────────────────────────────┘
```

**Estado: Ligado (sem dados)**
```
┌────────────────────────────────────────────┐
│ 🏪 Odoo                                    │
│ Detalhes do parceiro Odoo...               │
├────────────────────────────────────────────┤
│                                            │
│ Ligado ao parceiro Odoo #456               │
│                                            │
│ [Ver detalhes do parceiro]                 │
│                                            │
└────────────────────────────────────────────┘
```

**Estado: Ligado (com dados)**
```
┌────────────────────────────────────────────┐
│ 🏪 Odoo                                    │
│ Detalhes do parceiro Odoo...               │
├────────────────────────────────────────────┤
│                                            │
│ Ligado ao parceiro Odoo #456               │
│                                            │
│ [Ver detalhes do parceiro]                 │
│                                            │
│ Nome                                       │
│ Empresa A                                  │
│ ────────────────────────────────────────│
│ Email                                      │
│ contato@empresa-a.com                      │
│ ────────────────────────────────────────│
│ Telefone                                   │
│ 915000000                                  │
│ ────────────────────────────────────────│
│ NIF                                        │
│ PT123456789                                │
│ ────────────────────────────────────────│
│ Localização                                │
│ Rua Exemplo 123, Lisboa, Portugal          │
│                                            │
└────────────────────────────────────────────┘
```

---

## 📊 Stack Odoo Completa (Entidades + Contactos)

```
Odoo Integration UI
├─ Entidades
│  ├─ ✅ STEP1: Visualização
│  ├─ ✅ STEP2: Pesquisa + Ligação
│  └─ ✅ STEP3: Remover Ligação
│
└─ Contactos
   └─ ✅ STEP1: Visualização (Apenas leitura)
      ├─ Card "Odoo" com 2 estados
      ├─ Botão "Ver detalhes"
      ├─ Renderização de dados
      └─ Tratamento de erros

Próximas fases:
├─ ⏳ Contactos STEP2: Pesquisa + Ligação
├─ ⏳ Contactos STEP3: Remover Ligação
├─ ⏳ Sincronização bidirecional
└─ ⏳ Integrações adicionais (MS365, Google)
```

---

## ✅ Status de Compilação

✅ **TypeScript:** Sem erros  
✅ **React:** JSX válido  
✅ **Imports:** Todos adicionados  
✅ **Estados:** 4 useState's gerenciados  
✅ **Função:** handleFetchOdooPartner() completa  
✅ **UI:** Card + botão + alerts + dados  
✅ **Test IDs:** 9 elementos marcados  
✅ **API Integration:** Fetch com credenciais  
✅ **Servidor:** Running sem erros  

---

## 🧪 Casos de Teste

### Teste 1: Contacto Não Ligado
```
1. Abrir Contacto SEM odooPartnerId
2. ✅ Card "Odoo" mostra texto sobre não ligação
3. ✅ Sem botão "Ver detalhes"
4. ✅ Sem dados renderizados
```

### Teste 2: Contacto Ligado - Carregar Dados
```
1. Abrir Contacto COM odooPartnerId (ex: 456)
2. ✅ Card mostra "Ligado ao parceiro Odoo #456"
3. ✅ Botão "Ver detalhes" disponível
4. Clicar "Ver detalhes"
5. ✅ DevTools: GET /api/integrations/odoo/partner/456
6. ✅ Button fica em loading ("A carregar...")
7. ✅ Dados carregam (Nome, Email, etc.)
8. ✅ Button volta ao normal
```

### Teste 3: Parceiro Não Encontrado
```
1. Abrir Contacto com odooPartnerId inválido
2. Clicar "Ver detalhes"
3. ✅ Backend retorna 404
4. ✅ Alert: "Parceiro não encontrado no Odoo."
5. ✅ Sem dados renderizados
```

### Teste 4: Odoo Não Configurado
```
1. Desconfigurar Odoo
2. Clicar "Ver detalhes"
3. ✅ Backend retorna { notConfigured: true }
4. ✅ Alert: "Integração Odoo ainda não está configurada..."
5. ✅ Sem dados renderizados
```

---

## 📝 Notas Técnicas

1. **Padrão de Entidades:** Implementação idêntica à STEP1 de Entidades para consistência
2. **Condicionalidade:** `odooPartnerId` controla todo o fluxo (presença vs. ausência)
3. **Erro vs. Alerta:** `odooPartnerError` (destructive) vs. `odooNotConfigured` (warning)
4. **Responsividade:** `flex-wrap` garante botão funcional em ecrãs pequenos
5. **Acessibilidade:** `data-testid` em todos os elementos para QA
6. **Performance:** Sem fetch automático (apenas ao clicar botão)
7. **Estado Local:** 4 estados limpos apenas quando necessário

---

## 🏁 Conclusão

Implementação bem-sucedida de visualização Odoo para Contactos. O componente:
- ✅ Exibe estado da ligação (ligado vs. não ligado)
- ✅ Permite buscar dados do parceiro via botão
- ✅ Trata erros e não-configurado com clarity
- ✅ Renderiza dados de forma organizada
- ✅ Segue padrão visual idêntico a Entidades

**Próximo STEP:** Pesquisa e ligação de parceiros para Contactos (similar a Entidades STEP2).

---

**Status Final: ✅ ODOO-UI-CONTACTOS-STEP1 - COMPLETA E FUNCIONAL**

Visualização de parceiros Odoo para Contactos pronta! 🚀
