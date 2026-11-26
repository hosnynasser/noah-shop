/* لوحة تحكم نوح. بتكلّم الـAPI (API_BASE في assets/config.js). كل حفظ بيظهر في الموقع فورًا. */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mediaUrl=id=>/^https?:/.test(id)?id:API_BASE+'/api/media/'+id;
const fmt=n=>Number(n).toLocaleString('en-US');
const KEY='noah_admin_token';
let TOKEN=localStorage.getItem(KEY)||'';
let ME=null;
let products=[];
let SITE_SHOW=true;
let editing=null;      // المنتج اللي بيتعدل (null = جديد)
let draftImages=[];    // معرّفات الصور في النافذة
let newlyUploaded=[];  // صور اترفعت في النافذة دي (تتمسح لو لغيت)
let originalImages=[];
let busy=false;

/* ---------- الاتصال بالـAPI ---------- */
async function api(method,path,body){
  const r=await fetch(API_BASE+path,{method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},body:body?JSON.stringify(body):undefined});
  if(r.status===401){logout('الجلسة خلصت. ادخل تاني.');throw new Error('unauthorized')}
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||('خطأ '+r.status));
  return d;
}
let toastT;
function toast(msg,bad){const t=$('#toast');t.textContent=msg;t.className='toast'+(bad?' bad':'');t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,bad?5000:2800)}

/* ---------- الدخول ---------- */
function logout(msg){
  localStorage.removeItem(KEY);TOKEN='';ME=null;
  $('#app').hidden=true;$('#login').hidden=false;
  const e=$('#loginErr');if(msg){e.textContent=msg;e.hidden=false}else e.hidden=true;
  $('#code').value='';
}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const username=$('#user').value.trim(),password=$('#code').value;if(!username||!password)return;
  const b=e.target.querySelector('button');b.disabled=true;
  const x=$('#loginErr');
  try{
    const r=await fetch(API_BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    if(r.status===401){x.textContent='اليوزر أو الباسورد غلط.';x.hidden=false;return}
    if(!r.ok)throw new Error(r.status);
    const d=await r.json();TOKEN=d.token;localStorage.setItem(KEY,TOKEN);
    x.hidden=true;$('#code').value='';await start();
  }catch(err){x.textContent='مش قادر يتصل بالسيرفر. جرّب تاني.';x.hidden=false}
  finally{b.disabled=false}
});
$('#logout').onclick=()=>logout();

async function start(){
  $('#login').hidden=true;$('#app').hidden=false;
  $('#fCat').innerHTML=CATS.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#catFilter').innerHTML='<option value="">الكل</option>'+CATS.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if(typeof buildCatMenu==='function')buildCatMenu();
  await Promise.all([loadProducts(),loadSite(),loadAdmins(),loadOrders(true)]);
}

/* ---------- التبويبات ---------- */
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-selected',x===b)});
  $('#paneProducts').hidden=b.dataset.tab!=='products';$('#paneSite').hidden=b.dataset.tab!=='site';$('#paneAdmins').hidden=b.dataset.tab!=='admins';$('#paneOrders').hidden=b.dataset.tab!=='orders';if(b.dataset.tab==='orders')loadOrders();
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
  const cf=$('#catFilter').value;
  const rows=products.filter(p=>(!cf||p.cat===cf)&&(!q||(p.name+' '+p.brand+' '+p.tags+' '+catName(p.cat)).toLowerCase().includes(q)));
  $('#count').textContent=products.length?`${products.length} منتج${(q||cf)?`، المعروض ${rows.length}`:''}`:'';
  const samples=products.filter(p=>p.sample).length;
  $('#sampleBanner').hidden=!samples;
  if(samples)$('#delSamples').textContent=`امسح كل المنتجات التجريبية (${samples})`;
  $('#list').innerHTML=rows.length?rows.map(p=>`<li><button type="button" class="item" data-id="${esc(p.id)}">
    <span class="th">${p.images&&p.images[0]?`<img src="${esc(mediaUrl(p.images[0]))}" alt="" loading="lazy">`:'بدون صورة'}</span>
    <span class="tx"><div class="nm">${esc(p.name)}</div>
    <div class="mt"><span>${esc(catName(p.cat))}</span>${p.brand?`<span>· ${esc(p.brand)}</span>`:''}
    ${p.stock===false?'<span class="tag no">نفد</span>':''}${p.sample?'<span class="tag sm">تجريبي</span>':''}${(p.price==null||p.priceMode==='hide'||(p.priceMode!=='show'&&!SITE_SHOW))?'<span class="tag no">سعر مخفي</span>':''}</div></span>
    <span class="pr">${p.price==null?'<small>بدون سعر</small>':fmt(p.price)+' ج.م'}</span></button></li>`).join(''):`<li class="empty">${products.length?'مفيش نتيجة.':'مفيش منتجات لسه. اضغط "+ منتج جديد".'}</li>`;
}
$('#filter').addEventListener('input',renderList);
$('#catFilter').addEventListener('change',renderList);
function buildCatMenu(){
  const sel=$('#catFilter'),menu=$('#catMenu');
  menu.innerHTML=[...sel.options].map(o=>`<li role="option" tabindex="-1" data-v="${esc(o.value)}" aria-selected="${o.value===sel.value}">${esc(o.textContent)}</li>`).join('');
  $('#catLbl').textContent=sel.options[sel.selectedIndex].textContent;
}
function setCatMenu(open){
  $('#catMenu').hidden=!open;$('#catBtn').setAttribute('aria-expanded',open);
  if(open){const cur=$('#catMenu [aria-selected="true"]');if(cur)cur.scrollIntoView({block:'nearest'})}
}
$('#catBtn').addEventListener('click',e=>{e.stopPropagation();buildCatMenu();setCatMenu($('#catMenu').hidden)});
$('#catMenu').addEventListener('click',e=>{
  const li=e.target.closest('li[data-v]');if(!li)return;
  $('#catFilter').value=li.dataset.v;buildCatMenu();setCatMenu(false);renderList();
});
document.addEventListener('click',e=>{if(!e.target.closest('.cdd'))setCatMenu(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setCatMenu(false)});
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
  $('#fPrice').value=p&&p.price!=null?p.price:'';
  $('#fOld').value=p&&p.old?p.old:'';
  $('#fStock').checked=p?p.stock!==false:true;
  $('#fPriceMode').value=p&&(p.priceMode==='show'||p.priceMode==='hide')?p.priceMode:'';
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
  const price=$('#fPrice').value.trim()===''?null:parseFloat($('#fPrice').value);
  const err=$('#pErr');
  if(!$('#fName').value.trim()||(price!==null&&!(price>=0))){err.textContent='اكتب اسم المنتج (والسعر لو موجود).';err.hidden=false;return}
  const item={
    id:editing?editing.id:'p-'+Math.random().toString(36).slice(2,10),
    name:$('#fName').value.trim(),cat:$('#fCat').value,brand:$('#fBrand').value.trim(),
    price,old:price===null?0:(parseFloat($('#fOld').value)||0),stock:$('#fStock').checked,
    desc:$('#fDesc').value.trim(),tags:$('#fTags').value.trim(),images:[...draftImages]
  };
  const pm=$('#fPriceMode').value;if(pm==='show'||pm==='hide')item.priceMode=pm;
  if(item.old&&price!==null&&item.old<=item.price)item.old=0;
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
  SITE_SHOW=site.showPrices!==false;$('#sShowPrices').checked=SITE_SHOW;renderList();
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
    await api('PUT','/api/admin/site',{site:{phone:$('#sPhone').value,whatsapp:$('#sWa').value,address:$('#sAddr').value,mapUrl:$('#sMap').value,hours:$('#sHours').value,showPrices:$('#sShowPrices').checked}});SITE_SHOW=$('#sShowPrices').checked;renderList();
    toast('اتحفظت بيانات المحل وظهرت في الموقع');
  }catch(ex){if(ex.message!=='unauthorized')toast('ما اتحفظتش: '+ex.message,true)}
  finally{b.disabled=false}
});

/* ---------- المديرين ---------- */
let admins=[];
async function loadAdmins(){
  try{
    const d=await api('GET','/api/admin/admins');admins=d.admins;ME=d.me;renderAdmins();
  }catch(e){if(e.message!=='unauthorized')toast('مش قادر أحمّل المديرين: '+e.message,true)}
}
function renderAdmins(){
  $('#adminList').innerHTML=admins.map(a=>`<li class="arow" data-id="${esc(a.id)}">
    <div class="ahead"><b dir="ltr">${esc(a.username)}</b>${a.id===ME?'<span class="tag sm">أنت</span>':''}</div>
    <div class="aedit">
      <input class="aUser" dir="ltr" value="${esc(a.username)}" aria-label="اسم المستخدم" maxlength="30" autocapitalize="none">
      <input class="aPass" type="password" dir="ltr" placeholder="باسورد جديد (سيبه فاضي لو مش هتغيره)" aria-label="باسورد جديد" autocomplete="new-password" maxlength="100">
      <div class="abtns"><button type="button" class="btn primary sm" data-act="save">حفظ</button>
      <button type="button" class="btn danger sm" data-act="del"${admins.length<2?' disabled title="مينفعش تمسح آخر مدير"':''}>مسح</button></div>
    </div></li>`).join('');
}
$('#adminList').addEventListener('click',async e=>{
  const btn=e.target.closest('[data-act]');if(!btn)return;
  const row=btn.closest('.arow'),id=row.dataset.id;
  if(btn.dataset.act==='save'){
    const body={username:row.querySelector('.aUser').value.trim()};
    const pw=row.querySelector('.aPass').value;if(pw)body.password=pw;
    btn.disabled=true;
    try{
      const d=await api('PUT','/api/admin/admins/'+id,body);
      if(d.token){TOKEN=d.token;localStorage.setItem(KEY,TOKEN)}
      toast(pw?'اتحفظ. الباسورد الجديد شغال':'اتحفظ');await loadAdmins();
    }catch(ex){if(ex.message!=='unauthorized')toast(ex.message,true)}
    finally{btn.disabled=false}
  }else if(btn.dataset.act==='del'){
    const self=id===ME;
    confirmClick(btn,self?'ده حسابك. اضغط تاني للتأكيد':'اضغط تاني للتأكيد',async()=>{
      try{
        await api('DELETE','/api/admin/admins/'+id);
        if(self){logout('اتمسح حسابك.');return}
        toast('اتمسح المدير');await loadAdmins();
      }catch(ex){if(ex.message!=='unauthorized')toast(ex.message,true)}
    });
  }
});
$('#adminForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const b=e.target.querySelector('button[type=submit]');b.disabled=true;
  try{
    await api('POST','/api/admin/admins',{username:$('#nUser').value.trim(),password:$('#nPass').value});
    $('#nUser').value='';$('#nPass').value='';toast('اتضاف المدير');await loadAdmins();
  }catch(ex){if(ex.message!=='unauthorized')toast(ex.message,true)}
  finally{b.disabled=false}
});

/* ---------- الطلبات ---------- */
const ST={new:'جديد',preparing:'بيتجهز',done:'اتسلم',cancelled:'ملغي'};
let orders=[];
async function loadOrders(quiet){
  try{const d=await api('GET','/api/admin/orders');orders=d.orders||[];renderOrders();
    const n=orders.filter(o=>o.status==='new').length;$('#ordDot').hidden=!n;
  }catch(ex){if(!quiet&&ex.message!=='unauthorized')toast(ex.message,true)}
}
function renderOrders(){
  const f=$('#ordFilter').value;const list=orders.filter(o=>f==='all'||o.status===f);
  $('#ordCount').textContent=orders.length?`${list.length} طلب`:'';
  if(!list.length){$('#ordList').innerHTML=`<li class="muted" style="padding:18px;text-align:center">${orders.length?'مفيش طلبات بالحالة دي':'لسه مفيش طلبات'}</li>`;return}
  $('#ordList').innerHTML=list.map(o=>{
    const d=new Date(o.ts).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'});
    return `<li class="ord" data-id="${esc(o.id)}"><div class="ord-h"><b dir="ltr">${esc(o.id)}</b><span class="st st-${esc(o.status)}">${ST[o.status]||esc(o.status)}</span></div>
    <div class="muted small">${esc(d)}</div>
    <div><b>${esc(o.name)}</b> · <a href="tel:${esc(o.phone)}" dir="ltr">${esc(o.phone)}</a></div>
    <div class="small">${esc(o.address)}</div>${o.notes?`<div class="small muted">ملاحظات: ${esc(o.notes)}</div>`:''}
    <ul class="ord-items">${o.items.map(i=>`<li><span>${esc(i.name)} × ${i.qty}</span><em>${fmt(i.lineTotal)}</em></li>`).join('')}</ul>
    <div class="ord-t"><span>مجموع المنتجات (من غير شحن)</span><strong>${fmt(o.total)} ج.م</strong></div>
    <div class="ord-a">${Object.keys(ST).filter(k=>k!==o.status).map(k=>`<button type="button" class="btn ${k==='cancelled'?'danger':'ghost'} sm" data-st="${k}">${ST[k]}</button>`).join('')}
    <a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${esc(waNum(o.phone))}">واتساب</a></div></li>`;
  }).join('');
}
function waNum(p){let d=String(p).replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);else if(d.startsWith('0'))d='20'+d.slice(1);return d}
$('#ordFilter').onchange=renderOrders;$('#ordRefresh').onclick=()=>loadOrders();
$('#ordList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-st]');if(!b)return;const li=b.closest('.ord');
  if(b.dataset.st==='cancelled'&&!confirm('تلغي الطلب ده؟'))return;
  b.disabled=true;
  try{await api('POST','/api/admin/orders/status',{id:li.dataset.id,status:b.dataset.st});toast('اتغيرت الحالة');await loadOrders()}
  catch(ex){if(ex.message!=='unauthorized')toast(ex.message,true);b.disabled=false}
});

/* ---------- تشغيل ---------- */
(async()=>{
  if(TOKEN){try{await api('POST','/api/admin/check',{});await start();return}catch(_){}}
  $('#login').hidden=false;
})();
