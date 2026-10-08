'use strict';
const path=require('node:path'),fs=require('node:fs');
const {restore,verify}=require('./restore');
const backup=process.argv[2],destination=process.argv[3];
if(!backup||!destination){console.error('Uso: node RESTAURAR-DATOS.js RESPALDO.rma-backup CARPETA-DATOS');process.exit(2);}
try{
 const verified=verify(path.resolve(backup));
 console.log('Respaldo verificado: '+verified.files.length+' archivos. CERRÁ TECMOV RMA antes de continuar.');
 if(process.argv[4]!=='--confirmar-cerrada'){console.log('Para restaurar, repetí el comando agregando --confirmar-cerrada');process.exit(0);}
 if(!fs.existsSync(path.dirname(path.resolve(destination))))throw Error('La carpeta contenedora de datos no existe');
 const result=restore(path.resolve(backup),path.resolve(destination),{appClosed:true});
 console.log('Restauración completada; copia previa: '+(result.safetyCopy||'carpeta nueva'));
}catch(e){console.error('NO SE RESTAURÓ: '+e.message);process.exitCode=1;}
