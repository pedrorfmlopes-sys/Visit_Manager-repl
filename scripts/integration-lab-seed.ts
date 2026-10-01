import fs from 'node:fs';
import pg from 'pg';
import { hashPassword } from '../server/passwordAuth';
if (process.env.INTEGRATION_LAB !== 'true' || new URL(process.env.DATABASE_URL!).hostname !== 'db') throw new Error('Este seed só funciona no laboratório Docker.');
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
await pool.query('CREATE TABLE IF NOT EXISTS integration_lab_migrations(name text PRIMARY KEY)');
for(const name of fs.readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort()) {
  if((await pool.query('SELECT 1 FROM integration_lab_migrations WHERE name=$1',[name])).rowCount)continue;
  await pool.query('BEGIN');
  try{await pool.query(fs.readFileSync('migrations/'+name,'utf8'));await pool.query('INSERT INTO integration_lab_migrations VALUES($1)',[name]);await pool.query('COMMIT');}catch(e){await pool.query('ROLLBACK');throw e;}
}
await pool.query("INSERT INTO empresas(id,nome) VALUES('lab-company','Empresa de demonstração'),('other-company','Outra empresa de teste') ON CONFLICT DO NOTHING");
await pool.query("UPDATE empresas SET crm_leads_enabled=true WHERE id IN ('lab-company','other-company')");
await pool.query(`INSERT INTO users(id,email,password_hash,first_name,role,empresa_id,ativo) VALUES('lab-admin','admin@visit.test',$1,'Administrador','admin','lab-company',true),('other-admin','other@visit.test',$1,'Outro','admin','other-company',true),('lab-agent','agent@visit.test',$1,'Agente','agent','lab-company',true) ON CONFLICT DO NOTHING`,[await hashPassword('LocalDemo-2026!')]);
await pool.query("INSERT INTO entidades(id,empresa_id,nome,tipo_entidade,nif) VALUES('lab-entity','lab-company','Atelier de demonstração','Gabinete','PT500000001'),('other-entity','other-company','Entidade isolada','Gabinete','PT500000002') ON CONFLICT DO NOTHING");
await pool.query("INSERT INTO contactos(id,empresa_id,nome,entidade_id,email) VALUES('lab-contact','lab-company','Contacto de demonstração','lab-entity','contacto@example.test') ON CONFLICT DO NOTHING");
await pool.query("INSERT INTO entidades(id,empresa_id,nome,tipo_entidade) VALUES('10000000-0000-4000-8000-000000000001','lab-company','Entidade para testes HTTP','Gabinete') ON CONFLICT DO NOTHING");
await pool.query("INSERT INTO leads(id,empresa_id,entidade_id,titulo,descricao) VALUES('lab-lead','lab-company','lab-entity','Hotel de demonstração','Pedido de torneiras para o projeto de teste') ON CONFLICT DO NOTHING");
await pool.query("INSERT INTO visitas(id,empresa_id,entidade_id,user_id,data_visita,notas) VALUES('lab-visit','lab-company','lab-entity','lab-admin',now(),'Visita de demonstração') ON CONFLICT DO NOTHING");
await pool.query("INSERT INTO tarefas(id,empresa_id,titulo,created_by_user_id) VALUES('lab-task','lab-company','Preparar proposta','lab-admin') ON CONFLICT DO NOTHING");
await pool.end();
console.log('Laboratório Visit Manager preparado.');
