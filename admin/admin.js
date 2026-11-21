/* لوحة تحكم نوح. بتكلّم الـAPI (API_BASE في assets/config.js). كل حفظ بيظهر في الموقع فورًا. */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mediaUrl=id=>/^https?:/.test(id)?id:API_BASE+'/api/media/'+id;
const fmt=n=>Number(n).toLocaleString('en-US');
const KEY='noah_admin_code';
let CODE=localStorage.getItem(KEY)||'';
let products=[];
let editing=null;      // المنتج اللي بيتعدل (null = جديد)
let draftImages=[];    // معرّفات الصور في النافذة
let newlyUploaded=[];  // صور اترفعت في النافذة دي (تتمسح لو لغيت)
let originalImages=[];
let busy=false;

/* ---------- الاتصال بالـAPI ---------- */
async function api(method,path,body){
  const r=await fetch(API_BASE+path,{method,headers:{'Content-Type':'application/json','X-Admin-Code':CODE},body:body?JSON.stringify(body):undefined});
  if(r.status===401){logout('الكود غلط أو اتغيّر. اكتبه تاني.');throw new Error('unauthorized')}
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||('خطأ '+r.status));
  return d;
}
let toastT;
function toast(msg,bad){const t=$('#toast');t.textContent=msg;t.className='toast'+(bad?' bad':'');t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,bad?5000:2800)}

/* ---------- الدخول ---------- */
function logout(msg){
  localStorage.removeItem(KEY);CODE='';
  $('#app').hidden=true;$('#login').hidden=false;
  const e=$('#loginErr');if(msg){e.textContent=msg;e.hidden=false}else e.hidden=true;
  $('#code').value='';
}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  CODE=$('#code').value.trim();if(!CODE)return;
  const b=e.target.querySelector('button');b.disabled=true;
  try{
    await api('POST','/api/admin/check',{});
    localStorage.setItem(KEY,CODE);$('#loginErr').hidden=true;await start();
  }catch(err){
    if(err.message!=='unauthorized'){const x=$('#loginErr');x.textContent='مش قادر يتصل بالسيرفر. جرّب تاني.';x.hidden=false}
  }finally{b.disabled=false}
});
$('#logout').onclick=()=>logout();

async function start(){
  $('#login').hidden=true;$('#app').hidden=false;
  $('#fCat').innerHTML=CATS.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  await Promise.all([loadProducts(),loadSite()]);
}

/* ---------- التبويبات ---------- */
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-selected',x===b)});
  $('#paneProducts').hidden=b.dataset.tab!=='products';$('#paneSite').hidden=b.dataset.tab!=='site';
});

/* ---------- المنتجات ---------- */
async function loadProducts(){
  try{
    const d=await api('GET','/api/admin/products');
    products=Array.isArray(d.products)?d.products:SEED_PRODUCTS.map(p=>({...p}));
    renderList();
  }catch(e){if(e.message!=='unauthorized')toast('مش قادر أحمّل المنتجات: '+e.message,true)}
}
function catName(id){return (CAT[id]||{name:'أخرى'}).name}
function renderList(){
  const q=$('#filter').value.trim().toLowerCase();
  const rows=products.filter(p=>!q||(p.name+' '+p.brand+' '+p.tags+' '+catName(p.cat)).toLowerCase().includes(q));
  $('#count').textContent=products.length?`${products.length} منتج${q?`، المعروض ${rows.length}`:''}`:'';
  const samples=products.filter(p=>p.sample).length;
  $('#sampleBanner').hidden=!samples;
  if(samples)$('#delSamples').textContent=`امسح كل المنتجات التجريبية (${samples})`;
  $('#list').innerHTML=rows.length?rows.map(p=>`<li><button type="button" class="item" data-id="${esc(p.id)}">
    <span class="th">${p.images&&p.images[0]?`<img src="${esc(mediaUrl(p.images[0]))}" alt="" loading="lazy">`:'بدون صورة'}</span>
    <span class="tx"><div class="nm">${esc(p.name)}</div>
    <div class="mt"><span>${esc(catName(p.cat))}</span>${p.brand?`<span>· ${esc(p.brand)}</span>`:''}
    ${p.stock===false?'<span class="tag no">نفد</span>':''}${p.sample?'<span class="tag sm">تجريبي</span>':''}</div></span>
    <span class="pr">${fmt(p.price)} ج.م</span></button></li>`).join(''):`<li class="empty">${products.length?'مفيش نتيجة.':'مفيش منتجات لسه. اضغط "+ منتج جديد".'}</li>`;
}
$('#filter').addEventListener('input',renderList);
$('#list').addEventListener('click',e=>{const b=e.target.closest('.item');if(b)openForm(products.find(p=>p.id===b.dataset.id))});
$('#addBtn').onclick=()=>openForm(null);

async function saveAll(list){
  const d=await api('PUT','/api/admin/products',{products:list});
  return d;
}
async function freshProducts(){
  const d=await api('GET','/api/admin/products');
  return Array.isArray(d.products)?d.products:products;
}
/* مسح تجريبي بتأكيد على نفس الزرار */
let armed=null;
function confirmClick(btn,label,fn){
  if(armed===btn){clearTimeout(btn._t);armed=null;btn.textContent=btn._orig;fn();return}
  if(armed){clearTimeout(armed._t);armed.textContent=armed._orig;armed=null}
  btn._orig=btn.textContent;btn.textContent=label;armed=btn;
  btn._t=setTimeout(()=>{btn.textContent=btn._orig;armed=null},4000);
}
$('#delSamples').onclick=e=>confirmClick(e.currentTarget,'اضغط تاني للتأكيد',async()=>{
  try{
    const cur=await freshProducts();
    const gone=cur.filter(p=>p.sample),keep=cur.filter(p=>!p.sample);
    await saveAll(keep);
    const ids=gone.flatMap(p=>p.images||[]);if(ids.length)api('POST','/api/admin/media/delete',{ids}).catch(()=>{});
    products=keep;renderList();toast(`اتمسح ${gone.length} منتج تجريبي`);
  }catch(err){if(err.message!=='unauthorized')toast('معرفتش أمسح: '+err.message,true)}
});

/* ---------- نافذة المنتج ---------- */
function openForm(p){
  editing=p||null;
  newlyUploaded=[];originalImages=p?[...(p.images||[])]:[];draftImages=[...originalImages];
  $('#pTitle').textContent=p?'تعديل منتج':'منتج جديد';
  $('#fName').value=p?p.name:'';
  $('#fCat').value=p&&CAT[p.cat]?p.cat:CATS[0].id;
  $('#fBrand').value=p?p.brand||'':'';
  $('#fPrice').value=p?p.price:'';
  $('#fOld').value=p&&p.old?p.old:'';
  $('#fStock').checked=p?p.stock!==false:true;
  $('#fDesc').value=p?p.desc||'':'';
  $('#fTags').value=p?p.tags||'':'';
  $('#pDelete').hidden=!p;$('#pErr').hidden=true;
  renderThumbs();
  $('#scrim').hidden=false;document.body.style.overflow='hidden';
  setTimeout(()=>$('#fName').focus(),50);
}
function closeForm(discard){
  if(discard&&newlyUploaded.length)api('POST','/api/admin/media/delete',{ids:newlyUploaded}).catch(()=>{});
  $('#scrim').hidden=true;document.body.style.overflow='';editing=null;
}
$('#pClose').onclick=$('#pCancel').onclick=()=>closeForm(true);
$('#scrim').addEventListener('click',e=>{if(e.target===$('#scrim'))closeForm(true)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#scrim').hidden)closeForm(true)});

function renderThumbs(extra=0){
  $('#thumbs').innerHTML=draftImages.map((m,i)=>`<div class="pt ${i?'':'first'}"><img src="${esc(mediaUrl(m))}" alt="">
    <button type="button" class="rm" data-rm="${i}" aria-label="شيل الصورة">×</button>
    ${i?`<button type="button" class="mk" data-first="${i}">خليها الأولى</button>`:'<span class="mk" style="display:grid;place-items:center">الرئيسية</span>'}</div>`).join('')+
    '<div class="pt up">جاري الرفع…</div>'.repeat(extra);
  $('#addPhotoLbl').hidden=draftImages.length+extra>=6;
}
$('#thumbs').addEventListener('click',e=>{
  const r=e.target.closest('[data-rm]'),f=e.target.closest('[data-first]');
  if(r){draftImages.splice(+r.dataset.rm,1);renderThumbs()}
  if(f){const i=+f.dataset.first;draftImages.unshift(draftImages.splice(i,1)[0]);renderThumbs()}
});

/* تصغير الصورة قبل الرفع (أقصى 1000px) عشان الموقع يفضل سريع */
async function shrink(file){
  const bmp=await createImageBitmap(file);
  const k=Math.min(1,1000/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bmp,0,0,c.width,c.height);
  let type='image/webp',blob=await new Promise(r=>c.toBlob(r,type,.82));
  if(!blob||blob.type!==type){type='image/jpeg';blob=await new Promise(r=>c.toBlob(r,type,.82))}
  const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=rej;fr.readAsDataURL(blob)});
  return {type,data:b64};
}
$('#fFiles').addEventListener('change',async e=>{
  const files=[...e.target.files].slice(0,6-draftImages.length);e.target.value='';
  if(!files.length)return;
  const err=$('#pErr');err.hidden=true;
  let pending=files.length;renderThumbs(pending);$('#pSave').disabled=true;
  for(const f of files){
    try{
      const img=await shrink(f);
      const d=await api('POST','/api/admin/media',img);
      draftImages.push(d.id);newlyUploaded.push(d.id);
    }catch(ex){err.textContent='صورة منها ما اترفعتش ('+(ex.message||'خطأ')+'). جرّب تاني.';err.hidden=false}
    pending--;renderThumbs(pending);
  }
  $('#pSave').disabled=false;
});

$('#pform').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const price=parseFloat($('#fPrice').value);
  const err=$('#pErr');
  if(!$('#fName').value.trim()||!(price>=0)){err.textContent='اكتب اسم المنتج والسعر.';err.hidden=false;return}
  const item={
    id:editing?editing.id:'p-'+Math.random().toString(36).slice(2,10),
    name:$('#fName').value.trim(),cat:$('#fCat').value,brand:$('#fBrand').value.trim(),
    price,old:parseFloat($('#fOld').value)||0,stock:$('#fStock').checked,
    desc:$('#fDesc').value.trim(),tags:$('#fTags').value.trim(),images:[...draftImages]
  };
  if(item.old&&item.old<=item.price)item.old=0;
  busy=true;const b=$('#pSave');b.disabled=true;b.textContent='جاري الحفظ…';
  try{
    const cur=await freshProducts();           /* نقرا آخر نسخة عشان ما نمسحش تعديل جهاز تاني */
    const i=cur.findIndex(p=>p.id===item.id);
    if(i>=0)cur[i]=item;else cur.unshift(item);
    await saveAll(cur);
    const removed=originalImages.filter(m=>!item.images.includes(m));
    if(removed.length)api('POST','/api/admin/media/delete',{ids:removed}).catch(()=>{});
    products=cur;newlyUploaded=[];closeForm(false);renderList();
    toast('اتحفظ وظهر في الموقع');
  }catch(ex){if(ex.message!=='unauthorized'){err.textContent='ما اتحفظش: '+ex.message;err.hidden=false}}
  finally{busy=false;b.disabled=false;b.textContent='حفظ'}
});
$('#pDelete').onclick=e=>confirmClick(e.currentTarget,'اضغط تاني للتأكيد',async()=>{
  if(!editing||busy)return;busy=true;
  try{
    const cur=(await freshProducts()).filter(p=>p.id!==editing.id);
    await saveAll(cur);
    const ids=editing.images||[];if(ids.length)api('POST','/api/admin/media/delete',{ids}).catch(()=>{});
    products=cur;closeForm(false);renderList();toast('اتمسح المنتج');
  }catch(ex){if(ex.message!=='unauthorized')toast('معرفتش أمسح: '+ex.message,true)}
  finally{busy=false}
});

/* ---------- بيانات المحل ---------- */
const DEFAULTS={phone:'01000000000',whatsapp:'201000000000',address:'اكتب عنوان المحل هنا',mapUrl:'https://www.google.com/maps'};
async function loadSite(){
  let site={};
  try{const r=await fetch(API_BASE+'/api/site',{cache:'no-store'});site=(await r.json()).site||{}}catch(_){}
  const v=k=>site[k]||SHOP[k]||'';
  $('#sPhone').value=v('phone');$('#sWa').value=v('whatsapp');$('#sAddr').value=v('address');$('#sMap').value=v('mapUrl');$('#sHours').value=v('hours');
  checkSiteWarn();
}
function checkSiteWarn(){
  const bad=[];
  if(!$('#sPhone').value.trim()||$('#sPhone').value.trim()===DEFAULTS.phone)bad.push('رقم التليفون');
  if(!$('#sWa').value.trim()||$('#sWa').value.trim()===DEFAULTS.whatsapp)bad.push('رقم الواتساب (زرار واتساب في الموقع بيفتح رقم وهمي لحد ما يتغير)');
  if(!$('#sAddr').value.trim()||$('#sAddr').value.trim()===DEFAULTS.address)bad.push('العنوان');
  if(!$('#sMap').value.trim()||$('#sMap').value.trim()===DEFAULTS.mapUrl)bad.push('رابط الخريطة');
  $('#siteWarn').hidden=!bad.length;$('#siteWarnList').textContent=bad.join('، ');$('#siteDot').hidden=!bad.length;
}
['#sPhone','#sWa','#sAddr','#sMap'].forEach(s=>$(s).addEventListener('input',checkSiteWarn));
$('#siteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const b=e.target.querySelector('button[type=submit]');b.disabled=true;
  try{
    await api('PUT','/api/admin/site',{site:{phone:$('#sPhone').value,whatsapp:$('#sWa').value,address:$('#sAddr').value,mapUrl:$('#sMap').value,hours:$('#sHours').value}});
    toast('اتحفظت بيانات المحل وظهرت في الموقع');
  }catch(ex){if(ex.message!=='unauthorized')toast('ما اتحفظتش: '+ex.message,true)}
  finally{b.disabled=false}
});

/* ---------- تشغيل ---------- */
(async()=>{
  if(CODE){try{await api('POST','/api/admin/check',{});await start();return}catch(_){}}
  $('#login').hidden=false;
})();
