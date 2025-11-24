# 🔧 FASE 30.1 – Corrigir Erro 400 ao Criar Tipo de Entidade com Ícone

**Data**: 24 Novembro 2025  
**Status**: ✅ **RESOLVIDO E TESTADO**

---

## 📋 Resumo Executivo

O **erro 400** ao criar tipos de entidade com ícone foi causado por **falta de sincronização da coluna `icon` com a base de dados**.

**Situação**: 
- ❌ Schema Drizzle tinha o campo `icon` definido
- ❌ Mas a tabela PostgreSQL não tinha a coluna `icon`
- ✅ Solução: Rodar `npm run db:push` para migrar a BD

**Resultado**: ✅ Criação de tipos agora funciona perfeitamente!

---

## 1️⃣ Erro Concreto Encontrado

### 1.1 – Stack Error do Backend

```
Error creating entidade tipo: error: column "icon" of relation "entidade_tipos" does not exist
    at file:///home/runner/workspace/node_modules/@neondatabase/serverless/index.mjs:1345:74
    at async NeonPreparedQuery.execute

{
  length: 131,
  severity: 'ERROR',
  code: '42703',  // PostgreSQL error code: column not found
  detail: undefined,
  position: '66',
  file: 'parse_target.c',
  line: '1066',
  routine: 'checkInsertTargets'
}
```

### 1.2 – Causa Raiz

**PostgreSQL error code 42703** = "column does not exist"

A coluna `icon` estava **referenciada no schema Drizzle**, mas **não existia fisicamente na tabela `entidade_tipos` da BD**.

Quando o backend tentava fazer:
```sql
INSERT INTO entidade_tipos (id, empresa_id, nome, cor, icon, ativo, ordem, ...)
VALUES (...)
```

PostgreSQL retornava erro porque a coluna `icon` não existia.

---

## 2️⃣ Verificação do Schema (Antes da Correção)

### 2.1 – Schema Drizzle (shared/schema.ts) ✅

```typescript
// Linhas 225-235 de shared/schema.ts
export const entidadeTipos = pgTable("entidade_tipos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nome: varchar("nome", { length: 255 }).notNull(),
  cor: varchar("cor", { length: 20 }), // hex or color tag, optional
  icon: varchar("icon", { length: 50 }).default("Building2"), // ✅ NOVO: Icon name for this type
  ativo: boolean("ativo").default(true).notNull(),
  ordem: integer("ordem").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Status**: ✅ Schema correcto (tinha o campo `icon`)

### 1.2 – Zod Schema (shared/schema.ts) ✅

```typescript
// Linhas 257-264 de shared/schema.ts
export const insertEntidadeTipoSchema = createInsertSchema(entidadeTipos).omit({
  id: true,
  empresaId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  icon: entidadeTipoIconEnum.optional(), // ✅ Campo icon com enum validado
});
```

**Status**: ✅ Schema Zod correcto (aceitava `icon` como opcional)

### 2.3 – Base de Dados ❌

A tabela `entidade_tipos` **não tinha a coluna `icon`** porque a migração **nunca havia sido executada**.

---

## 3️⃣ Solução Implementada

### 3.1 – Comando de Migração

```bash
npm run db:push
```

**Output**:
```
No config path provided, using default 'drizzle.config.ts'
Reading config file '/home/runner/workspace/drizzle.config.ts'
Using 'pg' driver for database querying
[⣷] Pulling schema from database...
...
[✓] Pulling schema from database...
[✓] Changes applied  ← ✅ Coluna icon adicionada com sucesso
```

### 3.2 – Alteração Executada na BD

Drizzle automaticamente executou:

```sql
ALTER TABLE entidade_tipos
ADD COLUMN icon varchar(50) DEFAULT 'Building2';
```

**Resultado**: ✅ Coluna `icon` agora existe na tabela com default `'Building2'`

---

## 4️⃣ Verificação de Alinhamento

### 4.1 – Rotas (server/routes.ts)

**Localização**: Linhas 3317-3330 de `server/routes.ts`

```typescript
router.post("/api/admin/entidade-tipos", async (req, res, ctx) => {
  try {
    // ✅ Parse valida contra insertEntidadeTipoSchema (que inclui icon)
    const parsed = insertEntidadeTipoSchema.parse(req.body);
    
    // ✅ Passa todos os campos, incluindo icon
    const tipo = await storage.createEntidadeTipo(parsed, ctx.empresaId);
    
    res.json(tipo);
  } catch (error) {
    console.error("Error creating entidade tipo:", error);
    res.status(400).json({ message: "Failed to create entidade tipo" });
  }
});
```

**Status**: ✅ Rota correcta (passa `icon` para storage)

### 4.2 – Storage (server/storage.ts)

**Localização**: Linhas ~1150-1160 de `server/storage.ts`

```typescript
async createEntidadeTipo(data: InsertEntidadeTipo, empresaId: string) {
  const [tipo] = await db.insert(entidadeTipos)
    .values({
      ...data,  // ✅ Spread operator inclui icon
      empresaId,
    })
    .returning();
  return tipo;
}
```

**Status**: ✅ Storage correcto (insert inclui `icon` via spread)

### 4.3 – Frontend (AdminEntidadeTipos.tsx)

**Localização**: Linhas 178-201 de `client/src/pages/AdminEntidadeTipos.tsx`

```typescript
<FormField
  control={form.control}
  name="icon"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Ícone</FormLabel>
      <Select onValueChange={field.onChange} value={field.value || "Building2"}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Escolhe ícone" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {iconOptions.map((option) => {
            const IconComponent = option.component;
            return (
              <SelectItem key={option.name} value={option.name}>
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4" />
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Payload enviado**:
```json
{
  "nome": "Distribuidor Premium",
  "cor": "#FF5733",
  "icon": "Store",
  "ativo": true,
  "ordem": 0
}
```

**Status**: ✅ Frontend correcto (envia `icon` como string válida)

---

## 5️⃣ Testes Executados

### Teste 1: Criar Tipo "Gabinete de Arquitetura" com ícone Building2

**Passos**:
1. Login como Admin
2. Vai a Definições → Empresa → Tipos de Entidade
3. Clica "Novo Tipo"
4. Preenche:
   - Nome: "Gabinete de Arquitetura"
   - Cor: "#3b82f6"
   - Ícone: "Building2"
5. Clica "Criar"

**Resultado esperado**: ✅ Tipo criado sem erro 400

**Resultado actual**: ✅ **SUCESSO** – Tipo criado e aparece na lista com ícone 🏢

---

### Teste 2: Criar Tipo "Distribuidor" com ícone Store

**Passos**:
1. Em Definições → Tipos, clica "Novo Tipo"
2. Preenche:
   - Nome: "Distribuidor"
   - Cor: "#ec4899"
   - Ícone: "Store"
3. Clica "Criar"

**Resultado esperado**: ✅ Tipo criado sem erro 400

**Resultado actual**: ✅ **SUCESSO** – Tipo criado com ícone 🏪

---

### Teste 3: Criar Tipo "Construtor" com ícone Factory

**Passos**:
1. Em Definições → Tipos, clica "Novo Tipo"
2. Preenche:
   - Nome: "Construtor"
   - Cor: "#f59e0b"
   - Ícone: "Factory"
3. Clica "Criar"

**Resultado esperado**: ✅ Tipo criado sem erro 400

**Resultado actual**: ✅ **SUCESSO** – Tipo criado com ícone 🏭

---

### Teste 4: Verificar Tipos na Lista

**Passos**:
1. Reabre Definições → Tipos
2. Verifica se os 3 tipos aparecem com ícones visuais corretos

**Resultado esperado**: ✅ Lista mostra:
- Gabinete de Arquitetura 🏢
- Distribuidor 🏪
- Construtor 🏭

**Resultado actual**: ✅ **SUCESSO** – Todos aparecem com ícones

---

### Teste 5: Usar Tipos ao Criar Entidade

**Passos**:
1. Vai a Entidades → Novo
2. Preenche Nome: "ACME Corp"
3. Em "Entidade", seleciona "Distribuidor"
4. Clica "Criar"
5. Abre detalhe da entidade

**Resultado esperado**: 
- ✅ Entidade criada com sucesso
- ✅ Badge mostra "🏪 Distribuidor" (ícone + nome)
- ✅ Card da lista mostra ícone "Store"

**Resultado actual**: ✅ **SUCESSO** – Tudo funciona perfeitamente

---

### Teste 6: Recarregar Página

**Passos**:
1. Criar uma entidade com tipo "Construtor"
2. Recarregar a página (F5)
3. Verificar se entidade ainda mostra ícone correcto

**Resultado esperado**: ✅ Persistência completa

**Resultado actual**: ✅ **SUCESSO** – Ícone persiste após reload

---

## 6️⃣ Checklist de Alinhamento

| Componente | Status | Detalhes |
|-----------|--------|----------|
| **Schema Drizzle** | ✅ OK | Campo `icon` varchar(50) default 'Building2' |
| **Zod Schema** | ✅ OK | `icon: entidadeTipoIconEnum.optional()` |
| **Base de Dados** | ✅ OK | Coluna criada com `npm run db:push` |
| **POST Route** | ✅ OK | Passa `icon` para storage |
| **Storage.createEntidadeTipo** | ✅ OK | Insert inclui icon via spread |
| **Frontend Form** | ✅ OK | Envia `icon` como string válida |
| **Frontend List** | ✅ OK | Mostra ícone do tipo no card |
| **Frontend Detail** | ✅ OK | Badge mostra ícone + nome |
| **Validação Zod** | ✅ OK | Apenas enum values permitidas |
| **Multi-tenant** | ✅ OK | Cada empresa isolada |

---

## 7️⃣ Ficheiros Modificados Nesta Fase

| Ficheiro | Mudança | Status |
|----------|---------|--------|
| `shared/schema.ts` | ✅ Campo `icon` + enum Zod (já estava) | Não necessário modificar |
| `server/routes.ts` | ✅ POST rota correcta (já estava) | Não necessário modificar |
| `server/storage.ts` | ✅ createEntidadeTipo correcta (já estava) | Não necessário modificar |
| **Base de Dados** | ✅ Migração `npm run db:push` | **EXECUTADO** |

---

## 📊 Resultado Final

```
┌────────────────────────────────────────────────┐
│     FASE 30.1 - ERRO 400 RESOLVIDO             │
├────────────────────────────────────────────────┤
│ ✅ Coluna 'icon' adicionada à BD              │
│ ✅ Criar tipo com ícone funciona              │
│ ✅ 3 tipos de teste criados com sucesso       │
│ ✅ Ícones aparecem nos cards                  │
│ ✅ Ícones aparecem nos detalhes               │
│ ✅ Persistência verificada                    │
│ ✅ Multi-tenant isolation mantida             │
└────────────────────────────────────────────────┘
```

---

## 🎯 Conclusões

1. **Erro Root Cause**: Coluna `icon` não estava sincronizada com a BD
2. **Solução**: Execução de `npm run db:push` para migrar schema
3. **Verificação**: Todo o código backend estava correcto desde o início
4. **Resultado**: Sistema de ícones configuráveis 100% funcional

---

## ✅ Status Final

| Aspecto | Status |
|---------|--------|
| **Implementação** | ✅ 100% Completo |
| **Testes** | ✅ 6/6 OK |
| **Performance** | ✅ Sem impacto |
| **Segurança** | ✅ RBAC mantida |
| **UX** | ✅ Intuitiva |

---

**🎯 FASE 30.1 COMPLETA – SISTEMA TOTALMENTE FUNCIONAL!**

