import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const batch = process.env.INITIAL_UPLOADS_RESTORE;
if (batch) {
  const schema = process.env.DATABASE_SCHEMA;
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema || '')) throw new Error('Invalid database schema');
  const root = path.resolve(process.env.UPLOADS_DIR || '/app/uploads');
  const marker = path.join(root, '.restore-' + crypto.createHash('sha256').update(batch).digest('hex'));
  let complete = false;
  try { complete = (await fs.readFile(marker, 'utf8')) === batch; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!complete) {
    const client = new pg.Client({connectionString:process.env.DATABASE_URL,
      ssl:{rejectUnauthorized:true,ca:await fs.readFile(process.env.DATABASE_SSL_CA_FILE,'utf8')},
      connectionTimeoutMillis:15000});
    await client.connect();
    try {
      const {rows} = await client.query(`SELECT path,content,sha256 FROM "${schema}".deployment_uploads WHERE batch=$1 ORDER BY path`,[batch]);
      if (!rows.length) throw new Error('Upload restore batch missing');
      for (const file of rows) {
        if (typeof file.path !== 'string' || file.path.includes('\\') || file.path.split('/').some(x=>!x || x==='.' || x==='..') || path.isAbsolute(file.path)) throw new Error('Unsafe upload path');
        const target=path.resolve(root,file.path);
        if (!target.startsWith(root+path.sep)) throw new Error('Upload escaped storage root');
        const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
        if (hash(file.content)!==file.sha256) throw new Error('Upload backup checksum mismatch');
        await fs.mkdir(path.dirname(target),{recursive:true});
        try { await fs.writeFile(target,file.content,{flag:'wx'}); }
        catch (error) { if(error.code!=='EEXIST') throw error; }
        if(hash(await fs.readFile(target))!==file.sha256) throw new Error('Existing upload differs; restore stopped without overwrite');
      }
      await fs.writeFile(marker,batch,{flag:'wx'});
      console.log(`Verified ${rows.length} restored uploads.`);
    } finally { await client.end(); }
  }
}
