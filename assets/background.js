/* =====================================================
   الخلفية: دوائر إلكترونية والكهربا بتجري فيها
   ===================================================== */
const cv=document.querySelector('#bg'),ctx=cv.getContext('2d');
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
const layer=document.createElement('canvas'),lctx=layer.getContext('2d');
const G=44, DIRS=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
let W,H,paths=[],pulses=[],lit=.2,litTarget=1,surgeUntil=0,t0=performance.now();
const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));

function buildPath(){
  const cols=Math.floor(W/G),rows=Math.floor(H/G);
  let x=ri(0,cols)*G,y=ri(0,rows)*G,d=ri(0,3)*2;
  const pts=[[x,y]];
  for(let s=0,n=ri(4,10);s<n;s++){
    const run=ri(1,4);
    for(let k=0;k<run;k++){x+=DIRS[d][0]*G;y+=DIRS[d][1]*G}
    if(x<-G||y<-G||x>W+G||y>H+G)break;
    pts.push([x,y]);
    d=(d+(Math.random()<.5?-1:1)*(Math.random()<.7?1:2)+8)%8;
  }
  if(pts.length<3)return null;
  let len=0;const cum=[0];
  for(let i=1;i<pts.length;i++){len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);cum.push(len)}
  return {pts,cum,len};
}
function build(){
  W=innerWidth;H=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);
  cv.width=layer.width=W*dpr;cv.height=layer.height=H*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);lctx.setTransform(dpr,0,0,dpr,0,0);
  paths=[];const n=Math.max(16,Math.min(56,Math.round(W*H/(G*G*16))));
  while(paths.length<n){const p=buildPath();if(p)paths.push(p)}
  lctx.clearRect(0,0,W,H);
  lctx.lineJoin='round';lctx.lineCap='round';
  lctx.strokeStyle='rgba(190,150,50,.34)';lctx.lineWidth=1.3;
  paths.forEach(p=>{
    lctx.beginPath();p.pts.forEach((q,i)=>i?lctx.lineTo(q[0],q[1]):lctx.moveTo(q[0],q[1]));lctx.stroke();
    const a=p.pts[0],b=p.pts[p.pts.length-1];
    lctx.lineWidth=1.3;
    [a,b].forEach(q=>{lctx.beginPath();lctx.arc(q[0],q[1],4,0,7);lctx.stroke()});
    p.pts.slice(1,-1).forEach(q=>{if(Math.random()<.4){lctx.fillStyle='rgba(190,150,50,.5)';lctx.beginPath();lctx.arc(q[0],q[1],2,0,7);lctx.fill()}});
  });
  /* شرايح (ICs) */
  for(let i=0;i<Math.round(W/260);i++){
    const x=ri(1,Math.max(2,Math.floor(W/G)-4))*G,y=ri(1,Math.max(2,Math.floor(H/G)-3))*G,w=G*3,h=G*2;
    lctx.strokeStyle='rgba(190,150,50,.28)';lctx.strokeRect(x,y,w,h);
    for(let k=1;k<6;k++){const px=x+k*w/6;lctx.beginPath();lctx.moveTo(px,y);lctx.lineTo(px,y-8);lctx.moveTo(px,y+h);lctx.lineTo(px,y+h+8);lctx.stroke()}
  }
  pulses=[];
  const count=still?0:Math.round(paths.length*.6);
  for(let i=0;i<count;i++)pulses.push(newPulse(true));
}
function newPulse(initial){
  const p=paths[ri(0,paths.length-1)];
  return {p,d:initial?-Math.random()*p.len*1.5:-ri(0,200),v:ri(70,150),tail:ri(70,130)};
}
function at(p,d){
  d=Math.max(0,Math.min(p.len,d));
  let i=1;while(i<p.cum.length-1&&p.cum[i]<d)i++;
  const k=(d-p.cum[i-1])/(p.cum[i]-p.cum[i-1]||1),a=p.pts[i-1],b=p.pts[i];
  return [a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k];
}
const FLICK=[[0,.2],[.28,1],[.42,.25],[.5,.95],[.59,.35],[.7,1]];
let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const age=(now-t0)/1000;
  let base=1;
  if(age<1.4/1){const a=age/1.4;base=FLICK[0][1];for(const f of FLICK)if(a>=f[0])base=f[1]}
  lit+=(litTarget-lit)*Math.min(1,dt*3);
  const surging=now<surgeUntil;
  const k=lit*base*(surging?1.6:1);
  ctx.clearRect(0,0,W,H);
  ctx.globalAlpha=Math.min(1,.35+k*.65);ctx.drawImage(layer,0,0,W,H);ctx.globalAlpha=1;
  if(!still){
    ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    for(let i=0;i<pulses.length;i++){
      const u=pulses[i];u.d+=u.v*dt*(surging?3:1);
      if(u.d-u.tail>u.p.len){pulses[i]=newPulse(false);continue}
      if(u.d<0)continue;
      const steps=10;let prev=at(u.p,u.d);
      for(let s=1;s<=steps;s++){
        const q=at(u.p,u.d-u.tail*s/steps);
        const al=Math.pow(1-s/steps,1.6)*.9*k;
        ctx.strokeStyle=`rgba(255,${200-s*3},60,${al})`;ctx.lineWidth=2.4-s*.12;
        ctx.beginPath();ctx.moveTo(prev[0],prev[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();prev=q;
      }
      const h=at(u.p,u.d);
      const g=ctx.createRadialGradient(h[0],h[1],0,h[0],h[1],11);
      g.addColorStop(0,`rgba(255,240,190,${.95*k})`);g.addColorStop(1,'rgba(255,184,28,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(h[0],h[1],11,0,7);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
  }
  requestAnimationFrame(frame);
}
build();
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(build,200)});
if(still){ctx.globalAlpha=1;frame(performance.now());}else requestAnimationFrame(frame);
/* ضغطة على اللوجو = كهربا زيادة لحظة */
document.querySelectorAll('.brand').forEach(b=>b.addEventListener('click',()=>{surgeUntil=performance.now()+1100}));
