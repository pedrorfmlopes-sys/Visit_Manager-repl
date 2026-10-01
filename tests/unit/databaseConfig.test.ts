import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseSchema,postgresOptions} from '../../server/databaseConfig';
test('private PostgreSQL schema is validated and isolated in search_path',()=>{
 assert.equal(databaseSchema({}),'public');
 assert.equal(postgresOptions({DATABASE_URL:'postgres://u:p@localhost/lab',DATABASE_SCHEMA:'visit_manager'}).options,'-c search_path=visit_manager');
 assert.throws(()=>databaseSchema({DATABASE_SCHEMA:'visit_manager,public'}));
 assert.throws(()=>databaseSchema({DATABASE_SCHEMA:'test; DROP SCHEMA public'}));
});
test('production PostgreSQL requires verified TLS and prevents URL overrides',()=>{
 const env={DATABASE_URL:'postgres://u:p@localhost/lab',NODE_ENV:'production'};
 assert.throws(()=>postgresOptions(env));
 assert.equal(postgresOptions({...env,DATABASE_SSL_MODE:'verify-full'}).ssl && (postgresOptions({...env,DATABASE_SSL_MODE:'verify-full'}).ssl as {rejectUnauthorized:boolean}).rejectUnauthorized,true);
 assert.throws(()=>postgresOptions({...env,DATABASE_SSL_MODE:'verify-full',DATABASE_URL:env.DATABASE_URL+'?sslmode=no-verify'}));
});
