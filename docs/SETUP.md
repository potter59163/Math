# ตั้งค่าเพื่อเปิดใช้จริง

แอปรันได้แล้วแบบไม่ล็อกอิน ขั้นตอนนี้เปิด Google login, ตารางอันดับ, การเก็บข้อมูล และ AI คิว ใช้เวลาราว 20 นาที ทุกขั้นต้องทำด้วยบัญชีของคุณเอง อย่าส่งคีย์ใดๆ ในแชต

## 1. Supabase (ฐานข้อมูลและการล็อกอิน)
1. สมัครที่ supabase.com แล้วกด New project เลือก Region เป็น **Southeast Asia (Singapore)**
2. เปิด **SQL Editor** วางเนื้อหาไฟล์ `supabase/migrations/20261101090000_init.sql` ทั้งไฟล์ แล้วกด Run
3. เปิด **Project Settings → API** จดค่า 3 ค่าไว้ใช้ขั้นที่ 3: Project URL, anon key, service_role key
   - **service_role ห้ามเผยแพร่:** คีย์นี้ข้ามสิทธิ์ทั้งหมด repo นี้เป็น public จึงห้ามใส่ลงไฟล์ที่ commit

## 2. Google login
1. เปิด console.cloud.google.com สร้างโปรเจกต์ แล้วไปที่ **APIs & Services → OAuth consent screen**
   - เลือก External กรอกชื่อแอปและอีเมล แล้วกด Publish ให้เป็น In production เพื่อให้นักเรียนทุกคนล็อกอินได้
2. ไปที่ **Credentials → Create Credentials → OAuth client ID** เลือก Web application
   - **Authorized redirect URI:** `https://<project-ref>.supabase.co/auth/v1/callback` (ดู project-ref ได้จาก Project URL)
3. กลับไป Supabase ที่ **Authentication → Providers → Google** เปิดใช้ แล้ววาง Client ID กับ Client secret
4. ไปที่ **Authentication → URL Configuration**
   - **Site URL:** URL จริงจากขั้นที่ 3 เช่น `https://your-app.vercel.app`
   - **Redirect URLs:** เพิ่ม `https://your-app.vercel.app/auth/callback` และ `http://localhost:3000/auth/callback`

## 3. Vercel (ขึ้นเว็บจริง)
1. สมัครที่ vercel.com ด้วย GitHub แล้ว Import repo นี้ ตั้งชื่อโปรเจกต์ตามที่คุณเลือก (อย่าใช้คำว่า QEDify)
2. ใส่ Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key
3. กด Deploy แล้วกลับไปใส่ URL จริงในขั้นที่ 2.4

ลองเปิด URL บนมือถือ กดเข้าสู่ระบบด้วย Google ถ้าเข้าได้และเห็นหน้าตั้งชื่อ แปลว่าครบ

## 4. AI คิว (ไม่บังคับ แต่เป็นจุดขายหลัก)
ถ้าไม่ทำขั้นนี้ แอปใช้ระบบกฎและข้อความที่เขียนเตรียมไว้
1. สมัครขอ API key จากเจ้าใดเจ้าหนึ่ง: Anthropic, Google AI Studio (Gemini) หรือ OpenAI
2. เพิ่ม Environment Variables ใน Vercel แล้ว Redeploy:
   - `LLM_PROVIDER` = `anthropic` หรือ `gemini` หรือ `openai`
   - `LLM_API_KEY` = คีย์ที่ได้
   - `LLM_MODEL` ปล่อยว่างได้ ระบบจะใช้รุ่นเร็วและถูกของเจ้านั้น เช่น `claude-haiku-5-5`
3. ทดสอบก่อนใช้จริงด้วยคำสั่งนี้ ซึ่งใช้เงินจริงเล็กน้อย แล้วอ่าน `eval-report.md`
   ```bash
   LLM_PROVIDER=anthropic LLM_API_KEY=... npm run eval:director
   ```

## 5. ก่อนทดลองในห้องเรียน
- **ลิงก์ของกลุ่ม:** แจกลิงก์ `https://your-app.vercel.app/?cohort=ห้องA` นักเรียนที่เข้าจากลิงก์นี้จะถูกจัดกลุ่มในข้อมูลส่งออก โดยไม่มีใครเห็นรหัสนี้
- **LINE:** ลิงก์ที่เปิดจาก LINE หรือ Facebook ล็อกอิน Google ไม่ได้ แอปจะบอกให้เปิดในเบราว์เซอร์เอง
- **บัญชีโรงเรียน:** บัญชี Google ของโรงเรียนบางแห่งถูกปิดไม่ให้ล็อกอินแอปภายนอก ให้ลองล่วงหน้า ถ้าติดให้ใช้บัญชีส่วนตัวหรือโหมดลองเรียน
- **ทำแบบทดสอบผิดเวลา:** แบบทดสอบทำได้อย่างละครั้งและไม่มีปุ่มรีเซ็ต ถ้านักเรียนทำ post-test ก่อนถึงเวลา ให้ลบแถวนั้นในตาราง `assessments` ผ่าน SQL Editor คำตอบของแถวนั้นจะหายไปด้วย แล้วนักเรียนทำใหม่ได้

## 6. ส่งออกข้อมูลวิจัย (หลังทดลอง)
ใส่ค่า `NEXT_PUBLIC_SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` ใน `.env.local` แล้วรันคำสั่งนี้ ไฟล์จะอยู่ในโฟลเดอร์ `exports/` ซึ่งไม่ถูก commit ไฟล์ไม่มีชื่อหรืออีเมล ใช้รหัส S-1, S-2 แทน
```bash
npm run export -- ห้องA
```

จากนั้นสร้างรายงานและกราฟ ผลอยู่ใน `analysis/out/` ซึ่งไม่ถูก commit ใช้ Python 3.12 ขึ้นไป และเครื่องต้องมีฟอนต์ไทย (macOS มีอยู่แล้ว)
```bash
python3 -m venv .venv
```
```bash
.venv/bin/pip install -r analysis/requirements.txt
```
```bash
.venv/bin/python analysis/analyze.py exports
```

## ทดสอบในเครื่องโดยไม่ใช้บัญชีจริง
ต้องมี Docker เปิดอยู่
```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=local SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=local npx supabase start
```
นำค่า API_URL, ANON_KEY และ SERVICE_ROLE_KEY จากคำสั่ง `npx supabase status` ไปใส่ `.env.local`
