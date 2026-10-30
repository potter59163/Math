# SPEC: QEDify: Matrix (MVP)

> **เป้าหมาย:** ส่ง Chula Innovative Award 2027 (ประเภทนักเรียน ระดับมัธยมศึกษา) ภายใน 27 พ.ย. 2569 16:30 น. และทดลองในห้องเรียนจริง 13–19 พ.ย. 2569
> **ชื่อแอปและชื่อติวเตอร์ ("คิว") เป็นชื่อชั่วคราว:** แก้ได้ที่ `lib/config.ts`

---

## 1. ภาพรวม

**ปัญหา (เป็นสมมติฐาน ต้องยืนยันด้วยผล pre-test):**
- นักเรียนทำเมทริกซ์ผิดซ้ำแบบเดิม เพราะเข้าใจผิดเฉพาะจุด เช่น คูณทีละช่อง หรือลืมสลับ a กับ d ตอนหาอินเวอร์ส
- แบบฝึกทั่วไปบอกได้แค่ถูกหรือผิด
- ครูหนึ่งคนไล่ดูวิธีคิดของทั้งห้องไม่ทัน

**สิ่งที่สร้าง:** web app ฝึกเมทริกซ์สไตล์ Duolingo ที่มี 4 ส่วน
1. **วินิจฉัยว่าผิดเพราะอะไร:** engine คำนวณไว้ก่อนว่าถ้าเข้าใจผิดแต่ละแบบจะได้คำตอบอะไร แล้วเทียบกับคำตอบของนักเรียน ใน MVP มี bug library 18 แบบ (ดู MISCONCEPTIONS.md)
2. **อธิบายด้วย animation ที่ใช้ตัวเลขของนักเรียนเอง:** เป็น template ที่ engine ใส่ตัวเลขจริงลงไป แล้วเล่นในเบราว์เซอร์ได้ทันที (ดู SCENES.md)
3. **AI tutor "คิว" จัดบทเรียนให้แต่ละคนแบบสดๆ:** อ่าน learner profile แล้วเลือกขั้นถัดไป เช่น อธิบาย ทดสอบ เพิ่มความยาก ทบทวน หรือไปด่านต่อ ตัวเลือกทั้งหมดผ่านระบบกฎมาแล้ว ทุกการเลือกมีเหตุผลที่ครูเปิดดูได้ และนักเรียนเห็นเหตุผลสั้นๆ บนเส้นทางของตัวเอง (ดู AI_DIRECTOR.md)
4. **ครูเห็นภาพรวมห้อง:** ใครติดเรื่องไหน และความเข้าใจผิดแบบไหนเจอบ่อย

**หลักออกแบบ:** AI เป็นผู้กำกับ ไม่ใช่เครื่องคิดเลข ตัวเลขทุกตัวมาจาก engine ที่คำนวณแบบเศษส่วน exact

### 1.1 ต่อยอดจาก QEDify
pilot เดิมเป็นฟิสิกส์ นักเรียน n=31 ครู n=3 สิ่งที่เปลี่ยนตามผลมีดังนี้

| ผล pilot เดิม | สิ่งที่เปลี่ยน |
|---|---|
| ด้าน engagement ได้คะแนนต่ำสุด (3.37/5) นักเรียนขอ animation เพิ่ม ตัวหนังสือน้อยลง โจทย์สั้นลง | เน้น animation, caption ≤ 1 บรรทัด, โจทย์สั้น |
| บนมือถือ slider กับปุ่มเล็กใช้ยาก ข้อ "เข้าใจ UI ได้ทันที" ต่ำสุดในด้าน usability (3.29) | ใช้ keypad ของแอปเอง ปุ่ม ≥ 44px ไม่มี slider |
| ครูให้คะแนนคุณภาพ feedback ต่ำกว่าข้ออื่น (3.33) | feedback เฉพาะตามชนิดความเข้าใจผิด |
| ครูชอบ analytics ติดตามนักเรียน (4.00) | teacher dashboard และแสดงเหตุผลของ AI |
| ความมั่นใจในการแก้โจทย์เองต่ำสุด (3.26) เล่นรอบเดียวไม่พอ | ผ่านด่านด้วย mastery และแทรกข้อทบทวนสลับเรื่อง |

### 1.2 ต่างจากของที่มีอยู่
ใช้ตอบกรรมการ ก่อนเขียนแบบเสนอให้เช็คข้อมูลคู่แข่งอีกรอบ
- **แอปแก้โจทย์/สแกนโจทย์:** ให้คำตอบและวิธีทำ แต่ไม่ดูว่าคำตอบของนักเรียนผิดเพราะเข้าใจผิดแบบไหน
- **แอปฝึกโจทย์ทั่วไป:** บอกถูก/ผิดแล้วเฉลย เส้นทางเหมือนกันทุกคน
- **simulation (เช่น PhET):** ให้สำรวจอิสระ ไม่ปรับตามผู้เรียน
- **AI chat tutor ทั่วไป:** คิดเลขพลาดได้ และตรวจย้อนหลังยาก
- **งานนี้:**
  - วินิจฉัยจากคำตอบ
  - animation ที่ใช้ตัวเลขของนักเรียน
  - เส้นทางเฉพาะคนพร้อมเหตุผล
  - คณิตถูกเสมอ
  - ภาษาไทย ตรงหลักสูตร ไม่ต้องลงแอป

---

## 2. ผู้ใช้และบริบท
- **นักเรียน:** ม.5–6 ที่กำลังเรียนหรือเคยเรียนเมทริกซ์แล้ว (ยืนยันกับครูว่าโรงเรียนสอนบทนี้ชั้นไหน) ใช้ในคาบหลังสอนเนื้อหา หรือใช้ทบทวนก่อนสอบ
- **ครูคณิต:** เปิดห้อง ดู dashboard เปิด/ปิด pre-test และ post-test แล้ว export ข้อมูล
- **อุปกรณ์:** มือถือนักเรียน (Android รุ่นกลางถึงล่าง และ iPhone) กับคอมห้องคอม ใช้เน็ตโรงเรียน
- **ช่วงทดลอง:** 2 คาบ (ดู RESEARCH.md)

---

## 3. หลักสูตร: units และ skills

ตรวจลำดับหัวข้อกับหนังสือ สสวท. รายวิชาคณิตศาสตร์เพิ่มเติม (เล่มที่มีบทเมทริกซ์) และให้ครูยืนยันก่อน ★ = MVP

| Unit | skill id | ชื่อ | prereq | answer kind | L1 | L2 | L3 | misconceptions |
|---|---|---|---|---|---|---|---|---|
| 1 พื้นฐาน | `dim` ★ | มิติของเมทริกซ์ | – | dims | 2×3, 3×2 | ถึง 4×4 | 1×n, n×1 | M01 |
| | `index` ★ | ตำแหน่งสมาชิก aᵢⱼ | dim | cell | 3×3 เลข 1–9 ไม่ซ้ำ | 3×4 | 4×3 มีลบ | M02 |
| | `transpose` ★ | ทรานสโพส | index | matrix | 2×2 ไม่ซ้ำ | 2×3/3×2 | 3×3 มีลบ | M03 |
| 2 บวก ลบ สเกลาร์ | `addsub` ★ | บวก/ลบเมทริกซ์ | dim | matrix / matrix_or_undefined | 2×2 บวก 0–9 | ลบ มีจำนวนลบ หรือมิติไม่เท่ากัน | 3×3 หรือมิติไม่เท่ากัน | M04, M05, (M06) |
| | `scalar` ★ | คูณด้วยสเกลาร์ | addsub | matrix | k∈{2,3} 1–9 | k∈{−3,−2,2,3,4} มีลบ | 2A − 3B | M07 |
| 3 คูณ | `mult_defined` ★ | คูณได้ไหม / มิติผลคูณ | dim | dims_or_undefined | AB | AB และ BA | ABC | M08 |
| | `mult` ★ | คูณเมทริกซ์ | mult_defined | matrix / matrix_or_undefined | 2×2·2×2 เลข 0–5 | 2×3·3×2 หรือ 2×2 เลข −5..5 | 3×3·3×1, 2×3·3×3 เลข −4..6 | M09, M10, M11 |
| | `mult_noncomm` ★ | AB กับ BA | mult | choice / matrix | จริง/เท็จ | ให้ A, B และ AB มาแล้ว จงหา BA | คู่นี้สลับที่ได้ไหม | M11 |
| 4 ดีเทอร์มิแนนต์ | `det2` ★ | det 2×2 | dim | scalar | 0–9, det > 0 | มีลบ | หา x ที่ทำให้ det = 0 (☆) | M12 |
| | `det3` ★ | det 3×3 | det2 | scalar | 0–5 มีศูนย์ ≥ 2 ตัว | −3..5 มีศูนย์ 1 ตัว | −4..6 | M13 |
| | `det_props` ★ | สมบัติของ det | det3, scalar, mult | scalar | det(kA) n=2 | det(kA) n=3, det(AB), det(A+B) | det(Aᵀ), det(A⁻¹) | M14, M15, (M16, M17) |
| 5 อินเวอร์ส | `invertible` ★ | มีอินเวอร์สไหม | det2 | choice | ไม่มีศูนย์: คละแถวเป็นพหุคูณกันชัดๆ กับ det ≠ 0 | มีสมาชิกเป็น 0: คละ det ≠ 0 กับ det = 0 | 3×3 คละทั้งสองแบบ | M18, M19 |
| | `inv2` ★ | อินเวอร์ส 2×2 | invertible, scalar | matrix | det = ±1 | \|det\| 2–5 | det ติดลบ ได้เศษส่วน | M20, M21 |
| (stretch) | `props` ☆ | (AB)ᵀ, (AB)⁻¹ | inv2, transpose | choice / matrix | | | | M22, M23 |
| 6 (stretch) | `solve` ☆ | แก้ระบบสมการด้วย X = A⁻¹B | inv2 | matrix | | | | – |

**ระดับที่ misconception แต่ละแบบใช้ได้:** ดูตารางใน MISCONCEPTIONS §4.1

ครูเลือกได้ว่าห้องนี้เปิด unit ไหนบ้าง (`settings.unitsEnabled`)
- **prereq ข้าม unit:** prereq ที่อยู่ใน unit ที่ปิดให้ถือว่าผ่านแล้ว เช่น ปิด Unit 2 แล้ว `inv2` ไม่ต้องรอ `scalar`
- **ล็อกเมื่อเปิด pre-test:** เปลี่ยน unit ไม่ได้หลังครูเปิด pre-test เพื่อให้ pre และ post วัดข้อชุดเดียวกัน
- **วิธีเลือก:** ดูตารางเวลาใน RESEARCH §3.1

---

## 4. Student flow

1. **`/join`:** ใส่ class code 6 ตัว (หรือสแกน QR) + เลขที่ + ตั้ง PIN 4 หลัก + ชื่อเล่น (ไม่บังคับ)
   - ครั้งต่อไปใช้ code + เลขที่ + PIN
   - ครูรีเซ็ต PIN ให้ได้
2. **`/consent`:** แสดงครั้งแรกครั้งเดียว (ข้อความใน §15)
3. **ถ้าครูเปิด pre-test และยังไม่ได้ทำ:** ไป `/test/pre` ไม่มี feedback และไม่มี hint
4. **`/learn` (แผนที่):**
   - unit เรียงเป็นเส้นทาง ปลดล็อกตาม prereq
   - skill ปัจจุบันถูกไฮไลต์
   - **เส้นทางของฉัน:** แสดงขั้นล่าสุดที่คิวเลือกให้ (สูงสุด 5 ขั้น) พร้อมเหตุผลสั้นๆ ของแต่ละขั้น
   - แสดง XP กับ combo และมีปุ่ม "เรียนต่อ"
5. **`/learn/session` (ลูปหลัก):**
   - **คลิปนำ:** ก่อนข้อแรกของ skill ใหม่เล่น 1 คลิป กดข้ามได้
     - คลิปแรกที่ได้ดูใน unit เป็น intro ของ unit (≤ 40 วิ) ส่วน skill อื่นเป็น concept scene (≤ 20 วิ, SCENES §5.1)
     - ข้ามให้เองถ้าข้อ pre-test ของ skill นั้นถูก
     - ตัวอย่างในคลิปมาจาก engine และไม่ใช่ข้อที่กำลังจะทำ
   - **เส้นทางส่วนตัว:** แถบ `PathStrip` ด้านบนแสดงขั้นที่ผ่านมา เมื่อคิวเลือกขั้นใหม่จะมีจุดเพิ่มขึ้นพร้อมเหตุผล 1 บรรทัด เช่น "เพิ่มข้อนี้เพราะเมื่อกี้คูณทีละช่อง" (AI_DIRECTOR §3.2)
   - **การ์ดโจทย์:** โจทย์สั้น, `MatrixView` ของสิ่งที่โจทย์ให้, ช่องตอบ + keypad, ปุ่ม "ขอใบ้" (L1 → L2 → L3) และปุ่ม "ส่ง"
   - **กดส่ง:**
     - จัดประเภทคำตอบในเครื่องทันที แล้วขึ้น `FeedbackCard`
     - ถ้าตอบผิด มีปุ่ม "ดูวิธีทำ" ซึ่งเปิด `worked_solution` ของข้อนั้น
     - `TutorBubble` แสดงข้อความของ director เมื่อมาถึง
   - **ถ้า NextTurn มี scene:** เล่น scene (แตะไปทีละ beat) แล้วไปข้อถัดไป
   - **ข้อปิดทันทีหลังส่ง ไม่มีการแก้ข้อเดิม:** ถ้าผิด ข้อถัดไปมักเป็นข้อทดสอบ (probe) เรื่องเดิมแต่เปลี่ยนตัวเลข
   - **ปุ่ม "ไม่เข้าใจ" ใช้ได้ตลอด:** ส่ง trigger `student_request` → ได้ concept scene ของ skill นั้น
     - ใช้ตัวอย่างพี่น้อง (seed ใหม่) ไม่ใช้ตัวเลขของข้อที่กำลังทำ เพื่อไม่เฉลย
6. **`/summary`:** แสดงเมื่อนักเรียนกด "พอแค่นี้" หรือครูจบคาบ
   - skill ที่ผ่าน
   - ความเข้าใจผิดที่แก้ได้
   - XP
7. **`/test/post`:** เมื่อครูเปิด

---

## 5. Item kinds และการกรอกคำตอบ

| kind | UI | หมายเหตุ |
|---|---|---|
| `matrix` | grid ตามขนาดที่โจทย์กำหนด + keypad | ให้ขนาด grid เสมอใน MVP (☆ `chooseShape` สำหรับข้อที่วัดเรื่องมิติด้วย) |
| `matrix_or_undefined` | grid + ปุ่ม "หาค่าไม่ได้" | ใช้กับข้อที่มิติอาจไม่เข้ากัน · `addsub` L2–L3 ใช้ kind นี้ทุกข้อ ปุ่มจะได้ไม่เผยเฉลย · ขนาด grid: บวก/ลบใช้มิติของ A, คูณใช้แถวของ A × หลักของ B ทั้งข้อที่หาค่าได้และไม่ได้ |
| `scalar`, `cell` | ช่องเดียว | |
| `dims_or_undefined` | □ × □ + ปุ่ม "หาค่าไม่ได้" | |
| `choice` | ปุ่มใหญ่ 2–4 ปุ่ม | ตัวเลือกผิดแต่ละตัวผูกกับ misconception |

**Keypad:** 0–9, −, /, ., ⌫, → (ช่องถัดไป), ✓ (ส่ง) บน desktop พิมพ์จากคีย์บอร์ดได้ด้วย

**`parseAnswer`:**
- **normalize:** ตัดช่องว่าง, แปลง "−" และ "–" เป็น "-", แปลงเลขไทยเป็นเลขอารบิก
- **รับ:** จำนวนเต็ม `-3`, เศษส่วน `-3/2` (ตัวส่วน ≠ 0), ทศนิยมจำกัด `0.5` และ `-1.25` (แปลงเป็นเศษส่วน exact)
- **ไม่รับ:** จำนวนคละ, ทศนิยมซ้ำ, ช่องว่างเปล่า (ปุ่มส่งยังกดไม่ได้จนกรอกครบ)
- เศษส่วนที่ยังไม่ทำเป็นอย่างต่ำ (เช่น 2/4) นับว่าถูก

**ตัวอย่างโจทย์ (สั้นเสมอ):**
- "จงหา AB"
- "จงหา det(A)"
- "A มีมิติ 2×3 และ B มีมิติ 3×4 แล้ว AB หาค่าได้ไหม ถ้าได้มีมิติเท่าใด"
- "ถ้า A เป็นเมทริกซ์ 3×3 และ det(A) = 4 จงหา det(2A)"

---

## 6. Math engine
สรุปไว้ตรงนี้ รายละเอียดอยู่ใน MISCONCEPTIONS.md และ `.claude/rules/engine.md`

**`lib/core/` (ใช้ได้กับทุกหัวข้อ)**
- `rational.ts`: เลขเศษส่วน exact
- `prng.ts`: PRNG แบบใส่ seed
- `types.ts`: `Item`, `ItemRef`, `Answer`, `Classification`, `Diagnostic`
- `parse.ts`
- `validate.ts`: `validateItem`
- `classify.ts`: `classify(item, answer)`
- `tokens.ts`: แทนค่า `{{token}}`

**`lib/topics/matrix/`**
- `ops.ts`: add, sub, scalar, mul, transpose, det2, det3, inv2, equals
- `skills.ts`: skill graph + prereq
- `generators/<skill>.ts`: 1 ไฟล์ต่อ skill
- `misconceptions.ts`: catalog ที่มี id, nameTh, skills, `applies(item)`, `candidate(item)`, scene, hintKey
- `worked.ts`: `workedSteps(item, focus?)` คืนค่า `Step[]` = { labelKey, latex, value }
- `assessment.ts`: ฟอร์ม A/B จาก seed คงที่

**`regenerate(itemRef)`** ต้องได้ item เดิมทุกครั้ง server ใช้ฟังก์ชันนี้ตรวจซ้ำก่อนบันทึก

**seed ของโจทย์:** `deriveSeed(studentId, counter)` เป็น hash แบบ pure โดย counter อยู่ใน profile และเพิ่มทุกครั้งที่ออกโจทย์หรือตัวอย่างใหม่
- นักเรียนแต่ละคนจึงได้ตัวเลขของตัวเอง ลอกกันยาก และยังสร้างซ้ำได้จาก `ItemRef`
- ยกเว้นฟอร์ม A/B ของข้อสอบที่ใช้ seed คงที่ เพื่อให้ทุกคนสอบชุดเดียวกัน

---

## 7. Learner model

### 7.1 Mastery ต่อ skill: Bayesian Knowledge Tracing (Corbett & Anderson, 1994)
P(L) คือโอกาสที่นักเรียนรู้ skill นั้นแล้ว
- **ตอบถูก:** P(L|obs) = P(L)(1−S) / [P(L)(1−S) + (1−P(L))G]
- **ตอบผิด:** P(L|obs) = P(L)S / [P(L)S + (1−P(L))(1−G)]
- **จากนั้น:** P(L) ← P(L|obs) + (1 − P(L|obs))·T

**ค่าเริ่มต้น:**
- P(L₀) = 0.15, T = 0.15, S = 0.10
- G = 0.05 สำหรับข้อแบบพิมพ์คำตอบ, G = 1/k สำหรับ choice ที่มี k ตัวเลือก

**การนับ:**
- ใช้เฉพาะ attempt แรกของแต่ละข้อ
- ใช้ hint ตั้งแต่ L2 ขึ้นไป หรือกด "ดูวิธีทำ" ก่อนส่ง = นับเป็นตอบผิด

**ตั้งค่าจาก pre-test:** P(L₀) ของ skill =
- 0.60 ถ้าข้อของ skill นั้นถูก (ถ้ามีหลายข้อ เช่น `mult_defined` ต้องถูกทุกข้อ)
- 0.10 ถ้าผิดแบบ misconception (ถ้ามีหลายข้อ มีข้อเดียวก็นับ)
- 0.25 ถ้าผิดแบบอื่น
- 0.15 ถ้าฟอร์มไม่มีข้อของ skill นั้น

**ตัวอย่าง (คำนวณแล้ว ใช้เป็น test ได้):**
- เริ่ม 0.15 → ถูก → 0.796 → ถูก → 0.988
- เริ่ม 0.60 → ผิด → 0.266
- choice 2 ตัวเลือก เริ่ม 0.15 → ถูก → 0.355

**Mastered** = ครบทุกเงื่อนไขนี้
1. P(L) ≥ 0.95
2. ตอบถูกครั้งแรกโดยไม่ใช้ hint ≥ 3 ข้อใน skill นั้น แม้ P(L) จะเกิน 0.95 ตั้งแต่ข้อที่ 2 ก็ยังต้องถูกข้อที่ 3
3. ในข้อที่ถูกนั้นมีข้อที่ L2 ขึ้นไปอย่างน้อย 1 ข้อ เพราะข้อสอบหลายข้อเป็นเนื้อหาระดับ L2 (ข้อ 3, 4, 11, 12, 13 ใน RESEARCH §4)
4. ไม่มี misconception ของ skill นี้ในสถานะ suspected หรือ active

**ผ่านเร็วสำหรับ skill ที่ pre-test ถูก:** เริ่มที่ L2 และลดเงื่อนไขข้อ 2 เหลือ 1 ข้อ
- เริ่ม 0.60 → ถูก → 0.970 จึงผ่านได้ใน 1 ข้อ (ถ้าเป็น choice 2 ตัวเลือก ต้องถูก 4 ข้อจึงถึง 0.95)
- ถ้าตอบผิด จะลงระดับและเดินตามกฎปกติ

**ผ่านแล้วไม่หาย:** แม้ P(L) จะตกจากข้อทบทวน สถานะผ่านยังอยู่ เพื่อไม่ให้ skill ที่ต่อจากนั้นถูกล็อกย้อนหลัง แต่ misconception ที่เจอจากข้อทบทวนยังต้องแก้ตาม §7.2 ก่อนไปต่อ

### 7.2 สถานะ misconception (ต่อคน ต่อ misconception)
```
none ──เจอ 1 ครั้ง──▶ suspected ──เจอครั้งที่ 2──▶ active
suspected/active ──ตอบข้อที่เล็งเรื่องนั้นถูก 2 ข้อติด (attempt แรก ไม่ใช้ hint L2+)──▶ resolved
resolved ──เจออีก──▶ active (relapse)
ระหว่างแก้ถ้าเจอซ้ำ: fixStreak = 0, count += 1
```
บันทึก `itemsToResolve` กับ `msToResolve` เป็นตัวชี้วัดในแอป

### 7.3 ความยาก (L1–L3 ต่อ skill)
`rolling` = อัตราถูกจาก attempt แรก 6 ครั้งล่าสุดใน skill ปรับได้ครั้งละ 1 ระดับ
- **ปรับขึ้น +1 (ดูเมื่อข้อล่าสุดถูก และยังไม่ถึง `maxLevel`):** เข้าเงื่อนไขใดเงื่อนไขหนึ่ง
  - rolling ≥ 85% และทำที่ระดับนี้แล้ว ≥ 2 ข้อ
  - อยู่ที่ L1 และ P(L) ≥ 0.95
- **ปรับลง −1 (ดูเมื่อข้อล่าสุดผิด):** rolling ≤ 50%
- **`maxLevel`:** กำหนดใน `skills.ts` ใช้ค่า 2 กับ skill ที่ไม่มี L3 ใน MVP (เช่น `det2`) หรือยังไม่ได้ทำ L3
- **L3 เป็นโจทย์ท้าทาย:** ไม่บังคับต่อการผ่าน skill
- **เป้าหมาย:** อัตราถูกรวมอยู่ราว 70–85% (ท้าทายพอดี ตามแนว ZPD/Flow)

**ตัวอย่าง (คำนวณแล้ว ใช้เป็น test ได้ · ข้อแบบพิมพ์คำตอบ · ถ = ถูก, ผ = ผิด, M = ผิดแบบ misconception):**

| เริ่ม | คำตอบ | ระดับของแต่ละข้อ | P(L) หลังแต่ละข้อ | ผ่านที่ข้อ |
|---|---|---|---|---|
| 0.15 | ถ ถ ถ | 1 1 2 | 0.796 0.988 0.999 | 3 |
| 0.15 | ผ ถ ถ ถ | 1 1 1 2 | 0.166 0.814 0.989 0.999 | 4 |
| 0.15 | ถ ถ M ถ ถ | 1 1 2 2 2 | 0.796 0.988 0.913 0.996 1.000 | 5 (ต้องแก้ M ให้หายก่อน) |
| 0.15 | ถ ถ ผ ผ ถ ถ | 1 1 2 2 1 2 | 0.796 0.988 0.913 0.595 0.969 0.998 | 6 |
| 0.60 (pre-test ถูก) | ถ | 2 | 0.970 | 1 |
| 0.60 (pre-test ถูก) | ผ ถ ถ ถ | 2 1 1 2 | 0.266 0.887 0.994 1.000 | 4 |

### 7.4 ทบทวนแบบสลับ (interleaving)
ทุก 6 ข้อ ถ้ามี skill ที่ผ่านแล้วแต่ไม่ได้เจอใน 10 ข้อล่าสุด ให้แทรกข้อทบทวน 1 ข้อที่ L2

### 7.5 ติด
ผิด attempt แรกติดกัน 3 ข้อใน skill เดียว → `worked_solution` → ข้อ L1 + แจ้งเตือนครู

---

## 8. Director
ดู AI_DIRECTOR.md
- **ระบบกฎ:** เสนอ candidates 2–4 ทาง
- **LLM:** เลือก 1 ทาง เขียนข้อความถึงนักเรียน เขียน narration ของ scene และเขียนเหตุผลให้ครู
- **ถ้าไม่มี LLM หรือ LLM ล้มเหลว:** ระบบกฎเลือกเอง
- **ตอนทดลอง:** ตั้งใจเปิด LLM เพราะ AI ที่คิดสดเป็นจุดขายหลัก เงื่อนไขอยู่ใน PLAN (Go/No-go) และระบบกฎยังเป็นตัวสำรองเสมอ

---

## 9. Feedback และ hints

**Feedback ทันที (ระบบกฎ, < 100 ms)**

| classification | แสดง |
|---|---|
| correct | "ถูกต้อง!" + XP |
| misconception | ข้อความของ misconception นั้น (ไม่บอกคำตอบที่ถูก) + ปุ่ม "ดูวิธีทำ" |
| slip | "เกือบแล้ว ผิดแค่ช่องแถว i หลัก j" (ไม่บอกค่าที่ถูก) |
| shape_error / unknown | "ยังไม่ถูก มาดูทีละขั้นกัน" + ปุ่ม "ดูวิธีทำ" |

จากนั้น `TutorBubble` แสดงข้อความของ director แบบ cross-fade

**Hint 3 ระดับ:** กด "ขอใบ้" ทีละขั้น ข้อความทุกระดับเขียนเตรียมไว้ใน `lib/content/th.ts` (MVP ไม่ให้ LLM เขียน hint)
1. **L1 เตือนหลักการ:** เช่น "ช่องแถว i หลัก j ของ AB มาจากแถว i ของ A กับหลัก j ของ B"
2. **L2 ชี้จุด:** ถ้ามี misconception ที่ suspected หรือ active ใน skill นี้ ใช้ hint ของ misconception นั้น ถ้าไม่มี ให้ชี้ขั้นแรกของวิธีทำ
3. **L3 ทำให้ดู 1 ขั้นหรือ 1 ช่อง:** จาก `workedSteps(item, focus)` ไม่เฉลยทั้งข้อ

---

## 10. Scenes
ดู SCENES.md
- **Tier A (ต้องมี):** `row_col_dot`, `dimension_match`, `grid_transform`, `inverse_recipe`, `worked_solution`
- **Tier B:** `cell_locator`, `transpose_flip`, `sarrus` (ถ้ายังไม่มี ให้ fallback เป็น `worked_solution`)
- **คลิปนำและปุ่ม "ไม่เข้าใจ":** ใช้ template เหล่านี้ตามตารางใน SCENES §5.1 ไม่มีการสร้างวิดีโอตอน runtime

---

## 11. Gamification (เบาๆ)
- **XP:**
  - ถูกครั้งแรกไม่ใช้ hint = 10
  - ใช้ hint L1 = 7
  - หลังกดดูวิธีทำ = 0
  - แก้ misconception ได้ = +20
- **combo:** นับข้อถูกติดกัน
- **badge:** ผ่าน unit และ "แก้ความเข้าใจผิดสำเร็จ"
- **ไม่มี leaderboard:** หลีกเลี่ยงการเทียบกันในห้อง และครูก็ไม่เห็นอันดับ XP

---

## 12. Teacher dashboard (`/teacher/class/[id]`)
poll ทุก 10 วินาที

- **ภาพรวม:** ตารางนักเรียน × skill ระบายสี (P(L) < 0.5 แดง, P(L) ≥ 0.5 เหลือง, ผ่านตาม §7.1 เขียว), ทำอะไรอยู่ตอนนี้, ธงเตือน "ติด"
- **Misconceptions:** % นักเรียนที่ suspected, active หรือ resolved ต่อ misconception (10 อันดับแรก)
- **Decisions:** 50 รายการล่าสุด แสดงนักเรียน (alias), โหมด llm/rules, ทางที่เลือก และเหตุผล กดดู JSON เต็มได้
- **Assessment:**
  - เปิด/ปิด pre และ post
  - ดูและพิมพ์ฟอร์ม A/B พร้อมเฉลย (สำรองสำหรับสอบบนกระดาษ)
  - ความคืบหน้าการส่ง และสรุปผล
- **Settings:**
  - unit ที่เปิด (ล็อกเมื่อเปิด pre-test)
  - LLM on/off
  - condition mode (`all_adaptive` | `ab_split`)
  - class code และ QR
  - รีเซ็ต PIN
  - ลบข้อมูลห้อง (ต้องยืนยันสองชั้น)
- **Export:** CSV รายตาราง + CSV วิจัยแบบ wide (ดู RESEARCH.md)

---

## 13. Data model (Postgres / Supabase)
Claude Code ปรับรายละเอียดได้ แต่ต้องคงความหมายเดิม เปิด RLS ทุกตาราง ไม่มี policy สำหรับ anon และเข้าถึงผ่าน server เท่านั้น
```
classes(id uuid pk, code text unique, name text, teacher_id uuid, settings jsonb, created_at)
students(id uuid pk, class_id fk, seat_no int, nickname text null, pin_hash text,
         condition text default 'adaptive', form_pre text, form_post text, created_at,
         unique(class_id, seat_no))
sessions(id, student_id, started_at, ended_at, user_agent)
learner_profiles(student_id pk, profile jsonb, updated_at)
attempts(id, session_id, student_id, item_ref jsonb, skill, difficulty, kind, target null,
         answer jsonb, classification, misconception null, variant null, wrong_cells jsonb null,
         time_ms, hint_level, revealed bool, created_at)
decisions(id, student_id, attempt_id null, trigger, mode, candidates jsonb, choice, message, path_note,
          narration jsonb null, reason, latency_ms, fallback_reason null, created_at)
scene_views(id, student_id, decision_id null, template, purpose, beats_total, beats_seen,
            replays, skipped bool, duration_ms, created_at)
hint_events(id, student_id, item_ref jsonb, level, created_at)
assessments(id, student_id, phase 'pre'|'post', form 'A'|'B', started_at, submitted_at)
assessment_responses(id, assessment_id, item_no, item_ref jsonb, answer jsonb, correct bool,
                     misconception null, variant null, time_ms)
```
สร้าง index ที่ `(student_id, created_at)` ของทุกตาราง log

---

## 14. API (route handlers)
| route | ทำอะไร |
|---|---|
| `POST /api/join` | {code, seatNo, pin, nickname?} → ตั้ง cookie (signed, httpOnly) → {student, needsConsent, next} |
| `POST /api/consent` | บันทึกการยินยอม |
| `POST /api/session/start` | เปิด session → NextTurn (trigger `session_start`) |
| `POST /api/attempt` | {itemRef, answer, timeMs, hintLevel, revealed} → server regenerate, classify, อัปเดต profile, เรียก director, log → {classification, nextTurn} |
| `POST /api/hint` | {itemRef, level} → {text, step?} + log |
| `POST /api/help` | {itemRef} (กด "ไม่เข้าใจ") → NextTurn ที่มี concept scene (ใช้ตัวอย่างพี่น้อง) |
| `POST /api/event` | scene_view และ event อื่นของ client |
| `GET /api/path` | ขั้นล่าสุดบนเส้นทางของนักเรียน (สำหรับหน้า `/learn`) |
| `GET /api/assessment/[phase]` · `POST .../submit` | ฟอร์มและการส่งคำตอบ |
| `/api/teacher/*` | classes CRUD, overview, settings, assign-conditions, reset-pin, delete-data (ต้องเป็นครูที่ login) |
| `GET /api/export?class=&table=` | CSV |

---

## 15. Privacy, consent, security

**เก็บ:**
- เลขที่ และชื่อเล่น (ไม่บังคับ)
- คำตอบ เวลาที่ใช้
- การกด hint และการดู scene

**ไม่เก็บ:** ชื่อจริง รูป เสียง ตำแหน่ง

**ข้อความยินยอม (ร่าง ให้ครูที่ปรึกษาตรวจก่อนใช้):**
> แอปนี้เป็นส่วนหนึ่งของโครงงานนวัตกรรมของนักเรียน ระบบจะเก็บเลขที่ ชื่อเล่น (ถ้าใส่) คำตอบ และเวลาที่ใช้ เพื่อปรับบทเรียนให้เหมาะกับแต่ละคน และนำไปวิเคราะห์แบบไม่ระบุตัวตนเพื่อส่งประกวด ข้อมูลบางส่วนที่ไม่ระบุตัวตนจะถูกส่งไปยังบริการ AI เพื่อช่วยเลือกบทเรียน ไม่มีการเก็บชื่อจริง รูป หรือเสียง หยุดใช้เมื่อไหร่ก็ได้ และข้อมูลทั้งหมดจะถูกลบภายใน 31 มี.ค. 2570

ถ้าโรงเรียนกำหนดให้ผู้ปกครองยินยอมด้วย ให้ทำตามโรงเรียน

**Security:**
- **Keys:** service-role key และ LLM key อยู่ฝั่ง server เท่านั้น
- **PIN:** เก็บเป็น hash (bcrypt หรือ scrypt)
- **cookie:** signed ด้วย `SESSION_SECRET`
- **Rate limit:** `/api/attempt`, `/api/hint`, `/api/help` และ `/api/join` (กันเดา PIN)
- **Input:** validate ทุก request ด้วย Zod และจำกัดขนาด input
- **ลบข้อมูล:** ครูกดลบข้อมูลห้องได้หลังจบการศึกษา

---

## 16. Demo, offline และแผนสำรอง
- **`DEMO_MODE=1`:** seed ห้องตัวอย่างและนักเรียนจำลอง 3 คนที่มีความเข้าใจผิดต่างกัน ไม่ต้องใช้เน็ตไปหา LLM (rules mode)
- **`/demo/split` (nice-to-have):** นักเรียนจำลอง 2 คนทำ unit เดียวกันคู่กัน ให้เห็นว่าเส้นทางแยกกัน ใช้ถ่ายวิดีโอ 3 นาทีและเดโม 14 ม.ค.
- **LLM ล่มหรือโดน rate limit:** ทำงานต่อด้วย rules อัตโนมัติ ครูปิด LLM ทั้งห้องได้
- **เน็ตโรงเรียนล่มวันสอบ:** ใช้ฟอร์ม A/B แบบพิมพ์ (พร้อมเฉลย) แล้วกรอกผลภายหลัง

---

## 17. Config (`lib/config.ts`) ค่าเริ่มต้น
```ts
export const CONFIG = {
  appName: 'QEDify: Matrix',
  tutorName: 'คิว',
  bkt: { pInit: 0.15, pTransit: 0.15, pSlip: 0.10, pGuessEntry: 0.05 }, // choice: 1/k
  bktFromPretest: { correct: 0.60, misconception: 0.10, otherWrong: 0.25 },
  mastery: { pKnown: 0.95, minFirstTryCorrect: 3, minFirstTryCorrectIfPretestCorrect: 1, minLevelToPass: 2 },
  difficulty: { window: 6, upAt: 0.85, downAt: 0.5, minAttemptsAtLevel: 2 },
  misconception: { activeAtCount: 2, resolveAfterTargetedCorrect: 2 },
  interleave: { every: 6, lookback: 10 },
  stuckAfterWrong: 3,
  pathStepsOnMap: 5,
  hintL2CountsAsWrong: true,
  llm: { timeoutMs: 4000, maxCandidates: 4, maxCallsPerMinutePerStudent: 20 },
  xp: { firstTry: 10, withL1Hint: 7, misconceptionResolved: 20 },
  generatorVersion: 1,
} as const;
```

---

## 18. Non-goals (ไม่ทำใน MVP)
- กล้อง ไมค์ วิเคราะห์ใบหน้าหรือท่าทาง
- เนื้อเรื่องแบบ open world หรือ story mode ทั้งเกม (ถ้าทำ ธีมถอดรหัสเป็นโจทย์ประยุกต์ได้แค่ข้อเดียว)
- สร้างวิดีโอจาก prompt ตอน runtime
- แอป native และโหมด offline แบบ PWA
- หัวข้ออื่นนอกจากเมทริกซ์
- แชทกับ AI (stretch หลังส่งงาน)
- เสียงพากย์ (stretch)

---

## 19. Extensibility (vision: คณิต ม.ปลายทุกเรื่อง)
- **โครงสร้าง topic pack:** แต่ละหัวข้อมี `lib/topics/<topic>/` (ops, skills, generators, misconceptions, worked, assessment) + scene templates ของตัวเอง
- **ส่วนที่ใช้ร่วมกันทุกหัวข้อ:** core, learner model, director และ UI
- **เขียนในแบบเสนอได้ว่า:** "สถาปัตยกรรมรองรับการเพิ่มหัวข้อ" แต่ห้ามเคลมว่าทำหัวข้ออื่นเสร็จแล้ว
