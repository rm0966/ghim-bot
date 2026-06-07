# Ghim🌧 — Discord Bot

بوت ديسكورد ذكي بشخصية بنت اسمها Ghim🌧، يعمل بالذكاء الاصطناعي المجاني عبر Replit.

## الأوامر المتاحة

| الأمر | الوظيفة |
|-------|---------|
| `/chat` | كلّم Ghim وهي ترد |
| `/private` | محادثة خاصة (تظهر لك بس) |
| `/summarize` | تلخيص أي نص |
| `/remind` | تذكير بعد وقت معين |
| `/note` | حفظ وإدارة الملاحظات |
| `/history` | عرض آخر المحادثات |
| `/clear` | مسح سجل المحادثة |
| `/nickname` | إضافة/حذف ألقاب تنشّط البوت |
| `/game` | ألعاب: حجر ورقة مقص، خمّن الرقم، تريفيا، نكتة |
| `/ping` | التحقق من حالة البوت |

## طريقة التشغيل على Replit (مجاناً)

### 1. سوّي بوت Discord جديد
1. افتح [Discord Developer Portal](https://discord.com/developers/applications)
2. اضغط **New Application** واختار اسم
3. روح لـ **Bot** ← اضغط **Add Bot**
4. فعّل **Message Content Intent** (ضروري)
5. اضغط **Reset Token** وانسخ التوكن

### 2. شغّله على Replit
1. سجّل دخول على [replit.com](https://replit.com)
2. اضغط **+ Create Repl** ← **Import from GitHub**
3. الصق رابط هذا الريبو
4. بعد الاستيراد، روح لـ **Secrets** (قفل على اليسار)
5. أضف Secret جديد:
   - **Key:** `DISCORD_BOT_TOKEN`
   - **Value:** التوكن اللي نسخته من Discord
6. اضغط **Run**

### 3. أضف AI Integration
1. في Replit، اضغط على **Extensions** أو **Tools**
2. ابحث عن **OpenAI** integration وفعّله (مجاني)

### 4. ادعو البوت لسيرفرك
1. في Discord Developer Portal ← **OAuth2** ← **URL Generator**
2. حدد: `bot` + `applications.commands`
3. من الصلاحيات: `Send Messages`, `Read Message History`, `Use Slash Commands`
4. انسخ الرابط وافتحه لإضافة البوت لسيرفرك

## ملاحظات
- البوت يرد في DM دائماً
- في السيرفر يرد لما تذكره أو تكتب اسمه (ghim / غيم / قيم)
- يتذكر آخر 20 رسالة لكل مستخدم
