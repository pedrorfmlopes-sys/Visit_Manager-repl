# Visit Manager

Aplicação web multiempresa para gerir entidades, contactos, visitas, tarefas,
planeamento e sincronização opcional com Odoo.

## Desenvolvimento local

1. Copiar `.env.example` para `.env` e preencher `DATABASE_URL`,
   `SESSION_SECRET` e `APP_ENCRYPTION_KEY`.
2. Executar `npm install`.
3. Preparar a base de dados com `npm run db:push`.
4. Iniciar com `npm run dev`.
5. Abrir `http://127.0.0.1:5050`.

## Validação

```powershell
npm run check
npm run test:unit
npm run test:migrations
npm run test:integration
npm run build
npm run test:e2e
```

Os testes de migrations e integração devem usar uma base de dados de testes,
nunca a base de produção.

## Publicação de teste

Antes de iniciar em produção:

- Usar uma base PostgreSQL separada da base de desenvolvimento.
- Definir todas as variáveis obrigatórias de `.env.example`.
- Configurar `APP_BASE_URL` com HTTPS.
- Registar os callback URLs de Google e Microsoft exatamente como publicados.
- Configurar SMTP e testar recuperação de palavra-passe e convites.
- Usar armazenamento persistente para `UPLOADS_DIR`; o disco efémero perde
  logótipos e anexos em cada deploy.
- Executar e verificar as migrations antes de trocar a versão ativa.
- Criar um backup da base de dados e testar a restauração.
- Manter `ENABLE_E2E_AUTH_HELPERS=false`.
- Confirmar consentimento de localização e política de privacidade antes de
  ativar alertas GPS para uma empresa.

O servidor valida a configuração crítica no arranque em produção e disponibiliza
`/api/health` e `/api/ready` para monitorização.

## Teste no telemóvel com Cloudflare Tunnel

Para iniciar tudo automaticamente, fazer duplo clique em
`Iniciar Visit Manager.cmd`. O ficheiro inicia a app, cria o túnel e abre o
endereço público no navegador.

1. Manter a app ligada numa janela com `npm.cmd run dev`.
2. Abrir outra janela na pasta do projeto e executar `npm.cmd run tunnel`.
3. Abrir no telemóvel o endereço HTTPS `trycloudflare.com` apresentado.
4. Manter as duas janelas abertas durante os testes.
5. Premir `Ctrl+C` na segunda janela para fechar o túnel.

O comando descarrega localmente o cliente oficial `cloudflared` quando necessário.
O endereço do Quick Tunnel é temporário e muda sempre que o comando é reiniciado.
