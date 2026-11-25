/* ===== إعدادات الموقع (الملف ده بيتحمّل في الموقع وفي لوحة التحكم) ===== */

/* رابط الـAPI (الـWorker على Cloudflare). مش هتحتاج تغيّره غير لو نقلت الـWorker. */
const API_BASE='https://noah-api.hosnynasser843.workers.dev';

/* ✏️✏️ بيانات المحل: دي لسه بيانات وهمية لازم تتغير ✏️✏️
   - phone: رقم التليفون (للمكالمات)
   - whatsapp: رقم الواتساب بصيغة دولية من غير + ومن غير صفر (مصر: 20 وبعدها الرقم من غير الصفر). مثال: 201012345678
   - address + mapUrl: العنوان ورابط الخريطة (افتح المحل على Google Maps > مشاركة > انسخ الرابط)
   ممكن تغيّرهم من لوحة التحكم (تبويب "بيانات المحل") من غير ما تفتح الكود، وهي اللي بتتغلب على القيم اللي هنا. */
const SHOP={
  name:'نوح',
  phone:'01015753384',
  whatsapp:'201119907829',          // بصيغة دولية من غير + (مصر = 20)
  address:'الجيزة - الصف - قرية غمازة الكبرى امام المسجد الغربي',
  hours:'كل يوم من 9 صباحًا لـ 11 مساءً',
  mapUrl:'https://www.google.com/maps/search/?api=1&query=29.708078%2C31.296089'
};

const CATS=[
 {id:'light',name:'إضاءة',icon:'bulb'},
 {id:'cable',name:'أسلاك وكابلات',icon:'cable'},
 {id:'switch',name:'مفاتيح وأفياش',icon:'plug'},
 {id:'breaker',name:'قواطع وحماية',icon:'breaker'},
 {id:'hand',name:'عدد يدوية',icon:'hammer'},
 {id:'power',name:'عدد كهربائية',icon:'drill'},
 {id:'fix',name:'مسامير وتثبيت',icon:'screw'},
 {id:'lock',name:'أقفال وأمان',icon:'lock'},
 {id:'test',name:'قياس واختبار',icon:'gauge'}
];
/* الأقسام: لو ضفت قسم جديد هنا هيظهر في الموقع وفي لوحة التحكم. icon من: bulb cable plug breaker hammer drill screw lock gauge */
const CAT=Object.fromEntries(CATS.map(c=>[c.id,c]));
