'use strict';
// Recorta exclusivamente el blanco conectado al borde exterior.
// Conserva los blancos internos de las letras y del teléfono.
window.tecmovLogoData=(async()=>{
 const img=document.querySelector('#brandLogo');
 if(!img)return null;
 await new Promise((resolve,reject)=>{
  if(img.complete&&img.naturalWidth)return resolve();
  img.addEventListener('load',resolve,{once:true});
  img.addEventListener('error',reject,{once:true});
 });
 const canvas=document.createElement('canvas');
 canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(img,0,0);
 const data=ctx.getImageData(0,0,canvas.width,canvas.height);
 const d=data.data,w=canvas.width,h=canvas.height,n=w*h;
 const seen=new Uint8Array(n),stack=[];
 const isBackground=i=>{
  const j=i*4,r=d[j],g=d[j+1],b=d[j+2];
  return Math.min(r,g,b)>=226&&Math.max(r,g,b)-Math.min(r,g,b)<=24;
 };
 const enqueue=i=>{if(i>=0&&i<n&&!seen[i]&&isBackground(i)){seen[i]=1;stack.push(i)}};
 for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x)}
 for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1)}
 while(stack.length){
  const i=stack.pop(),x=i%w,y=(i-x)/w;
  d[i*4+3]=0;
  if(x>0)enqueue(i-1);if(x<w-1)enqueue(i+1);
  if(y>0)enqueue(i-w);if(y<h-1)enqueue(i+w);
 }
 ctx.putImageData(data,0,0);
 const result=canvas.toDataURL('image/png');
 const display=document.createElement('img');
 display.src=result;display.alt='TECMOV';display.className='app-logo';
 img.replaceWith(display);
 return result;
})().catch(e=>{console.warn('Logo transparente no disponible:',e);return null});
