'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const STATUSES = ['Recibido','Pendiente de evaluación','En evaluación','Pendiente de información','Enviado al proveedor','Enviado al fabricante','Aguardando respuesta','Garantía aprobada','Garantía rechazada','Cambio autorizado','Producto reemplazado','Reintegro autorizado','Disponible para retirar','Entregado al cliente','Cerrado','Anulado'];
const FIELDS = ['customer_name','customer_id','phone','email','address','purchase_date','invoice_type','invoice_number','invoice_file','purchase_price','brand','product','model','sku','serial','quantity','accessories','claim','physical_condition','reception_notes','internal_notes','branch','type','assigned_user'];
function openStore(directory){
 fs.mkdirSync(directory,{recursive:true});
 const db = new DatabaseSync(path.join(directory,'rma.sqlite'));
 db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS cases(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Recibido', customer_name TEXT NOT NULL, customer_id TEXT, phone TEXT, email TEXT, address TEXT, purchase_date TEXT, invoice_type TEXT, invoice_number TEXT, invoice_file TEXT, purchase_price REAL, brand TEXT NOT NULL, product TEXT NOT NULL, model TEXT, sku TEXT, serial TEXT, quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0), accessories TEXT, claim TEXT NOT NULL, physical_condition TEXT NOT NULL, reception_notes TEXT, internal_notes TEXT, branch TEXT, type TEXT, assigned_user TEXT, evaluation TEXT, tests TEXT, diagnosis TEXT, resolution_reason TEXT, decision_at TEXT, delivered_at TEXT);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(id), created_at TEXT NOT NULL, kind TEXT NOT NULL, old_status TEXT, new_status TEXT, note TEXT, actor TEXT);
 CREATE TABLE IF NOT EXISTS communications(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(id), created_at TEXT NOT NULL, type TEXT NOT NULL, message TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'Preparado');
 CREATE TABLE IF NOT EXISTS attachments(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(id), created_at TEXT NOT NULL, original_name TEXT NOT NULL, stored_name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS case_edits(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id INTEGER NOT NULL REFERENCES cases(id),created_at TEXT NOT NULL,actor TEXT NOT NULL,changes TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_cases_invoice ON cases(invoice_number);
 CREATE INDEX IF NOT EXISTS idx_cases_customer ON cases(customer_name);`);
 const colsCases=db.prepare('PRAGMA table_info(cases)').all().map(x=>x.name);
 if(!colsCases.includes('archived_at'))db.exec('ALTER TABLE cases ADD COLUMN archived_at TEXT');
 if(!colsCases.includes('annul_reason'))db.exec('ALTER TABLE cases ADD COLUMN annul_reason TEXT');
 if(!colsCases.includes('annul_actor'))db.exec('ALTER TABLE cases ADD COLUMN annul_actor TEXT');
 if(!colsCases.includes('customer_ref_id'))db.exec('ALTER TABLE cases ADD COLUMN customer_ref_id INTEGER REFERENCES customers(id)');
 if(!db.prepare('SELECT value FROM settings WHERE key=?').get('shop_name')) db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('shop_name','TECMOV Accesorios');
 const now=()=>new Date().toISOString();
 const one=id=>{ const row=db.prepare('SELECT * FROM cases WHERE id=?').get(id); if(!row) throw Error('RMA no encontrado'); return row; };
 const log=(id,kind,oldSt,newSt,note,actor)=>db.prepare('INSERT INTO events(case_id,created_at,kind,old_status,new_status,note,actor) VALUES(?,?,?,?,?,?,?)').run(id,now(),kind,oldSt||null,newSt||null,note||'',actor||'Operador');
 return {
  db,
  statuses:STATUSES,
  settings:()=>Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value])),
  saveSettings:(obj)=>{const q=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'); for(const [k,v] of Object.entries(obj)){if(['shop_name','shop_address','shop_phone','shop_footer'].includes(k))q.run(k,String(v||''));} return true;},
  create:(v)=>{
   for(const k of ['customer_name','product','brand','claim','physical_condition']) if(!String(v[k]||'').trim())throw Error('Campo obligatorio: '+k);
   if(!Number.isInteger(Number(v.quantity||1)) || Number(v.quantity||1)<1)throw Error('Cantidad inválida');
   const t=now();
   db.exec('BEGIN IMMEDIATE');
   try{
    let customerRef=v.customer_ref_id?Number(v.customer_ref_id):null;
    if(customerRef){
      const selected=db.prepare('SELECT id FROM customers WHERE id=?').get(customerRef);
      if(!selected)throw Error('El cliente seleccionado no existe');
    }else{
      const doc=String(v.customer_id||'').trim(),phone=String(v.phone||'').trim(),name=String(v.customer_name||'').trim();
      let found=doc?db.prepare('SELECT id FROM customers WHERE document=? LIMIT 1').get(doc):null;
      if(!found&&phone)found=db.prepare('SELECT id FROM customers WHERE phone=? LIMIT 1').get(phone);
      if(!found&&name)found=db.prepare('SELECT id FROM customers WHERE lower(name)=lower(?) LIMIT 1').get(name);
      if(found)customerRef=found.id;
      else customerRef=Number(db.prepare('INSERT INTO customers(name,document,phone,email,address,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(name,doc,phone,String(v.email||''),String(v.address||''),t,t).lastInsertRowid);
    }
    const cols=['created_at','updated_at','status','customer_ref_id',...FIELDS]; const vals=[t,t,'Recibido',customerRef,...FIELDS.map(k=>k==='quantity'?Number(v[k]||1):String(v[k]??''))];
    const result=db.prepare(`INSERT INTO cases (${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).run(...vals);
    const id=Number(result.lastInsertRowid); const code=`RMA-${String(id).padStart(8,'0')}`;
    db.prepare('UPDATE cases SET code=? WHERE id=?').run(code,id);
    log(id,'Ingreso',null,'Recibido','Producto recibido para evaluación',v.assigned_user);
    db.exec('COMMIT');return one(id);
   }catch(e){db.exec('ROLLBACK');throw e;}
  },
  get:one,
  archive:(id,{actor,reason}={})=>{const row=one(id);if(row.archived_at)throw Error('El expediente ya está en papelera');if(!String(actor||'').trim()||!String(reason||'').trim())throw Error('Indicá responsable y motivo');const t=now();db.prepare('UPDATE cases SET archived_at=?,updated_at=? WHERE id=?').run(t,t,id);log(id,'Papelera',row.status,row.status,String(reason),String(actor));return one(id);},
  restoreCase:(id,{actor}={})=>{const row=one(id);if(!row.archived_at)throw Error('El expediente no está en papelera');if(!String(actor||'').trim())throw Error('Indicá responsable');db.prepare('UPDATE cases SET archived_at=NULL,updated_at=? WHERE id=?').run(now(),id);log(id,'Restauración',row.status,row.status,'Recuperado de papelera',String(actor));return one(id);},
  annul:(id,{actor,reason}={})=>{const row=one(id);if(row.status==='Anulado')throw Error('El expediente ya está anulado');if(row.delivered_at)throw Error('No puede anularse un expediente entregado');if(!String(actor||'').trim()||!String(reason||'').trim())throw Error('Indicá responsable y motivo');const t=now();db.prepare('UPDATE cases SET status=?,annul_reason=?,annul_actor=?,updated_at=? WHERE id=?').run('Anulado',String(reason),String(actor),t,id);log(id,'Anulación',row.status,'Anulado',String(reason),String(actor));return one(id);},
  edit:(id,v)=>{
    const old=one(id);
    if(old.delivered_at||old.archived_at||old.status==='Anulado')throw Error('No se puede editar un expediente entregado, archivado o anulado');
    const allowed=FIELDS.filter(k=>k in v);
    const actor=String(v.actor||'').trim();
    if(!actor)throw Error('Indicá el responsable');
    const changed=allowed.filter(k=>String(v[k]??'')!==String(old[k]??''));
    if(!changed.length)return old;
    const next={...old,...Object.fromEntries(changed.map(k=>[k,v[k]]))};
    for(const k of ['customer_name','product','brand','claim','physical_condition'])if(!String(next[k]||'').trim())throw Error('Campo obligatorio: '+k);
    if(!Number.isInteger(Number(next.quantity))||Number(next.quantity)<1)throw Error('Cantidad inválida');
    db.exec('BEGIN IMMEDIATE');
    try{
      const t=now(),changes=Object.fromEntries(changed.map(k=>[k,{before:old[k],after:next[k]}]));
      db.prepare('UPDATE cases SET '+changed.map(k=>k+'=?').join(',')+',updated_at=? WHERE id=?').run(...changed.map(k=>k==='quantity'?Number(v[k]):String(v[k]??'')),t,id);
      db.prepare('INSERT INTO case_edits(case_id,created_at,actor,changes) VALUES(?,?,?,?)').run(id,t,actor,JSON.stringify(changes));
      log(id,'Edición',old.status,old.status,'Campos: '+changed.join(', '),actor);
      db.exec('COMMIT');return one(id);
    }catch(e){db.exec('ROLLBACK');throw e;}
  },
  edits:id=>{one(id);return db.prepare('SELECT * FROM case_edits WHERE case_id=? ORDER BY id DESC').all(id);},
  reportFiltered:(options={})=>{
    const status=String(options.status||''),search=String(options.search||'').trim(),from=String(options.from||''),to=String(options.to||'');
    const sql="SELECT id,code,created_at,customer_name,product,brand,invoice_number,status FROM cases WHERE archived_at IS NULL AND (?='' OR status=?) AND (?='' OR code LIKE ? OR customer_name LIKE ? OR product LIKE ?) AND (?='' OR substr(created_at,1,10)>=?) AND (?='' OR substr(created_at,1,10)<=?) ORDER BY id DESC LIMIT 5000";
    const q='%'+search+'%';
    return db.prepare(sql).all(status,status,search,q,q,q,from,from,to,to);
  },
  alerts:()=>{
    const rows=db.prepare("SELECT id,code,customer_name,product,status,created_at FROM cases WHERE archived_at IS NULL AND status NOT IN ('Entregado al cliente','Cerrado','Anulado') ORDER BY id DESC").all();
    return rows.map(x=>({...x,days_open:Math.max(0,Math.floor((Date.now()-Date.parse(x.created_at))/86400000))})).filter(x=>x.days_open>=7);
  },
  list:(query='',archived=false)=>db.prepare('SELECT * FROM cases WHERE '+(archived?'archived_at IS NOT NULL':'archived_at IS NULL')+' AND (code LIKE ? OR customer_name LIKE ? OR invoice_number LIKE ? OR product LIKE ? OR phone LIKE ?) ORDER BY id DESC LIMIT 500').all(...Array(5).fill('%'+String(query).trim()+'%')),
  trash:(query='')=>db.prepare('SELECT * FROM cases WHERE archived_at IS NOT NULL AND (code LIKE ? OR customer_name LIKE ? OR product LIKE ?) ORDER BY id DESC LIMIT 500').all(...Array(3).fill('%'+String(query).trim()+'%')),
  timeline:id=>db.prepare('SELECT * FROM events WHERE case_id=? ORDER BY id DESC').all(id),
  updateStatus:(id,v)=>{
   const row=one(id);if(row.archived_at||row.status==='Anulado')throw Error('Este RMA está archivado o anulado');if(!STATUSES.includes(v.status))throw Error('Estado inválido');
   const note=String(v.note||'').trim();
   if(v.status==='Garantía rechazada' && (!String(v.tests||row.tests||'').trim() || !String(v.diagnosis||row.diagnosis||'').trim() || !String(v.resolution_reason||row.resolution_reason||'').trim())) throw Error('El rechazo requiere pruebas, diagnóstico y fundamento documentados.');
   if(v.status==='Garantía rechazada' && !note)throw Error('Indicá el motivo del cambio de estado.');
   db.prepare(`UPDATE cases SET status=?,updated_at=?,evaluation=?,tests=?,diagnosis=?,resolution_reason=?,decision_at=?,delivered_at=? WHERE id=?`).run(v.status,now(),String(v.evaluation??row.evaluation??''),String(v.tests??row.tests??''),String(v.diagnosis??row.diagnosis??''),String(v.resolution_reason??row.resolution_reason??''),['Garantía aprobada','Garantía rechazada'].includes(v.status)?now():row.decision_at,v.status==='Entregado al cliente'?now():row.delivered_at,id);
   log(id,'Cambio de estado',row.status,v.status,note,v.actor); return one(id);
  },
  communications:id=>db.prepare('SELECT * FROM communications WHERE case_id=? ORDER BY id DESC').all(id),
  saveCommunication:(id,v)=>{one(id); if(!String(v.message||'').trim())throw Error('Mensaje vacío'); return Number(db.prepare('INSERT INTO communications(case_id,created_at,type,message,state) VALUES(?,?,?,?,?)').run(id,now(),String(v.type||'Comunicación'),String(v.message),String(v.state||'Preparado')).lastInsertRowid);},
  cameraPhoto:(id,data)=>{
    one(id);
    const count=db.prepare("SELECT COUNT(*) AS n FROM attachments WHERE case_id=? AND original_name LIKE 'Recepción webcam %'").get(id).n;
    if(count>=4)throw Error('Máximo de cuatro fotos de recepción');
    if(typeof data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('Imagen JPEG inválida');
    const buffer=Buffer.from(data.slice('data:image/jpeg;base64,'.length),'base64');
    if(buffer.length<100||buffer.length>5*1024*1024)throw Error('La fotografía debe pesar menos de 5 MB');
    const folder=path.join(directory,'attachments',String(id));fs.mkdirSync(folder,{recursive:true});
    const filename='recepcion-'+Date.now()+'-'+require('node:crypto').randomUUID()+'.jpg';
    const fullpath=path.join(folder,filename);
    fs.writeFileSync(fullpath,buffer,{flag:'wx'});
    try{
      db.prepare('INSERT INTO attachments(case_id,created_at,original_name,stored_name) VALUES(?,?,?,?)').run(id,now(),'Recepción webcam '+(count+1)+'.jpg',filename);
    }catch(e){fs.rmSync(fullpath,{force:true});throw e;}
    return {name:filename,total:count+1};
  },
  attachments:id=>db.prepare('SELECT * FROM attachments WHERE case_id=? ORDER BY id DESC').all(id),
  attach:(id,source)=>{one(id); const dir=path.join(directory,'attachments',String(id));fs.mkdirSync(dir,{recursive:true});const ext=path.extname(source).toLowerCase();if(!['.jpg','.jpeg','.png','.webp','.pdf'].includes(ext))throw Error('Solo JPG, PNG, WEBP o PDF'); const filename=Date.now()+'-'+require('node:crypto').randomUUID()+ext;fs.copyFileSync(source,path.join(dir,filename));db.prepare('INSERT INTO attachments(case_id,created_at,original_name,stored_name) VALUES(?,?,?,?)').run(id,now(),path.basename(source),filename);return true;},
  backup:(destination)=>{fs.mkdirSync(path.dirname(destination),{recursive:true});db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.exec("VACUUM INTO '"+destination.replace(/'/g,"''")+"'");return Promise.resolve(destination);}
 };
}
module.exports={openStore,STATUSES};
