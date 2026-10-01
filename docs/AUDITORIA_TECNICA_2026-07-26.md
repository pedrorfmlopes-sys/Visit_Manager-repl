# Auditoria tecnica da Visit Manager

Data: 26 de julho de 2026

## Atualizacao apos correcoes

As secoes seguintes registam o estado encontrado na auditoria inicial e devem ser
lidas como baseline historica. Depois dessa auditoria foram executadas duas fases
de estabilizacao, preservadas nos commits Git `9f16202` e `fc49002`, seguidas da
fase atual.

Estado validado em 26 de julho de 2026:

| Validacao atual | Resultado |
| --- | --- |
| `npm run check` | Passou |
| `npm run build` | Passou |
| `npm run test:unit` | 3 de 3 testes passaram |
| `npm run test:migrations` | 1 de 1, instalacao limpa passou |
| `npm run test:e2e` | 30 de 30 testes passaram |
| Contrato real App -> Odoo -> App | Passou, incluindo titulo e Tipo de Lead |
| Isolamento de referencias entre empresas | Passou |
| `npm audit --omit=dev --audit-level=moderate` | 0 vulnerabilidades |

Ja corrigido:

- Autenticacao de producao, bloqueio do modo local fora de desenvolvimento,
  utilizadores inativos e handler global de erros.
- Migracoes Drizzle completas para o schema atual.
- URLs, autenticacao e configuracao de diretorio persistente dos uploads.
- Gravacao local de leads mesmo quando o Odoo falha, arrays vazios e estado
  explicito de sincronizacao.
- Sincronizacao bidirecional real de leads, incluindo o campo Odoo opcional Tipo
  de Lead quando configurado e validado nos settings.
- Validacao multi-tenant das relacoes usadas por entidades, contactos, tarefas,
  visitas e leads.
- Encriptacao versionada dos segredos Odoo, Google, Microsoft e OpenAI, incluindo
  migracao automatica de valores antigos em texto simples.
- Updates offline de visitas, persistencia do contador de tentativas e remocao do
  indicador de sincronizacao duplicado.
- Endpoint GPS no URL usado pelo frontend, transcricao real do audio anexado a
  uma nova visita e manifesto PWA com icones 192/512/maskable.
- Remocao da interface comercial do Planner, Google Workspace sem Calendar,
  cards apenas planeados e respetivo codigo frontend morto.
- Remocao do primeiro lote de 12 ficheiros frontend duplicados/inalcancaveis e
  sete dependencias declaradas sem utilizacao, preservando redirects e dados
  legados.
- Remocao de oito modulos backend inalcancaveis, incluindo routers duplicados,
  Leads 501, GPS antigo e integracoes legadas sem consumidores.
- Teste automatizado das migracoes numa base isolada e workflow CI para
  TypeScript, unitarios, migracoes, build e audit de producao.
- Dependencias de producao vulneraveis identificadas no audit inicial.
- Pesquisa de Contactos e Entidades com resultados imediatos, scroll e filtragem
  progressiva, incluindo deteção local de nomes de entidades semelhantes.
- Gestao visual da fila offline bloqueada, permitindo consultar, repetir ou
  descartar alteracoes depois do limite de tentativas.
- Monitorizacao GPS consolidada num unico observador global, evitando pedidos e
  notificacoes duplicados no Dashboard.
- Respostas `404` JSON para APIs desconhecidas, impedindo que o HTML da SPA seja
  interpretado como uma sincronizacao bem-sucedida.
- Remocao dos controlos visiveis de enriquecimento web/IA sem backend ativo.
- Downloads de uploads protegidos por sessao e propriedade da empresa, com
  resposta indistinguivel `404` para ficheiros de outras empresas.
- Limites, validacao MIME e assinatura binaria para logos, audio e media,
  incluindo bloqueio de novos SVG nao sanitizados.
- Limpeza fisica de audio/media ao apagar visitas ou audios, de ficheiros
  temporarios quando uma criacao falha e do logo anterior quando e substituido.

Ainda por finalizar:

- Configurar um volume persistente ou storage de objetos no ambiente de deploy;
  o codigo ja aceita `UPLOADS_DIR`, mas a infraestrutura nao esta definida no
  repositorio.
- Definir backup e restauracao do diretorio configurado em `UPLOADS_DIR` enquanto
  for usado armazenamento em disco local.
- O deploy atual usa Replit Autoscale, cujo disco local nao e persistente. Antes
  da entrega, os uploads devem ser ligados a Replit Object Storage ou outro
  storage de objetos; definir apenas uma pasta local nao resolve este risco.
- Testar instalacao e arranque PWA totalmente offline em browser e em
  dispositivos moveis reais.
- Remover ou arquivar codigo morto, schema legado e componentes/dependencias nao
  usados, sempre em lotes com regressao completa.
- Adicionar lint e ampliar a cobertura de integracao do backend.

## 1. Resumo executivo

A aplicacao tem um nucleo funcional e utilizavel. A autenticacao local, dashboards,
entidades, contactos, visitas, tarefas, lembretes, configuracoes de empresa e a
navegacao principal passam nos testes existentes. O TypeScript compila, o build de
producao termina com sucesso e os 26 testes end-to-end atuais passaram.

Ainda nao esta pronta para entrega comercial sem uma fase de estabilizacao. Os
principais bloqueios nao estao no aspeto visual: estao na instalacao da base de
dados, seguranca de autenticacao e multi-tenant, armazenamento de ficheiros,
sincronizacao Odoo, funcionalidade offline e dependencias vulneraveis.

A ideia original continua coerente e deve ser preservada:

- A app e o sistema operacional para entidades, contactos, visitas, tarefas,
  notas e informacao visivel introduzida pelo utilizador.
- O Odoo e uma integracao opcional para objetos comerciais que ja existem no
  Odoo, sem obrigar cada cliente a criar dezenas de campos.
- Campos Odoo personalizados devem ser opcionais, configurados e validados nos
  settings. O primeiro e, por agora, o Tipo de Lead.
- Modulos futuros devem ficar escondidos da versao comercial ate terem um fluxo
  funcional completo.

## 2. Validacoes executadas

| Validacao | Resultado |
| --- | --- |
| `npm run check` | Passou |
| `npm run build` | Passou |
| `npm run test:e2e` | 26 de 26 testes passaram |
| Analise de imports a partir de `client/src/main.tsx` e `server/index.ts` | 46 ficheiros TypeScript/TSX nao alcancaveis |
| `npm audit --omit=dev` | 19 vulnerabilidades: 1 critica, 11 altas e 7 moderadas |
| Comparacao entre schema e migracoes | Drift grave confirmado |

Os testes demoraram cerca de 6 minutos. Validam navegacao, CRUD principal,
settings, flags de modulos, paginas de integracoes e respostas basicas de IA/Odoo.
Nao validam uma instalacao limpa, escrita real bidirecional de leads no Odoo,
campo Tipo de Lead, Microsoft Planner, Google Calendar, uploads, GPS ou offline.

## 3. O que existe e funciona

### Nucleo CRM

- Autenticacao por sessao e contexto de empresa no ambiente atual.
- Separacao base entre administrador e agente.
- CRUD de entidades, contactos, visitas e tarefas.
- Associacao de contactos e marcas a visitas.
- Dashboards de administrador e agente.
- Analytics e lembretes.
- Tipos de entidade e marcas configuraveis.
- Configuracoes de empresa, tema, funcionalidades e catalogo de modulos.
- Pedidos de criacao/ligacao de contactos Odoo, incluindo estados e visibilidade.
- Exportacao de PDF/ICS nos fluxos atualmente ligados ao frontend.
- Criacao e edicao de tarefas com texto rico.
- Scanner de cartoes e filas especificas de importacao existem, embora camera e
  processamento offline nao estejam cobertos pelos testes end-to-end.

### Modulos e integracoes

- As flags de Leads, IA, Odoo Contacts e sync de visitas sao guardadas e
  aplicadas na navegacao e em varios endpoints.
- O backend Odoo consegue guardar uma ligacao, consultar estado, pesquisar
  parceiros, importar/ligar entidades e contactos e tem rotas de push/pull.
- A validacao do campo personalizado de Tipo de Lead existe no backend e guarda
  nome tecnico, tipo, label e opcoes de um campo `selection`.
- Microsoft OAuth, exportacao para To Do e exportacao de visitas para Outlook
  Calendar estao implementados.
- Google OAuth e estado da ligacao estao implementados.
- O service worker atual evita cachear a API e usa rede primeiro para navegacao,
  reduzindo o risco de servir JavaScript antigo.

## 4. Existe, mas nao e usado e pode sair

Esta lista resulta de imports estaticos a partir dos dois pontos de entrada. Antes
de apagar, deve ser criada uma baseline em controlo de versoes e repetidos todos
os testes.

### Ficheiros de produto sem utilizacao atual

Frontend:

- `client/src/pages/Gabinetes.tsx`
- `client/src/pages/GabineteForm.tsx`
- `client/src/components/GabineteCard.tsx`
- `client/src/components/FAB.tsx`
- `client/src/pages/AdminEntidades.tsx`
- `client/src/components/CompanyAutocomplete.tsx`
- `client/src/components/SearchSelectExample.tsx`
- `client/src/components/integrations/OdooIntegrationCard.tsx`
- `client/src/pages/MyOdooContactRequestsPage.tsx`
- `client/src/routes/odooContactRequests.ts`
- `client/src/routes/me.odoo-requests.tsx`
- `client/src/lib/pdfExport.ts`

Backend:

- `server/routes/index.ts`, segundo agregador de rotas que nao e importado pelo
  arranque.
- `server/routes/crm/leadsRoutes.ts`, implementacao antiga com respostas `501`.
- `server/routes/admin/empresaRoutes.ts`
- `server/routes/admin/entidadeTiposRoutes.ts`
- `server/routes/admin/utilizadoresRoutes.ts`
- `server/integrations/assertLeadsEnabled.ts`
- `server/enrichment.ts`
- `server/enrichmentPT.ts`
- `server/googleSearch.ts`
- `server/microsoft.ts`

Os scripts `migrate-gabinetes.ts`, `seed-enterprise.ts`, `debugLeads.ts` e scripts
de testes manuais tambem nao entram na aplicacao, mas devem ser arquivados como
ferramentas operacionais em vez de apagados sem confirmar o historico da base.

### Componentes UI e dependencias

Ha 21 componentes genericos em `client/src/components/ui` sem qualquer import
atual. Podem ser removidos em conjunto com as dependencias Radix correspondentes,
depois de uma verificacao automatica de imports.

Dependencias de aplicacao sem utilizacao encontrada:

- `framer-motion`
- `memorystore`
- `next-themes`
- `passport-local`
- `react-quill`
- `zod-validation-error`
- `tw-animate-css`
- `@tailwindcss/vite`

`react-quill` deve ser removido com prioridade porque arrasta uma versao vulneravel
de Quill. As dependencias de tipos e ferramentas de build nao devem ser removidas
apenas por nao aparecerem em imports.

### Dados e schema legado

- A tabela `gabinetes`, os campos `gabineteId` e o respetivo IndexedDB sao legado.
  As rotas visiveis ja redirecionam para Entidades.
- A tabela `microsoft_tokens` pertence a uma integracao Microsoft antiga. O codigo
  ativo usa `microsoft_connections`.
- O router `/api/search/*` esta registado mas o frontend ativo usa os endpoints
  `/api/crm/*/search`, implementados noutros modulos.
- As primeiras rotas PDF `/api/pdf/visitas/:id` e
  `/api/pdf/visitas/:id/ics` duplicam os endpoints ativos de Visitas.

Estas tabelas e colunas so devem ser removidas depois de uma consulta a producao
confirmar que nao existem registos ainda dependentes delas.

### Artefactos do projeto

- `attached_assets` tem 284 ficheiros, cerca de 8,81 MB, sem referencias no codigo.
- Existem logs, cookies temporarios, resultados de testes, relatorios antigos e
  um `footer.tsx` vazio na raiz.
- Existem blocos visiveis marcados como "Planeado" para email/notificacoes, mapas,
  storage e webhooks. Devem sair da interface comercial e ficar apenas num
  roadmap interno.
- O manual `Manual_Odoo_Campos_Integracao` contradiz a decisao atual, pois pede
  varios campos personalizados no Odoo. Deve ser substituido por um manual curto
  sobre campos opcionais validados nos settings.

## 5. Existe, mas tem falhas ou esta incompleto

### P0 - Bloqueios para uma entrega comercial

#### Migracoes da base de dados incompletas

`shared/schema.ts` contem leads, relacoes de leads, tipos de entidade,
`visitas_contactos`, ligacoes Google/Microsoft/Odoo e pedidos Odoo. As migracoes
versionadas nao criam essas tabelas. A migracao `0001` nem esta registada no
journal do Drizzle.

Impacto: uma instalacao nova pode ter build verde e falhar em runtime por tabelas
ou colunas inexistentes.

Correcao segura:

1. Tirar um snapshot do schema real da base atual.
2. Gerar uma migracao cumulativa apenas com as diferencas em falta.
3. Testar a migracao numa base vazia e numa copia da base atual.
4. Substituir alteracoes estruturais no arranque por migracoes idempotentes.
5. Adicionar teste automatizado de instalacao limpa.

#### Autenticacao insegura se OAuth nao estiver configurado

Sem OIDC, `/api/login` escolhe automaticamente o primeiro administrador da base.
Isto e aceitavel apenas em desenvolvimento local. O endpoint
`/api/dev/toggle-role` tambem esta disponivel sem condicao de ambiente e permite a
um utilizador autenticado alternar o proprio papel para administrador.

O campo `users.ativo` nao e verificado na autenticacao nem no contexto. Um
utilizador desativado pode continuar a usar uma sessao existente. Varias rotas
verificam o papel guardado na sessao, enquanto outras consultam a base, criando
comportamentos diferentes depois de uma alteracao de papel.

Correcao segura:

1. Bloquear o fallback e `toggle-role` fora de `NODE_ENV=development`.
2. Falhar o arranque de producao sem OIDC e `SESSION_SECRET`.
3. Centralizar `isAuthenticated` e `requireAdmin`.
4. Consultar `ativo`, papel e empresa atuais em cada contexto autenticado.
5. Invalidar sessoes quando um utilizador e desativado ou muda de empresa/papel.

#### Isolamento multi-tenant incompleto

Os IDs relacionados recebidos no body nao sao sempre validados contra a empresa
atual. Um pedido manipulado pode tentar associar um contacto, entidade, visita,
marca ou utilizador de outra empresa. Entidades e contactos tambem aceitam
`createdByUserId` e `assignedUserId` enviados pelo cliente em alguns fluxos.

Correcao segura:

1. Criar validadores comuns `assertEntityInCompany`, `assertContactInCompany`,
   `assertVisitInCompany`, `assertBrandInCompany` e `assertUserInCompany`.
2. Aplicar os validadores antes de cada create/update e dentro de transacoes.
3. Definir autoria no servidor; agentes nao devem escolher `createdByUserId`.
4. Adicionar testes com duas empresas que tentem cruzar IDs.

#### Uploads quebrados, temporarios e sem protecao

Os registos guardam URLs `/uploads/...`, mas o router e montado em
`/api/uploads/...`. Logos, audios e media podem portanto devolver 404 ou o HTML da
SPA. Os ficheiros ficam em `/tmp/uploads`, sendo perdidos num reinicio ou novo
deploy. O endpoint de download nao valida autenticacao.

Correcao segura:

1. Criar uma abstracao de storage e manter os URLs atuais durante a migracao.
2. Usar storage persistente S3-compativel ou volume persistente.
3. Separar logos publicos de audios/media privados.
4. Servir privados com autorizacao por empresa/registo ou URL assinada.
5. Migrar ficheiros existentes antes de trocar URLs.
6. Apagar o ficheiro quando o respetivo registo e eliminado.

#### Segredos em texto simples

Tokens Google/Microsoft, API key do Odoo e chave OpenAI da empresa sao guardados
em texto simples na base de dados.

Correcao segura:

1. Introduzir uma chave de encriptacao separada de `SESSION_SECRET`.
2. Encriptar novos valores com um formato versionado.
3. Ler temporariamente valores antigos e regrava-los encriptados.
4. Nunca devolver nem registar segredos em logs.

#### Dependencias vulneraveis

O audit encontrou 19 vulnerabilidades. As mais relevantes estao em `jspdf`
(critica), Drizzle ORM, Multer, `ws`, DOMPurify, Express e dependencias
transitivas. Nem todas podem ser atualizadas em bloco porque Drizzle e jsPDF
podem exigir adaptacoes.

Correcao segura:

1. Remover primeiro dependencias nao usadas, especialmente `react-quill`.
2. Aplicar atualizacoes sem breaking changes e repetir todos os testes.
3. Atualizar DOMPurify e Multer com testes dirigidos.
4. Criar uma branch/fase propria para Drizzle e jsPDF.
5. Adicionar `npm audit` ao controlo de qualidade.

### P1 - Funcionalidades visiveis com falhas

#### Tipo de Lead Odoo incompleto no frontend

O detalhe do lead ja carrega as opcoes configuradas do Odoo e calcula
`normalizedLeadTypeOptions`, mas o `<select>` continua sempre visivel e usa seis
opcoes fixas. Isto viola a regra acordada: o campo so deve aparecer quando o nome
tecnico existe, foi validado e continua valido.

Correcao segura:

1. Mostrar o campo apenas com `leadTypeFieldVerified === true` e nome tecnico.
2. Renderizar as opcoes devolvidas pelo Odoo, usando `value` e `label`.
3. Manter temporariamente o valor atual se deixou de existir, com aviso.
4. Ao gravar, fazer PATCH local e depois push Odoo; em erro, manter o valor local
   com `syncStatus=error`, sem fazer pull automatico.
5. Testar create, edit, limpar valor, opcao invalida, push e pull.

#### Sincronizacao de Leads Odoo sem cobertura suficiente

O backend ativo tem push e pull separados, marca `pending/error/synced` e ja
contem mapeamento do custom field. Contudo, os testes atuais so verificam status e
pesquisa Odoo; nao provam escrita real de um lead e leitura posterior.

Ao atualizar relacoes de um lead, enviar `contactosIds: []` ou `marcasIds: []`
nao limpa as associacoes porque o codigo so entra no bloco quando o array tem
elementos.

Correcao segura:

1. Corrigir arrays vazios dentro de uma transacao.
2. Criar um teste de contrato com um lead dedicado no Odoo.
3. Confirmar apos cada push o valor lido diretamente do Odoo.
4. Impedir qualquer pull automatico logo apos gravar na app.
5. Registar direcao, data e erro de sync sem sobrescrever o valor local.

#### Configuracao Odoo acessivel a qualquer utilizador autenticado

As rotas de guardar credenciais e validar campo personalizado usam apenas
`isAuthenticated`, nao `requireAdmin`. O endpoint `/test-create-lead` tambem esta
exposto e cria registos reais no Odoo.

Correcao segura: restringir configuracao/validacao a admin e remover ou limitar o
endpoint de teste a desenvolvimento. As operacoes de negocio continuam
disponiveis aos papeis definidos pelo produto.

#### Microsoft Planner aparece, mas nao existe no backend

`TarefaDetail` pede grupos, planos, buckets e exportacao Planner. Nao existem
handlers ativos para esses endpoints; ha apenas codigo comentado. To Do e Outlook
Calendar estao implementados.

Correcao segura: esconder Planner e manter To Do/Calendar, ou implementar os
quatro endpoints e testes com uma conta Microsoft de teste. Para terminar mais
depressa, a recomendacao e esconder Planner nesta versao.

#### Google ligado sem funcionalidade de Calendar

O OAuth e o estado funcionam, mas nao existe exportacao para Google Calendar nem
disconnect. O texto da interface promete sincronizacao de eventos.

Correcao segura: nesta entrega, rotular a ligacao como experimental/indisponivel
ou esconder o card. Implementar Calendar numa fase posterior com refresh,
disconnect e teste real.

#### Sugestoes GPS nao funcionam

O frontend chama `/api/visitas/proximidade`. O router esta montado sob
`/api/misc`, tornando o caminho real `/api/misc/visitas/proximidade`. Mesmo nesse
caminho, usa `req.storage`, que nunca e atribuido.

Correcao segura: manter o URL ja usado pelo frontend, montar a rota nesse URL e
importar `storage` diretamente. Adicionar teste com coordenadas e permissao GPS.

#### Audio de uma nova visita nao e realmente transcrito

No create de visita, o ficheiro de audio e guardado, mas a suposta transcricao
chama o gerador de resumo sem enviar o audio. A rota separada de transcricao usa o
ficheiro corretamente.

Correcao segura: criar primeiro a visita e o registo de audio, chamar a mesma
funcao de transcricao da rota dedicada e gerar o resumo apenas depois. Fazer o
processamento assincrono para nao bloquear a gravacao da visita.

#### Offline/PWA e parcial e pode duplicar dados

- Criar entidades, contactos, visitas e tarefas offline esta parcialmente ligado.
- Editar uma visita offline entra na fila de criacao e pode criar uma visita
  duplicada quando a ligacao regressa.
- O contador de retries do `syncManager` nunca e persistido; um item defeituoso
  pode ficar pendente indefinidamente.
- `SyncIndicator` e renderizado no `App` e novamente no layout de agente.
- A cache IndexedDB usa correspondencia ampla por URL; respostas de audio sob
  `/api/visitas/...` podem ser tratadas como visitas.
- O manifest so fornece um icone 128x128 e nao cumpre o conjunto habitual
  192x192/512x512/maskable.
- Nao ha testes de browser para instalacao, upgrade do service worker, arranque
  offline ou replay da fila.

Correcao segura:

1. Definir claramente se a entrega precisa de escrita offline ou apenas leitura.
2. Se precisar, modelar create/update/delete com idempotency keys.
3. Nunca converter um update offline em create.
4. Persistir retries e mostrar uma fila com erro recuperavel.
5. Renderizar um unico indicador.
6. Limitar a cache por recurso e adicionar testes PWA.

### P2 - Qualidade e manutencao

- `storage.ts`, `VisitaDetail.tsx`, `AdminEmpresa.tsx`, `crmLeads.ts`,
  `odooClient.ts` e `shared/schema.ts` sao demasiado grandes e misturam varias
  responsabilidades.
- Nao existe script de lint e o TypeScript nao verifica imports/variaveis nao
  usados.
- Nao ha testes unitarios nem testes de integracao do backend; existe uma unica
  suite E2E serial.
- Analytics, editor rico e bundle principal geram chunks grandes.
- O projeto nesta pasta nao contem metadata `.git` nem pipeline `.github`, o que
  torna rollback e entrega mais arriscados.
- O handler global de erros responde e volta a fazer `throw`, aumentando o risco
  de comportamento instavel e logs duplicados.
- Existem muitos `console.log` de payloads e fluxos internos em producao.
- A configuracao OAuth usa `Math.random()` para `state`; deve usar
  `crypto.randomBytes()` e cookies com limpeza consistente.

## 6. O que nao deve ser removido

- O schema local de entidades, contactos, visitas, tarefas e leads. E a base da
  ideia original e permite que os dados visiveis nao dependam de campos Odoo.
- IDs Odoo e metadados minimos de sincronizacao na base da app.
- A separacao explicita entre push e pull.
- A validacao opcional de custom fields Odoo nos settings.
- As flags de modulos por empresa.
- Os redirects de `/gabinetes` durante pelo menos uma versao, para nao quebrar
  links guardados.
- O codigo de migracao legado antes de confirmar e documentar o estado dos dados.
- Os testes que hoje passam; devem ser expandidos, nao substituidos.

## 7. Plano seguro para finalizar

### Fase 0 - Baseline e protecao

1. Colocar a pasta correta sob Git e criar uma tag/snapshot da versao atual.
2. Guardar dump da base de dados e inventario de ficheiros.
3. Congelar novas funcionalidades ate terminar P0 e P1.
4. Documentar variaveis de ambiente obrigatorias sem incluir segredos.

Aceitacao: build, 26 testes atuais e restauracao do dump confirmados.

### Fase 1 - Seguranca e instalacao

1. Corrigir auth de producao, utilizadores inativos e RBAC central.
2. Validar todas as relacoes por empresa.
3. Criar migracoes completas e teste de base vazia.
4. Atualizar/remover dependencias vulneraveis.
5. Encriptar segredos.

Aceitacao: testes com duas empresas, utilizador desativado, agente sem escalada,
base vazia e `npm audit` sem vulnerabilidades criticas/altas exploraveis.

### Fase 2 - Dados e uploads

1. Corrigir URLs e persistencia de uploads.
2. Separar ficheiros publicos e privados.
3. Corrigir audio/transcricao e limpeza de ficheiros.

Aceitacao: logo e audio continuam acessiveis apos reinicio; outro tenant nao
consegue abrir ficheiros privados; apagar remove registo e objeto.

### Fase 3 - Fechar Odoo

1. Terminar o campo condicional Tipo de Lead.
2. Corrigir arrays vazios e transacoes de lead.
3. Restringir settings Odoo a admin.
4. Criar testes reais app -> Odoo -> app e Odoo -> app.
5. Atualizar o manual conforme a integracao opcional.

Aceitacao: alterar na app permanece na app e aparece no Odoo; pull so ocorre por
acao explicita; valor invalido produz erro claro sem perder dados locais.

### Fase 4 - Fechar ou esconder funcionalidades incompletas

1. Corrigir GPS.
2. Decidir a promessa offline e implementar o minimo completo.
3. Manter Microsoft To Do/Calendar e esconder Planner ate estar pronto.
4. Esconder Google Calendar e blocos "Planeado" se nao forem concluidos.

Aceitacao: nenhum botao visivel devolve 404/501 ou promete uma funcionalidade sem
efeito.

### Fase 5 - Limpeza e desempenho

1. Remover codigo morto, componentes UI e dependencias nao usadas em lotes.
2. Remover schema legado apenas depois da auditoria de dados.
3. Dividir os ficheiros maiores por dominio.
4. Otimizar chunks e paralelizar a suite E2E com isolamento de dados.
5. Adicionar lint, testes unitarios, integracao backend e CI.

Aceitacao: cada lote passa TypeScript, build e suite completa; bundle inicial
diminui; nao existem rotas duplicadas nem imports mortos conhecidos.

## 8. Ordem recomendada imediata

Para terminar depressa sem fugir da ideia original:

1. Criar baseline Git e dump.
2. Corrigir auth, migracoes e isolamento multi-tenant.
3. Corrigir uploads persistentes.
4. Fechar definitivamente Leads/Odoo e Tipo de Lead com teste real.
5. Corrigir GPS e offline, ou esconder o que nao ficar completo.
6. Remover Planner, Google Calendar prometido e cards "Planeado" da entrega.
7. Fazer a limpeza de codigo morto e dependencias.
8. Executar uma regressao final em desktop, mobile, admin, agente e duas empresas.

O nucleo nao precisa de ser refeito. A estrategia mais segura e estabilizar as
fronteiras do sistema - autenticacao, tenant, base de dados, ficheiros e
integracoes - e so depois reduzir o legado.
