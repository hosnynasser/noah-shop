/* البحث الذكي: المرادفات + فهم الجملة والأسعار + التصحيح. (ملف مستقل عن الـDOM) */
/* مرادفات: كلمات بمعنى واحد (بالعامية والفصحى والإنجليزي) */
const SYN=[
 ['لمبة','لمبات','ليد','led','اضاءة','كشاف','سبوت','مصباح'],
 ['مفك','مفكات','screwdriver'],
 ['شاكوش','مطرقة','شواكيش'],
 ['سلك','اسلاك','سلوك','كابل','كابلات','وير','وايرات'],
 ['فيشة','فيش','بريزة','بريز','افياش','مقبس'],
 ['مشترك','وصلة','تمديد','موزع','برايز'],
 ['قاطع','فيوز','بريكر','قواطع','طبلون','لوحة'],
 ['دريل','شنيور','مثقاب','حفر'],
 ['صاروخ','جلاخة'],
 ['قفل','كالون'],
 ['افوميتر','ملتيميتر','فاحص','قياس'],
 ['كماشة','بنسة','زرادية','بنس'],
 ['مسمار','مسامير','براغي','برغي'],
 ['رولبلج','بلج','رول'],
 ['عازل','ايزولاسيون','لاصق'],
 ['ديمر','دمر','تخفيت'],
 ['ميزان','تسوية']
];
const STOP=new Set(['عايز','عاوز','عايزه','عاوزه','محتاج','محتاجه','ورني','فين','في','من','علي','لو','سمحت','ده','دي','انا','عندك','عندكم','هل','يوجد','ممكن','حاجه','شويه','يا','و','او','مع','بتاع','بتاعه','نوع','جنيه','جنيها','بجنيه','ج','م','جم','للبيت','حلو','كويس','ال','لي','عن','الي','ب']);

/* ---- تطبيع النص العربي (حرف بحرف عشان التظليل يشتغل) ---- */
const DIAC=/[\u064B-\u065F\u0670\u0640]/g;
function fold(s){
  return String(s).toLowerCase().replace(DIAC,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}
const WORD=/[\u0621-\u064Aa-z0-9]+/g;
const words=s=>fold(s).match(WORD)||[];
function stem(w){
  if(w.length>4&&w.startsWith('ال'))w=w.slice(2);
  if(w.length>4&&w.endsWith('ات'))w=w.slice(0,-2);
  else if(w.length>3&&w.endsWith('ه'))w=w.slice(0,-1);
  return w;
}
const wl=s=>words(s).map(stem);

/* خريطة المرادفات */
const GROUPS=SYN.map(g=>new Set(g.map(w=>stem(fold(w)))));
const SYNMAP=new Map();
GROUPS.forEach((g,gi)=>g.forEach(w=>{if(!SYNMAP.has(w))SYNMAP.set(w,[]);SYNMAP.get(w).push(gi)}));
function expand(st){
  const out=new Set([st]);
  (SYNMAP.get(st)||[]).forEach(gi=>GROUPS[gi].forEach(w=>out.add(w)));
  return out;
}

/* فهرسة المنتجات + قاموس للتصحيح. بتتنده كل ما المنتجات تتحمّل من الـAPI */
let P=[];
let DISPLAY=new Map(); // جذر الكلمة -> الكلمة الأصلية
let VOCAB=[];
function indexProducts(list){
  P=list.map((p,i)=>({
    pid:p.id,id:i,name:String(p.name||''),cat:p.cat,brand:String(p.brand||''),
    price:p.ph?0:+p.price||0,old:p.ph?0:+p.old||0,ph:!!p.ph,stock:p.stock!==false,tags:String(p.tags||''),desc:String(p.desc||''),
    images:Array.isArray(p.images)?p.images:[],sample:!!p.sample
  }));
  DISPLAY=new Map();
  P.forEach(p=>{
    p.catName=(CAT[p.cat]||{name:'أخرى'}).name;
    p.f={name:wl(p.name),tags:wl(p.tags),cat:wl(p.catName),brand:wl(p.brand),desc:wl(p.desc)};
    (p.name+' '+p.tags+' '+p.catName).split(/\s+/).forEach(w=>{
      const clean=w.replace(/[()\-]/g,'');if(!clean)return;
      const s=stem(fold(clean));if(s.length>=3&&!DISPLAY.has(s)&&!/^\d+$/.test(s))DISPLAY.set(s,clean);
    });
  });
  VOCAB=[...DISPLAY.keys()];
}

function lev(a,b){
  if(a===b)return 0;
  if(Math.abs(a.length-b.length)>2)return 9;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const cur=[i];
    for(let j=1;j<=b.length;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    prev=cur;
  }
  return prev[b.length];
}

/* ---- فهم الجملة: الأسعار والكلمات المفتاحية ---- */
function parseQuery(raw){
  let s=' '+fold(raw)+' ';
  const chips=[];let m;
  if((m=s.match(/(?:من\s*)?(\d+)\s*(?:الي|حتي)\s*(\d+)/))){
    const a=+m[1],b=+m[2];s=s.replace(m[0],' ');
    chips.push({k:'range',label:`من ${Math.min(a,b)} إلى ${Math.max(a,b)} ج.م`,fx:{min:Math.min(a,b),max:Math.max(a,b)}});
  }
  if((m=s.match(/(?:اقل من|اقل|تحت|لحد|حتي|بحد اقصي|ما يزيدش عن|مايزيدش عن|ميزيدش عن|مش اكتر من|مش اكتر)\s*(\d+)/))){
    s=s.replace(m[0],' ');chips.push({k:'max',label:`أقل من ${+m[1]} ج.م`,fx:{max:+m[1]}});
  }
  if((m=s.match(/(?:اكتر من|اكثر من|اكتر|اكثر|فوق|اعلي من)\s*(\d+)/))){
    s=s.replace(m[0],' ');chips.push({k:'min',label:`أكثر من ${+m[1]} ج.م`,fx:{min:+m[1]}});
  }
  if((m=s.match(/(?:^|\s)(رخيص|رخيصه|ارخص|ارخصهم|اقتصادي|اقتصاديه|توفير)(?=\s)/))){
    s=s.replace(m[0],' ');chips.push({k:'cheap',label:'الأرخص أولًا',fx:{cheap:true}});
  }
  if((m=s.match(/(?:^|\s)(متوفر|متوفره|موجود|موجوده|متاح|متاحه)(?=\s)/))){
    s=s.replace(m[0],' ');chips.push({k:'stock',label:'المتوفر فقط',fx:{stock:true}});
  }
  const tokens=[];
  words(s).forEach(w=>{
    if(STOP.has(w))return;
    const st=stem(w);if(!st||STOP.has(st))return;
    tokens.push({raw:w,stem:st,isNum:/^\d+$/.test(st),forms:expand(st)});
  });
  return {tokens,chips};
}

/* ---- تقييم منتج لكلمة ---- */
const FW={name:3,tags:2.5,cat:2,brand:2,desc:1};
function scoreToken(p,t){
  let total=0;
  for(const f in FW){
    let best=0;
    for(const w of p.f[f]){
      for(const x of t.forms){
        const exact=x===t.stem;let s=0;
        if(w===x)s=exact?10:7;
        else if(x.length>=2&&w.startsWith(x))s=exact?6:4;
        else if(!t.isNum&&exact&&x.length>=3&&f!=='desc'&&w.includes(x))s=3;
        else if(exact&&!t.isNum&&x.length>=4&&Math.abs(w.length-x.length)<=2&&lev(w,x)<=(x.length>=7?2:1))s=2.5;
        if(s>best)best=s;
      }
    }
    total+=best*FW[f];
  }
  return total;
}
/* كل المنتجات اللي بتطابق الكلمات. لو مفيش منتج فيه كل الكلمات نرجع أقرب نتايج */
function searchAll(tokens){
  if(!tokens.length)return null;
  const rows=P.map(p=>{
    const sc=tokens.map(t=>scoreToken(p,t));
    return {p,score:sc.reduce((a,b)=>a+b,0),all:sc.every(x=>x>0),any:sc.some(x=>x>0)};
  });
  const full=rows.filter(r=>r.all);
  if(full.length)return {map:new Map(full.map(r=>[r.p.id,r.score])),loose:false};
  const some=rows.filter(r=>r.any);
  return {map:new Map(some.map(r=>[r.p.id,r.score])),loose:true};
}
/* "قصدك؟": أقرب كلمة من القاموس للكلمات اللي ملهاش نتيجة */
function didYouMean(tokens){
  const out=[];
  tokens.forEach(t=>{
    if(t.isNum||t.stem.length<3)return;
    if(P.some(p=>scoreToken(p,t)>0))return;
    let best=null,bd=9;
    VOCAB.forEach(v=>{const d=lev(t.stem,v);if(d<bd){bd=d;best=v}});
    if(best&&best[0]===t.stem[0]&&bd<=(t.stem.length>=7?2:1))out.push({from:t.raw,to:DISPLAY.get(best)});
  });
  return out;
}
