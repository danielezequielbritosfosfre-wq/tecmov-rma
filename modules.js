'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {backup}=require('node:sqlite');
const ENTITIES={customers:['name','document','phone','email','address','notes'],products:['name','brand','model','sku','serial','warranty_months','notes'],suppliers:['name','contact','phone','email','address','notes']};
function installModules(store,directory){
 const db=store.db;const now=()=>new Date().toISOString();
 db.exec(`CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,document TEXT,phone TEXT,email TEXT,address TEXT,notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,brand TEXT,model TEXT,sku TEXT,serial TEXT,warranty_months TEXT,notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,contact TEXT,phone TEXT,email TEXT,address TEXT,notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS referrals(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id INTEGER NOT NULL REFERENCES cases(id),created_at TEXT NOT NULL,supplier_name TEXT NOT NULL,tracking TEXT,reason TEXT NOT NULL,tests TEXT,accessories TEXT,operator TEXT NOT NULL,reply TEXT,reply_at TEXT);
 CREATE TABLE IF NOT EXISTS referral_updates(id INTEGER PRIMARY KEY AUTOINCREMENT,referral_id INTEGER NOT NULL REFERENCES referrals(id),created_at TEXT NOT NULL,stage TEXT NOT NULL,note TEXT NOT NULL,tracking TEXT,actor TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_referral_updates_referral ON referral_updates(referral_id);
 CREATE TABLE IF NOT EXISTS deliveries(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id INTEGER NOT NULL REFERENCES cases(id),created_at TEXT NOT NULL,recipient TEXT NOT NULL,document TEXT,identity_checked INTEGER NOT NULL,condition TEXT NOT NULL,accessories TEXT,remarks TEXT,operator TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at TEXT NOT NULL,entity TEXT NOT NULL,entity_id INTEGER,action TEXT NOT NULL,details TEXT NOT NULL,actor TEXT);
 CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit(entity,entity_id);`);
 const audit=(entity,id,action,details,actor='Operador')=>db.prepare('INSERT INTO audit(created_at,entity,entity_id,action,details,actor) VALUES(?,?,?,?,?,?)').run(now(),entity,id,action,JSON.stringify(details),actor);
 const validType=t=>{if(!ENTITIES[t])throw Error('Módulo desconocido');return ENTITIES[t];};
 const api={
  entityList:(type,q='')=>{const columns=validType(type);return db.prepare(`SELECT * FROM ${type} WHERE ${columns.map(x=>`${x} LIKE ?`).join(' OR ')} ORDER BY id DESC LIMIT 1000`).all(...columns.map(()=>'%'+q+'%'));},
  entitySave:(type,v)=>{const columns=validType(type);if(!String(v.name||'').trim())throw Error('El nombre es obligatorio');const fields=columns.filter(k=>k in v),vals=fields.map(k=>String(v[k]??''));const t=now();db.exec('BEGIN IMMEDIATE');try{let id;if(v.id){id=Number(v.id);if(!db.prepare(`SELECT id FROM ${type} WHERE id=?`).get(id))throw Error('Registro inexistente');db.prepare(`UPDATE ${type} SET ${fields.map(k=>k+'=?').join(',')},updated_at=? WHERE id=?`).run(...vals,t,id);}else{id=Number(db.prepare(`INSERT INTO ${type} (${fields.join(',')},created_at,updated_at) VALUES(${fields.map(()=>'?').join(',')},?,?)`).run(...vals,t,t).lastInsertRowid);}audit(type,id,v.id?'Actualización':'Alta',Object.fromEntries(fields.map((k,i)=>[k,vals[i]])));db.exec('COMMIT');return db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id);}catch(e){db.exec('ROLLBACK');throw e;}},
  entityGet:(type,id)=>{validType(type);return db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id);},
  delivery:(id,v)=>{const c=store.get(id);if(c.delivered_at)throw Error('Este RMA ya registra una entrega');if(!['Disponible para retirar','Producto reemplazado','Garantía rechazada','Reintegro autorizado'].includes(c.status))throw Error('Para entregar, primero registrá la resolución y disponibilidad correspondiente');for(const k of ['recipient','condition','operator'])if(!String(v[k]||'').trim())throw Error('Campo de entrega obligatorio: '+k);if(!v.identity_checked)throw Error('Confirmá la verificación de identidad de quien retira');db.exec('BEGIN IMMEDIATE');try{const t=now();const result=db.prepare('INSERT INTO deliveries(case_id,created_at,recipient,document,identity_checked,condition,accessories,remarks,operator) VALUES(?,?,?,?,?,?,?,?,?)').run(id,t,String(v.recipient),String(v.document||''),1,String(v.condition),String(v.accessories||''),String(v.remarks||''),String(v.operator));db.prepare("UPDATE cases SET status='Entregado al cliente',delivered_at=?,updated_at=? WHERE id=?").run(t,t,id);db.prepare('INSERT INTO events(case_id,created_at,kind,old_status,new_status,note,actor) VALUES(?,?,?,?,?,?,?)').run(id,t,'Entrega',c.status,'Entregado al cliente',`Entrega a ${v.recipient}; documento: ${v.document||'no informado'}`,v.operator);audit('deliveries',Number(result.lastInsertRowid),'Entrega',v,v.operator);db.exec('COMMIT');return db.prepare('SELECT * FROM deliveries WHERE id=?').get(Number(result.lastInsertRowid));}catch(e){db.exec('ROLLBACK');throw e;}},
  referrals:id=>{store.get(id);return db.prepare('SELECT * FROM referrals WHERE case_id=? ORDER BY id DESC').all(id);},
  refer:(id,v)=>{
    const c=store.get(id),name=String(v.supplier_name||'').trim(),reason=String(v.reason||'').trim(),operator=String(v.operator||'').trim();
    if(!name||!reason||!operator)throw Error('Indicá proveedor, falla y responsable');
    const t=now(); db.exec('BEGIN IMMEDIATE');
    try{
      const r=db.prepare('INSERT INTO referrals(case_id,created_at,supplier_name,tracking,reason,tests,accessories,operator) VALUES(?,?,?,?,?,?,?,?)').run(id,t,name,String(v.tracking||''),reason,String(v.tests||''),String(v.accessories||''),operator);
      db.prepare("UPDATE cases SET status='Enviado al proveedor',updated_at=? WHERE id=?").run(t,id);
      db.prepare('INSERT INTO events(case_id,created_at,kind,old_status,new_status,note,actor) VALUES(?,?,?,?,?,?,?)').run(id,t,'Derivación',c.status,'Enviado al proveedor',name+': '+reason,operator);
      audit('referrals',Number(r.lastInsertRowid),'Derivación',{case_id:id,supplier:name,tracking:v.tracking},operator);
      db.exec('COMMIT');return Number(r.lastInsertRowid);
    }catch(e){db.exec('ROLLBACK');throw e;}
  },
  referralReply:(id,v)=>{
    const ref=db.prepare('SELECT * FROM referrals WHERE id=?').get(id);
    if(!ref)throw Error('Derivación inexistente');
    const reply=String(v.reply||'').trim();if(!reply)throw Error('Ingresá una respuesta');
    const t=now();db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('UPDATE referrals SET reply=?,reply_at=? WHERE id=?').run(reply,t,id);
      db.prepare('INSERT INTO events(case_id,created_at,kind,note,actor) VALUES(?,?,?,?,?)').run(ref.case_id,t,'Respuesta de fábrica',reply,String(v.operator||'Operador'));
      audit('referrals',id,'Respuesta',{reply},String(v.operator||'Operador'));
      db.exec('COMMIT');return true;
    }catch(e){db.exec('ROLLBACK');throw e;}
  },
  referralUpdates:id=>db.prepare('SELECT * FROM referral_updates WHERE referral_id=? ORDER BY id DESC').all(id),
  referralProgress:(id,v)=>{
    const ref=db.prepare('SELECT * FROM referrals WHERE id=?').get(id);
    if(!ref)throw Error('Envío a fábrica inexistente');
    const allowed=['Preparado','Despachado','Recibido por fábrica','En revisión','Respuesta recibida','Devuelto a TECMOV','Finalizado'];
    const stage=String(v.stage||''),note=String(v.note||'').trim(),actor=String(v.actor||'').trim();
    if(!allowed.includes(stage)||!note||!actor)throw Error('Completá etapa, observación y responsable');
    const t=now();
    db.exec('BEGIN IMMEDIATE');
    try{
      const tracking=String(v.tracking||ref.tracking||'');
      const r=db.prepare('INSERT INTO referral_updates(referral_id,created_at,stage,note,tracking,actor) VALUES(?,?,?,?,?,?)').run(id,t,stage,note,tracking,actor);
      db.prepare('UPDATE referrals SET tracking=? WHERE id=?').run(tracking,id);
      db.prepare('INSERT INTO events(case_id,created_at,kind,note,actor) VALUES(?,?,?,?,?)').run(ref.case_id,t,'Seguimiento fábrica',stage+': '+note,actor);
      audit('referrals',id,'Seguimiento',{stage,note,tracking},actor);
      db.exec('COMMIT');return Number(r.lastInsertRowid);
    }catch(e){db.exec('ROLLBACK');throw e;}
  },
  deliveries:id=>db.prepare('SELECT * FROM deliveries WHERE case_id=? ORDER BY id DESC').all(id),
  auditList:(limit=100)=>db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?').all(Math.min(Math.max(Number(limit)||100,1),1000)),
  stats:()=>{const total=db.prepare('SELECT COUNT(*) AS n FROM cases').get().n;const statuses=db.prepare('SELECT status,COUNT(*) AS n FROM cases GROUP BY status ORDER BY n DESC').all();const brands=db.prepare('SELECT brand,COUNT(*) AS n FROM cases GROUP BY brand ORDER BY n DESC LIMIT 12').all();const months=db.prepare("SELECT substr(created_at,1,7) AS month,COUNT(*) AS n FROM cases GROUP BY substr(created_at,1,7) ORDER BY month DESC LIMIT 12").all();return {total,statuses,brands,months};},
  exportCases:()=>db.prepare('SELECT * FROM cases ORDER BY id').all(),
  fullBackup:async dest=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tecmov-backup-'));try{const dbfile=path.join(tmp,'rma.sqlite');await backup(db,dbfile);const files=[{name:'rma.sqlite',bytes:fs.readFileSync(dbfile).toString('base64')}];const attachments=path.join(directory,'attachments');if(fs.existsSync(attachments))for(const entry of walk(attachments)){const rel=path.relative(directory,entry).split(path.sep).join('/');files.push({name:rel,bytes:fs.readFileSync(entry).toString('base64')});}const body={format:'TECMOV-RMA-BACKUP',version:1,created_at:now(),files};const checksum=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');const output=JSON.stringify({...body,checksum});fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,output,{flag:'wx',mode:0o600});audit('backup',null,'Respaldo completo',{filename:path.basename(dest),files:files.length});return dest;}finally{fs.rmSync(tmp,{recursive:true,force:true});}},
  verifyBackup:file=>{const data=JSON.parse(fs.readFileSync(file,'utf8'));if(data.format!=='TECMOV-RMA-BACKUP'||data.version!==1||!Array.isArray(data.files))throw Error('Respaldo incompatible');const {checksum,...body}=data;if(crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')!==checksum)throw Error('Integridad de respaldo inválida');for(const f of data.files){if(!/^(rma\.sqlite|attachments\/[\w./-]+)$/.test(f.name)||f.name.includes('..'))throw Error('Ruta insegura en respaldo');}if(!data.files.some(f=>f.name==='rma.sqlite'))throw Error('Falta la base de datos');return data;}
 };
 return api;
}
function* walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())yield* walk(p);else if(item.isFile())yield p;}}
module.exports={installModules};
