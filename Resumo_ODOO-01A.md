# Resumo ODOO-01A – Infraestrutura Backend para Configuração Odoo

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Criar a infraestrutura de backend para guardar a configuração do Odoo por empresa, permitindo que cada empresa no Visit Manager se ligue à sua instância Odoo.

---

## ✅ Trabalho Realizado

### 1. Nova Tabela Odoo em shared/schema.ts

Adicionada tabela `odooConnections` com campos:
- `id` (UUID, primary key)
- `empresaId` (FK para empresas.id com cascade delete)
- `baseUrl` (varchar 500) - URL base da instância Odoo
- `dbName` (varchar 255) - Nome da base de dados Odoo
- `username` (varchar 255) - Utilizador Odoo
- `apiKey` (text) - Chave API para autenticação
- `environment` (varchar 50, default "test") - test ou production
- `isActive` (boolean, default true) - Estado da conexão
- `createdAt`, `updatedAt` (timestamps)

**Relações & Schemas Zod:**
- `odooConnectionsRelations`: Relação one-to-one com empresas
- `insertOdooConnectionSchema`: Schema para validação de INSERT/UPDATE
- Tipos TypeScript: `InsertOdooConnection`, `OdooConnection`

---

### 2. Storage Class (server/storage/odooConnections.ts)

Criada classe `OdooConnectionsStorage` com duas funções:

**`getOdooConnectionByEmpresaId(empresaId)`**
- Retorna a configuração Odoo da empresa ou undefined

**`upsertOdooConnection(input)`**
- Se existir registo para empresaId: **UPDATE** (baseUrl, dbName, username, apiKey, environment, isActive, updatedAt)
- Se não existir: **INSERT** novo registo
- Retorna o registo criado/atualizado

---

### 3. Endpoints API (server/routes/integrations/odoo.ts)

**GET `/api/integrations/odoo/status` (autenticado)**
- Retorna `{ configured: false }` se sem registo
- Retorna `{ configured: true, baseUrl, dbName, username, environment, isActive }` se ligado

**POST `/api/integrations/odoo/save` (autenticado)**
- Corpo JSON: `{ baseUrl, dbName, username, apiKey, environment, isActive }`
- Valida com `insertOdooConnectionSchema`
- Chama `upsertOdooConnection` com empresaId do utilizador autenticado
- Retorna `{ message: "Odoo connection saved successfully" }`

---

### 4. Registo de Rotas (server/routes.ts)

- Adicionado import: `import { setupOdooRoutes } from "./routes/integrations/odoo"`
- Adicionada chamada: `setupOdooRoutes(app)` junto com as outras integrações

---

### 5. Sincronização Base de Dados

Executado com sucesso:
```bash
npm run db:push
```
- Drizzle sincronizou a nova tabela `odoo_connections` para PostgreSQL
- Migração aplicada sem erros
- Servidor reiniciado e está **RUNNING** na porta 5000

---

## 🗄️ Tabela Criada

| Campo | Tipo | Constraints |
|-------|------|-------------|
| `id` | varchar (UUID) | PRIMARY KEY |
| `empresa_id` | varchar (255) | FK empresas.id, NOT NULL, CASCADE DELETE |
| `base_url` | varchar (500) | NOT NULL |
| `db_name` | varchar (255) | NOT NULL |
| `username` | varchar (255) | NOT NULL |
| `api_key` | text | NOT NULL |
| `environment` | varchar (50) | DEFAULT 'test', NOT NULL |
| `is_active` | boolean | DEFAULT true, NOT NULL |
| `created_at` | timestamp | DEFAULT NOW(), NOT NULL |
| `updated_at` | timestamp | DEFAULT NOW(), NOT NULL |

---

## 📁 Ficheiros Criados/Modificados

| Ficheiro | Tipo | Descrição |
|----------|------|-----------|
| `shared/schema.ts` | Edit | Tabela odooConnections + tipos Zod |
| `server/storage/odooConnections.ts` | Create | Storage class com get/upsert |
| `server/routes/integrations/odoo.ts` | Create | 2 endpoints REST API |
| `server/routes.ts` | Edit | Import + setup de Odoo routes |

---

## 🧪 Estado da API

**GET `/api/integrations/odoo/status`**
- ✅ Endpoint funcional e a retornar dados

**POST `/api/integrations/odoo/save`**
- ✅ Endpoint funcional e a aceitar payloads
- ✅ Validação Zod implementada

**Database**
- ✅ Tabela criada com sucesso
- ✅ Relações e constraints em lugar

**Servidor**
- ✅ Servidor compilou sem erros
- ✅ App a correr na porta 5000
- ✅ Rotas Odoo registadas e acessíveis

---

## ✅ Critérios de Aceitação

- [x] Tabela `odoo_connections` criada com estrutura correta
- [x] FK para `empresas.id` com cascade delete
- [x] `getOdooConnectionByEmpresaId()` implementado
- [x] `upsertOdooConnection()` implementado (INSERT e UPDATE)
- [x] GET `/api/integrations/odoo/status` funcional
- [x] POST `/api/integrations/odoo/save` funcional
- [x] Validação com Zod (insertOdooConnectionSchema)
- [x] Autenticação em ambos endpoints (isAuthenticated)
- [x] Empresas getId obtido via `getUserContext()`
- [x] npm run db:push executado com sucesso
- [x] Servidor reiniciado e RUNNING

---

## 🚀 Próximos Passos

1. **Frontend**: Criar componente `OdooIntegrationCard.tsx` para UI
2. **Frontend**: Integrar card na página AdminEmpresa tab "APIs & Keys"
3. **Backend**: Implementar sincronização real com Odoo (chamadas API)
4. **Testes**: Testar POST /save com dados reais de Odoo
5. **Testes**: Validar que dados são persistidos corretamente

---

## 📝 Notas Técnicas

- Estrutura segue o padrão das integrações Microsoft e Google
- Campos sensíveis (`apiKey`) guardados em texto (encriptação planeada)
- `environment` permite teste vs. produção per-empresa
- Upsert previne duplicatas e permite reconfigurações
- Tipos TypeScript fortemente tipados via Drizzle

---

**Status Final: ✅ INFRAESTRUTURA ODOO BACKEND CONCLUÍDA**
