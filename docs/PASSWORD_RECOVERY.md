# Recuperação de palavra-passe

A aplicação permite pedir um link de recuperação no ecrã de login. Cada link:

- expira após 30 minutos;
- só pode ser utilizado uma vez;
- é guardado na base de dados apenas como hash;
- invalida as sessões existentes após a alteração da palavra-passe;
- devolve sempre a mesma mensagem, exista ou não uma conta com o email indicado.

O mesmo mecanismo seguro é usado para o convite inicial de utilizadores de uma
empresa. Ao definir a primeira palavra-passe, a conta passa de pendente a aceite.

## Desenvolvimento local

Não é necessário contratar um serviço de email para testar localmente. Sem SMTP
configurado, o servidor escreve o link no terminal e a interface apresenta um
botão para o abrir. Esse botão nunca é devolvido em produção.

## Produção

Em produção são obrigatórias as seguintes variáveis:

```env
APP_BASE_URL=https://app.exemplo.pt
SMTP_FROM="Visitas Comerciais <no-reply@exemplo.pt>"
```

O transporte pode ser configurado através de uma única URL:

```env
SMTP_URL=smtps://utilizador:palavra-passe@smtp.exemplo.pt:465
```

Ou através dos campos separados:

```env
SMTP_HOST=smtp.exemplo.pt
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=utilizador
SMTP_PASS=palavra-passe
```

`APP_BASE_URL` tem de usar HTTPS em produção. Se o SMTP não estiver configurado,
o pedido mantém uma resposta genérica por segurança, mas o erro de envio fica
registado no servidor.
