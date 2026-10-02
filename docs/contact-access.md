# Contactos e projetos do InvoiceStudio

`CONTACT_ACCESS_V2=true` ativa o controlo por contacto. A opção fica desligada por defeito para permitir uma atualização compatível antes da transição dos dados.

## Utilização

- Um administrador importa o diretório em Integração InvoiceStudio: primeiro pré-visualiza, depois confirma a mesma versão. O Invoice é apenas consultado. Uma alteração da origem exige revisão, nunca reutiliza silenciosamente os identificadores anteriores.
- Entidades, pessoas e todas as suas associações mantêm identificadores de origem. Repetir a importação atualiza as cópias existentes e preserva decisões de acesso. Registos retirados/inativos na origem deixam de estar disponíveis aos utilizadores.
- Em Contactos e autorizações, os administradores consultam os contactos da empresa e autorizam/revogam o acesso de cada utilizador. Entidade e pessoa têm autorizações separadas.
- Um utilizador vê os contactos que criou ou que lhe foram autorizados. Uma revogação explícita prevalece sobre a criação. Os contactos importados não concedem acesso automaticamente.
- Criar um possível duplicado gera um pedido e um aviso na aplicação para os administradores. A correspondência considera nome normalizado, email, NIF e telefone, incluindo o segundo número importado. O utilizador recebe apenas o estado do pedido. Um administrador autoriza o contacto existente, recusa ou confirma que se trata de um contacto diferente.
- Os projetos continuam no Invoice. Os seus títulos e conteúdos só surgem no VisitManager após revisão/publicação por um administrador interno do Invoice, respeitando também as permissões existentes. Um documento com vários contactos exige acesso a todos. Conteúdo alterado precisa de nova revisão.
- Visitas e tarefas com contactos ocultos ficam integralmente ocultas. URLs diretos, anexos, pesquisa e relatórios aplicam a mesma restrição.
- Neste modo, é necessária ligação à Internet para consultar os contactos e projetos protegidos. Cópias antigas de respostas do servidor são removidas do armazenamento offline; rascunhos locais e a fila de envio são preservados.

## Transição operacional

1. Validar código, builds, testes de isolamento, importação, documentos e recuperação numa cópia Docker.
2. Guardar backups cifrados recentes e os commits/configurações atuais. Não restaurar uma cópia antiga do Invoice sobre trabalho diário novo.
3. Publicar primeiro o Invoice com a nova leitura desativada. Verificar saúde e funções existentes. Publicar depois o VisitManager.
4. Configurar `CONTACT_ACCESS_MAINTENANCE_FILE` com um caminho persistente exclusivo do VisitManager. Criar o ficheiro para bloquear pedidos e entregas automáticas. Esperar por `maintenance:true, activeOperations:0` em `/api/ready`; uma ligação interrompida exige reinício sob manutenção antes de prosseguir.
5. Usar `resetVisitTestData` apenas no schema privado correto, com a impressão digital da pré-visualização. A lista de tabelas é explícita, sem CASCADE. Contas, empresas, sessões, credenciais, tipos de entidade, configurações e licenças ficam preservados. Dependências desconhecidas ou alterações concorrentes cancelam a operação.
6. Importar o diretório revisto do Invoice sem conceder acessos a utilizadores. Verificar contagens, associações, contas preservadas e que não existem dados de teste nem permissões herdadas.
7. Retirar o ficheiro de manutenção e verificar a aplicação. Manter o backup anterior disponível. O helper de limpeza não é uma rota HTTP nem corre automaticamente.

O modo de manutenção pertence exclusivamente ao VisitManager. A integração com Odoo permanece configurável de forma independente; a descoberta/importação do diretório externo exige administrador no modo restrito.
