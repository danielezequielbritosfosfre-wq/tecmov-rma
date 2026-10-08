const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../src/store');const {installModules}=require('../src/modules');
test('Catálogos persistentes, entrega, estadísticas y respaldo íntegro',async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tecmov-'));try{
let store=openStore(dir),m=installModules(store,dir);
const customer=m.entitySave('customers',{name:'Ana',phone:'123'});m.entitySave('customers',{id:customer.id,name:'Ana María',phone:'456'});
assert.equal(m.entityList('customers','María').length,1);assert.equal(m.entityGet('customers',customer.id).phone,'456');
m.entitySave('products',{name:'Cable USB',brand:'SOUL'});m.entitySave('suppliers',{name:'Proveedor Uno'});
const c=store.create({customer_name:'Ana',brand:'SOUL',product:'Cable USB',claim:'No carga',physical_condition:'Bueno'});
assert.throws(()=>m.delivery(c.id,{recipient:'Ana',operator:'Admin',condition:'Bueno',identity_checked:1}),/disponibilidad/);
store.updateStatus(c.id,{status:'Disponible para retirar',note:'Evaluado'});
m.delivery(c.id,{recipient:'Ana',document:'123',operator:'Admin',condition:'Bueno',identity_checked:1});
assert.equal(m.deliveries(c.id).length,1);assert.equal(store.get(c.id).status,'Entregado al cliente');assert.throws(()=>m.delivery(c.id,{}),/ya registra/);
const attachmentDir=path.join(dir,'attachments',String(c.id));fs.mkdirSync(attachmentDir,{recursive:true});fs.writeFileSync(path.join(attachmentDir,'sample.pdf'),'TEST');
const output=path.join(dir,'full.rma-backup');await m.fullBackup(output);const checked=m.verifyBackup(output);assert.equal(checked.files.length,2);assert.equal(m.stats().total,1);
store.db.close();store=openStore(dir);m=installModules(store,dir);assert.equal(m.entityGet('customers',customer.id).name,'Ana María');assert.equal(m.deliveries(c.id).length,1);
store.db.close();const damaged=JSON.parse(fs.readFileSync(output));damaged.files[0].bytes='corrupt';fs.writeFileSync(output,JSON.stringify(damaged));assert.throws(()=>m.verifyBackup(output),/Integridad/);
}finally{fs.rmSync(dir,{recursive:true,force:true});}});
