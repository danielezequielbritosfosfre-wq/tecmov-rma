'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
function verify(file){
 const body=JSON.parse(fs.readFileSync(file,'utf8'));
 if(body.format!=='TECMOV-RMA-BACKUP'||body.version!==1||!Array.isArray(body.files))throw Error('Formato de respaldo inválido');
 const {checksum,...contents}=body;
 if(crypto.createHash('sha256').update(JSON.stringify(contents)).digest('hex')!==checksum)throw Error('Respaldo alterado o incompleto');
 const names=new Set();
 for(const f of body.files){
  if(!/^(rma\.sqlite|attachments\/[A-Za-z0-9._/-]+)$/.test(f.name)||f.name.split('/').includes('..')||names.has(f.name))throw Error('Ruta inválida o duplicada');
  names.add(f.name);
  if(typeof f.bytes!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.bytes))throw Error('Adjunto inválido');
 }
 if(!names.has('rma.sqlite'))throw Error('Base ausente');
 const db=Buffer.from(body.files.find(f=>f.name==='rma.sqlite').bytes,'base64');
 if(db.subarray(0,16).toString('ascii')!=='SQLite format 3\0')throw Error('La base SQLite del respaldo es inválida');
 return body;
}
function restore(file,destination,{appClosed=false}={}){
 if(!appClosed)throw Error('La aplicación debe estar cerrada antes de restaurar');
 const data=verify(file);
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 const staging=fs.mkdtempSync(path.join(path.dirname(destination),'tecmov-restore-staging-'));
 const old=path.join(path.dirname(destination),'tecmov-before-restore-'+Date.now());
 try{
  for(const entry of data.files){const target=path.join(staging,...entry.name.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(entry.bytes,'base64'),{flag:'wx'});}
  const {DatabaseSync}=require('node:sqlite');
  const verificationDb=new DatabaseSync(path.join(staging,'rma.sqlite'),{readOnly:true});
  try{if(verificationDb.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('La base recuperada no supera el control SQLite');}finally{verificationDb.close();}
  if(fs.existsSync(destination))fs.cpSync(destination,old,{recursive:true,errorOnExist:true,force:false});
  const keep=path.join(destination,'attachments');
  fs.mkdirSync(destination,{recursive:true});
  const db=path.join(destination,'rma.sqlite');
  fs.copyFileSync(path.join(staging,'rma.sqlite'),db+'.restore-new');
  fs.renameSync(db+'.restore-new',db);
  for(const side of ['-wal','-shm'])if(fs.existsSync(db+side))fs.rmSync(db+side);
  if(fs.existsSync(keep))fs.rmSync(keep,{recursive:true,force:true});
  if(fs.existsSync(path.join(staging,'attachments')))fs.cpSync(path.join(staging,'attachments'),keep,{recursive:true});
  return {safetyCopy:fs.existsSync(old)?old:null,restoredFiles:data.files.length};
 }finally{fs.rmSync(staging,{recursive:true,force:true});}
}
module.exports={verify,restore};
