/* قائمة الاستفسار: الزبون يختار كذا منتج بكمياتهم ويبعتهم في رسالة واتساب واحدة، من غير أسعار.
   منفصلة عن السلة: السلة وطلب المراجعة زي ما هم. القائمة محفوظة على جهاز الزبون بس. */
(function(){
  const KEY='noah_inquiry';
  let list={};try{list=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){list={}}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(list))}catch(_){}};
  const byPid=id=>P.find(p=>p.pid===id);
  const lines=()=>Object.keys(list).map(id=>({p:byPid(id),id,qty:list[id]})).filter(l=>l.p);
  const count=()=>lines().reduce((a,l)=>a+l.qty,0);

  const bar=document.createElement('button');bar.id='inqBar';bar.className='inq-bar';bar.type='button';bar.hidden=true;
  document.body.appendChild(bar);
  const box=document.createElement('div');box.id='inqBox';box.className='scrim';box.hidden=true;document.body.appendChild(box);
  const cartBar=()=>document.getElementById('cartBar');

  function refreshBar(){
    const n=count();
    bar.hidden=!n||!box.hidden;
    bar.innerHTML=`<span class="cb-n">${n}</span><span>قائمة الاستفسار</span>`;
    const cb=cartBar();bar.classList.toggle('above',!!(cb&&!cb.hidden));
  }
  function add(id,q=1){if(!byPid(id))return;list[id]=Math.min(99,(list[id]||0)+q);save();refreshBar()}
  function toast(m){
    let t=document.getElementById('cToast');if(!t){t=document.createElement('div');t.id='cToast';t.className='c-toast';t.setAttribute('role','status');document.body.appendChild(t)}
    t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),1800);
  }
  const message=()=>{
    const ls=lines();
    return `أهلاً ${SHOP.name}، عايز أسأل عن المنتجات دي:\n`+ls.map((l,i)=>`${i+1}. ${l.p.name} × ${l.qty}`).join('\n');
  };
  function openList(){
    const ls=lines();
    box.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="قائمة الاستفسار"><div class="body">
      <div class="c-head"><h2>قائمة الاستفسار</h2><button type="button" class="ibtn" id="inqX" aria-label="إغلاق">${ic('x')}</button></div>
      ${ls.length?`<ul class="cl-list">${ls.map(l=>`<li class="cl"><div class="cl-i"><b>${esc(l.p.name)}</b></div>
        <div class="qty"><button type="button" data-q="-1" data-id="${esc(l.id)}" aria-label="نقّص">−</button><span>${l.qty}</span><button type="button" data-q="1" data-id="${esc(l.id)}" aria-label="زوّد">+</button></div>
        <button type="button" class="rm" data-rm="${esc(l.id)}" aria-label="شيل">×</button></li>`).join('')}</ul>
      <p class="o-note">هتفتح رسالة واتساب واحدة فيها أسماء المنتجات وكمياتها. راجعها وابعتها بنفسك.</p>
      <a class="btn primary" id="inqGo" target="_blank" rel="noopener" href="${waLink(message())}">${ic('chat')}اسأل عن المنتجات على واتساب</a>`
      :`<div class="empty"><h3>القائمة فاضية</h3><p>دوس «أضف للاستفسار» على أي منتج.</p></div>`}
    </div></div>`;
    box.hidden=false;document.body.style.overflow='hidden';bar.hidden=true;
  }
  function closeList(){box.hidden=true;box.innerHTML='';document.body.style.overflow='';refreshBar()}
  bar.onclick=openList;
  box.addEventListener('click',e=>{
    if(e.target===box||e.target.closest('#inqX')){closeList();return}
    const q=e.target.closest('[data-q]');
    if(q){const id=q.dataset.id,n=(list[id]||0)+ +q.dataset.q;if(n<1)delete list[id];else list[id]=Math.min(99,n);save();openList();return}
    const r=e.target.closest('[data-rm]');if(r){delete list[r.dataset.rm];save();openList()}
  });
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden)closeList()});

  /* زرار "أضف للاستفسار" على كارت المنتج (للمنتجات المخفي سعرها) */
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-inq]');if(!b)return;
    e.stopImmediatePropagation();e.preventDefault();
    add(b.dataset.inq);toast('اتضاف لقائمة الاستفسار');
  },true);

  /* زرار في نافذة المنتج (لأي منتج) */
  const _open=openProduct;
  openProduct=function(i){
    _open(i);
    const p=P[i];const body=document.querySelector('#scrim .sheet .body');if(!body)return;
    const b=document.createElement('button');b.type='button';b.className='btn add-cart inq-add';b.textContent='أضف لقائمة الاستفسار';
    b.onclick=()=>{add(p.pid);closeProduct();toast('اتضاف لقائمة الاستفسار')};
    const wa=body.querySelector('a.btn');body.insertBefore(b,wa);
  };

  /* لما الكتالوج يتحمّل، شيل من القائمة أي منتج اختفى */
  const _set=setCatalog;
  setCatalog=function(l){_set(l);let ch=false;Object.keys(list).forEach(id=>{if(!byPid(id)){delete list[id];ch=true}});if(ch)save();refreshBar()};
  new MutationObserver(refreshBar).observe(cartBar()||document.body,{attributes:true,attributeFilter:['hidden']});
  refreshBar();
})();
