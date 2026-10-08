'use strict';
/**
 * Núcleo de verificación de licencias TECMOV RMA.
 * La clave PRIVADA nunca forma parte del instalador o repositorio.
 * Este módulo no activa control comercial hasta integrar una clave pública
 * oficial y un servicio de activación/renovación.
 */
const crypto=require('node:crypto');
function canonical(payload){return JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a],[b])=>a.localeCompare(b))));}
function verifyLicense(token,publicKey,{installationId,now=Date.now()}={}){
 if(!publicKey)throw Error('Falta configurar la clave pública de licencias');
 if(!token||typeof token!=='object'||typeof token.signature!=='string'||!token.payload||typeof token.payload!=='object')throw Error('Licencia inválida');
 const payload=token.payload;
 if(payload.product!=='TECMOV-RMA')throw Error('Licencia para otro producto');
 if(typeof payload.installationId!=='string'||!payload.installationId)throw Error('Identificador de instalación inválido');
 const signature=Buffer.from(token.signature,'base64');
 const verified=crypto.verify(null,Buffer.from(canonical(payload),'utf8'),publicKey,signature);
 if(!verified)throw Error('Firma de licencia inválida');
 if(installationId&&payload.installationId!==installationId)throw Error('Licencia asociada a otra instalación');
 if(payload.expiresAt!=null){
  const end=Date.parse(payload.expiresAt);
  if(!Number.isFinite(end)||end<now)throw Error('Licencia vencida');
 }
 return {valid:true,plan:String(payload.plan||''),expiresAt:payload.expiresAt||null,installationId:payload.installationId};
}
module.exports={canonical,verifyLicense};
