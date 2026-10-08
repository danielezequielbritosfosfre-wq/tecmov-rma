'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../store');
const {installModules}=require('../modules');
test('RMA persiste edicion auditada y derivaciones tras reabrir',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tecmov-rma-test-'));
 try{
  let store=openStore(dir);const mods=installModules(store,dir);
  const created=store.create({customer_name:'Persona de prueba',product:'Cable',brand:'SOUL',claim:'No carga',physical_condition:'Sin daños',quantity:1});
  const edited=store.edit(created.id,{phone:'3511234567',actor:'Pruebas'});
  assert.equal(edited.phone,'3511234567');
  assert.ok(store.get(created.id).customer_ref_id);
  assert.equal(mods.entityList('customers','Persona de prueba').length,1);assert.equal(store.edits(created.id).length,1);
  assert.throws(()=>store.edit(created.id,{phone:'0',actor:''}),/responsable/i);
  assert.equal(store.get(created.id).phone,'3511234567');
  mods.refer(created.id,{supplier_name:'Fabricante prueba',reason:'Carga intermitente',operator:'Pruebas'});
  assert.equal(mods.referrals(created.id).length,1);
  const referral=mods.referrals(created.id)[0];
  mods.referralProgress(referral.id,{stage:'Despachado',note:'Remito de prueba',actor:'Pruebas',tracking:'TRACK-123'});
  assert.equal(mods.referralUpdates(referral.id).length,1);
  assert.throws(()=>mods.referralProgress(referral.id,{stage:'Desconocido',note:'X',actor:'Pruebas'}),/etapa/i);
  store.db.close();
  store=openStore(dir);const reopened=installModules(store,dir);
  assert.equal(store.get(created.id).phone,'3511234567');
  assert.equal(store.edits(created.id).length,1);
  assert.equal(reopened.referrals(created.id).length,1);
  assert.equal(reopened.referralUpdates(referral.id)[0].tracking,'TRACK-123');
  store.db.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
