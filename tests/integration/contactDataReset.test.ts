import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'node:crypto';
import {resetVisitTestData} from '../../server/contactDataReset';
test('business reset previews, rejects changed data, preserves accounts/configuration, rehearses rollback and refuses unknown dependencies',async()=>{
 const url=process.env.CONTACT_ACCESS_TEST_DATABASE_URL;
 assert.ok(url && new URL(url).hostname==='db','Isolated Docker database required');
 const schema='reset_test_'+crypto.randomBytes(8).toString('hex'),pool=new pg.Pool({connectionString:url});
 try {
  await pool.query(`CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.empresas(id text PRIMARY KEY,license text);
   CREATE TABLE ${schema}.users(id text PRIMARY KEY,password_hash text,empresa_id text REFERENCES ${schema}.empresas(id));
   CREATE TABLE ${schema}.invoice_connections(id text PRIMARY KEY,secret text);
   CREATE TABLE ${schema}.entidades(id text PRIMARY KEY,empresa_id text REFERENCES ${schema}.empresas(id));
   CREATE TABLE ${schema}.contactos(id text PRIMARY KEY,entidade_id text REFERENCES ${schema}.entidades(id));
   CREATE TABLE ${schema}.visitas(id text PRIMARY KEY,contacto_id text REFERENCES ${schema}.contactos(id));
   INSERT INTO ${schema}.empresas VALUES('company','paid'); INSERT INTO ${schema}.users VALUES('admin','fake hash','company');
   INSERT INTO ${schema}.invoice_connections VALUES('invoice','fake token'); INSERT INTO ${schema}.entidades VALUES('entity','company');
   INSERT INTO ${schema}.contactos VALUES('person','entity'); INSERT INTO ${schema}.visitas VALUES('visit','person');`);
  const first=await resetVisitTestData(pool,{schema});assert.equal(first.business.visitas,1);
  const rehearsal=await resetVisitTestData(pool,{schema,expectedFingerprint:first.fingerprint});assert.equal(rehearsal.protectedUnchanged,true);
  assert.equal((await resetVisitTestData(pool,{schema})).fingerprint,first.fingerprint,'rehearsal must restore every row');
  await pool.query(`INSERT INTO ${schema}.visitas VALUES('new','person')`);
  await assert.rejects(resetVisitTestData(pool,{schema,expectedFingerprint:first.fingerprint,commit:true}),/mudaram/);
  const updated=await resetVisitTestData(pool,{schema});
  await pool.query(`CREATE TABLE ${schema}.unexpected(id text REFERENCES ${schema}.contactos(id)); INSERT INTO ${schema}.unexpected VALUES('person');`);
  const extra=await resetVisitTestData(pool,{schema});
  await assert.rejects(resetVisitTestData(pool,{schema,expectedFingerprint:extra.fingerprint,commit:true}),/foreign key/);
  assert.equal((await resetVisitTestData(pool,{schema})).business.visitas,2);
  await pool.query(`DROP TABLE ${schema}.unexpected`);
  const final=await resetVisitTestData(pool,{schema,expectedFingerprint:updated.fingerprint,commit:true});
  assert.equal(final.mode,'committed');assert.equal(final.protectedUnchanged,true);
  assert.deepEqual((await pool.query(`SELECT id,license FROM ${schema}.empresas`)).rows,[{id:'company',license:'paid'}]);
  assert.deepEqual((await pool.query(`SELECT password_hash FROM ${schema}.users`)).rows,[{password_hash:'fake hash'}]);
 }finally{await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();}
});
