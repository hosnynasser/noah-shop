
const ICONS={
 bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
 cable:'<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
 plug:'<path d="M9 2.500v5M15 2.500v5"/><path d="M6 7.500h12v3.500a6 6 0 0 1-12 0z"/><path d="M12 17v4.500"/>',
 breaker:'<rect x="6" y="3" width="12" height="18" rx="2"/><rect x="10" y="6" width="4" height="7" rx="1"/><path d="M9 17h6"/>',
 hammer:'<path d="M5 4h9l3 3-3 3H5z"/><path d="M10 10v10"/>',
 drill:'<rect x="3" y="7" width="13" height="5" rx="2"/><path d="M16 9.5h5M7 12l-1 7h4l1-7"/>',
 screw:'<rect x="7" y="3" width="10" height="4" rx="1"/><path d="M9 7v13l3 1 3-1V7M9 11h6M9 15h6"/>',
 lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>',
 gauge:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 home:'<path d="M4 11 12 4l8 7M6 10v10h12V10M10 20v-6h4v6"/>',
 toolbox:'<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18M11 13v2h2v-2"/>',
 mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
 phone:'<path d="M6 3h3l2 5-2 1.5a11 11 0 0 0 5.5 5.5L16 13l5 2v3a3 3 0 0 1-3 3A15 15 0 0 1 3 6a3 3 0 0 1 3-3z"/>',
 pin:'<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/>',
 bolt:'<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>',
 chevR:'<path d="M9 6l6 6-6 6"/>',
 chevL:'<path d="M15 6l-6 6 6 6"/>',
 empty:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8.5 11h5"/>'
};
const $=s=>document.querySelector(s);
const ic=(n,cls='')=>`<svg class="i ${cls}" viewBox="0 0 24 24">${ICONS[n]||''}</svg>`;
document.querySelectorAll('svg[data-icon]').forEach(el=>el.innerHTML=ICONS[el.dataset.icon]||'');
document.querySelectorAll('[data-stars]').forEach(el=>el.innerHTML='<svg viewBox="0 0 24 24"><path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.600 5.800 21l1.400-7L2 9.300l7-.8z"/></svg>'.repeat(5));

document.querySelectorAll('img[data-logo]').forEach(i=>i.src=$('#logoMain').src);

/* ---- بيانات المحل ---- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mediaUrl=id=>/^https?:/.test(id)?id:API_BASE+'/api/media/'+id;
const waLink=(t='')=>`https://wa.me/${SHOP.whatsapp}${t?`?text=${encodeURIComponent(t)}`:''}`;
function applyShop(){
  $('#waHero').href=waLink('أهلاً '+SHOP.name+'، عندي استفسار');
  $('#waFab').href=waLink('أهلاً '+SHOP.name+'، عندي استفسار');
  $('#cAddr').innerHTML=`<a href="${esc(SHOP.mapUrl)}" target="_blank" rel="noopener">${esc(SHOP.address)}</a>`;
  $('#cHours').textContent=SHOP.hours;
  $('#cPhone').textContent=SHOP.phone;$('#cPhone').href='tel:'+SHOP.phone;$('#cPhone').style.color='var(--muted)';
}
applyShop();

/* ---- أقسام الرئيسية ---- */
$('#homeTiles').innerHTML=CATS.map(c=>`<button class="tile-btn" data-cat="${c.id}">${ic(c.icon)}<span>${c.name}</span></button>`).join('');

/* ---- التنقل بين الصفحتين ---- */
const views={home:$('#view-home'),products:$('#view-products')};
const dockBtns=[...document.querySelectorAll('.dock button')];
const pill=$('#pill');
let current='home';
function placePill(){const b=$('.dock button.on');pill.style.width=b.offsetWidth+'px';pill.style.transform=`translateX(${b.offsetLeft}px)`}
function show(name,{push=true}={}){
  if(!views[name])name='home';
  current=name;
  Object.entries(views).forEach(([k,v])=>v.classList.toggle('active',k===name));
  dockBtns.forEach(b=>b.classList.toggle('on',b.dataset.go===name));
  placePill();
  window.scrollTo(0,0);
  if(push&&location.hash!=='#'+name)history.replaceState(null,'','#'+name);
  litTarget=name==='home'?1:.55;
  if(name==='products')renderSoon();
}
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-go]');if(g){show(g.dataset.go);return}
  const c=e.target.closest('[data-cat]');if(c){state.cat=c.dataset.cat;show('products')}
});
addEventListener('hashchange',()=>show(location.hash.slice(1),{push:false}));
addEventListener('resize',placePill);

/* ---- حالة صفحة المنتجات ---- */
const state={q:'',cat:'all',brands:new Set(),min:null,max:null,stock:false,sort:'rel',dismiss:new Set(),page:1};
const PER=14;let lastSig='';
const input=$('#q'),grid=$('#grid'),sugg=$('#sugg');
let BRANDS=[];let LOADING=true;
const fmt=n=>n.toLocaleString('en-US');
const plural=n=>n===0?'مفيش منتجات':n===1?'منتج واحد':n===2?'منتجين':n<=10?`${n} منتجات`:`${n} منتج`;
const discount=p=>p.old?Math.round((1-p.price/p.old)*100):0;

function hl(text,forms,raws){
  const f=fold(text);let out='',last=0,m;
  WORD.lastIndex=0;
  while((m=WORD.exec(f))){
    const w=m[0],st=stem(w);let hit=false;
    for(const x of forms){if(st===x||(x.length>=2&&w.startsWith(x))){hit=true;break}}
    if(!hit)for(const r of raws){if(r.length>=2&&w.startsWith(r)){hit=true;break}}
    if(hit){out+=text.slice(last,m.index)+'<mark>'+text.slice(m.index,m.index+w.length)+'</mark>';last=m.index+w.length}
  }
  return out+text.slice(last);
}

let rafId=0;
function renderSoon(){cancelAnimationFrame(rafId);rafId=requestAnimationFrame(render)}

function render(){
  const pq=parseQuery(state.q);
  const fx={};
  pq.chips.filter(c=>!state.dismiss.has(c.k)).forEach(c=>Object.assign(fx,c.fx));
  const eMin=fx.min??state.min, eMax=fx.max??state.max, eStock=fx.stock||state.stock;
  const S=searchAll(pq.tokens);
  const common=p=>(!state.brands.size||state.brands.has(p.brand))&&(eMin==null||p.price>=eMin)&&(eMax==null||p.price<=eMax)&&(!eStock||p.stock)&&(!S||S.map.has(p.id));
  const list=P.filter(p=>common(p)&&(state.cat==='all'||p.cat===state.cat));

  /* ترتيب */
  let sort=state.sort;if(sort==='rel'&&fx.cheap)sort='asc';
  list.sort((a,b)=>{
    if(sort==='asc')return a.price-b.price;
    if(sort==='desc')return b.price-a.price;
    if(sort==='disc')return discount(b)-discount(a)||a.id-b.id;
    if(S)return (S.map.get(b.id)-S.map.get(a.id))||(+b.stock-+a.stock)||a.id-b.id;
    return a.id-b.id;
  });

  /* الصفحات */
  const sig=JSON.stringify([state.q,state.cat,[...state.brands],state.min,state.max,state.stock,state.sort,[...state.dismiss]]);
  if(sig!==lastSig){state.page=1;lastSig=sig}
  const pages=Math.max(1,Math.ceil(list.length/PER));
  state.page=Math.min(state.page,pages);
  const pageList=list.slice((state.page-1)*PER,state.page*PER);

  /* العدّاد */
  $('#count').textContent=plural(list.length)+(pages>1?`، صفحة ${state.page} من ${pages}`:'');

  /* شرائح الفهم الذكي */
  const smart=$('#smart');
  if(pq.chips.length){
    smart.hidden=false;
    smart.innerHTML='فهمت:'+pq.chips.map(c=>{const off=state.dismiss.has(c.k);return `<button class="chip" data-dm="${c.k}" ${off?'style="opacity:.45;text-decoration:line-through"':''} aria-label="${off?'رجّع':'شيل'} ${c.label}">${c.label}${ic('x')}</button>`}).join('');
  }else smart.hidden=true;

  /* الأقسام مع الأعداد */
  const counts={all:0};CATS.forEach(c=>counts[c.id]=0);
  P.forEach(p=>{if(common(p)){counts.all++;counts[p.cat]++}});
  $('#cats').innerHTML=`<button class="chip ${state.cat==='all'?'on':''}" data-c="all">الكل <small>${counts.all}</small></button>`+
    CATS.map(c=>`<button class="chip ${state.cat===c.id?'on':''} ${counts[c.id]===0&&state.cat!==c.id?'dim':''}" data-c="${c.id}">${ic(c.icon)}${c.name} <small>${counts[c.id]}</small></button>`).join('');

  /* تنبيه النتائج التقريبية */
  const notice=$('#notice');
  if(S&&S.loose&&list.length&&pq.tokens.filter(t=>!t.isNum).length+pq.tokens.filter(t=>t.isNum).length>1){notice.hidden=false;notice.textContent='مفيش منتج فيه كل كلماتك. دي أقرب النتايج:'}
  else notice.hidden=true;

  /* الكروت */
  const forms=new Set(),raws=[];
  pq.tokens.forEach(t=>{t.forms.forEach(x=>forms.add(x));raws.push(t.raw)});
  if(LOADING&&!P.length){
    grid.innerHTML='<div class="empty"><h3>جاري تحميل المنتجات…</h3></div>';
  }else if(!list.length){
    const dym=didYouMean(pq.tokens);
    grid.innerHTML=`<div class="empty">${ic('empty')}<h3>${state.q.trim()?'مفيش نتايج لبحثك':'مفيش منتجات بالفلاتر دي'}</h3>
      <p>${dym.length?'يمكن قصدك:':'جرّب كلمة تانية أو شيل بعض الفلاتر.'}</p>
      <div class="wrap">${dym.map(d=>`<button class="chip" data-fix="${d.from}|${d.to}">${d.to}</button>`).join('')}
      <button class="chip" data-reset>امسح الفلاتر</button>
      <a class="chip" target="_blank" rel="noopener" href="${waLink('أهلاً نوح، بدوّر على: '+state.q)}">اسأل على واتساب</a></div></div>`;
  }else{
    grid.innerHTML=pageList.map(p=>{
      const d=discount(p);
      return `<article class="card" role="button" tabindex="0" data-id="${p.id}" aria-label="${esc(p.name)}">
        <div class="tile ${p.images[0]?'has-img':''}">${p.images[0]?`<img src="${esc(mediaUrl(p.images[0]))}" alt="" loading="lazy" decoding="async">`:ic((CAT[p.cat]||CATS[0]).icon)}${d?`<span class="off">خصم ${d}%</span>`:''}</div>
        <div class="info"><h3>${hl(esc(p.name),forms,raws)}</h3>
        <div class="meta"><b>${esc(p.brand)}</b><span>${p.catName}</span></div>
        <div class="price"><strong>${fmt(p.price)}<small>ج.م</small></strong>${p.old?`<s>${fmt(p.old)}</s>`:''}<span class="stock ${p.stock?'':'no'}">${p.stock?'متوفر':'نفد'}</span></div></div></article>`;
    }).join('');
  }

  /* أزرار الصفحات */
  const pg=$('#pager');
  if(pages<=1)pg.hidden=true;
  else{
    pg.hidden=false;
    const nums=[];
    for(let i=1;i<=pages;i++){if(pages<=7||i===1||i===pages||Math.abs(i-state.page)<=1)nums.push(i);else if(nums[nums.length-1]!=='…')nums.push('…')}
    pg.innerHTML=`<button class="pg" data-pg="${state.page-1}" ${state.page===1?'disabled':''} aria-label="الصفحة السابقة">${ic('chevR')}السابق</button>`+
      nums.map(n=>n==='…'?'<span class="gap">…</span>':`<button class="pg ${n===state.page?'on':''}" data-pg="${n}" aria-label="صفحة ${n}" ${n===state.page?'aria-current="page"':''}>${n}</button>`).join('')+
      `<button class="pg" data-pg="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="الصفحة التالية">التالي${ic('chevL')}</button>`;
  }

  /* شارة الفلاتر */
  const n=(state.min!=null||state.max!=null?1:0)+(state.brands.size?1:0)+(state.stock?1:0)+(state.sort!=='rel'?1:0);
  const b=$('#fBadge');b.hidden=!n;b.textContent=n;
  $('#filterBtn').classList.toggle('on',n>0);
  $('#clearQ').hidden=!state.q;
  $('#mic').hidden=!(SR)||!!state.q;
  $('#brands').innerHTML=BRANDS.map(x=>`<button class="chip ${state.brands.has(x)?'on':''}" data-b="${esc(x)}">${esc(x)}</button>`).join('');
}

/* ---- أحداث البحث ---- */
input.addEventListener('input',()=>{state.q=input.value;state.dismiss.clear();renderSoon();renderSugg()});
input.addEventListener('focus',renderSugg);
input.addEventListener('keydown',e=>{if(e.key==='Enter'){sugg.hidden=true;input.blur()}if(e.key==='Escape')sugg.hidden=true});
$('#clearQ').onclick=()=>{input.value='';state.q='';state.dismiss.clear();render();input.focus()};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#searchBox'))sugg.hidden=true});
sugg.addEventListener('mousedown',e=>e.preventDefault());

const POP=['لمبة ليد','قاطع 32','مفك','شاكوش','كشاف خارجي أقل من 250','سلك نحاس'];
function renderSugg(){
  const q=input.value.trim();
  if(!panel.hidden){sugg.hidden=true;return}
  if(!q){
    sugg.innerHTML=`<p class="sg-h">جرّب تدوّر على</p><div class="sg-chips">${POP.map(x=>`<button class="chip" data-q="${x}">${x}</button>`).join('')}</div>`;
    sugg.hidden=false;return;
  }
  const pq=parseQuery(q);
  const S=searchAll(pq.tokens);
  if(!S||!S.map.size){sugg.hidden=true;return}
  const forms=new Set(),raws=[];pq.tokens.forEach(t=>{t.forms.forEach(x=>forms.add(x));raws.push(t.raw)});
  const top=[...S.map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id])=>P[id]);
  sugg.innerHTML=top.map(p=>`<button class="sg-item" data-open="${p.id}">${ic((CAT[p.cat]||CATS[0]).icon)}<div><b>${hl(esc(p.name),forms,raws)}</b><small>${p.catName}</small></div><em>${fmt(p.price)} ج.م</em></button>`).join('');
  sugg.hidden=false;
}

/* ---- أحداث عامة في صفحة المنتجات ---- */
document.addEventListener('click',e=>{
  const t=e.target;let el;
  if((el=t.closest('[data-q]'))){input.value=el.dataset.q;state.q=el.dataset.q;state.dismiss.clear();sugg.hidden=true;render()}
  else if((el=t.closest('[data-open]'))){sugg.hidden=true;openProduct(+el.dataset.open)}
  else if((el=t.closest('[data-c]'))){state.cat=el.dataset.c;render()}
  else if((el=t.closest('[data-b]'))){const b=el.dataset.b;state.brands.has(b)?state.brands.delete(b):state.brands.add(b);render()}
  else if((el=t.closest('[data-dm]'))){const k=el.dataset.dm;state.dismiss.has(k)?state.dismiss.delete(k):state.dismiss.add(k);render()}
  else if((el=t.closest('[data-fix]'))){const [from,to]=el.dataset.fix.split('|');state.q=state.q.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),to);if(!state.q.includes(to))state.q=to;input.value=state.q;render()}
  else if((el=t.closest('[data-pg]'))){if(!el.disabled){state.page=+el.dataset.pg;render();window.scrollTo(0,0)}}
  else if(t.closest('[data-reset]'))resetAll();
  else if((el=t.closest('.card')))openProduct(+el.dataset.id);
});
grid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('card')){e.preventDefault();openProduct(+e.target.dataset.id)}});

/* لوحة الفلاتر */
const panel=$('#panel');
$('#filterBtn').onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden){sugg.hidden=true;input.blur()}$('#filterBtn').setAttribute('aria-expanded',!panel.hidden)};
const pMin=$('#pMin'),pMax=$('#pMax');
const setPrice=()=>{state.min=pMin.value===''?null:+pMin.value;state.max=pMax.value===''?null:+pMax.value;render()};
pMin.oninput=pMax.oninput=setPrice;
const PRESETS=[['أقل من 50',null,50],['50 – 200',50,200],['200 – 500',200,500],['أكثر من 500',500,null]];
$('#presets').innerHTML=PRESETS.map((p,i)=>`<button class="chip" data-p="${i}">${p[0]}</button>`).join('');
$('#presets').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;const p=PRESETS[+b.dataset.p];pMin.value=p[1]??'';pMax.value=p[2]??'';setPrice()});
$('#stockOnly').onchange=e=>{state.stock=e.target.checked;render()};
$('#sort').onchange=e=>{state.sort=e.target.value;render()};
function resetAll(){
  Object.assign(state,{cat:'all',min:null,max:null,stock:false,sort:'rel'});state.brands.clear();state.dismiss.clear();
  pMin.value=pMax.value='';$('#stockOnly').checked=false;$('#sort').value='rel';render();
}
$('#resetAll').onclick=resetAll;

/* بحث صوتي */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  $('#mic').onclick=()=>{
    const r=new SR();r.lang='ar-EG';r.interimResults=false;
    const mic=$('#mic');mic.classList.add('rec');
    r.onresult=e=>{input.value=e.results[0][0].transcript;state.q=input.value;state.dismiss.clear();render()};
    r.onend=r.onerror=()=>mic.classList.remove('rec');
    try{r.start()}catch(_){mic.classList.remove('rec')}
  };
}

/* placeholder بيتغير */
const HINTS=['جرّب: كشاف خارجي أقل من 250','جرّب: مفك اختبار','جرّب: لمبه ليد رخيصه','جرّب: بريزه أو فيشه','جرّب: قاطع 32 متوفر'];
let hi=0;input.placeholder=HINTS[0];
setInterval(()=>{if(document.activeElement!==input&&!input.value){hi=(hi+1)%HINTS.length;input.placeholder=HINTS[hi]}},3200);

/* ---- نافذة المنتج ---- */
const scrim=$('#scrim');let lastFocus=null;
function openProduct(id){
  const p=P[id],d=discount(p);lastFocus=document.activeElement;
  scrim.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
    <div style="position:relative"><button class="ibtn xbtn" id="closeSheet" aria-label="إغلاق">${ic('x')}</button>
    ${gallery(p,d)}</div>
    <div class="body"><div class="meta"><b>${esc(p.brand)}</b><span>${p.catName}</span></div>
    <h2>${esc(p.name)}</h2>
    <div class="price"><strong>${fmt(p.price)}<small>ج.م</small></strong>${p.old?`<s>${fmt(p.old)}</s>`:''}<span class="stock ${p.stock?'':'no'}">${p.stock?'متوفر':'نفد حاليًا'}</span></div>
    <p>${esc(p.desc)}</p>
    <a class="btn primary" target="_blank" rel="noopener" href="${waLink(`أهلاً ${SHOP.name}، عايز أسأل عن: ${p.name} (${fmt(p.price)} ج.م)`)}">${ic('chat')}${p.stock?'اسأل أو اطلب على واتساب':'اسأل عن موعد التوفر'}</a></div></div>`;
  scrim.hidden=false;document.body.style.overflow='hidden';
  $('#closeSheet').focus();
}
function closeProduct(){scrim.hidden=true;scrim.innerHTML='';document.body.style.overflow='';if(lastFocus)lastFocus.focus()}
scrim.addEventListener('click',e=>{if(e.target===scrim||e.target.closest('#closeSheet'))closeProduct()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!scrim.hidden)closeProduct()});


/* ---- تلميح إن الصف بيتسحب ---- */
function scrollHint(el){
  const upd=()=>{
    const max=el.scrollWidth-el.clientWidth,pos=Math.abs(el.scrollLeft);
    const rtl=getComputedStyle(el).direction==='rtl';
    /* في RTL البداية على اليمين، فالمحتوى الباقي على الشمال */
    const moreLeft=rtl?pos<max-4:pos>4, moreRight=rtl?pos>4:pos<max-4;
    el.style.setProperty('--fl',moreLeft&&max>4?1:0);
    el.style.setProperty('--fr',moreRight&&max>4?1:0);
  };
  el.addEventListener('scroll',upd,{passive:true});
  addEventListener('resize',upd);
  new MutationObserver(upd).observe(el,{childList:true});
  upd();setTimeout(upd,300);
  return upd;
}
const hintTiles=scrollHint($('#homeTiles')),hintCats=scrollHint($('#cats'));
addEventListener('hashchange',()=>setTimeout(()=>{hintTiles();hintCats()},60));
/* الخلفية تقف لما التبويب يتخبى */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)last=performance.now()});

/* ---- تشغيل ---- */
render();
show((location.hash||'#home').slice(1),{push:false});
loadCatalog();
document.fonts&&document.fonts.ready.then(placePill);

/* معرض صور المنتج في النافذة */
function gallery(p,d){
  const off=d?`<span class="off">خصم ${d}%</span>`:'';
  if(!p.images.length)return `<div class="tile">${ic((CAT[p.cat]||CATS[0]).icon)}${off}</div>`;
  const thumbs=p.images.length>1?`<div class="thumbs">${p.images.map((m,i)=>`<button type="button" class="${i?'':'on'}" data-img="${esc(mediaUrl(m))}" aria-label="صورة ${i+1}"><img src="${esc(mediaUrl(m))}" alt="" loading="lazy"></button>`).join('')}</div>`:'';
  return `<div class="tile has-img big"><img id="sheetImg" src="${esc(mediaUrl(p.images[0]))}" alt="${esc(p.name)}">${off}</div>${thumbs}`;
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-img]');if(!t)return;
  const im=$('#sheetImg');if(im)im.src=t.dataset.img;
  t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===t));
});

/* ---- تحميل الكتالوج من الـAPI (ولو فشل: آخر نسخة محفوظة، ولو مفيش: المنتجات التجريبية) ---- */
function setCatalog(list){
  LOADING=false;
  indexProducts(list);
  BRANDS=[...new Set(P.map(p=>p.brand).filter(Boolean))];
  lastSig='';
  render();
}
async function getJSON(path,ms=8000){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(API_BASE+path,{signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error(r.status);return await r.json()}
  finally{clearTimeout(t)}
}
async function loadCatalog(){
  let cached=null;
  try{cached=JSON.parse(localStorage.getItem('noah_catalog')||'null')}catch(_){}
  if(cached&&cached.length)setCatalog(cached);
  getJSON('/api/site').then(d=>{
    if(d&&d.site){['phone','whatsapp','address','hours','mapUrl'].forEach(k=>{if(d.site[k])SHOP[k]=d.site[k]});applyShop()}
  }).catch(()=>{});
  try{
    const d=await getJSON('/api/products');
    const list=Array.isArray(d.products)?d.products:SEED_PRODUCTS;
    try{localStorage.setItem('noah_catalog',JSON.stringify(list))}catch(_){}
    setCatalog(list);
  }catch(_){
    if(!cached||!cached.length)setCatalog(SEED_PRODUCTS);
  }
}
