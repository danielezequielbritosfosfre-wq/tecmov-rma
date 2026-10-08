'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {canonical,verifyLicense}=require('../license');
test('Validación de firma Ed25519, PC y vencimiento',()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const payload={product:'TECMOV-RMA',installationId:'equipo-test',plan:'anual',expiresAt:'2027-10-08T00:00:00.000Z'};
 const signature=crypto.sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64');
 const token={payload,signature};
 assert.equal(verifyLicense(token,publicKey,{installationId:'equipo-test',now:Date.parse('2026-10-08')}).valid,true);
 assert.throws(()=>verifyLicense(token,publicKey,{installationId:'otro-equipo'}),/otra instalación/);
 assert.throws(()=>verifyLicense(token,publicKey,{now:Date.parse('2028-10-08')}),/vencida/);
 assert.throws(()=>verifyLicense({...token,payload:{...payload,plan:'permanente'}},publicKey),/Firma/);
});
