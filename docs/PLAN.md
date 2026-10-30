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
- [ ] เปิด `/` บนมือถือจริง (Potter ลองเอง)
- **Acceptance:** `npm run check` ผ่าน · เปิด `/` บนมือถือจริงได้ · commit แรก

## Phase 1: Math engine (31 ต.ค.–2 พ.ย.)
- [ ] `Rational`, `prng` + `deriveSeed` (SPEC §6), `types`, `parseAnswer` (กฎใน SPEC §5)
- [ ] `ops.ts`: add, sub, scalar, mul, transpose, det2, det3, inv2, equals
- [ ] generators ของทุก ★ skill (SPEC §3) ครบ 3 ระดับ (L3 ทำทีหลังได้ เพราะ misconception ★ ทุกแบบมีระดับ L1–L2 รองรับ)
- [ ] `misconceptions.ts`: ทุก ★ (candidate + applies + scene + hintKey)
- [ ] `validateItem` (MISCONCEPTIONS §2), `probeLevel` (MISCONCEPTIONS §4.1), `classify`, `regenerate(itemRef)`, `workedSteps`
- [ ] **tests:**
  - ตัวอย่างทุกตัวใน MISCONCEPTIONS.md (ตัวเลขต้องตรง)
  - property ≥ 1000 runs ต่อ generator × level: validate ผ่าน · correct → `correct` · ทุก diagnostic → classify เป็นตัวเอง · A·A⁻¹ = I
  - ทุกแถว × ทุกระดับในตาราง MISCONCEPTIONS §4.1 สร้าง probe ได้ และตัวอย่าง `probeLevel` ตรงทุกตัว
  - golden seeds (regenerate ได้เหมือนเดิม)
- [ ] หน้า `/dev/engine`: เลือก skill/level/target/seed → ดูโจทย์, เฉลย, diagnostics, worked steps แล้วลองพิมพ์คำตอบดู classification
- **Acceptance:** `npm run check` ผ่าน · ทุก ★ misconception สร้าง probe ได้และจับได้ · รายงานสรุปว่าตัวไหนยังมีปัญหา (ถ้ามี)

## Phase 2: Practice UI (2–4 พ.ย.)
- [ ] `MatrixView`, `MatrixInput`, `Keypad` (ไม่เด้ง keyboard ระบบ ปุ่ม ≥ 44px), choice buttons, dims input
- [ ] join แบบ local (ยังไม่มี DB) → `/learn` แผนที่ → `/learn/session` ลูปโจทย์
  - ใช้ rules แบบง่ายไปก่อน: เดินตามลำดับ skill และปรับระดับ
- [ ] `FeedbackCard` (ทันที), ปุ่ม "ดูวิธีทำ", hint L1–L3 (ข้อความจาก th.ts), XP/combo, `/summary`
- [ ] ข้อความไทยทั้งหมดอยู่ใน `th.ts` และของที่ร่างใหม่ติด `// TODO(review)`
- **Acceptance:** ทำ Unit 3 จบบนมือถือ 360px ได้ · ไม่มี layout shift ตอนขึ้น feedback · Lighthouse mobile performance ≥ 80

## Phase 3: Scenes (3–6 พ.ย.)
- [ ] `ScenePlayer` (beats, แตะไปต่อ, เล่นซ้ำ, ข้าม, progress, reduced-motion, ส่ง scene_view event)
- [ ] Tier A: `row_col_dot`, `dimension_match`, `grid_transform`, `inverse_recipe`, `worked_solution`
- [ ] ผูก misconception → scene ตาม MISCONCEPTIONS.md (ถ้ายังไม่มี template ให้ fallback เป็น `worked_solution`)
- [ ] intro ของ Unit 1–5 และ concept scene ทุก ★ skill (SCENES §5, §5.1) พร้อมกติกาคลิปนำ (SPEC §4)
- [ ] `/dev/scenes` gallery
- [ ] (ถ้ามีเวลา) Tier B: `cell_locator`, `transpose_flip`, `sarrus`
- **Acceptance:**
  - ทุก ★ misconception มี scene ที่เล่นด้วยตัวเลขจาก generator ได้
  - scene แก้ความเข้าใจผิด ≤ 25 วิ
  - concept scene ≤ 20 วิ
  - caption ไม่ล้นที่ 360px
  - ลื่นบน Android รุ่นล่างจริง 1 เครื่อง

## Phase 4: Learner model + rules director (5–7 พ.ย.)
- [ ] BKT, mastery, สถานะ misconception, ความยาก, interleaving, ติด (SPEC §7) แบบ pure function + tests ตามตัวอย่างใน SPEC
- [ ] `candidates.ts` (AI_DIRECTOR §3), `rules.ts`, `fixedPath.ts`, `NextTurn`, `pathStep` (AI_DIRECTOR §3.2), token resolver
- [ ] `PathStrip` ใน `/learn/session` และ "เส้นทางของฉัน" บน `/learn` (SPEC §4)
- [ ] `lib/sim/`: นักเรียนจำลอง
  - `perfect`
  - `slipper(p)`
  - `buggy(Mxx, fixProb)`: ตอบตาม candidate ของ Mxx และหายจาก bug ด้วยความน่าจะเป็น fixProb หลังดู scene ของเรื่องนั้น
  - `random`
- [ ] `npm run sim`: รัน 200 คน × 60 ข้อ ทั้ง adaptive และ fixed แล้วรายงาน items-to-mastery, % bug resolved, จำนวน illegal transition และเทียบจำนวนข้อต่อ skill กับตารางเวลาใน RESEARCH §3.1
- [ ] **tests (deterministic seeds):**
  - buggy เจอ probe ภายใน 1 ข้อหลังโดนจับได้
  - perfect ไม่เคยได้ remediation scene
  - ไม่มี advance ไป skill ที่ prereq ไม่ครบ (prereq ใน unit ที่ปิดถือว่าผ่าน)
  - มีการทบทวนเกิดขึ้นจริง
  - R7 ทำงาน
  - ตารางตัวอย่างใน SPEC §7.3 ตรงทุกแถว
  - ผ่านครบทุก skill ที่เปิดแล้วยังมีข้อให้ทำ
  - นักเรียนจำลองสองคนที่ตอบต่างกันได้เส้นทางต่างกัน และได้ตัวเลขคนละชุด
  - ทุก `note` ไม่เกิน 40 code units และไม่มีตัวเลข
- [ ] `/dev/director`: เลือก scenario แล้วดู candidates และการตัดสินใจ
- **Acceptance:** `npm run check` ผ่าน · `npm run sim` มี illegal transition = 0 · เห็นขั้นใหม่พร้อมเหตุผลบนจอ 360px โดยไม่มี layout shift
- ⚠️ ผล sim ใช้ทดสอบระบบเท่านั้น ห้ามใช้เป็นหลักฐานในแบบเสนอ

## Phase 5: Backend + teacher + deploy (6–9 พ.ย.)
- [ ] Supabase (region Singapore): migrations ตาม SPEC §13, เปิด RLS ทุกตาราง ไม่มี anon policy
- [ ] join จริง: class code + เลขที่ + PIN (hash), cookie signed, rate limit การเดา PIN, consent
- [ ] API ตาม SPEC §14
  - `/api/attempt` ทำครบ: regenerate → re-classify → profile → director (rules) → log
- [ ] ครู: login ด้วย magic link, สร้างห้อง (code + QR), dashboard v1 (ตาราง mastery, misconception prevalence, stuck alert, decision log), settings, reset PIN, ลบข้อมูลห้อง
- [ ] Export CSV รายตาราง
- [ ] deploy Vercel (region `sin1`) + env vars
- **Acceptance:**
  - ครู 1 + นักเรียน 2 เครื่องใช้งานบน URL จริงพร้อมกันได้
  - test ยืนยันว่านักเรียนอ่านข้อมูลคนอื่นไม่ได้
  - attempts และ decisions ถูกบันทึกครบ

## Phase 6: LLM director (8–10 พ.ย.)
**เป้าหมายหลักของการทดลอง:** AI ที่คิดสดเป็นจุดขายหลัก จึงตั้งใจเปิดใช้ตอนทดลองจริง ถ้าไม่ทันหรือไม่ผ่าน acceptance ให้ทดลองด้วยโหมด rules และเขียนตามจริงในแบบเสนอ

- [ ] provider adapter (`LLM_PROVIDER=none|gemini|anthropic|openai`), prompt ตาม AI_DIRECTOR §4.6–4.7, Zod schema, `validateDecision`, timeout, fallback, rate limit ต่อคน
- [ ] ครูเปิด/ปิด LLM รายห้องได้ · TutorBubble cross-fade
- [ ] scenarios 20 ชุด + `npm run eval:director` → `eval-report.md`
- **Acceptance:**
  - valid ≥ 95%
  - ไม่มีตัวเลขในข้อความถึงนักเรียน
  - p95 latency ≤ timeout หรือ fallback ถูกต้อง
  - ทุกอย่างยังใช้ได้เมื่อ `LLM_PROVIDER=none`

## Phase 7: Assessment (9–11 พ.ย.)
- [ ] ฟอร์ม A/B จาก seed คงที่ตาม RESEARCH §4 + หน้า preview/print พร้อมเฉลย (กรองตาม unit ที่เปิด)
- [ ] counterbalance ตามเลขที่ · ครูเปิด/ปิด pre และ post · ล็อก unit เมื่อเปิด pre-test · หน้าสอบไม่มี feedback และไม่มี hint
- [ ] ตั้ง P(L₀), การผ่านเร็ว (SPEC §7.1) และการข้ามคลิปนำ (SPEC §4) จาก pre-test · ปุ่ม assign conditions (เมื่อเปิด ab_split)
- [ ] หน้ากรอกผลสอบกระดาษ (สำรอง) · `research_wide.csv`
- **Acceptance:** นักเรียนทดสอบ 1 คนทำ pre → learn → post ครบ แล้ว export มีข้อมูลถูกต้องทุกคอลัมน์ (`pre_Mxx` ที่ไม่มีข้อวัดต้องว่าง ไม่ใช่ 0)

## ⛳ Go/No-go: พฤหัส 12 พ.ย.
**GO เมื่อครบทุกข้อ:**
- [ ] ห้องทดลองยืนยันแล้ว (ครู + วัน/คาบ + unit ที่จะเปิด)
- [ ] Phase 1–5 และ 7 ผ่าน acceptance (Phase 6 ไม่บังคับ ใช้โหมด rules ได้)
- [ ] ใช้ได้บนเน็ตโรงเรียน + มือถือจริง ≥ 3 แบบ
- [ ] ซ้อมกับเพื่อน 3–5 คน (pre → learn → post) แล้วไม่มี bug ร้ายแรง

**NO-GO:** ส่ง QEDify ฟิสิกส์ + เก็บ pre/post ตามแผนเดิมแทน แล้วเก็บแอปนี้ไว้ทำต่อ

**เปิด LLM ตอนทดลองไหม (ไม่ใช่เงื่อนไข GO):** เปิดเมื่อ Phase 6 ผ่าน acceptance, load test ผ่านทั้งที่เปิด LLM และเน็ตโรงเรียนเข้าถึง API ของ LLM ได้ ถ้าไม่ครบให้ใช้โหมด rules

## Phase 8: Hardening (12 พ.ย.)
- [ ] load test จำลองนักเรียน 40 คนพร้อมกัน (script ยิง API และเปิด LLM ถ้าจะใช้ตอนทดลอง)
- [ ] เช็คว่าเน็ตโรงเรียนไม่บล็อก `*.vercel.app`, `*.supabase.co` และ API ของ LLM
- [ ] freeze `generatorVersion` · ตั้ง `DEMO_MODE` · (ถ้าทำทัน) `/demo/split`
- [ ] พิมพ์ฟอร์ม A/B สำรอง · ทดสอบ export และ backup
- [ ] QR ของห้องพร้อมใช้

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
