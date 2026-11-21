# نوح — أدوات كهربائية وحدايد

موقع محل نوح: واجهة للزباين + لوحة تحكم بتضيف وتعدّل وتمسح المنتجات وتظهر على الموقع فورًا.
كله على خطط Cloudflare المجانية (Pages + Worker + KV). تكلفة صفر.

## الروابط
- الموقع: https://noah-shop.pages.dev/
- لوحة التحكم: https://noah-shop.pages.dev/admin/ (دخول بيوزر وباسورد)
- الـ API: https://noah-api.hosnynasser843.workers.dev

## هيكل المشروع
```
index.html            الصفحة الرئيسية للزباين
assets/
  style.css           التصميم والألوان
  config.js           الإعدادات: رابط الـ API، بيانات المحل، الأقسام
  products.seed.js    منتجات تجريبية (بتظهر لو الـ API مش متاح)
  search.js           البحث (المرادفات SYN في أول الملف)
  background.js       خلفية الصفحة
  app.js              عرض المنتجات وزرار الواتساب
  logo.webp, og-image.png, icon-*.png
admin/                لوحة التحكم (index.html, admin.css, admin.js)
worker/               كود الـ API (worker.js) وإعداد wrangler.toml
manifest.webmanifest, robots.txt, sitemap.xml, _headers
```

## لازم تغيّر دول (حاليًا أرقام وهمية)
1. رقم التليفون، رقم الواتساب، العنوان، لينك الخريطة.
   - الأسهل: من لوحة التحكم، تبويب "بيانات المحل". بيتحفظ ويظهر فورًا.
   - أو من `assets/config.js` (الكائن SHOP).
2. في `index.html` جوه كتلة `<noscript>` فيه رقمين مكتوبين ثابت: `01000000000` و `201000000000`. غيّرهم يدويًا.
3. المنتجات التجريبية (43 منتج): في اللوحة زرار يمسح كل المنتجات التجريبية مرة واحدة. بعدها ضيف منتجاتك الحقيقية بصورها.

## تعديل المنتجات
من لوحة التحكم: إضافة / تعديل / حذف (الاسم، السعر، الصور، القسم). الحفظ فوري.
الأقسام نفسها في `assets/config.js` (CATS).

## تعديل الكود
عدّل الملفات في GitHub مباشرة أو على جهازك واعمل push على main. Cloudflare Pages بينشر تلقائيًا (لو الربط شغال).
مفيش build: الملفات بتترفع زي ما هي.

## الـ Worker
- المنتجات في KV اسمه `noah-shop-kv`، والصور بتتخزن فيه برضه.
- المديرين (يوزر + باسورد متشفّر PBKDF2) متخزنين في KV تحت المفتاح `admins`. الجلسات 30 يوم.
- نشر تعديل في worker.js: `cd worker && npx wrangler deploy`.

## المديرين
من تبويب "المديرين" في اللوحة: إضافة مدير، مسح، تغيير اليوزر أو الباسورد. مينفعش تمسح آخر مدير.
لو نسيت كل الباسوردات: امسح المفتاح `admins` من KV (`npx wrangler kv key delete admins --binding SHOP_KV --remote`)، وحط سر مؤقت `npx wrangler secret put ADMIN_CODE`، وادخل بيوزر `admin` والباسورد اللي كتبته. بعدها غيّر الباسورد وامسح السر (`npx wrangler secret delete ADMIN_CODE`).

## ملاحظات
- لو غيّرت رابط الموقع، غيّره كمان في وسوم og/canonical في index.html وفي sitemap.xml و robots.txt.
- الحدود المجانية كفاية لمحل صغير.
