'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../store');
const {installModules}=require('../modules');
const {verify,restore}=require('../restore');
test('Respaldo completo, restauración y copia previa preservan datos',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tecmov-recovery-test-'));
 const handles=[];
 const track=store=>{handles.push(store);return store;};
 try{
  const live=path.join(dir,'data');fs.mkdirSync(live);
  const s=track(openStore(live)),modules=installModules(s,live);
  const c=s.create({customer_name:'Prueba',product:'Cable SOUL',brand:'SOUL',claim:'Intermitencia',physical_condition:'Bien',quantity:1});
  const backup=path.join(dir,'copia.rma-backup');await modules.fullBackup(backup);
  assert.equal(verify(backup).files.length,1);
  s.edit(c.id,{phone:'123',actor:'Control'});
  s.db.close();
  assert.throws(()=>restore(backup,live),/cerrada/);
  const result=restore(backup,live,{appClosed:true});
  assert.ok(result.safetyCopy);
  const restored=track(openStore(live));
  assert.equal(restored.get(c.id).phone,'');
  restored.db.close();
  const previous=track(openStore(result.safetyCopy));
  assert.equal(previous.get(c.id).phone,'123');
  previous.db.close();
 }finally{for(const h of handles){try{h.db.close();}catch{}}await new Promise(resolve=>setTimeout(resolve,150));fs.rmSync(dir,{recursive:true,force:true,maxRetries:8,retryDelay:250});}
});
