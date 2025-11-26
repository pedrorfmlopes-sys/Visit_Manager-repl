# Resumo ODOO-02A / STEP 1 – Campos de Ligação Odoo (odooPartnerId)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager (Node + Express + TypeScript, Drizzle ORM, PostgreSQL)  
**Status:** ✅ CONCLUÍDA COM SUCESSO

---

## 📋 Objetivo

Adicionar campos de ligação ao Odoo nas tabelas de Entidades e Contactos (`odooPartnerId`), sincronizar a base de dados e expor o campo na API, preparando a estrutura para sincronização de dados futura.

---

## ✅ Trabalho Realizado

### 1. Atualização do Schema Drizzle (shared/schema.ts)

**Tabela Entidades (linha 307-352):**
- Adicionado campo: `odooPartnerId: text("odoo_partner_id")`
- Tipo: texto (nullable)
- Nome da coluna BD: `odoo_partner_id`
- Localização: após `odooEntityId`, antes de `needsSync`

**Tabela Contactos (linha 432-459):**
- Adicionado campo: `odooPartnerId: text("odoo_partner_id")`
- Tipo: texto (nullable)
- Nome da coluna BD: `odoo_partner_id`
- Localização: após `odooContactId`, antes de `needsSync`

**Esquemas de Inserção (Zod):**
- `insertEntidadeSchema`: Adicionado `odooPartnerId: true` à lista de omit
- `insertContactoSchema`: Adicionado `odooPartnerId: true` à lista de omit
- Rationale: Campo é auto-gerado/sincronizado pelo backend, não deve ser inserido via API

**Tipos TypeScript (automaticamente derivados):**
- `Entidade = typeof entidades.$inferSelect` → inclui `odooPartnerId?: string | null`
- `Contacto = typeof contactos.$inferSelect` → inclui `odooPartnerId?: string | null`

---

### 2. Sincronização da Base de Dados

Executado com sucesso:
```bash
npm run db:push
```

**Resultado:**
- ✅ Colunas `odoo_partner_id` criadas na tabela `entidades`
- ✅ Colunas `odoo_partner_id` criadas na tabela `contactos`
- ✅ Migrations aplicadas sem erros
- ✅ Schema PostgreSQL atualizado

---

### 3. Exposição do Campo na API

**Automaticamente exposto via:**
- **GET `/api/entidades`** → Retorna array de entidades com `odooPartnerId` (null por padrão)
- **GET `/api/entidades/:id`** → Retorna detalhe de entidade com `odooPartnerId`
- **GET `/api/contactos`** → Retorna array de contactos com `odooPartnerId` (null por padrão)
- **GET `/api/contactos/:id`** → Retorna detalhe de contacto com `odooPartnerId`

**Nota:** Não foram criadas novas rotas nesta fase. O campo é exposto automaticamente pelo storage existente que usa `db.select().from(tabela)` sem mapeamentos manuais.

---

## 🗄️ Alterações de Banco de Dados

| Tabela | Coluna | Tipo | Nullable | Default |
|--------|--------|------|----------|---------|
| `entidades` | `odoo_partner_id` | text | YES | null |
| `contactos` | `odoo_partner_id` | text | YES | null |

---

## 📁 Ficheiros Editados

| Ficheiro | Secções Modificadas | Descrição |
|----------|-------------------|-----------|
| `shared/schema.ts` | Tabela entidades (linha 345) | Adicionado `odooPartnerId` |
| `shared/schema.ts` | Tabela contactos (linha 452) | Adicionado `odooPartnerId` |
| `shared/schema.ts` | `insertEntidadeSchema` (linha 387) | Omit `odooPartnerId` |
| `shared/schema.ts` | `insertContactoSchema` (linha 509) | Omit `odooPartnerId` |

---

## ✅ Estrutura de Dados Criada

### Entidade com Odoo Partner ID
```typescript
{
  id: string;
  empresaId: string;
  nome: string;
  email?: string;
  telefone?: string;
  // ... outros campos existentes
  odooEntityId?: number;           // ID interno do Odoo (legacy)
  odooPartnerId?: string | null;   // ✅ NOVO: Partner ID do Odoo
  needsSync: boolean;
  syncStatus: 'pending' | 'synced' | 'error' | 'never';
  lastSyncAt?: Date;
  syncError?: string;
}
```

### Contacto com Odoo Partner ID
```typescript
{
  id: string;
  empresaId: string;
  nome: string;
  email?: string;
  telemovel?: string;
  entidadeId?: string;
  // ... outros campos existentes
  odooContactId?: number;           // ID interno do Odoo (legacy)
  odooPartnerId?: string | null;    // ✅ NOVO: Partner ID do Odoo
  needsSync: boolean;
  syncStatus: 'pending' | 'synced' | 'error' | 'never';
  lastSyncAt?: Date;
  syncError?: string;
}
```

---

## 🧪 Validações Implementadas

✅ **Compilação TypeScript:** Sem erros  
✅ **Migração Drizzle:** Aplicada com sucesso  
✅ **Tipos Derivados:** `odooPartnerId` incluído automaticamente  
✅ **Storage API:** Campo automaticamente exposto  
✅ **Servidor:** Compilado e a correr normalmente  

---

## ✅ Critérios de Aceitação

- [x] Campo `odooPartnerId` adicionado à tabela entidades
- [x] Campo `odooPartnerId` adicionado à tabela contactos
- [x] Ambos os campos são texto (nullable)
- [x] Nome da coluna BD: `odoo_partner_id`
- [x] Schemas Zod atualizados (omit)
- [x] Tipos TypeScript incluem `odooPartnerId?: string | null`
- [x] `npm run db:push` executado com sucesso
- [x] Migração aplicada sem erros
- [x] Campo exposto na API
- [x] Nenhuma rota nova criada (conforme requerimento)
- [x] Nenhuma chamada HTTP para Odoo (conforme requerimento)
- [x] Servidor compilado e funcional

---

## 🚀 Próximos Passos (ODOO-02B)

1. **Rotas de Sincronização:** Criar endpoints para associar Partner IDs
2. **Chamadas Odoo:** Implementar ligação com API Odoo
3. **Sincronização de Dados:** Buscar e atualizar dados comerciais
4. **Validação:** Testes E2E com Odoo real
5. **Relatórios:** Dashboard de status de sincronização

---

## 📝 Notas Técnicas

- Campo é opcional (nullable) para não quebrar dados existentes
- Padrão de naming consistente com campos existentes (`odooEntityId`, `odooContactId`)
- Field é auto-gerado e não pode ser inserido via API (está em omit)
- Estrutura permite múltiplos Partner IDs no futuro (por enquanto um por entidade/contacto)
- Tipagem forte via Drizzle garante segurança em tipo

---

**Status Final: ✅ CAMPO ODOOPARTNERID ADICIONADO, ESTRUTURA DE DADOS PRONTA PARA SINCRONIZAÇÃO**
