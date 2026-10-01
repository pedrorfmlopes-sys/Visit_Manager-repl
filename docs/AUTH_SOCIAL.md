# Login com Google e Microsoft

O login social usa apenas OpenID Connect:

```text
openid email profile
```

Nao pede permissoes Microsoft Graph, Google Calendar, contactos, ficheiros ou
tokens offline. As integracoes de dados existentes continuam separadas.

## Google

Criar um cliente OAuth do tipo Web e configurar:

```env
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=
GOOGLE_AUTH_CALLBACK_URL=http://127.0.0.1:5050/api/auth/google/callback
```

Adicionar o mesmo callback aos redirect URIs autorizados no Google Cloud.

## Microsoft

Registar uma aplicacao Web no Microsoft Entra. Para aceitar contas profissionais
e pessoais, selecionar contas de qualquer organizacao e contas Microsoft
pessoais. Configurar:

```env
MICROSOFT_AUTH_CLIENT_ID=
MICROSOFT_AUTH_CLIENT_SECRET=
MICROSOFT_AUTH_TENANT=common
MICROSOFT_AUTH_CALLBACK_URL=http://127.0.0.1:5050/api/auth/microsoft/callback
```

Adicionar o callback a plataforma Web da aplicacao. Nao e necessario adicionar
permissoes Graph.

## Producao

Substituir os callbacks locais pelos URLs HTTPS do dominio final. Os redirect
URIs configurados no fornecedor e na aplicacao devem coincidir exatamente.
