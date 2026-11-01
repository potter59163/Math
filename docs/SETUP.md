# ตั้งค่าเพื่อเปิดใช้จริง

แอปรันได้แล้วแบบไม่ล็อกอิน ขั้นตอนนี้เปิด Google login, ตารางอันดับ, การเก็บข้อมูล และ AI คิว ใช้เวลาราว 30 นาที ทุกขั้นต้องทำด้วยบัญชีของคุณเอง อย่าส่งคีย์ใดๆ ในแชต

จะได้ค่าไปใส่ใน Vercel ทั้งหมด 5 ค่า: `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LLM_PROVIDER`, `LLM_API_KEY` repo นี้เป็น public จึงห้ามใส่ค่าเหล่านี้ลงไฟล์ที่ commit

## 1. MongoDB Atlas (ฐานข้อมูล)
1. สมัครที่ mongodb.com/cloud/atlas แล้วสร้าง Cluster แบบ **Free** เลือก **AWS** และ **Singapore** ถ้าแบบ Free ไม่มี Singapore ให้เลือกที่ใกล้ไทยที่สุด
2. เปิด **Database Access** เพิ่มผู้ใช้แบบ Password กด Autogenerate จะได้รหัสที่ไม่มีอักขระแปลกๆ เลือกสิทธิ์ **Read and write to any database**
3. เปิด **Network Access** เพิ่ม `0.0.0.0/0` (Allow access from anywhere) เพราะ Vercel ไม่มี IP ตายตัว ด่านเดียวจึงเป็นรหัสผ่านในขั้นถัดไป
4. กด **Connect → Drivers** คัดลอกค่าที่ขึ้นต้นด้วย `mongodb+srv://` แล้วใส่รหัสจริงแทน `<db_password>` ค่านี้คือ `MONGODB_URI`
   - **ห้ามเผยแพร่:** ใครมีค่านี้อ่านและแก้ข้อมูลนักเรียนได้ทั้งหมด
5. เปิด **Backup** ของ Cluster ก่อนวันทดลอง Atlas จะเก็บข้อมูลสำรองวันละครั้ง ย้อนได้ 4 ครั้ง

ไม่ต้องสร้างตารางเอง แอปสร้าง collection และ index ให้ตอนมีคนใช้ครั้งแรก

## 2. Google login
1. เปิด console.cloud.google.com สร้างโปรเจกต์ แล้วไปที่ **APIs & Services → OAuth consent screen**
   - เลือก External กรอกชื่อแอป `Kidma` และอีเมลของคุณ
   - ไม่ต้องเพิ่ม scope ใดๆ แอปขอแค่ `openid` จึงไม่ได้รับอีเมลหรือชื่อของนักเรียนเลย
   - กด Publish ให้เป็น In production เพื่อให้นักเรียนทุกคนล็อกอินได้
2. ไปที่ **Credentials → Create Credentials → OAuth client ID** เลือก Web application
   - **Authorized redirect URIs:** เพิ่ม `https://your-app.vercel.app/auth/callback` และ `http://localhost:3000/auth/callback`
3. จด Client ID และ Client secret ไว้ นี่คือ `GOOGLE_CLIENT_ID` และ `GOOGLE_CLIENT_SECRET`

## 3. Vercel (ขึ้นเว็บจริง)
1. สมัครที่ vercel.com ด้วย GitHub แล้ว Import repo นี้ ตั้งชื่อโปรเจกต์ `kidma` ถ้าชื่อนี้มีคนใช้แล้ว Vercel จะให้ URL อื่นมา ให้ใช้ URL ที่ได้จริงแทน `your-app.vercel.app` ทุกที่ในคู่มือนี้
2. ใส่ Environment Variables: `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
3. กด Deploy ถ้า URL จริงไม่ตรงกับที่ใส่ในขั้นที่ 2.2 ให้กลับไปแก้ที่ Google

ลองเปิด URL บนมือถือ กดเข้าสู่ระบบด้วย Google ถ้าเข้าได้และเห็นหน้าตั้งชื่อ แปลว่าครบ ล็อกอินได้เฉพาะ URL ที่ลงไว้กับ Google URL แบบ Preview ของ Vercel จะถูก Google ปฏิเสธ

## 4. AI คิว ใช้ Claude (ไม่บังคับ แต่เป็นจุดขายหลัก)
ถ้าไม่ทำขั้นนี้ แอปใช้ระบบกฎและข้อความที่เขียนเตรียมไว้
1. สมัครที่ platform.claude.com เติมเครดิต แล้วสร้าง API key
2. เพิ่ม Environment Variables ใน Vercel แล้ว Redeploy:
   - `LLM_PROVIDER` = `anthropic`
   - `LLM_API_KEY` = คีย์ที่ได้
   - `LLM_MODEL` ปล่อยว่างได้ ระบบจะใช้ `claude-haiku-5-5` ซึ่งเร็วพอกับเวลา 4 วินาที ค่าใช้จ่ายราว $0.0003 ต่อคำตอบ (คำนวณจากราคา ยังไม่ได้วัดจริง)
3. ทดสอบก่อนใช้จริงด้วยคำสั่งนี้ ซึ่งใช้เงินจริงเล็กน้อย แล้วอ่าน `eval-report.md` **นี่จะเป็นการเรียก Claude จริงครั้งแรกของแอป** ถ้าทุกข้อขึ้น `provider_error` ให้ดูข้อความที่ขึ้นต้นด้วย `tutor:` ในหน้าจอ
   ```bash
   LLM_PROVIDER=anthropic LLM_API_KEY=... npm run eval:director
   ```

## 5. ก่อนทดลองในห้องเรียน
- **ลิงก์ของกลุ่ม:** แจกลิงก์ `https://your-app.vercel.app/?cohort=m5-1` นักเรียนที่เข้าจากลิงก์นี้จะถูกจัดกลุ่มในข้อมูลส่งออก โดยไม่มีใครเห็นรหัสนี้ ใช้ตัวอังกฤษกับตัวเลขจะได้ QR เล็กและลิงก์ไม่เพี้ยนเวลาส่งต่อ รหัสยาวเกิน 32 ตัวจะถูกทิ้ง นักเรียนยังเข้าเรียนได้แต่ไม่ถูกจัดกลุ่ม
- **LINE:** ลิงก์ที่เปิดจาก LINE หรือ Facebook ล็อกอิน Google ไม่ได้ แอปจะบอกให้เปิดในเบราว์เซอร์เอง
- **บัญชีโรงเรียน:** บัญชี Google ของโรงเรียนบางแห่งถูกปิดไม่ให้ล็อกอินแอปภายนอก ให้ลองล่วงหน้า ถ้าติดให้ใช้บัญชีส่วนตัวหรือโหมดลองเรียน
- **ทำแบบทดสอบผิดเวลา:** แบบทดสอบทำได้อย่างละครั้งและไม่มีปุ่มรีเซ็ต ถ้านักเรียนทำ post-test ก่อนถึงเวลา ให้เปิด **Browse Collections** ใน Atlas แล้วทำตามนี้ จากนั้นนักเรียนทำใหม่ได้
  1. ใน `profiles` หาแถวจากชื่อที่นักเรียนตั้ง แล้วจดค่า `_id`
  2. ใน `assessments` ค้นด้วย `{ "user_id": "<_id>", "phase": "post" }` จดค่า `_id` ของแถวนั้น แล้วลบแถวนั้น
  3. ใน `assessment_responses` ค้นด้วย `{ "assessment_id": "<_id ของแถวที่ลบ>" }` แล้วลบทุกแถวที่ขึ้นมา
- **ข้อจำกัดของแบบ Free:** เก็บได้ 0.5 GB และรับได้ 100 คำสั่งต่อวินาที เกินแล้ว Atlas จะหน่วงให้ช้าลงชั่วครู่ จากที่วัดในเครื่อง หนึ่งคำตอบใช้ราว 7 คำสั่ง และการเข้าครั้งแรกใช้ราว 16 คำสั่งต่อคน ห้อง 40 คนที่ตอบคนละข้อต่อนาทีจึงใช้แค่ราว 5 คำสั่งต่อวินาที มีแค่ตอนทั้งห้องเริ่มในวินาทีเดียวกันที่อาจช้าไปไม่กี่วินาที ตัวเลขนี้ยังไม่ได้วัดบน Atlas จริง

## 6. ส่งออกข้อมูลวิจัย (หลังทดลอง)
ใส่ค่า `MONGODB_URI` ใน `.env.local` แล้วรันคำสั่งนี้ทันทีหลังทดลองทุกครั้ง ไฟล์จะอยู่ในโฟลเดอร์ `exports/` ซึ่งไม่ถูก commit ไฟล์ไม่มีชื่อหรือบัญชี Google ใช้รหัส S-1, S-2 แทน
```bash
npm run export -- m5-1
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

**ก่อนวันเดโม 14 ม.ค.:** Atlas จะพัก Cluster แบบ Free เองถ้าไม่มีใครเชื่อมต่อ 30 วัน ซึ่งอาจเกิดระหว่างจบทดลองกับวันเดโม ให้เปิด Atlas แล้วกด Resume ล่วงหน้า

## ทดสอบในเครื่องโดยไม่ใช้บัญชีจริง
เทสต์ของฐานข้อมูลรันบน MongoDB จริง ถ้าไม่ตั้ง `TEST_MONGODB_URI` เทสต์ชุดนี้จะถูกข้าม ต้องมี Docker เปิดอยู่
```bash
docker run -d --name kidma-mongo-test -p 127.0.0.1:27099:27017 mongo:8
```
```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27099 npm test
```
เทสต์สร้างฐานข้อมูลชื่อ `kidma_test_...` ของตัวเองแล้วลบทิ้งตอนจบ ใช้เสร็จแล้วลบ container ได้
```bash
docker rm -f kidma-mongo-test
```
