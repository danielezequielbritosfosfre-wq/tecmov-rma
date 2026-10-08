'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../store');
const {createAuth}=require('../auth');
test('Administrador inicial, credenciales y permisos en SQLite',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tecmov-auth-'));
 let store;
 try{
  store=openStore(dir);
  const auth=createAuth(store.db);
  assert.equal(auth.info().configured,false);
  assert.throws(()=>auth.authorize('list'),/iniciar sesión/i);
  assert.throws(()=>auth.setup('admin','123'),/12/);
  auth.setup('admin','ClaveSegura12345');
  assert.equal(auth.info().user.role,'admin');
  assert.throws(()=>auth.setup('otro','ClaveSegura12345'),/creado/);
  auth.addUser('operador1','OperadorSeguro123','operador');
  auth.logout();
  assert.throws(()=>auth.login('operador1','incorrecta'),/incorrectos/);
  auth.login('operador1','OperadorSeguro123');
  auth.authorize('create');
  assert.throws(()=>auth.authorize('annul'),/permisos/);
  assert.throws(()=>auth.authorize('usersList'),/permisos/);
  auth.logout();
  store.db.close();store=null;
  store=openStore(dir);
  const reopened=createAuth(store.db);
  assert.equal(reopened.info().configured,true);
  reopened.login('admin','ClaveSegura12345');
  assert.equal(reopened.listUsers().length,2);
 }finally{try{store?.db.close()}catch{}fs.rmSync(dir,{recursive:true,force:true,maxRetries:8,retryDelay:250});}
});
