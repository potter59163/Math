# PLAN

**วันสำคัญ**
- วันนี้: ศุกร์ 30 ต.ค. 2569
- Go/No-go: พฤหัส 12 พ.ย.
- ทดลองในห้อง: 13–19 พ.ย.
- ส่งจริง: พฤหัส 26 พ.ย. (deadline ศุกร์ 27 พ.ย. 16:30)
- ประกาศผลรอบคัดเลือก: 11 ธ.ค.
- นำเสนอรอบตัดสิน: 14 ม.ค. 2570

**การใช้ไฟล์นี้**
- ทำทีละ phase, 1 phase ต่อ 1 session
- tick checkbox เมื่อผ่าน acceptance และแนบหลักฐาน (`npm run check`, screenshot)
- วันที่เป็นเป้า ถ้าช้ากว่าแผนให้ดู "ลำดับการตัด" ท้ายไฟล์

---

## Phase 0: Setup (30–31 ต.ค.)
- [x] Next.js (App Router) + TS strict + Tailwind + ESLint + Prettier + Vitest + fast-check
  - โฟลเดอร์มีไฟล์อยู่แล้ว: scaffold ใน temp dir แล้วย้ายเข้ามา โดยห้ามทับ `CLAUDE.md`, `docs/`, `.claude/`, `.env.example`, `.gitignore` (ถ้าต้อง merge `.gitignore` ให้รวมเนื้อหา)
- [x] สร้างโครงโฟลเดอร์ตาม CLAUDE.md
  - `lib/config.ts` ใส่ค่าตาม SPEC §17
  - `lib/content/th.ts` (โครงเปล่า)
- [x] ฟอนต์ไทยสำหรับ body + ฟอนต์ตัวเลข tabular สำหรับเมทริกซ์ (ผ่าน `next/font`)
- [x] script `npm run check` = typecheck + lint + test
- [x] หน้า `/` แสดงข้อความไทยถูกต้องที่ 360px
- [x] เปิด `/` บนมือถือจริง (Potter ลองเอง)
- **Acceptance:** `npm run check` ผ่าน · เปิด `/` บนมือถือจริงได้ · commit แรก

## Phase 1: Math engine (31 ต.ค.–2 พ.ย.)
- [x] `Rational`, `prng` + `deriveSeed` (SPEC §6), `types`, `parseAnswer` (กฎใน SPEC §5)
- [x] `ops.ts`: add, sub, scalar, mul, transpose, det2, det3, inv2, equals
- [x] generators ของทุก ★ skill (SPEC §3) ครบ 3 ระดับ (L3 ทำทีหลังได้ เพราะ misconception ★ ทุกแบบมีระดับ L1–L2 รองรับ)
- [x] `misconceptions.ts`: ทุก ★ (candidate + applies + scene + hintKey)
- [x] `validateItem` (MISCONCEPTIONS §2), `probeLevel` (MISCONCEPTIONS §4.1), `classify`, `regenerate(itemRef)`, `workedSteps`
- [x] **tests:**
  - ตัวอย่างทุกตัวใน MISCONCEPTIONS.md (ตัวเลขต้องตรง)
  - property ≥ 1000 runs ต่อ generator × level: validate ผ่าน · correct → `correct` · ทุก diagnostic → classify เป็นตัวเอง · A·A⁻¹ = I
  - ทุกแถว × ทุกระดับในตาราง MISCONCEPTIONS §4.1 สร้าง probe ได้ และตัวอย่าง `probeLevel` ตรงทุกตัว
  - golden seeds (regenerate ได้เหมือนเดิม)
- [x] หน้า `/dev/engine`: เลือก skill/level/target/seed → ดูโจทย์, เฉลย, diagnostics, worked steps แล้วลองพิมพ์คำตอบดู classification
- **Acceptance:** `npm run check` ผ่าน · ทุก ★ misconception สร้าง probe ได้และจับได้ · รายงานสรุปว่าตัวไหนยังมีปัญหา (ถ้ามี)

## Phase 2: Practice UI (2–4 พ.ย.)
- [x] `MatrixView`, `MatrixInput`, `Keypad` (ไม่เด้ง keyboard ระบบ ปุ่ม ≥ 44px), choice buttons, dims input
- [x] join แบบ local (ยังไม่มี DB) → `/learn` แผนที่ → `/learn/session` ลูปโจทย์
  - ใช้ rules แบบง่ายไปก่อน: เดินตามลำดับ skill และปรับระดับ
- [x] `FeedbackCard` (ทันที), ปุ่ม "ดูวิธีทำ", hint L1–L3 (ข้อความจาก th.ts), XP/combo, `/summary`
- [x] ข้อความไทยทั้งหมดอยู่ใน `th.ts` และของที่ร่างใหม่ติด `// TODO(review)`
- [x] กด keypad และทำ Unit 3 บนมือถือจริง (Potter ลองเอง)
- **Acceptance:** ทำ Unit 3 จบบนมือถือ 360px ได้ · ไม่มี layout shift ตอนขึ้น feedback · Lighthouse mobile performance ≥ 80

## Phase 3: Scenes (3–6 พ.ย.)
- [x] `ScenePlayer` (beats, แตะไปต่อ, เล่นซ้ำ, ข้าม, progress, reduced-motion, ส่ง scene_view event)
  - scene_view เก็บในเครื่องจนกว่า `/api/event` จะมีใน Phase 5
- [x] Tier A: `row_col_dot`, `dimension_match`, `grid_transform`, `inverse_recipe`, `worked_solution`
- [x] ผูก misconception → scene ตาม MISCONCEPTIONS.md (ถ้ายังไม่มี template ให้ fallback เป็น `worked_solution`)
- [x] intro ของ Unit 1–5 และ concept scene ทุก ★ skill (SCENES §5, §5.1) พร้อมกติกาคลิปนำ (SPEC §4)
  - การข้ามคลิปจาก pre-test รอ Phase 7
- [x] `/dev/scenes` gallery
- [x] (ถ้ามีเวลา) Tier B: `cell_locator`, `transpose_flip`, `sarrus`
- [x] เล่นคลิปบน Android รุ่นล่างจริง 1 เครื่อง (Potter ลองเอง)
- **Acceptance:**
  - ทุก ★ misconception มี scene ที่เล่นด้วยตัวเลขจาก generator ได้
  - scene แก้ความเข้าใจผิด ≤ 25 วิ
  - concept scene ≤ 20 วิ
  - caption ไม่ล้นที่ 360px
  - ลื่นบน Android รุ่นล่างจริง 1 เครื่อง

## Phase 4: Learner model + rules director (5–7 พ.ย.)
- [x] BKT, mastery, สถานะ misconception, ความยาก, interleaving, ติด (SPEC §7) แบบ pure function + tests ตามตัวอย่างใน SPEC
- [x] `candidates.ts` (AI_DIRECTOR §3), `rules.ts`, `fixedPath.ts`, `NextTurn`, `pathStep` (AI_DIRECTOR §3.2), token resolver
- [x] `PathStrip` ใน `/learn/session` และ "เส้นทางของฉัน" บน `/learn` (SPEC §4)
- [x] `lib/sim/`: นักเรียนจำลอง
  - `perfect`
  - `slipper(p)`
  - `buggy(Mxx, fixProb)`: ตอบตาม candidate ของ Mxx และหายจาก bug ด้วยความน่าจะเป็น fixProb หลังดู scene ของเรื่องนั้น
  - `random`
- [x] `npm run sim`: รัน 200 คน × 60 ข้อ ทั้ง adaptive และ fixed แล้วรายงาน items-to-mastery, % bug resolved, จำนวน illegal transition และเทียบจำนวนข้อต่อ skill กับตารางเวลาใน RESEARCH §3.1
- [x] **tests (deterministic seeds):**
  - buggy เจอ probe ภายใน 1 ข้อหลังโดนจับได้ (ยกเว้นครั้งที่ R7 ทำงาน เพราะ .97 ชนะ .90)
  - perfect ไม่เคยได้ remediation scene
  - ไม่มี advance ไป skill ที่ prereq ไม่ครบ (prereq ใน unit ที่ปิดถือว่าผ่าน)
  - มีการทบทวนเกิดขึ้นจริง
  - R7 ทำงาน
  - ตารางตัวอย่างใน SPEC §7.3 ตรงทุกแถว
  - ผ่านครบทุก skill ที่เปิดแล้วยังมีข้อให้ทำ
  - นักเรียนจำลองสองคนที่ตอบต่างกันได้เส้นทางต่างกัน และได้ตัวเลขคนละชุด
  - ทุก `note` ไม่เกิน 40 code units และไม่มีตัวเลข
- [x] `/dev/director`: เลือก scenario แล้วดู candidates และการตัดสินใจ
- **Acceptance:** `npm run check` ผ่าน · `npm run sim` มี illegal transition = 0 · เห็นขั้นใหม่พร้อมเหตุผลบนจอ 360px โดยไม่มี layout shift
- ⚠️ ผล sim ใช้ทดสอบระบบเท่านั้น ห้ามใช้เป็นหลักฐานในแบบเสนอ

> **ทิศทางใหม่ 1 พ.ย. 2569 (Potter):** ตัดหน้าครู เข้าด้วย Google มีแท็บบทเรียน อันดับ โปรไฟล์ ตั้งค่า ทำรวมกันใน Phase 5–7 ด้านล่าง

## Phase 5: Google login + backend + แอปเต็มรูป
- [x] Supabase: migrations ตาม SPEC §13, RLS ทุกตารางไม่มี policy (ตรวจบน Supabase ในเครื่อง)
- [x] Google login, `/welcome` (ชื่อ รูป เรื่องที่สนใจ ยินยอม), โหมดลองเรียน, คำเตือนใน LINE/Facebook
- [x] `/api/sync`: action เดียวกันทั้งสองฝั่ง คิวในเครื่อง ส่งซ้ำได้ ทำงานต่อเมื่อเน็ตหลุด
- [x] แท็บบทเรียน อันดับ โปรไฟล์ ตั้งค่า, ลบบัญชี, ธีมสว่างและมืด
- [x] Export CSV (`npm run export`)
- [ ] Potter สมัคร Supabase, Google OAuth, Vercel ตาม `docs/SETUP.md` แล้ว deploy (`sin1`)
- [ ] ลองบน URL จริงด้วยบัญชี Google จริงและมือถือจริง 2 เครื่องพร้อมกัน
- **Acceptance:**
  - นักเรียน 2 เครื่องใช้งานบน URL จริงพร้อมกันได้
  - test ยืนยันว่านักเรียนอ่านข้อมูลคนอื่นไม่ได้
  - attempts และ decisions ถูกบันทึกครบ

## Phase 6: LLM director
**เป้าหมายหลักของการทดลอง:** AI ที่คิดสดเป็นจุดขายหลัก จึงตั้งใจเปิดใช้ตอนทดลองจริง ถ้าไม่ทันหรือไม่ผ่าน acceptance ให้ทดลองด้วยโหมด rules และเขียนตามจริงในแบบเสนอ

- [x] provider adapter (`LLM_PROVIDER=none|gemini|anthropic|openai`), prompt ตาม AI_DIRECTOR §4.6–4.7, Zod schema, `validateDecision`, timeout, fallback, rate limit ต่อคน
- [x] TutorBubble cross-fade, narration ทับ caption, ข้อความของระบบกฎเมื่อไม่มี LLM
- [x] scenarios 20 ชุด + `npm run eval:director` → `eval-report.md`
- [ ] Potter ใส่ API key แล้วรัน eval กับ LLM จริง
- **Acceptance:**
  - valid ≥ 95%
  - ไม่มีตัวเลขในข้อความถึงนักเรียน
  - p95 latency ≤ timeout หรือ fallback ถูกต้อง
  - ทุกอย่างยังใช้ได้เมื่อ `LLM_PROVIDER=none`

## Phase 7: Assessment
- [x] ฟอร์ม A/B จาก seed คงที่ตาม RESEARCH §4 หน้าสอบไม่มี feedback และไม่มี hint ตรวจที่ server ส่งได้ครั้งเดียว
- [x] counterbalance จากรหัสบัญชี
- [x] ตั้ง P(L₀), การผ่านเร็ว (SPEC §7.1) และการข้ามคลิปนำ (SPEC §4) จาก pre-test · `research_wide.csv`
- [ ] หน้าพิมพ์ฟอร์มพร้อมเฉลยและหน้ากรอกผลสอบกระดาษ (สำรอง): ยังไม่ทำ เพราะเดิมเป็นหน้าของครู
- [ ] ครูตรวจฟอร์ม A/B ก่อนใช้
- **Acceptance:** นักเรียนทดสอบ 1 คนทำ pre → learn → post ครบ แล้ว export มีข้อมูลถูกต้องทุกคอลัมน์ (`pre_Mxx` ที่ไม่มีข้อวัดต้องว่าง ไม่ใช่ 0)

## ⛳ Go/No-go: พฤหัส 12 พ.ย.
**GO เมื่อครบทุกข้อ:**
- [ ] ห้องทดลองยืนยันแล้ว (ครู + วัน/คาบ)
- [ ] Phase 1–5 และ 7 ผ่าน acceptance (Phase 6 ไม่บังคับ ใช้โหมด rules ได้)
- [ ] ใช้ได้บนเน็ตโรงเรียน + มือถือจริง ≥ 3 แบบ
- [ ] ซ้อมกับเพื่อน 3–5 คน (pre → learn → post) แล้วไม่มี bug ร้ายแรง

**NO-GO:** ส่ง QEDify ฟิสิกส์ + เก็บ pre/post ตามแผนเดิมแทน แล้วเก็บแอปนี้ไว้ทำต่อ

**เปิด LLM ตอนทดลองไหม (ไม่ใช่เงื่อนไข GO):** เปิดเมื่อ Phase 6 ผ่าน acceptance, load test ผ่านทั้งที่เปิด LLM และเน็ตโรงเรียนเข้าถึง API ของ LLM ได้ ถ้าไม่ครบให้ใช้โหมด rules

## Phase 8: Hardening (12 พ.ย.)
- [ ] load test จำลองนักเรียน 40 คนพร้อมกัน (script ยิง API และเปิด LLM ถ้าจะใช้ตอนทดลอง)
- [ ] เช็คว่าเน็ตโรงเรียนไม่บล็อก `*.vercel.app`, `*.supabase.co` และ API ของ LLM
- [ ] freeze `generatorVersion` · (ถ้าทำทัน) `/demo/split`
- [ ] พิมพ์ฟอร์ม A/B สำรอง · ทดสอบ export และ backup
- [ ] ลิงก์ `?cohort=` และ QR ของห้องพร้อมใช้

## 🧪 ทดลอง (13–19 พ.ย.) — feature freeze
- [ ] แก้ได้เฉพาะ bug ที่ขวางการใช้งาน (บันทึกทุกครั้งใน DECISIONS.md)
- [ ] export และ backup ทุกวันที่มีการใช้งาน

## Phase 9: Analysis (20–21 พ.ย.)
- [ ] `analysis/analyze.py` + `requirements.txt` ตาม RESEARCH §6 → `analysis/out/report.md` + กราฟ
- [ ] test ด้วยข้อมูลปลอมที่รู้คำตอบล่วงหน้าก่อนรันกับข้อมูลจริง รวมกรณีค่าว่างใน `pre_Mxx`
- **Acceptance:** report ใหม่ทั้งหมดได้จากคำสั่งเดียว และตัวเลขตรวจมือได้

## ✍️ งานส่ง (20–26 พ.ย.): Potter ทำ, Claude Code ช่วยได้
- [ ] แบบเสนอ (7 หัวข้อใน 1 หน้า A4) + ข้อมูลในฟอร์มออนไลน์ต้องตรงกัน
- [ ] โปสเตอร์ A0 จากเทมเพลต**ประเภทนักเรียน (สีชมพู)** · อย่าดูจากชื่อไฟล์ เพราะในโฟลเดอร์ผู้จัดชื่อไฟล์สลับกัน ให้ดูป้ายมุมขวาบน
- [ ] วิดีโอ MP4 ≤ 3 นาที แนวนอน (มีโหมด screen recording ที่ UI สะอาด และ `/demo/split` ช่วยได้)
- [ ] ลิงก์ Google Drive ทุกอันเปิดได้จาก incognito
- [ ] ส่งภายในพฤหัส 26 พ.ย.

---

## ลำดับการตัด (ถ้าช้า ตัดจากบนลงล่าง)
1. เสียงพากย์ และคลิป hook
2. `/demo/split`
3. Tier B scenes (ใช้ `worked_solution` แทน)
4. `ab_split`
5. หน้า "เส้นทางของฉัน" บน `/learn` (คงเหตุผลใน `PathStrip` ไว้)
6. ความสวยงามของ dashboard (ต้องคง export ไว้)
7. ความลึกของ Unit 1–2 (เหลือ L1–L2)
8. concept scene ของ skill ที่ไม่ใช่คลิปแรกของ unit (คง intro ของ unit และปุ่ม "ไม่เข้าใจ" ที่เปิด `worked_solution` ไว้)
9. LLM director เต็มรูปแบบ (ให้ LLM เขียนแค่ข้อความ ส่วนการเลือกทางให้ rules ทำ)

**ห้ามตัด:**
- ความถูกต้องของ engine
- การจับ misconception ★
- logging และ export
- assessment A/B
- `row_col_dot` และ `inverse_recipe`

## หลังส่งงาน (ก่อน 14 ม.ค. ถ้าผ่านรอบคัดเลือก)
- แชท "ถามคิว" (AI_DIRECTOR §8)
- Tier B scenes ที่เหลือ
- เสียงพากย์
- skill `props`
- Unit 6
- เตรียมเดโมสด: โหมด offline + `DEMO_MODE`
- เตรียมตอบคำถามกรรมการ
