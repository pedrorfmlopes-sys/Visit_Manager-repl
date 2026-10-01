# Contas empresariais e licenciamento

## Modelo

- A licença pertence à empresa, não a um utilizador.
- O primeiro utilizador que regista a empresa é o proprietário.
- O proprietário mantém o perfil funcional de administrador, mas não pode ser
  desativado ou despromovido.
- Administradores gerem agentes. Apenas o proprietário pode gerir outros
  administradores.
- Todos os utilizadores e dados operacionais ficam associados ao mesmo
  `empresaId`.

## Convites

O administrador cria o utilizador em **Definições > Empresa e Equipa >
Utilizadores**. A aplicação reserva um lugar da licença e envia um link de uso
único, válido durante 30 minutos.

O convidado pode:

- abrir o link e definir uma palavra-passe;
- entrar com Google ou Microsoft usando exatamente o email convidado.

A associação social só é automática enquanto a conta está pendente e ainda não
tem palavra-passe nem identidade associada. Isto impede a substituição da
identidade de uma conta que já foi aceite.

Sem SMTP, o link aparece na interface apenas em desenvolvimento local. Em
produção é enviado por email.

## Licença

Os campos persistidos na empresa são:

- `license_plan`: `base`, `pro` ou `enterprise`;
- `license_status`: `active`, `suspended` ou outro estado definido pela camada
  comercial;
- `license_expires_at`: data opcional de expiração;
- `license_max_users`: limite opcional de utilizadores ativos.

Empresas migradas e novos registos recebem inicialmente licença `enterprise`
ativa e sem limite configurado. Isto preserva o funcionamento atual enquanto
não existe faturação.

O plano é um teto de funcionalidades. O administrador pode desligar um módulo
contratado, mas não pode ativar um módulo fora do plano nem alterar o próprio
plano. A alteração comercial da licença deve ser feita por uma futura área de
gestão da plataforma ou pelo sistema de faturação.

Uma licença suspensa ou expirada bloqueia novos logins e chamadas autenticadas.

## Planos

- **Base:** CRM, entidades, contactos, visitas, tarefas e lembretes.
- **Pro:** Base, leads e IA.
- **Enterprise:** todos os módulos, incluindo integrações Odoo.

As credenciais Odoo e as chaves de IA continuam a ser configurações próprias de
cada empresa. Ter o módulo contratado não cria nem altera campos no Odoo.
