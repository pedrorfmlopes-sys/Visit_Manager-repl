# FASE 26 - Localização & Sugestões de Visita por Proximidade

## 🎯 Objetivo
Implementar sistema inteligente de sugestões de visita baseado em GPS, permitindo que agentes sejam notificados quando estão próximos de uma entidade com visita agendada ou sem visita recente.

## ✅ Features Implementadas

### 1. Backend - Endpoint de Proximidade
**File**: `server/routes.ts` (linhas 3282-3301)
**Endpoint**: `POST /api/visitas/proximidade`

```typescript
POST /api/visitas/proximidade
Body: { lat: number, lng: number }
Returns: { sugestao: NearbySuggestion | null }
```

**Lógica**:
- Recebe coordenadas GPS do cliente
- Busca todas entidades da empresa com lat/lng
- Calcula distância haversine para cada uma
- Filtra por raio (padrão 200m)
- Verifica se há visita agendada ±5 dias
- Se sim → sugestão "visita_agendada"
- Se não → verifica se última visita foi >60 dias atrás
- Se sim → sugestão "sem_visita_recente"
- Retorna null se nenhuma sugestão aplicável

### 2. Storage - Método getNearbyVisitSuggestions
**File**: `server/storage.ts` (linhas 1089-1163)

```typescript
async getNearbyVisitSuggestions(
  empresaId: string, 
  lat: number, 
  lng: number, 
  radiusMeters: number = 200
): Promise<any>
```

**Implementação**:
- Busca entidades com coordenadas válidas
- Carrega últimas 10 visitas por entidade
- Calcula distância real usando haversine
- Retorna sugestão inteligente ou null

### 3. Utilitários - Função Haversine
**File**: `server/distanceUtils.ts` (novo)

```typescript
export function haversineDistance(
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): number
```

**Fórmula**:
- Calcula distância em metros entre dois pontos GPS
- Usa raio da Terra (6.371.000m)
- Precisão: ±0.1% em distâncias normais

### 4. Hook Frontend - useNearbyVisitSuggestions
**File**: `client/src/hooks/useNearbyVisitSuggestions.ts` (novo)

**Funcionalidades**:
- Monitora GPS via Geolocation API
- Chamadas a cada 30s (configurable)
- Respeita `empresa.mostrarGPS` toggle
- Verifica `user.userSettings.localizacao.enableNearbySuggestions`
- RBAC: ativa apenas para agents
- Cooldown de 4h por entidade em localStorage
- Retorna: `{ suggestion, dismissSuggestion, isActive }`

**Lógica de Ativação**:
```typescript
const enableGPS = empresa.mostrarGPS === true;
const userAllowsIt = user.userSettings?.localizacao?.enableNearbySuggestions !== false;
setIsActive(enableGPS && userAllowsIt && user.role === 'agent');
```

### 5. Componente UI - NearbySuggestionSheet
**File**: `client/src/components/NearbySuggestionSheet.tsx` (novo)

**Features**:
- Modal/Sheet bottom com sugestão
- Título com ícone MapPin
- 2 tipos de card (azul para agendada, âmbar para antiga)
- Mostra: nome entidade, distância, info relevante
- Botões inteligentes:
  - Se agendada: "Abrir Visita" + "Nova Visita"
  - Se antiga: "Registar Agora" + "Ignorar"
- Close button (X) para fechar
- Closing auto se dismissido ou clicado fora

**Styling**:
- Usa Sheet do shadcn
- Cores semânticas (azul/âmbar)
- Responsive (mobile-first)

### 6. Integração no Dashboard
**File**: `client/src/pages/Dashboard.tsx`

**Mudanças**:
- Adiciona hook `useNearbyVisitSuggestions()`
- Renderiza `<NearbySuggestionSheet />` no fim
- Passa `suggestion` e `dismissSuggestion` ao componente

## 📊 Tipos de Dados

### NearbySuggestion Type
```typescript
interface NearbySuggestion {
  tipo: 'visita_agendada' | 'sem_visita_recente';
  entidadeId: string;
  entidadeNome: string;
  visitaId?: string;
  dataVisita?: string;           // ISO date string
  diasDesdeUltimaVisita?: number;
  distanciaMetros: number;
}
```

## 🔐 Segurança & RBAC

### Filtros Implementados
1. **Empresa Isolation**: Apenas entidades da empresa do user
2. **User Role**: Apenas agents veem sugestões (admin não)
3. **RBAC em Storage**: Backend filtra por empresaId
4. **Client-side Guards**: Hook verifica user role
5. **GPS Toggle**: Empresa pode desabilitar completamente

### Consentimento
- Geolocation API pede permissão explícita ao user
- User pode desabilitar em settings
- 4h cooldown evita spam
- Button para dispensar sugestão

## 🗄️ Database
- Utiliza campos existentes: `entidades.latitude`, `entidades.longitude`
- Nenhuma migração necessária (campos já existiam)
- Suporta valores NULL (entidades sem coords ignoradas)

## 🧪 Fluxo de Teste

### Cenário 1: Visita Agendada
1. Criar entidade com lat/lng
2. Agendar visita para hoje ±3 dias
3. Estar a <200m de distância
4. Resultado: Sheet mostra "Visita Agendada para [data]"

### Cenário 2: Entidade Sem Visita Recente
1. Criar entidade com lat/lng
2. Criar última visita há 70 dias
3. Estar a <200m de distância
4. Nenhuma visita agendada ±5 dias
5. Resultado: Sheet mostra "Sem visita há 70 dias"

### Cenário 3: Cooldown
1. Dispensar sugestão de entidade A
2. Afastar e voltar para <200m (mesma hora)
3. Resultado: Sheet não aparece (cooldown 4h ativo)

### Cenário 4: GPS Desabilitado
1. Admin desabilita `empresa.mostrarGPS`
2. Estar próximo de entidade
3. Resultado: Sheet não aparece

## 📈 Próximas Fases (Roadmap)

### FASE 27: Email Notifications
- Notificações por email quando próximo de entidade
- Preferências de frequência

### FASE 28: Push Notifications
- Push notification native se PWA instalado
- Background sync para offline

### FASE 29: Geofencing Advanced
- Círculos no mapa para visualizar raios
- Smart routing suggestions
- Multi-entity detection

## 🎨 Componentes Relacionados

### Usados
- shadcn/ui: Sheet, Button, Card
- lucide-react: MapPin, X icons
- react-query: Caching automático
- date-fns: Cálculos de data

### Futuros
- Maps component para visualizar proximidade
- Advanced filters para sugestões
- Analytics de sugestões aceitas vs dispensadas

## ✨ Melhorias Futuras

1. **Smart Routing**: Ordem de visitas por proximidade
2. **Predictive**: ML para prever próximas entidades
3. **Alerts**: Notificação antes de sair da zona
4. **Analytics**: Dashboard com padrões de proximidade
5. **A/B Testing**: Testar diferentes raios/tipos de sugestão

## 📝 Notas de Implementação

- **Haversine vs PostGIS**: Usamos cálculo em JavaScript em vez de PostGIS por simplicity
- **Polling vs WebSocket**: Usando geolocation.watchPosition (polling 30s) em vez de contínuo
- **Cooldown**: Armazenado em Memory (ref) - resetado ao refresh página
- **RBAC**: Dupla validação (backend + frontend)

---

**Status**: ✅ FASE 26 COMPLETA
**Data**: Novembro 24, 2025
**Testes**: Aguardando validação de UX
