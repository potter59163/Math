# เริ่มตรงนี้: ชุดเอกสารสร้างแอปสอนคณิตศาสตร์ ม.ปลาย ด้วย Claude Code

ชุดนี้คือ spec ที่ให้ Claude Code สร้างแอปสอนคณิตศาสตร์ ม.ปลาย แบบ adaptive โดยเริ่มจากเรื่องเมทริกซ์ ตามที่คุยกันไว้
- เส้นทางเรียนสไตล์ Duolingo
- animation ที่ใช้ตัวเลขของนักเรียนเอง
- จับความเข้าใจผิดได้ 18 แบบ
- เข้าด้วย Google มีหน้าบทเรียน อันดับ โปรไฟล์ ตั้งค่า (ขั้นตอนตั้งค่าอยู่ที่ `docs/SETUP.md`)
- AI "คิว" จัดบทเรียนให้แต่ละคน โดยไม่ให้ AI คิดเลขเอง

แอปยังไม่มีชื่อจริง ตอนนี้ใช้คำชั่วคราวว่า "คณิตศาสตร์ ม.ปลาย" ส่วนชื่อติวเตอร์ ("คิว") ก็เป็นชื่อชั่วคราว เปลี่ยนได้ที่ `lib/config.ts` (ห้ามใช้ QEDify เพราะชื่อซ้ำกับงานอื่น และอย่าตั้งชื่อตามตัวละครที่มีเจ้าของ เช่น Jarvis)

## ไฟล์ในชุดนี้
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `CLAUDE.md` | Claude Code โหลดอัตโนมัติทุก session: กฎเหล็ก stack คำสั่ง โครงโฟลเดอร์ |
| `.claude/rules/*.md` | กฎเฉพาะส่วน (engine, director/API, UI) โหลดเฉพาะตอนแก้ไฟล์ส่วนนั้น |
| `docs/PLAN.md` | phase 0–9 พร้อม acceptance, วัน go/no-go, ลำดับการตัด |
| `docs/SPEC.md` | ภาพรวม flow learner model data model API privacy |
| `docs/MISCONCEPTIONS.md` | ความเข้าใจผิด 23 แบบ (MVP 18) พร้อมสูตรและตัวอย่างที่คำนวณแล้ว |
| `docs/SCENES.md` | animation templates |
| `docs/AI_DIRECTOR.md` | ระบบกฎ + สัญญากับ LLM + prompt + validator |
| `docs/RESEARCH.md` | ข้อสอบ pre/post, ขั้นตอนทดลอง, การวิเคราะห์, เอกสารอ้างอิง |
| `docs/DECISIONS.md` | บันทึกการตัดสินใจ (ใช้เตรียมตอบกรรมการ) |
| `.env.example` | ตัวแปรที่ต้องตั้ง |

## เตรียมก่อนเริ่ม
- **ติดตั้ง:** Node.js (LTS), git, Python 3 (ใช้ตอน Phase 9)
- **บัญชีฟรี:** Supabase (เลือก region Singapore) และ Vercel
- **API key LLM 1 เจ้า:** Gemini, Claude หรือ OpenAI ใช้ตอน Phase 6 ส่วน phase ก่อนหน้าไม่ต้องใช้

## วิธีเริ่ม
1. แตก zip จะได้โฟลเดอร์ `qedify-matrix`
2. ใน terminal: `cd qedify-matrix && git init && git add . && git commit -m "docs: spec kit"`
3. เปิด Claude Code ในโฟลเดอร์นี้
4. วาง prompt ด้านล่างทีละอัน **1 phase = 1 session ใหม่** (หรือพิมพ์ `/clear` ก่อนเริ่ม phase ถัดไป)

## Prompts (copy ไปวางได้เลย)

**Session แรก: เปิด plan mode ก่อน (ให้ Claude อ่านอย่างเดียว ยังไม่แก้ไฟล์)**
```
อ่าน CLAUDE.md, docs/PLAN.md และ docs/SPEC.md ให้ครบ แล้ว
1) สรุปสิ่งที่จะสร้างไม่เกิน 10 บรรทัด
2) ลิสต์จุดที่ spec ไม่ชัด ขัดกันเอง หรือดูแล้วทำไม่ทันตามแผน
3) วางแผน Phase 0 เป็นขั้นๆ
ยังไม่ต้องแก้ไฟล์ใดๆ
```
ตอบคำถามที่มันถาม → approve แผน → แล้วสั่ง:
```
ทำ Phase 0 ตามแผน จบแล้วรัน npm run check แปะผล tick docs/PLAN.md และ commit
```

**Phase 1: Math engine**
```
ทำ Phase 1 ใน docs/PLAN.md โดยอ่าน docs/MISCONCEPTIONS.md ทั้งไฟล์ก่อน
- เขียน test จากตัวอย่างใน MISCONCEPTIONS.md ก่อน (ตัวเลขต้องตรงทุกตัว) แล้วค่อย implement
- property test ทุก generator × level อย่างน้อย 1000 runs
- ทำหน้า /dev/engine
จบแล้วรัน npm run check แปะผล บอกว่า misconception ★ ตัวไหนยังมีปัญหาหรือต้องให้ผมตัดสินใจ แล้ว tick PLAN.md และ commit
```

**Phase 2: Practice UI**
```
ทำ Phase 2 ใน docs/PLAN.md (อ่าน SPEC §4, §5, §9, §11)
ออกแบบให้มือถือ 360px ก่อน ใช้ keypad ของแอปเอง ข้อความไทยทั้งหมดอยู่ใน lib/content/th.ts และที่ร่างใหม่ให้ติด // TODO(review)
จบแล้วรัน npm run check เช็คหน้าจอ 360px กับ desktop tick PLAN.md และ commit
```

**Phase 3: Scenes**
```
ทำ Phase 3 ใน docs/PLAN.md โดยอ่าน docs/SCENES.md ทั้งไฟล์
เริ่มจาก ScenePlayer + row_col_dot ให้ครบทั้งเส้นทางก่อน (ตอบผิด → SceneSpec → เล่นด้วยตัวเลขของข้อนั้น) แล้วค่อยทำ template อื่น
ตัวเลขทุกตัวใน scene ต้องมาจาก engine จบแล้วรัน npm run check ทำ /dev/scenes ให้ผมดู tick PLAN.md และ commit
```

**Phase 4: Learner model + rules director**
```
ทำ Phase 4 ใน docs/PLAN.md (อ่าน SPEC §4, §6, §7 และ docs/AI_DIRECTOR.md §2–3)
test BKT ด้วยตัวเลขตัวอย่างใน SPEC §7.1 และทำ simulated learners + npm run sim
จบแล้วแปะผล npm run check และ npm run sim tick PLAN.md และ commit
```

**Phase 5: Backend + ครู + deploy**
```
ทำ Phase 5 ใน docs/PLAN.md (อ่าน SPEC §12–15 และ .claude/rules/director.md)
ถ้าผมยังไม่ได้สร้าง Supabase หรือใส่ .env.local ให้บอกขั้นตอนที่ผมต้องทำเองทีละขั้นก่อน
ต้องมี test ยืนยันว่านักเรียนอ่านข้อมูลคนอื่นไม่ได้ และช่วยผม deploy ขึ้น Vercel (บอกให้ชัดว่าขั้นไหนผมต้องกดเอง)
จบแล้วรัน npm run check tick PLAN.md และ commit
```

**Phase 6: LLM director**
```
ทำ Phase 6 ใน docs/PLAN.md โดยอ่าน docs/AI_DIRECTOR.md ทั้งไฟล์ ใช้ LLM_PROVIDER=[gemini/anthropic/openai] ที่ผมใส่ key ไว้แล้ว
validator ต้องเข้มตาม §4.3 และต้องมี test ของทุก fallback_reason ทำ scenarios 20 ชุดกับ npm run eval:director
จบแล้วสรุป eval (valid %, latency p50/p95, ตัวอย่างข้อความ 5 อัน) tick PLAN.md และ commit
```

**Phase 7: Assessment**
```
ทำ Phase 7 ใน docs/PLAN.md (อ่าน docs/RESEARCH.md §4–5) ทำหน้า preview/print ฟอร์ม A/B พร้อมเฉลยให้ผมเอาไปให้ครูตรวจ
จบแล้วลองทำ pre → learn → post ด้วยนักเรียนทดสอบ 1 คน แปะตัวอย่าง research_wide.csv tick PLAN.md และ commit
```

**Phase 8: Hardening** (ก่อนทดลอง)
```
ทำ Phase 8 ใน docs/PLAN.md: load test 40 คน, DEMO_MODE, freeze generatorVersion และ /demo/split ถ้าทันเวลา
แปะผล load test (latency, error rate) พร้อม checklist ที่ผมต้องทำเอง
```

**Phase 9: Analysis** (หลังทดลอง)
```
ทำ Phase 9 ใน docs/PLAN.md (อ่าน docs/RESEARCH.md §5–6) เริ่มจากข้อมูลปลอมที่รู้คำตอบล่วงหน้า เขียน test ว่า analyze.py คำนวณถูก แล้วค่อยรันกับข้อมูลจริงใน exports/
```

**ใช้ก่อนปิดทุก phase: review ด้วย context ใหม่**
```
ใช้ subagent review diff ของ phase นี้เทียบกับ docs/PLAN.md และ docs ที่เกี่ยวข้อง ว่า requirement ครบไหม มี test ครอบ edge case ที่ระบุไว้ไหม และมีอะไรหลุดนอก scope ไหม
รายงานเฉพาะ gap ที่กระทบความถูกต้องหรือ requirement แล้วแก้ให้
```

## ทริคใช้ Claude Code
- **plan mode ก่อนลงมือ:** ใช้กับ phase ใหญ่ ให้มันอ่านและวางแผนก่อน approve แล้วค่อยลงมือ
- **ขอหลักฐาน ไม่ใช่คำว่า "เสร็จแล้ว":** ให้แปะผล test หรือ screenshot
- **แก้เรื่องเดิม 2 รอบแล้วยังไม่หาย:** `/clear` แล้วเขียน prompt ใหม่ที่บอกสิ่งที่เรียนรู้มา
- **ถ้า spec ผิดหรือไม่ชัด ให้มันถามก่อน:** อย่าให้แก้ docs เองเงียบๆ
- **commit ทุก phase:** จะได้ย้อนกลับได้

## งานที่ Potter ต้องทำเอง (Claude Code ทำแทนไม่ได้)
- [ ] **ภายในจันทร์ 2 พ.ย. (สำคัญที่สุด):**
  - หาครูคณิตเป็นที่ปรึกษา (เซ็นแบบเสนอและเป็นผู้ประสานงาน)
  - ขอห้องทดลอง 2 คาบในช่วง 13–19 พ.ย.
  - ถ้ายังหาห้องไม่ได้ อย่ารอถึง 12 พ.ย. ค่อยตัดสินใจ
  - ถามครูว่านักเรียนเรียนเมทริกซ์ถึงไหนแล้ว และตกลงว่าจะเปิด unit ไหนในการทดลอง (ดู `docs/RESEARCH.md` §3.1)
- [ ] **สมัครบริการ:** Supabase, Vercel และ API key LLM
- [ ] **ตรวจเนื้อหา:** ตรวจข้อความไทยและความถูกต้องทางคณิตในส่วนที่ติด `TODO(review)` และให้ครูดูด้วย
- [ ] **ข้อสอบ:** ส่งฟอร์ม A/B ให้ครูตรวจ (ถ้าได้ IOC จากครู 3 คนจะดีมาก)
- [ ] **ขออนุญาต:** ขออนุญาตโรงเรียน + ใบยินยอม (ดูข้อความร่างใน SPEC §15)
- [ ] **ทดสอบเน็ต:** ลองแอปบนเน็ตโรงเรียนกับมือถือจริงก่อน 12 พ.ย.
- [ ] **ระหว่างทดลอง:** จดสังเกต และห้ามช่วยนักเรียนตอบ
- [ ] **20–26 พ.ย. ทำของส่ง:**
  - แบบเสนอ 1 หน้า A4
  - โปสเตอร์ A0 ใช้เทมเพลตประเภทนักเรียน (สีชมพู) ดูที่ป้ายมุมขวาบน เพราะชื่อไฟล์ในโฟลเดอร์ผู้จัดสลับกัน
  - วิดีโอ ≤ 3 นาที
- [ ] **เข้าใจทุกส่วนที่ Claude Code เขียน:** วันที่ 14 ม.ค. ต้องตอบกรรมการเอง ให้อ่าน `docs/DECISIONS.md` และสั่งให้ Claude Code อธิบายส่วนที่ไม่เข้าใจ
