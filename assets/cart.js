/* سلة الزبون وإرسال الطلب. بيشتغل فوق app.js من غير ما يغيّر في البحث. */
(function(){
  const KEY='noah_cart';
  let cart={};try{cart=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){cart={}}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(_){}};
  const byPid=id=>P.find(p=>p.pid===id);
  const canBuy=p=>!!(p&&p.stock&&!p.sample);
  const lines=()=>Object.keys(cart).map(id=>({p:byPid(id),id,qty:cart[id]})).filter(l=>l.p);
  const count=()=>lines().reduce((a,l)=>a+l.qty,0);
  const total=()=>lines().reduce((a,l)=>a+l.qty*l.p.price,0);
  const money=n=>fmt(Math.round(n*100)/100);

  const bar=document.createElement('button');bar.id='cartBar';bar.className='cart-bar';bar.hidden=true;bar.type='button';
  document.body.appendChild(bar);
  const box=document.createElement('div');box.id='cartBox';box.className='scrim';box.hidden=true;document.body.appendChild(box);

  function refreshBar(){
    const n=count();
    bar.hidden=!n||!box.hidden;
    bar.innerHTML=`<span class="cb-n">${n}</span><span>السلة</span><b>${money(total())} ج.م</b>`;
  }
  function add(id,q=1){const p=byPid(id);if(!canBuy(p))return;cart[id]=Math.min(99,(cart[id]||0)+q);save();refreshBar()}

  /* زرار "أضف للسلة" في نافذة المنتج */
  const _open=openProduct;
  openProduct=function(i){
    _open(i);
    const p=P[i];const body=document.querySelector('#scrim .sheet .body');if(!body)return;
    if(!canBuy(p))return;
    const b=document.createElement('button');b.type='button';b.className='btn primary add-cart';b.textContent='أضف للسلة';
    b.onclick=()=>{add(p.pid);closeProduct();toast('اتضاف للسلة')};
    body.insertBefore(b,body.querySelector('a.btn'));
  };
  function toast(m){
    let t=document.getElementById('cToast');if(!t){t=document.createElement('div');t.id='cToast';t.className='c-toast';t.setAttribute('role','status');document.body.appendChild(t)}
    t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),1800);
  }

  function lineHtml(l){
    return `<li class="cl"><div class="cl-i"><b>${esc(l.p.name)}</b><small>${money(l.p.price)} ج.م</small></div>
      <div class="qty"><button type="button" data-q="-1" data-id="${esc(l.id)}" aria-label="نقّص">−</button><span>${l.qty}</span><button type="button" data-q="1" data-id="${esc(l.id)}" aria-label="زوّد">+</button></div>
      <em>${money(l.qty*l.p.price)}</em><button type="button" class="rm" data-rm="${esc(l.id)}" aria-label="شيل">×</button></li>`;
  }
  function openCart(){
    const ls=lines();
    let prefill={};try{prefill=JSON.parse(localStorage.getItem('noah_cust')||'{}')}catch(_){}
    box.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="السلة"><div class="body">
      <div class="c-head"><h2>سلتك</h2><button type="button" class="ibtn" id="cartX" aria-label="إغلاق">${ic('x')}</button></div>
      ${ls.length?`<ul class="cl-list">${ls.map(lineHtml).join('')}</ul>
      <div class="c-total"><span>الإجمالي</span><strong>${money(total())} ج.م</strong></div>
      <form id="ordForm" class="o-form" autocomplete="on">
        <input name="name" placeholder="الاسم" required maxlength="80" autocomplete="name" value="${esc(prefill.name||'')}">
        <input name="phone" placeholder="رقم التليفون" required inputmode="tel" dir="ltr" maxlength="30" autocomplete="tel" value="${esc(prefill.phone||'')}">
        <textarea name="address" placeholder="العنوان بالتفصيل" required rows="2" maxlength="300" autocomplete="street-address">${esc(prefill.address||'')}</textarea>
        <input name="notes" placeholder="ملاحظات (اختياري)" maxlength="300">
        <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="o-err" id="ordErr" hidden></p>
        <button class="btn primary" id="ordGo" type="submit">ابعت الطلب</button>
        <small class="o-note">الدفع عند الاستلام. هنكلمك نأكد الطلب.</small>
      </form>`:`<div class="empty"><h3>السلة فاضية</h3><p>اختار منتجات من صفحة المنتجات.</p></div>`}
    </div></div>`;
    box.hidden=false;document.body.style.overflow='hidden';bar.hidden=true;
  }
  function closeCart(){box.hidden=true;box.innerHTML='';document.body.style.overflow='';refreshBar()}
  bar.onclick=openCart;
  box.addEventListener('click',e=>{
    if(e.target===box||e.target.closest('#cartX')){closeCart();return}
    const q=e.target.closest('[data-q]');
    if(q){const id=q.dataset.id,n=(cart[id]||0)+ +q.dataset.q;if(n<1)delete cart[id];else cart[id]=Math.min(99,n);save();openCart();return}
    const r=e.target.closest('[data-rm]');if(r){delete cart[r.dataset.rm];save();openCart()}
  });
  box.addEventListener('submit',async e=>{
    if(e.target.id!=='ordForm')return;e.preventDefault();
    const f=e.target,go=$('#ordGo'),err=$('#ordErr');err.hidden=true;go.disabled=true;go.textContent='جاري الإرسال…';
    const v=Object.fromEntries(new FormData(f));
    const payload={name:v.name,phone:v.phone,address:v.address,notes:v.notes,website:v.website,items:lines().map(l=>({id:l.id,qty:l.qty}))};
    try{
      const r=await fetch(API_BASE+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        if(d.code==='unknown_product'||d.code==='out_of_stock'||d.code==='sample'){delete cart[d.id];save()}
        throw new Error(d.error||'حصلت مشكلة. جرّب تاني أو كلمنا واتساب.');
      }
      try{localStorage.setItem('noah_cust',JSON.stringify({name:v.name,phone:v.phone,address:v.address}))}catch(_){}
      cart={};save();
      box.innerHTML=`<div class="sheet" role="dialog" aria-modal="true"><div class="body ok-box"><h2>وصل طلبك ✓</h2><p>رقم الطلب: <b dir="ltr">${esc(d.id)}</b></p><p>الإجمالي ${money(d.total)} ج.م. الدفع عند الاستلام. هنكلمك على رقمك نأكد.</p><button class="btn primary" type="button" id="cartX">تمام</button></div></div>`;
    }catch(ex){
      err.textContent=(ex&&ex.name==='TypeError')?'مفيش اتصال. جرّب تاني.':ex.message;err.hidden=false;go.disabled=false;go.textContent='ابعت الطلب';
    }
  });
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden)closeCart()});
  /* لما الكتالوج يتحمّل، شيل من السلة أي منتج اختفى */
  const _set=setCatalog;
  setCatalog=function(list){_set(list);let ch=false;Object.keys(cart).forEach(id=>{const p=byPid(id);if(!p||!canBuy(p)){delete cart[id];ch=true}});if(ch)save();refreshBar()};
  refreshBar();
})();
