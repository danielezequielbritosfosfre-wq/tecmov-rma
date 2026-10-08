'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,clipboard}=require('electron');
const path=require('node:path');
const {openStore}=require('./store');
const {installModules}=require('./modules');
const fs=require('node:fs');
let win,store,modules;
const dataDir=app.getPath('userData');
const logFile=path.join(dataDir,'diagnostico-arranque.log');
function logProblem(kind,error){
 try{fs.mkdirSync(dataDir,{recursive:true});fs.appendFileSync(logFile,`[${new Date().toISOString()}] ${kind}: ${String(error?.stack||error)}\n`)}catch(_){}
 console.error(kind,error);
}
process.on('uncaughtException',e=>logProblem('uncaughtException',e));
process.on('unhandledRejection',e=>logProblem('unhandledRejection',e));
const register=(name,fn)=>ipcMain.handle(name,async(_event,...args)=>fn(...args));
app.whenReady().then(()=>{
 try{store=openStore(dataDir);modules=installModules(store,dataDir);}
 catch(e){logProblem('Fallo al abrir almacenamiento',e);dialog.showErrorBox('TECMOV RMA - almacenamiento',`No se pudo iniciar la base de datos. No se modificaron ni borraron tus datos.\n\n${String(e?.message||e)}\n\nDiagnóstico: ${logFile}`);app.quit();return;}
 const scheduleBackup=async()=>{try{const dir=path.join(app.getPath('userData'),'automatic-backups');fs.mkdirSync(dir,{recursive:true});const day=new Date().toISOString().slice(0,10);const file=path.join(dir,'TECMOV-'+day+'.rma-backup');if(!fs.existsSync(file))await modules.fullBackup(file);const saved=fs.readdirSync(dir).filter(f=>f.endsWith('.rma-backup')).sort().reverse();for(const old of saved.slice(14))fs.rmSync(path.join(dir,old));}catch(e){console.error('Error al respaldar:',e);}};
 scheduleBackup();
 win=new BrowserWindow({width:1360,height:860,minWidth:990,minHeight:680,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 win.webContents.on('preload-error',(_event,file,error)=>logProblem(`Fallo preload ${file}`,error));
 win.webContents.on('render-process-gone',(_event,details)=>logProblem('Proceso interfaz finalizado',JSON.stringify(details)));
 win.loadFile(path.join(__dirname,'index.html')).catch(e=>{console.error('No se pudo abrir la interfaz:',e);dialog.showErrorBox('TECMOV RMA',String(e.message||e));});
 register('referrals',id=>modules.referrals(id));register('refer',(id,v)=>modules.refer(id,v));register('referralReply',(id,v)=>modules.referralReply(id,v));
 register('entityList',(t,q)=>modules.entityList(t,q));register('entitySave',(t,v)=>modules.entitySave(t,v));register('entityGet',(t,id)=>modules.entityGet(t,id));register('delivery',(id,v)=>modules.delivery(id,v));register('deliveries',id=>modules.deliveries(id));register('auditList',n=>modules.auditList(n));register('stats',()=>modules.stats());register('exportCases',()=>modules.exportCases());
 register('fullBackup',async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'TECMOV-RMA-respaldo-'+new Date().toISOString().slice(0,10)+'.rma-backup',filters:[{name:'Respaldo TECMOV',extensions:['rma-backup']}]});if(r.canceled)return false;return modules.fullBackup(r.filePath);});
 register('verifyBackup',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Respaldo TECMOV',extensions:['rma-backup']}]});if(r.canceled)return false;const data=modules.verifyBackup(r.filePaths[0]);return {name:path.basename(r.filePaths[0]),created_at:data.created_at,files:data.files.length};});
 register('exportCSV',async()=>{const rows=modules.exportCases();const r=await dialog.showSaveDialog(win,{defaultPath:'TECMOV-RMA-reporte.csv',filters:[{name:'CSV',extensions:['csv']}]});if(r.canceled)return false;const cols=Object.keys(rows[0]||{code:'',status:'',customer_name:'',product:''});const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';fs.writeFileSync(r.filePath,'\ufeff'+cols.join(';')+'\r\n'+rows.map(x=>cols.map(k=>cell(x[k])).join(';')).join('\r\n'));return r.filePath;});
 register('health',()=>({ok:true,storage:dataDir,sqlite:store.db.prepare('PRAGMA integrity_check').get().integrity_check,version:app.getVersion()}));
 register('edit',(id,v)=>store.edit(id,v));register('edits',id=>store.edits(id));register('alerts',()=>store.alerts());
 register('list',q=>store.list(q));register('create',v=>store.create(v));register('get',id=>store.get(id));register('statuses',()=>store.statuses);
 register('timeline',id=>store.timeline(id));register('status', (id,v)=>store.updateStatus(id,v));
 register('settings',()=>store.settings());register('saveSettings',v=>store.saveSettings(v));register('communications',id=>store.communications(id));register('saveCommunication',(id,v)=>store.saveCommunication(id,v));
 register('attachments',id=>store.attachments(id));register('attach',async id=>{const result=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'Fotos y PDF',extensions:['png','jpg','jpeg','webp','pdf']}]});if(result.canceled)return false;for(const file of result.filePaths)store.attach(id,file);return true;});
 register('pdf', async html=>{const child=new BrowserWindow({show:false,webPreferences:{sandbox:true}});try{await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));const pdf=await child.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true});const r=await dialog.showSaveDialog(win,{defaultPath:'Comprobante-RMA.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(r.canceled)return false;require('node:fs').writeFileSync(r.filePath,pdf);return r.filePath;}finally{child.destroy();}});
 register('print',async html=>{const child=new BrowserWindow({show:true,width:850,height:850,webPreferences:{sandbox:true}});await child.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));child.webContents.print({silent:false,printBackground:true});return true;});
 register('clipboard',text=>{clipboard.writeText(text);return true;});
 register('whatsapp',async(number,message)=>{const clean=String(number).replace(/\D/g,'');if(!clean)throw Error('Teléfono no registrado');await shell.openExternal(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`);return true;});
 register('backup',async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'rma-respaldo.sqlite',filters:[{name:'SQLite',extensions:['sqlite']}]});if(r.canceled)return false;return store.backup(r.filePath);});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
