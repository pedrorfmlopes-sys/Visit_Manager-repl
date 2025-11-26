# Resumo Odoo / STEP: UI Entidades – Visualização e Leitura de Parceiros

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Criar uma pequena secção "Odoo" na página de detalhe de Entidade do backoffice que:

1. Mostra o estado da ligação (`odooPartnerId`) da entidade ao Odoo
2. Quando existe `odooPartnerId`, permite carregar num botão para buscar e mostrar dados do parceiro via `GET /api/integrations/odoo/partner/:id`
3. Trata os casos: "não configurado", "não encontrado", erro genérico
4. **Sem implementar** pesquisa/seleção de parceiro (fica para próximo step)

---

## ✅ Trabalho Realizado

### 1. Localização do Componente

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx`

Este é o componente que renderiza a página de detalhe da Entidade em `/entidades/:id`. Já carrega dados da API com `useQuery(["/api/entidades", entidadeId])` que inclui `odooPartnerId?: string | null`.

### 2. Tipo TypeScript para Parceiro Odoo

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx` (linhas 29-39)

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

**Notas:**
- Tipo local (não importado) para simplificar
- Alinha com `OdooPartner` no backend
- Todos os campos opcionais exceto `id` e `name`

### 3. Estado (useState)

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx` (linhas 50-53)

```typescript
const [odooPartner, setOdooPartner] = useState<OdooPartner | null>(null);
const [odooPartnerLoading, setOdooPartnerLoading] = useState(false);
const [odooPartnerError, setOdooPartnerError] = useState<string | null>(null);
const [odooNotConfigured, setOdooNotConfigured] = useState(false);
```

**Gerenciamento:**
- `odooPartner`: Dados do parceiro fetched
- `odooPartnerLoading`: Flag de carregamento
- `odooPartnerError`: Mensagem de erro (se houver)
- `odooNotConfigured`: Flag para Odoo não configurado

### 4. Função handleFetchOdooPartner()

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx` (linhas 353-400)

**Fluxo:**

```typescript
const handleFetchOdooPartner = async () => {
  // 1. Validação: odooPartnerId existe?
  if (!entidade?.odooPartnerId) return;

  // 2. Conversão: String → Number
  const partnerId = Number(entidade.odooPartnerId);
  if (Number.isNaN(partnerId)) {
    setOdooPartnerError("ID de parceiro inválido");
    return;
  }

  // 3. Reset de estado
  setOdooPartnerLoading(true);
  setOdooPartnerError(null);
  setOdooNotConfigured(false);
  setOdooPartner(null);

  try {
    // 4. Fetch: GET /api/integrations/odoo/partner/:id
    const response = await fetch(`/api/integrations/odoo/partner/${partnerId}`, {
      method: 'GET',
      credentials: 'include',
    });

    // 5. Tratamento: Respostas HTTP
    if (!response.ok) {
      if (response.status === 404) {
        // Parceiro não encontrado no Odoo
        setOdooPartnerError("Parceiro não encontrado no Odoo");
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

    // 8. Sucesso: Guardar parceiro
    if (data.partner) {
      setOdooPartner(data.partner);
    }
  } catch (error: any) {
    // 9. Erro genérico
    console.error("[Odoo] Error fetching partner:", error);
    setOdooPartnerError("Erro ao carregar parceiro do Odoo");
  } finally {
    // 10. Cleanup: Desligar loading
    setOdooPartnerLoading(false);
  }
};
```

**Lógica de Erro:**

| Cenário | Resultado |
|---------|-----------|
| `odooPartnerId` vazio | Retorna sem fazer nada |
| `odooPartnerId` não é número | `partnerError = "ID de parceiro inválido"` |
| HTTP 404 | `partnerError = "Parceiro não encontrado no Odoo"` |
| `{ notConfigured: true }` | `notConfigured = true` (flag especial) |
| Outro erro HTTP ou network | `partnerError = "Erro ao carregar parceiro do Odoo"` |
| Sucesso | `partner = data.partner` (dados do Odoo) |

### 5. Card "Odoo" UI

**Ficheiro:** `client/src/pages/EntidadeDetail.tsx` (linhas 806-932)

**Localização:** Antes do card de Geolocalização (ordem lógica)

**Estrutura:**

#### A. Quando NÃO ligado (`!entidade.odooPartnerId`)

```
┌─────────────────────────────────┐
│ Odoo                            │
├─────────────────────────────────┤
│ Esta entidade ainda não está    │
│ ligada a nenhum parceiro Odoo.  │
│                                 │
│ A ligação manual será           │
│ configurada numa próxima etapa. │
└─────────────────────────────────┘
```

**Código:**

```tsx
{!entidade.odooPartnerId ? (
  <div>
    <p className="text-sm text-muted-foreground">
      Esta entidade ainda não está ligada a nenhum parceiro Odoo.
    </p>
    <p className="text-xs text-muted-foreground mt-2">
      A ligação manual será configurada numa próxima etapa.
    </p>
  </div>
```

#### B. Quando ligado - Botão Fetch

```
┌─────────────────────────────────────────────────────┐
│ Ligado ao parceiro Odoo #123  [Ver detalhes...]    │
└─────────────────────────────────────────────────────┘
```

**Código:**

```tsx
<div className="flex items-center justify-between">
  <p className="text-sm">
    <span className="text-muted-foreground">Ligado ao parceiro Odoo </span>
    <span className="font-medium" data-testid="text-odoo-partner-id">
      #{entidade.odooPartnerId}
    </span>
  </p>
  <Button
    variant="outline"
    size="sm"
    onClick={handleFetchOdooPartner}
    disabled={odooPartnerLoading}
    data-testid="button-odoo-fetch-partner"
  >
    {odooPartnerLoading ? (
      <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
    ) : null}
    Ver detalhes do parceiro
  </Button>
</div>
```

#### C. Estado: Loading

```
┌─────────────────────────────────┐
│ ⏳ A carregar...                │
└─────────────────────────────────┘
```

**Código:**

```tsx
{odooPartnerLoading && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
    A carregar...
  </div>
)}
```

#### D. Estado: Odoo Não Configurado

```
┌─────────────────────────────────┐
│ ⚠️  Integração não configurada   │
│ Integração Odoo ainda não está  │
│ configurada para esta empresa.  │
└─────────────────────────────────┘
```

**Código:**

```tsx
{odooNotConfigured && (
  <Alert data-testid="alert-odoo-not-configured">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Integração não configurada</AlertTitle>
    <AlertDescription>
      Integração Odoo ainda não está configurada para esta empresa.
    </AlertDescription>
  </Alert>
)}
```

#### E. Estado: Erro

```
┌─────────────────────────────────┐
│ ❌ Erro                         │
│ Parceiro não encontrado no Odoo │
└─────────────────────────────────┘
```

**Código:**

```tsx
{odooPartnerError && (
  <Alert variant="destructive" data-testid="alert-odoo-error">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Erro</AlertTitle>
    <AlertDescription>{odooPartnerError}</AlertDescription>
  </Alert>
)}
```

#### F. Estado: Sucesso (Dados do Parceiro)

```
┌────────────────────────────────────────┐
│ Nome                                   │
│ Empresa Teste                          │
│                                        │
│ Email                                  │
│ contato@empresa.com                    │
│                                        │
│ Telefone                               │
│ +351 915 000 000                       │
│                                        │
│ NIF                                    │
│ PT123456789                            │
│                                        │
│ Localização                            │
│ Lisboa, Portugal                       │
│                                        │
│ Rua                                    │
│ Avenida Exemplo 123                    │
└────────────────────────────────────────┘
```

**Código:**

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

    {(odooPartner.phone || odooPartner.mobile) && (
      <div>
        <p className="text-sm text-muted-foreground">Telefone</p>
        <p className="text-sm" data-testid="text-odoo-partner-phone">
          {odooPartner.phone || odooPartner.mobile}
        </p>
      </div>
    )}

    {odooPartner.vat && (
      <div>
        <p className="text-sm text-muted-foreground">NIF</p>
        <p className="text-sm" data-testid="text-odoo-partner-vat">
          {odooPartner.vat}
        </p>
      </div>
    )}

    {(odooPartner.city || odooPartner.country) && (
      <div>
        <p className="text-sm text-muted-foreground">Localização</p>
        <p className="text-sm" data-testid="text-odoo-partner-location">
          {[odooPartner.city, odooPartner.country]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
    )}

    {odooPartner.street && (
      <div>
        <p className="text-sm text-muted-foreground">Rua</p>
        <p className="text-sm" data-testid="text-odoo-partner-street">
          {odooPartner.street}
        </p>
      </div>
    )}
  </div>
)}
```

---

## 📁 Ficheiros Editados

| Ficheiro | Linhas | Mudança |
|----------|--------|---------|
| `client/src/pages/EntidadeDetail.tsx` | 29-39 | Tipo `OdooPartner` |
| `client/src/pages/EntidadeDetail.tsx` | 50-53 | Estado (useState) |
| `client/src/pages/EntidadeDetail.tsx` | 353-400 | Função `handleFetchOdooPartner()` |
| `client/src/pages/EntidadeDetail.tsx` | 806-932 | Card "Odoo" com renderização condicional |

---

## 🧪 Test IDs (Automação QA)

Todos os elementos interativos têm `data-testid` descriptivos:

| Elemento | Test ID | Tipo |
|----------|---------|------|
| ID do Parceiro | `text-odoo-partner-id` | Display (text) |
| Botão Fetch | `button-odoo-fetch-partner` | Interactive (button) |
| Alert Não Configurado | `alert-odoo-not-configured` | Display (alert) |
| Alert Erro | `alert-odoo-error` | Display (alert) |
| Nome Parceiro | `text-odoo-partner-name` | Display (text) |
| Email Parceiro | `text-odoo-partner-email` | Display (text) |
| Telefone Parceiro | `text-odoo-partner-phone` | Display (text) |
| NIF Parceiro | `text-odoo-partner-vat` | Display (text) |
| Localização Parceiro | `text-odoo-partner-location` | Display (text) |
| Rua Parceiro | `text-odoo-partner-street` | Display (text) |

---

## 🔌 Integração com Endpoints Existentes

A UI consome o endpoint já criado:

**Endpoint:** `GET /api/integrations/odoo/partner/:id`

**Respostas esperadas:**

```json
{
  "partner": {
    "id": 123,
    "name": "...",
    "email": "...",
    ...
  }
}
```

```json
{
  "notConfigured": true,
  "partner": null
}
```

```json
{
  "error": "Partner not found"
}
```

---

## ✅ Critérios de Aceitação

- [x] Localizado componente de detalhe de Entidade
- [x] Criado tipo `OdooPartner` local
- [x] Adicionado estado (useState) para gerenciar: partner, loading, error, notConfigured
- [x] Função `handleFetchOdooPartner()` criada com validação de ID
- [x] Conversão: `odooPartnerId` (string) → `partnerId` (number)
- [x] Fetch: `GET /api/integrations/odoo/partner/:id` com credenciais
- [x] Tratamento: HTTP 404 → erro "Parceiro não encontrado"
- [x] Tratamento: `{ notConfigured: true }` → flag especial
- [x] Tratamento: Outros erros → mensagem genérica
- [x] Card "Odoo" adicionado com renderização condicional
- [x] Caso: Não ligado → mensagem informativa + preview
- [x] Caso: Ligado → ID + botão "Ver detalhes"
- [x] Caso: Loading → indicador visual
- [x] Caso: Erro → mensagem de erro
- [x] Caso: Odoo não configurado → Alert discreto
- [x] Caso: Sucesso → Exibição de dados do parceiro
- [x] Campos exibidos: nome, email, telefone, NIF, localização, rua
- [x] Renderização condicional: campos vazios não aparecem
- [x] Estilo: Consistente com cards existentes (mesma UI lib)
- [x] Test IDs: Todos os elementos interativos/display têm data-testid
- [x] TypeScript: Sem erros de compilação
- [x] Imports: `Store` icon importado de `lucide-react`

---

## 🚀 Fluxo de Utilização

```
1. Utilizador abre detalhe de Entidade (/entidades/:id)
   ↓
2. Sistema carrega entidade + odooPartnerId
   ↓
3. Se odooPartnerId existe:
   ├─ Mostra "Ligado ao parceiro Odoo #123"
   ├─ Botão "Ver detalhes do parceiro" clicável
   │
4. Utilizador clica no botão
   ├─ UI: loading spinner
   ├─ Backend: GET /api/integrations/odoo/partner/123
   │
5. Resposta (3 cenários):
   ├─ Sucesso: Exibe dados completos do parceiro
   ├─ Odoo não configurado: Alert informativo
   └─ Erro: Mensagem de erro
```

---

## 📊 Padrão de Implementação (Reutilizável)

Este padrão pode ser replicado para outras entidades (Contactos, Tarefas, etc.):

```
1. Definir tipo local: type OdooEntity = { ... }
2. Estados: entity, loading, error, notConfigured
3. Função handler: handleFetchOdoo[Entity]()
   ├─ Validar ID
   ├─ Reset estado
   ├─ Fetch: GET /api/integrations/odoo/[entity]/:id
   ├─ Tratar: notConfigured, 404, success
   └─ Guardar em state
4. Card com renderização condicional
   ├─ Não ligado: mensagem
   ├─ Ligado: botão + estados (loading/error/success)
   ├─ Sucesso: exibir dados
```

---

## 🏗️ Stack Odoo Atualizada

```
Odoo Integration Stack
├─ Configuration (Admin)
│  └─ ✅ OdooIntegrationCard + endpoints
│
├─ Backend
│  ├─ ✅ odooClient.ts: getOdooPartnerById()
│  ├─ ✅ odoo.ts routes: GET /partner/:id
│  └─ ✅ Link/Unlink endpoints
│
├─ Frontend: Entidades
│  └─ ✅ EntidadeDetail: Card "Odoo" + Fetch
│
├─ Frontend: Contactos
│  └─ ⏳ ContactoDetail: Card "Odoo" + Fetch (similar)
│
└─ ⏳ Próximos Steps
   ├─ UI pesquisa/seleção de parceiros
   ├─ Sincronização bidirecional
   └─ Dashboard de integrações
```

---

## ✅ Status de Compilação

✅ **TypeScript:** Sem erros  
✅ **React:** JSX válido  
✅ **Imports:** `Store` icon adicionado  
✅ **Estado:** Gerenciamento correto  
✅ **API Integration:** Fetch com credenciais  
✅ **Test IDs:** Todos os elementos marcados  
✅ **UI/UX:** Consistente com design existente  

---

## 📝 Notas de Implementação

1. **Sem busca ainda:** A pesquisa/seleção de parceiros fica para o próximo step (STEP2)
2. **Local state apenas:** Não usa React Query (simples fetch com useState é suficiente para este caso)
3. **Fetch nativo:** Usa `fetch()` API (já disponível no projeto) - sem axios nem novas libs
4. **Credenciais:** `credentials: 'include'` garante que o utilizador autenticado é enviado ao backend
5. **Tratamento discreto:** Erro em alert, não em toast disruptivo
6. **Campos opcionais:** Renderização condicional evita blocos vazios

---

**Status Final: ✅ UI LEITURA/VISUALIZAÇÃO PARCEIROS ODOO - COMPLETA E FUNCIONAL**

Próximo step: Pesquisa e seleção interativa de parceiros Odoo! 🎯
