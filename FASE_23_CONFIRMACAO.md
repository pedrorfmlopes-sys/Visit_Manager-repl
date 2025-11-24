# FASE 23: IA Insights Dashboard - Confirmação de Implementação

Data: 24 de Novembro de 2025

## ✅ Confirmação 1: Cenário Admin - Foco em Empresa/Equipa

### Como se diferencia Agent vs Admin?

**Backend (server/storage.ts)**

#### getTarefasInPeriod (linhas 878-905)
```typescript
// Agent: Filtra por userId
const whereClause = userRole === 'agent'
  ? and(
      eq(tarefas.empresaId, empresaId),
      or(
        eq(tarefas.createdByUserId, userId),    // Apenas tarefas criadas por este user
        eq(tarefas.assignedUserId, userId)      // OU atribuídas a este user
      ),
      sql`${tarefas.dueDate} >= ${startDate}`,
      sql`${tarefas.dueDate} <= ${endDate}`
    )
  // Admin: Agregado - sem filtro de userId
  : and(
      eq(tarefas.empresaId, empresaId),
      sql`${tarefas.dueDate} >= ${startDate}`,
      sql`${tarefas.dueDate} <= ${endDate}`
    );
```

#### getVisitasInPeriod (linhas 931-955)
```typescript
// Agent: Filtra por userId
const whereClause = userRole === 'agent'
  ? and(
      eq(visitas.empresaId, empresaId),
      eq(visitas.createdByUserId, userId),    // Apenas visitas deste user
      sql`${visitas.dataVisita} >= ${startDate}`,
      sql`${visitas.dataVisita} <= ${endDate}`
    )
  // Admin: Agregado - sem filtro de userId
  : and(
      eq(visitas.empresaId, empresaId),
      sql`${visitas.dataVisita} >= ${startDate}`,
      sql`${visitas.dataVisita} <= ${endDate}`
    );
```

**Frontend/Backend (routes.ts, linhas 406-414)**

```typescript
// Get metrics - storage methods automatically differentiate:
// - agent: filtered by userId (createdByUserId/assignedUserId)
// - admin: aggregated by empresaId (all users)
const visitas = await storage.getVisitasInPeriod(from, to, empresaId, userId, userRole);
const tarefas = await storage.getTarefasInPeriod(from, to, empresaId, userId, userRole);

// Get all visitas to calculate next 7 days (same role-based filtering)
const nextWeek = new Date(to.getTime() + 7 * 24 * 60 * 60 * 1000);
const visitasProximas = await storage.getVisitasInPeriod(to, nextWeek, empresaId, userId, userRole);
```

### Adaptação do Prompt IA (server/openai.ts, linhas 442-481)

**Scope Agent (pessoal):**
```javascript
const scopeLabel = data.scope === 'agent' ? 'pessoal' : 'da equipa/empresa';
const perspective = data.scope === 'agent' 
  ? 'Escreve em tom de recomendações personalizadas para melhorar a tua performance pessoal.'
  : 'Escreve em tom executivo dirigido à gestão, focando na performance coletiva da equipa/empresa.';
```

**Resultado:**
- **Agent**: "Recomendações para ti" - Texto focado em "como TU podes melhorar"
- **Admin**: "Insights da empresa" - Texto focado em "como a EQUIPA/EMPRESA está a funcionar"

---

## ✅ Confirmação 2: Cenário IA Desligada - Não Chamar API

### Flag de Controlo em uiSettings

**Localização**: `empresas.uiSettings` (campo JSON)

**Campo/Flag Exato**: `uiSettings.enableIA`

**Valor**:
- `enableIA: true` (padrão, ou ausente) → IA **ativada**
- `enableIA: false` → IA **desativada**

**Backend (routes.ts, linhas 386-400)**

```typescript
// Get empresa to check if IA is enabled
const empresa = await storage.getEmpresa(empresaId);
if (!empresa) return res.status(404).json({ message: "Company not found" });

// Check if dashboard insights are enabled (default enabled for backwards compatibility)
const uiSettings = typeof empresa.uiSettings === 'string' ? JSON.parse(empresa.uiSettings) : empresa.uiSettings;
const enableIA = uiSettings?.enableIA !== false; // Default to true

if (!enableIA) {
  return res.json({
    scope: userRole,
    period: { from: "", to: "" },
    metrics: {},
    insightsText: "Insights IA desativados nas definições da empresa."
  });
}
```

### Frontend - Evita Chamar API Quando IA está Desligada

**Fluxo:**
1. Frontend chama sempre `/api/dashboard/insights`
2. Backend verifica `uiSettings.enableIA`
3. Se `enableIA = false`, backend retorna mensagem com `insightsText = "Insights IA desativados..."`
4. Frontend detecta essa mensagem e renderiza apenas a mensagem informativa

**DashboardInsightsCard.tsx (linhas 68-102)**

```typescript
const isInsightsDisabled = data.insightsText.includes("desativados");

return (
  <Card data-testid="card-insights">
    <CardHeader>...</CardHeader>
    <CardContent className="space-y-4">
      {isInsightsDisabled ? (
        // Mostra apenas mensagem informativa
        <p className="text-sm text-muted-foreground">{data.insightsText}</p>
      ) : (
        // Mostra insights completos
        <>
          <div className="prose prose-sm">
            <div className="text-sm text-foreground">
              {data.insightsText}
            </div>
          </div>
          {/* Refresh button, etc. */}
        </>
      )}
    </CardContent>
  </Card>
);
```

**Comportamento Resultante:**

| Cenário | Resultado |
|---------|-----------|
| `enableIA: true` (padrão) | Endpoint geradores insights IA, card mostra análise completa |
| `enableIA: false` | Endpoint retorna mensagem, card mostra "Insights IA desativados..." |
| Sem OpenAI API key | Endpoint retorna insights de fallback, card mostra mensagem padrão |

---

## 📋 Resumo de Implementação

### Arquivos Modificados

1. **server/openai.ts**
   - ✅ Função `generateDashboardInsights()` com scope-based prompt
   - ✅ Adapta linguagem: "A equipa..." (admin) vs "Tu..." (agent)

2. **server/routes.ts**
   - ✅ Endpoint `GET /api/dashboard/insights`
   - ✅ Verifica `uiSettings.enableIA`
   - ✅ Passa `scope` (agent/admin) ao gerador IA
   - ✅ Retorna métricas + insights

3. **client/src/components/DashboardInsightsCard.tsx**
   - ✅ Novo componente de insights
   - ✅ Deteta se IA está desativada via texto da resposta
   - ✅ Mostra estado de loading, erro, ou insights
   - ✅ Botão "Regenerar insights"

4. **client/src/pages/Dashboard.tsx**
   - ✅ Importa e renderiza `DashboardInsightsCard`
   - ✅ Posição: Acima do card de PDF Export

5. **client/src/pages/AdminDashboard.tsx**
   - ✅ Importa e renderiza `DashboardInsightsCard`
   - ✅ Mostra "Insights da empresa" para admin
   - ✅ Posição: Acima do card de PDF Export

### Storage Layer (Sem Alterações)
- ✅ `storage.getTarefasInPeriod()` - JÁ diferencia agent vs admin
- ✅ `storage.getVisitasInPeriod()` - JÁ diferencia agent vs admin

---

## 🎯 Endpoints

### GET /api/dashboard/insights

**Autenticação**: Required (isAuthenticated)

**Resposta OK (200)**:
```json
{
  "scope": "agent|admin",
  "period": {
    "from": "2025-10-25",
    "to": "2025-11-24"
  },
  "metrics": {
    "visitasRealizadas": 12,
    "visitasAgendadas": 3,
    "tarefasCriadas": 8,
    "tarefasConcluidas": 5,
    "tarefasEmAtraso": 2,
    "clientesChave": [
      { "nome": "Cliente X", "visitCount": 4 }
    ],
    "marcasMaisTrabalhadas": [
      { "marca": "Marca A", "count": 6 }
    ]
  },
  "insightsText": "Gerado com IA ou mensagem de desativação..."
}
```

**Resposta IA Desativada (200)**:
```json
{
  "scope": "admin",
  "period": { "from": "", "to": "" },
  "metrics": {},
  "insightsText": "Insights IA desativados nas definições da empresa."
}
```

---

## 🔍 Testes

### Teste 1: Agent vê insights pessoais
1. Login como Agent
2. Ir ao Dashboard
3. Ver card "Recomendações para ti"
4. Verificar que fala em "A tua performance...", "Visitaste...", etc.

### Teste 2: Admin vê insights de equipa
1. Login como Admin
2. Ir ao AdminDashboard
3. Ver card "Insights da empresa"
4. Verificar que fala em "A equipa...", "A empresa visitou...", etc.

### Teste 3: IA Desativada
1. Admin vai a Settings → IA & Transcrição
2. Desativa "Dashboard Insights"
3. Voltar ao Dashboard
4. Card mostra "Insights IA desativados nas definições da empresa"
5. Sem chamar OpenAI

---

## 📝 Notas Técnicas

- **Cache**: 5 minutos (staleTime em frontend)
- **Métrica de Período**: Últimos 30 dias
- **Próximas Visitas**: Calculadas para próximos 7 dias
- **Fallback**: Se OpenAI não configurada, retorna mensagem padrão
- **Backward Compatibility**: `enableIA` padrão é `true`

---

## ✨ FASE 23 Completa

Status: ✅ **IMPLEMENTADA E CONFIRMADA**

Data: 24/11/2025
