'use strict';
const crypto=require('node:crypto');
const RULES={
 admin:new Set(['*']),
 supervisor:new Set(['health','authInfo','logout','list','get','statuses','timeline','stats','alerts','create','edit','edits','reportFiltered','communications','saveCommunication','cameraPhoto','attachments','attach','pdf','print','clipboard','whatsapp','backup','fullBackup','verifyBackup','entityList','entityGet','entitySave','delivery','deliveries','referralUpdates','referralProgress','referrals','refer','referralReply','auditList','exportCases','exportCSV','annul','archive','restoreCase','trash','status','settings']),
 operador:new Set(['health','authInfo','logout','list','get','statuses','timeline','alerts','create','communications','saveCommunication','cameraPhoto','attachments','attach','pdf','print','clipboard','whatsapp','entityList','entityGet'])
};
function createAuth(db){
 db.exec("CREATE TABLE IF NOT EXISTS auth_users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('admin','supervisor','operador')),salt TEXT NOT NULL,hash TEXT NOT NULL,created_at TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0)");
 const users=()=>db.prepare('SELECT COUNT(*) AS n FROM auth_users').get().n;
 const derive=(password,salt)=>crypto.scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex');
 const passwordCheck=p=>{if(typeof p!=='string'||p.length<12||p.length>256)throw Error('La contraseña debe tener entre 12 y 256 caracteres');};
 const createUser=(name,password,role='admin')=>{
  const username=String(name||'').trim().toLowerCase();
  if(!/^[a-z0-9_.-]{3,40}$/.test(username))throw Error('Usuario inválido: 3 a 40 letras/números');
  if(!RULES[role])throw Error('Rol inválido');passwordCheck(password);
  const salt=crypto.randomBytes(32).toString('hex');
  const r=db.prepare('INSERT INTO auth_users(username,role,salt,hash,created_at) VALUES(?,?,?,?,?)').run(username,role,salt,derive(password,salt),new Date().toISOString());
  return Number(r.lastInsertRowid);
 };
 let failed=0,lockedUntil=0,session=null;
 const info=()=>({configured:users()>0,authenticated:!!session,user:session?{username:session.username,role:session.role}:null});
 const setup=(name,password)=>{if(users())throw Error('El administrador inicial ya fue creado');db.exec('BEGIN IMMEDIATE');try{if(users())throw Error('Administrador ya configurado');createUser(name,password,'admin');db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e;}return login(name,password);};
 const login=(name,password)=>{
  if(Date.now()<lockedUntil)throw Error('Demasiados intentos. Esperá 60 segundos');
  const user=db.prepare('SELECT * FROM auth_users WHERE username=? AND disabled=0').get(String(name||'').trim().toLowerCase());
  const fakeSalt='0'.repeat(64);
  const actual=derive(String(password||''),user?.salt||fakeSalt);
  const expected=Buffer.from(user?.hash||'0'.repeat(128),'hex');
  if(!user||!crypto.timingSafeEqual(Buffer.from(actual,'hex'),expected)){
   failed++;if(failed>=5){lockedUntil=Date.now()+60000;failed=0;}
   throw Error('Usuario o contraseña incorrectos');
  }
  failed=0;lockedUntil=0;session={id:user.id,username:user.username,role:user.role};
  return info();
 };
 const authorize=method=>{
  if(!session)throw Error('Debés iniciar sesión para continuar');
  if(!RULES[session.role].has('*')&&!RULES[session.role].has(method))throw Error('No tenés permisos para esta operación');
 };
 const addUser=(name,password,role)=>{authorize('manageUsers');return createUser(name,password,role);};
 const listUsers=()=>{authorize('manageUsers');return db.prepare('SELECT id,username,role,disabled,created_at FROM auth_users ORDER BY id').all();};
 const disableUser=(id)=>{authorize('manageUsers');if(Number(id)===session.id)throw Error('No podés desactivar tu propio usuario');db.prepare('UPDATE auth_users SET disabled=1 WHERE id=?').run(Number(id));return true;};
 return {info,setup,login,logout:()=>{session=null;return info()},authorize,addUser,listUsers,disableUser};
}
module.exports={createAuth};
