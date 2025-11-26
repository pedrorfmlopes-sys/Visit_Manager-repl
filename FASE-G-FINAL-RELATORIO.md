# FASE G-FINAL – Integração Google OAuth (Backend + UI)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ Concluída com sucesso

---

## 📋 Objetivo

Finalizar a integração Google OAuth garantindo que:
- Após login Google bem-sucedido, uma ligação é criada/atualizada em `google_connections` para o userId autenticado
- O endpoint `/api/integrations/google/status` retorna corretamente o estado da ligação
- O card Google na UI mostra "Desligado" ou "Ligado como <email>"
- Fluxo de autenticação completo e funcional

---

## ✅ Implementações Realizadas

### 1. Schema & Tipagem (`shared/schema.ts`)

**Tabela `google_connections`:**
```typescript
export const googleConnections = pgTable("google_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  googleUserId: text("google_user_id").notNull(),        // sub do Google userinfo
  email: text("email"),
  name: text("name"),
  picture: text("picture"),                             // URL da foto do perfil
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Relações e Schemas Zod:**
- `googleConnectionsRelations`: Relação one-to-one com `users`
- `insertGoogleConnectionSchema`: Schema para INSERT/UPDATE (exclui id, createdAt, updatedAt)
- `InsertGoogleConnection`: Tipo TypeScript inferido do schema
- `GoogleConnection`: Tipo inferido da tabela (select)

---

### 2. Storage (`server/storage/googleConnections.ts`)

**Classe `GoogleConnectionsStorage`:**

```typescript
async getGoogleConnectionByUserId(userId: string): Promise<GoogleConnection | undefined>
```
- Executa: `SELECT * FROM google_connections WHERE user_id = userId LIMIT 1`
- Retorna a ligação do user ou undefined

```typescript
async upsertGoogleConnection(input: InsertGoogleConnection): Promise<GoogleConnection>
```
- Se existir registo para o userId: **UPDATE** com novos valores (googleUserId, email, name, picture, tokens, expiresAt, updatedAt)
- Se não existir: **INSERT** novo registo
- Proteção contra duplicatas: verifica existência antes de inserir
- Retorna o registo criado/atualizado

---

### 3. Endpoints Backend (`server/routes/integrations/google.ts`)

**GET `/api/integrations/google/login` (autenticado)**
```
Middleware: isAuthenticated
Objetivo: Redirecionar utilizador para o ecrã de consentimento Google

Passos:
1. Obter userId via getUserContext(req)
2. Ler env vars: GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI
3. Gerar state aleatório (string 30+ chars)
4. Guardar state em cookie HTTP-only "google_oauth_state" (10 min expiração)
5. Construir URL de autorização:
   - Base: https://accounts.google.com/o/oauth2/v2/auth
   - Params: client_id, redirect_uri, response_type=code, scope (openid profile email calendar)
   - access_type=offline (para refresh_token)
   - prompt=consent (força consentimento sempre)
   - state (CSRF protection)
6. res.redirect(302, authorizeUrl)

Resposta: Redirect 302 para Google OAuth
```

**GET `/api/integrations/google/callback` (público, protegido por state)**
```
Objetivo: Receber code do Google, trocar por tokens, guardar na BD

Passos:
1. Ler query params: code, state, error
2. Se erro presente: redirect /admin/empresa?tab=apis-keys&google=error
3. Se code ausente: redirect para error
4. Validar state:
   - Ler cookie "google_oauth_state"
   - Comparar com state recebido
   - Se não coincidir: redirect error
5. Ler env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
6. POST para https://oauth2.googleapis.com/token com:
   - code, client_id, client_secret, redirect_uri, grant_type=authorization_code
   - Content-Type: application/x-www-form-urlencoded
7. Extrair resposta: access_token, refresh_token, expires_in
8. Se tokens inválidos: redirect error
9. GET https://openidconnect.googleapis.com/v1/userinfo com Authorization: Bearer {accessToken}
10. Extrair userinfo: sub (googleUserId), email, name, picture
11. Obter userId autenticado: const { userId } = await getUserContext(req)
12. Calcular expiresAt: new Date(Date.now() + expiresIn * 1000)
13. Chamar upsertGoogleConnection({ userId, googleUserId, email, name, picture, accessToken, refreshToken, expiresAt })
14. res.clearCookie("google_oauth_state")
15. res.redirect(302, "/admin/empresa?tab=apis-keys&google=connected")

Em caso de erro: Registar erro em console, redirecionar para google=error
```

**GET `/api/integrations/google/status` (autenticado)**
```
Objetivo: Retornar estado da ligação Google do user autenticado

Passos:
1. Obter userId via getUserContext(req)
2. Chamar googleConnectionsStorage.getGoogleConnectionByUserId(userId)
3. Se não houver registo: return res.json({ connected: false })
4. Se houver: res.json({
     connected: true,
     email: connection.email,
     name: connection.name,
     googleUserId: connection.googleUserId,
     picture: connection.picture,
   })

Resposta: JSON com estado da ligação
```

**Registo em `server/routes.ts`:**
- Importado: `import { setupGoogleRoutes } from "./routes/integrations/google"`
- Registado em `registerRoutes()`: `setupGoogleRoutes(app)`

---

### 4. Componente Frontend (`client/src/components/integrations/GoogleIntegrationCard.tsx`)

**Interface:**
```typescript
interface GoogleStatus {
  connected: boolean;
  email?: string;
  name?: string;
  googleUserId?: string;
  picture?: string;
}
```

**Funcionalidades:**
- **Query React**: `useQuery` para `/api/integrations/google/status` com `gcTime: 0` (sem cache)
- **Estados:**
  - Loading: Spinner com "A verificar ligação..."
  - Error: Mensagem de erro + botão "Tentar novamente"
  - Disconnected: "Nenhuma conta Google ligada" + botão "Ligar conta Google"
  - Connected: Mostra nome/email + badge "Ligado" + botão "Religar / trocar conta"
- **Feedback URL:**
  - Se `?google=connected`: Toast de sucesso + refetch
  - Se `?google=error`: Toast de erro
  - Limpa parâmetros da URL após processamento
- **Data-testid:**
  - `button-connect-google`: Botão ligar
  - `button-reconnect-google`: Botão religar
  - `button-retry-google-status`: Botão tentar novamente

---

### 5. Integração UI (`client/src/pages/AdminEmpresa.tsx`)

**Alterações:**
```typescript
// Import adicionado
import { GoogleIntegrationCard } from "@/components/integrations/GoogleIntegrationCard";

// Substituição do placeholder Card por componente funcional
// Antes: Card com "Planeado"
// Depois: <GoogleIntegrationCard />
```

**Localização:** Secção "APIs & Keys" (tab "apis-keys" em AdminEmpresa)

**Apresentação:**
- Card Microsoft 365 com estado
- Card Google Workspace com estado
- Outros cards como "planeado"

---

### 6. Correção Microsoft (`server/routes/integrations/microsoft.ts`)

**Correção Critical:**
```typescript
// ANTES (INCORRETO):
const authUrl = new URL(`https://login.microsoftonline.com/${clientId}/oauth2/v2.0/authorize`);

// DEPOIS (CORRETO):
const authorizeUrl =
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
  `?client_id=${encodeURIComponent(clientId)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&response_mode=query` +
  `&scope=${encodeURIComponent("openid profile offline_access User.Read Calendars.ReadWrite")}` +
  `&state=${encodeURIComponent(state)}`;
```

**Motivo:** A URL de autorização Microsoft **DEVE** usar `tenantId` (não `clientId`) no hostname.

---

## 📊 Fluxo Completo

### Cenário: User ligando conta Google

```
1. User em /admin/empresa?tab=apis-keys
   ↓
2. GoogleIntegrationCard faz query a /api/integrations/google/status
   ↓
3. Obtém connected: false
   ↓
4. Mostra botão "Ligar conta Google"
   ↓
5. User clica → window.location.href = "/api/integrations/google/login"
   ↓
6. Backend:
   - Gera state + cookie
   - Redireciona para Google OAuth
   ↓
7. Google:
   - User faz login / aceita permissões
   - Google redireciona para /api/integrations/google/callback?code=...&state=...
   ↓
8. Backend:
   - Valida state
   - Troca code por tokens
   - Obtém userinfo
   - Insere em google_connections
   - Redireciona para /admin/empresa?tab=apis-keys&google=connected
   ↓
9. Frontend:
   - Detecta ?google=connected
   - Toast de sucesso
   - Refetch de status
   ↓
10. GoogleIntegrationCard:
    - Query retorna connected: true, email, name
    - Mostra estado "Ligado como <email>"
    - Badge "Ligado" em verde
```

---

## 🔐 Segurança

### State CSRF Protection
- State aleatório gerado a cada login
- Armazenado em cookie HTTP-only
- Validado no callback
- Expiração de 10 minutos

### Cookies
- `httpOnly: true` (não acessível a JavaScript)
- `secure: true` em produção (apenas HTTPS)
- `sameSite: "lax"` (proteção contra CSRF)

### Tokens
- Armazenados em PostgreSQL (BD do projeto)
- `accessToken` e `refreshToken` guardados como text
- `expiresAt` calculado: `Date.now() + expiresIn * 1000`
- Futura implementação: Criptografia de tokens em BD

---

## 🗄️ Base de Dados

### Tabela `google_connections`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | Primary Key |
| `user_id` | varchar (255) | FK para users.id (cascade delete) |
| `google_user_id` | text | Google user ID (sub) |
| `email` | text | Email do user Google |
| `name` | text | Nome do user Google |
| `picture` | text | URL foto perfil (se existir) |
| `access_token` | text | Token OAuth (confidencial) |
| `refresh_token` | text | Refresh token (confidencial) |
| `expires_at` | timestamp | Data/hora expiração do access_token |
| `created_at` | timestamp | Data criação do registo |
| `updated_at` | timestamp | Data atualização do registo |

### Índices
- PK: `id`
- FK: `user_id` com `onDelete: cascade`

---

## 📁 Ficheiros Modificados/Criados

| Ficheiro | Tipo | Alteração |
|----------|------|-----------|
| `shared/schema.ts` | Edit | Tabela googleConnections + tipos Zod |
| `server/storage/googleConnections.ts` | Create | Storage class com get/upsert |
| `server/routes/integrations/google.ts` | Create | 3 endpoints OAuth |
| `server/routes.ts` | Edit | Import + setup de Google routes |
| `client/src/components/integrations/GoogleIntegrationCard.tsx` | Create | Componente React |
| `client/src/pages/AdminEmpresa.tsx` | Edit | Import + uso de GoogleIntegrationCard |
| `server/routes/integrations/microsoft.ts` | Edit | Correção: tenantId na URL |

---

## ✅ Critérios de Aceitação (Validação)

- [x] Tabela `google_connections` existe em BD com estrutura correta
- [x] `getGoogleConnectionByUserId()` faz SELECT correto
- [x] `upsertGoogleConnection()` INSERT/UPDATE sem duplicatas
- [x] GET `/api/integrations/google/login` redireciona para Google OAuth
- [x] GET `/api/integrations/google/callback` valida state + troca tokens
- [x] Tokens guardados em BD via upsert
- [x] GET `/api/integrations/google/status` retorna `{ connected: false }` para user sem ligação
- [x] GET `/api/integrations/google/status` retorna `{ connected: true, email, name, ... }` após login
- [x] GoogleIntegrationCard mostra "Desligado" quando connected: false
- [x] GoogleIntegrationCard mostra "Ligado como <email>" quando connected: true
- [x] Card integrado em AdminEmpresa tab "APIs & Keys"
- [x] Fluxo de login completo e funcional
- [x] Correção Microsoft: URL usa tenantId (não clientId)

---

## 🚀 Próximos Passos (Futuro)

1. **Encriptação de Tokens**: Implementar encriptação de access_token/refresh_token em BD
2. **Token Refresh**: Automatizar refresh de tokens quando expiram
3. **Calendar Sync**: Implementar sincronização de eventos Visita → Google Calendar
4. **Múltiplas Contas**: Permitir múltiplas contas Google por user
5. **Desconexão**: Endpoint para desconectar conta Google
6. **Gmail Integration**: Sincronização de contactos/emails
7. **Error Handling**: Retry logic para falhas de rede

---

## 📝 Notas de Implementação

### Decisões de Design

1. **State em Cookie:** Seguiu padrão Microsoft (HTTP-only, 10min)
2. **Tokens em BD:** Implementação simples, encriptação planeada
3. **Upsert Pattern:** Permite religar sem criar duplicatas
4. **Query SEM Cache:** `gcTime: 0` força fetch sempre que montar componente
5. **URL Feedback:** Parâmetros query (?google=connected) para feedback UX

### Compatibilidades

- TypeScript: Types inferidos de Drizzle schema
- React Query v5: Sintaxe `useQuery({ queryKey: [...] })`
- Drizzle ORM: Relações one-to-one com cascade delete
- Zod: Schemas para validação de dados

---

## ⚠️ Problemas Resolvidos

### EADDRINUSE (Porta 5000)
- **Causa:** Processo Node anterior ainda em execução
- **Solução:** Kill processo + restart workflow

### userId Incompatível
- **Causa:** googleConnections.userId era uuid, users.id é varchar
- **Solução:** Alterado para varchar(255) com referência correta

### Microsoft URL Incorreta
- **Causa:** Usava clientId em vez de tenantId
- **Solução:** Correção do endpoint de autorização

---

## 📞 Contacto

Para dúvidas ou issues relacionadas com esta integração, referir:
- **Fase:** FASE G-FINAL (Google OAuth)
- **Data Conclusão:** 26 de Novembro de 2025
- **Ficheiro Relatório:** FASE-G-FINAL-RELATORIO.md

---

**Status Final: ✅ CONCLUÍDA COM SUCESSO**
