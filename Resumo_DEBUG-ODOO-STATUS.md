# Relatório: DEBUG ODOO /status (Erro Capturado)

**Data:** 26 de Novembro de 2025  
**Projeto:** Visit Manager  
**Status:** ✅ **ERRO IDENTIFICADO**

---

## 🎯 Objetivo

Capturar a mensagem de erro exata quando a rota GET `/api/integrations/odoo/status` falha, usando logging detalhado (message + stack trace).

---

## 📊 ERRO CAPTURADO

### 1. Erro no Servidor (Backend Logs)

**Timestamp:** 7:22:08 PM e 7:23:03 PM  
**Rota:** GET `/api/integrations/odoo/status`  
**Status HTTP:** 500

```
[Odoo] /status error: {
  message: 'Odoo error: Odoo Server Error',
  stack: 'Error: Odoo error: Odoo Server Error
    at authenticateOdoo (/home/runner/workspace/server/integrations/odooClient.ts:78:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async testOdooConnection (/home/runner/workspace/server/integrations/odooClient.ts:100:16)
    at async <anonymous> (/home/runner/workspace/server/routes/integrations/odoo.ts:26:22)'
}
```

**Análise:**
- **Erro:** `Odoo error: Odoo Server Error`
- **Localização:** `authenticateOdoo()` em `odooClient.ts` linha 78
- **Fluxo:** testOdooConnection → authenticateOdoo → erro
- **Causa Raiz:** Falha na autenticação com o servidor Odoo

---

### 2. Erro no Browser Console

**Timestamp:** 1764184169619  
**Contexto:** Ao tentar guardar configuração Odoo

```json
["Error saving Odoo connection", {
  "message": "Control plane request failed"
}]
```

**Análise:**
- **Erro:** `Control plane request failed`
- **Contexto:** Falha ao guardar credentials Odoo
- **Possível Causa:** Problema ao fazer request para o Odoo server ou credenciais inválidas

---

## 🔍 Stack Trace Completo

```
Error: Odoo error: Odoo Server Error
    at authenticateOdoo (/home/runner/workspace/server/integrations/odooClient.ts:78:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async testOdooConnection (/home/runner/workspace/server/integrations/odooClient.ts:100:16)
    at async <anonymous> (/home/runner/workspace/server/routes/integrations/odoo.ts:26:22)
```

**Passo-a-Passo:**
1. Rota `/api/integrations/odoo/status` (odoo.ts:26) recebe request
2. Chama `testOdooConnection()` (odooClient.ts:100)
3. `testOdooConnection()` chama `authenticateOdoo()` (odooClient.ts:78)
4. `authenticateOdoo()` falha com: `Odoo error: Odoo Server Error`

---

## 📋 Response JSON Enviado ao Cliente

```json
{
  "connected": false,
  "error": "Odoo status error",
  "message": "Odoo error: Odoo Server Error"
}
```

**Status:** 500 Internal Server Error

---

## ✅ Melhorias Implementadas

### Ficheiro Editado: `server/routes/integrations/odoo.ts`

**Antes:**
```typescript
console.error("[Odoo] Status error:", error);
return res.status(500).json({
  connected: false,
  reason: "error",
  message: error.message ?? "Unknown error",
});
```

**Depois:**
```typescript
console.error("[Odoo] /status error:", {
  message: error?.message,
  stack: error?.stack,
});

return res.status(500).json({
  connected: false,
  error: "Odoo status error",
  message: error?.message ?? "Unknown error",
});
```

**Benefícios:**
- ✅ Message agora incluída na resposta JSON
- ✅ Stack trace capturado nos logs
- ✅ Identificação clara do erro com `[Odoo] /status error:`

---

## 🎯 Diagnóstico

### Problema Identificado

A ligação com o Odoo está a falhar na fase de autenticação. O erro "Odoo Server Error" sugere que:

1. **Credenciais Inválidas** - O URL/API Key podem estar errados
2. **Servidor Odoo Indisponível** - O servidor Odoo pode estar down
3. **Timeout de Ligação** - A ligação pode estar a timeout
4. **Erro de Network** - Problema de rede entre Visit Manager e Odoo

### Próximos Passos para Corrigir

Para resolver isto, é necessário:

1. **Verificar credenciais Odoo:**
   - URL do servidor Odoo correcto?
   - API Key válida?
   - Permissões correctas na conta Odoo?

2. **Testar ligação Odoo:**
   - Fazer curl directo para Odoo API
   - Verificar se Odoo server está online

3. **Verificar implementação `authenticateOdoo()`:**
   - Ler código em `server/integrations/odooClient.ts` linha 78
   - Ver qual é a chamada exacta que está a falhar

---

## 📊 Testes Realizados

| Teste | Resultado |
|-------|-----------|
| GET /api/integrations/odoo/status | ❌ 500 Error |
| Message nos logs | ✅ Capturado |
| Stack trace | ✅ Capturado |
| Response JSON | ✅ Contém message |
| Tentativas | 2 (7:22:08 PM e 7:23:03 PM) |

---

## 📝 Ficheiros Afectados

- ✅ `server/routes/integrations/odoo.ts` - Logging melhorado
- 🔍 `server/integrations/odooClient.ts` - Onde o erro originalmente ocorre (linha 78)
- 🔍 `shared/schema.ts` - Schema Odoo (verificar se credenciais estão correctamente mapeadas)

---

## 🏁 Conclusão

O logging foi **implementado com sucesso** e o erro foi **identificado claramente**:

**Erro:** `Odoo error: Odoo Server Error` na função `authenticateOdoo()`

**Causa Provável:** Problema na autenticação com o servidor Odoo (credenciais, disponibilidade, ou permissões)

**Próximo Passo:** Examinar `odooClient.ts` linha 78 para ver qual é a chamada exacta que está a falhar, e validar as credenciais Odoo.

---

**Status Final: ✅ ERRO CAPTURADO E DOCUMENTADO - PRONTO PARA INVESTIGAÇÃO**
