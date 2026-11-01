# Scenes (animation templates)

animation ที่ใช้ตัวเลขของนักเรียนเอง ทุกค่ามาจาก engine เท่านั้น ส่วน AI หรือ rules เป็นแค่ผู้เลือก template, ลำดับ beat และ caption

## 1. หลักออกแบบ (Mayer, Multimedia Learning)
- **Segmenting:** แบ่งเป็น beat สั้นๆ ละ ≤ 4 วินาที แล้วรอให้นักเรียนแตะเพื่อไปต่อ นักเรียนคุมจังหวะเอง
- **Signaling:** ไฮไลต์เฉพาะสิ่งที่ต้องดู ส่วนอื่นจางลง
- **Coherence:** ไม่ใส่ของตกแต่งที่ไม่เกี่ยว
- **Caption:** สั้น ไม่เกิน 1 บรรทัดบนจอ 360px (MVP ยังไม่มีเสียง เสียงพากย์เป็น stretch)
- **Personalization:**
  - ใช้ตัวเลขจากข้อที่นักเรียนเพิ่งทำ
  - โหมด compare วาง "ที่ทำมา" คู่กับ "ที่ถูก"
- **ความยาว:**
  - scene แก้ความเข้าใจผิด ≤ 25 วินาที
  - intro ของ unit ≤ 40 วินาที
  - concept scene ≤ 20 วินาที
  - จบ scene แล้วเจอโจทย์ทันที
  - นับจากผลรวมเวลาต่อ beat ที่ template ประกาศไว้ (แอนิเมชันกับเวลาค้างให้อ่าน) ไม่นับเวลารอแตะ ส่วน `duration_ms` ใน `scene_views` เก็บเวลาจริงรวมเวลารอแตะ

## 2. Types
```ts
type TemplateId =
  | 'row_col_dot' | 'dimension_match' | 'grid_transform' | 'inverse_recipe' | 'worked_solution' // Tier A
  | 'cell_locator' | 'transpose_flip' | 'sarrus';                                             // Tier B

interface SceneSpec<T extends TemplateId = TemplateId> {
  template: T;
  params: TemplateParams[T];                      // มาจาก engine: matrices, cell, mode, variant
  beats: BeatId<T>[];                             // ลำดับที่จะเล่น (ค่าเริ่มต้นมาจาก template)
  captions: Partial<Record<BeatId<T>, string>>;   // ข้อความไทยที่แทนค่า token แล้ว
  beatMs: Partial<Record<BeatId<T>, number>>;     // เวลาที่ประกาศของแต่ละ beat (≤ 4 วินาที)
  compare?: { studentAnswer: Answer; variant?: string };
  flagged?: BeatId<T>;                            // beat ที่ compare ชี้ เห็นบน progress dots
  purpose: 'intro' | 'concept' | 'remediate' | 'request' | 'reveal';
}
```
- template component ต้องเป็น pure ต่อ `SceneSpec` (render เหมือนเดิมทุกครั้ง)
- เปลี่ยน beat ด้วยแตะหรือปุ่ม "ต่อไป"
- `ScenePlayer` มีปุ่ม เล่นซ้ำ (เริ่มใหม่จาก beat แรก) / ข้าม และ progress dots แล้วส่ง `scene_view` event (beats_seen, replays, skipped, duration)
- `prefers-reduced-motion`: แสดงภาพนิ่งของแต่ละ beat แทนการเคลื่อนไหว

## 3. Tier A (ต้องมีก่อนทดลอง)

### 3.1 `row_col_dot`: แถว × หลัก
- **ใช้กับ:** M09 · M10 · M11 (matrix) · intro ของ Unit 3
- **params:** `{ A, B, cell: [i, j], variant?: 'elementwise' | 'row_row' | 'col_col' | 'reversed' }`
  - `cell` ค่าเริ่มต้นคือช่องแรกที่นักเรียนตอบผิด
- **beats:**
  1. `compare` (เฉพาะโหมด compare) แสดงสิ่งที่ทำมาแล้วขีดฆ่า:
     - elementwise: aᵢⱼ × bᵢⱼ
     - row_row: แถวของ B
     - reversed: BA
  2. `setup`: แสดง A, B และผลลัพธ์ C ที่ยังว่าง
  3. `pick_row`: ไฮไลต์แถว i ของ A
  4. `pick_col`: ไฮไลต์หลัก j ของ B
  5. `pair`: หมุนหลัก j มาวางใต้แถว i แล้วโยงเส้นคู่
  6. `multiply`: แสดงผลคูณแต่ละคู่ (ค่าจาก engine)
  7. `sum`: บวกรวมได้ cᵢⱼ
  8. `place`: ตัวเลขลอยเข้าช่อง (i, j) ของ C
  9. `fill_rest` (ไม่บังคับ): เติมช่องอื่นแบบเร็ว
- **caption เริ่มต้น:**
  - setup "หาช่องแถว {{i}} หลัก {{j}} ของ AB"
  - pick_row "ใช้แถวที่ {{i}} ของ A ทั้งแถว"
  - pick_col "คู่กับหลักที่ {{j}} ของ B ทั้งหลัก"
  - pair "ตัวแรกคู่ตัวแรก ตัวที่สองคู่ตัวที่สอง…"
  - multiply "คูณแต่ละคู่"
  - sum "บวกผลคูณทั้งหมด"
  - place "ได้ค่าของช่องนี้แล้ว"
- **caption ของ compare:**
  - elementwise "ที่ทำมา: เอาตัวเลขตำแหน่งเดียวกันมาคูณกัน"
  - row_row "ที่ทำมา: ใช้แถวของ B แต่ต้องใช้หลัก"
  - col_col "ที่ทำมา: ใช้หลักของ A แต่ต้องใช้แถว"
  - reversed "ที่ทำมา: คูณสลับลำดับกับที่โจทย์ถาม"

### 3.2 `dimension_match`: มิติ
- **ใช้กับ:** M01 · M04 · M08
- **params:** `{ op: 'single' | 'add' | 'mult', dimsA, dimsB?, studentDims? }`
- **beats:**
  - `blocks`: แสดงกล่องขนาดตามมิติ ป้ายแถว×หลัก
  - `check`:
    - mult: ไฮไลต์เลขด้านใน n กับ r ถ้าเท่ากันขึ้นสีเขียว ไม่เท่าขึ้นสีแดง
    - add: มิติต้องเท่ากันทั้งคู่
  - `result`:
    - mult: เลขด้านนอก m กับ p ประกอบเป็นกล่องผลลัพธ์
    - ถ้าคำนวณไม่ได้ แสดง "หาค่าไม่ได้"
  - โหมด single: ลูกศรนับแถวก่อน (แนวนอน) แล้วนับหลัก (แนวตั้ง) → "{{dimsA}}"
- **caption:** "ตัวในต้องเท่ากัน" · "ตัวนอกคือมิติของผลคูณ" · "แถวก่อน หลักทีหลัง"
- **`studentDims`:** ขีดฆ่าคำตอบของนักเรียนไว้ใน beat `result` รวมถึงกรณีตอบ "หาค่าไม่ได้" (SAME_DIMS) และตอบตัวเลขด้านนอกโดยไม่เช็กตัวใน (RESULT_OUTER)

### 3.3 `grid_transform`: เมทริกซ์ 2×2 คือการแปลงระนาบ
- **ใช้กับ:** M11 (choice) · M14 · M18 · M19 · M22 · intro ของ Unit 4–5
- **params:** `{ M, N?, mode: 'det_area' | 'det_zero' | 'scale_k' | 'compose' | 'undo', k? }`
- **องค์ประกอบ:** ตาราง, สี่เหลี่ยมหน่วย, เวกเตอร์ฐาน î ĵ (สีต่างกัน)
- **การเคลื่อนไหว:** interpolate แบบ I + t(M − I)
  - เมื่อ det(M) < 0 รูปจะต้องแบนชั่วขณะระหว่างทาง (ต่อเนื่อง) ให้ใช้เป็นจุดอธิบายเรื่อง "พลิกด้าน"
- **beats ตาม mode:**
  - **det_area:**
    - `unit` "สี่เหลี่ยมนี้พื้นที่ 1 หน่วย"
    - `apply` แปลงด้วย M
    - `area` "พื้นที่ใหม่ = |det| = {{absDet}} เท่า"
    - (det < 0) `flip` "พลิกด้านด้วย"
  - **det_zero:** `apply` แล้วแบนเป็นเส้น → `cant_undo` "พื้นที่เป็น 0 ย้อนกลับไม่ได้ จึงไม่มีอินเวอร์ส"
  - **scale_k:** `apply` M แล้วต่อด้วย kM แบ่ง caption เป็น beat ละบรรทัด
    - `scale` "ขยายทั้งสองแกน แกนละ {{absK}} เท่า"
    - `area` "พื้นที่จึงขยาย {{kPow2}} = {{factor}} เท่า" เมื่อ k ติดลบให้เขียน (−3)² ไม่ใช่ −3²
    - (n = 3) `cube` "3×3 มีสามแกน จึงเป็น {{kPow3}} เท่า"
  - **compose:** สองกรอบคู่กัน
    - ซ้าย: ทำ N ก่อนแล้ว M (= MN)
    - ขวา: ทำ M ก่อนแล้ว N (= NM)
    - → `differ` "ลำดับต่างกัน ผลต่างกัน"
  - **undo:** apply M แล้ว apply M⁻¹ กลับเป็นสี่เหลี่ยมเดิม
    - สำหรับ M22: ย้อนตามลำดับกลับกัน "ใส่ถุงเท้าแล้วใส่รองเท้า ตอนถอดต้องถอดรองเท้าก่อน"
- **ตัวอย่างค่า (ตรวจแล้ว):**
  - det_area: M=[[2,1],[0,1]] det 2 (ระหว่าง interpolate det > 0 ตลอด)
  - det_zero: [[2,4],[1,2]]
  - compose: R=[[0,−1],[1,0]], S=[[2,0],[0,1]] → RS=[[0,−1],[2,0]] ≠ SR=[[0,−2],[1,0]]
- **ข้อที่ไม่มีเมทริกซ์ 2×2 ให้วาด ใช้ตัวอย่าง 2×2 จาก engine แล้วบอกใน caption แรกว่าเป็นตัวอย่าง:**
  - M14 (`det_scaled`): 2×2 ที่ det เท่ากับ d ของข้อ ใช้ k ของข้อ และถ้า n = 3 มี beat `cube` ปิดท้าย
  - M18 และ M19 ที่ L3 (3×3): ตัวอย่างพี่น้องจาก generator `invertible` (M18 ใช้ L1, M19 ใช้ L2)
  - M11 ข้อ choice: คู่เล็กจากชุดการแปลงพื้นฐาน เช่น หมุน ยืด เฉือน ที่ engine ตรวจว่า AB ≠ BA เพราะคู่ของ generator ผลคูณถึงราว 72 จนอ่านบนตารางไม่ออก
- **ข้อควรรู้:** การมองเมทริกซ์เป็นการแปลงเกินหลักสูตรที่สอนกันทั่วไป ใช้เป็นภาพช่วยให้เข้าใจเท่านั้น ส่วนโจทย์ยังอิงหลักสูตร

### 3.4 `inverse_recipe`: สลับ → กลับเครื่องหมาย → หาร
- **ใช้กับ:** M20 · M21
- **params:** `{ A (2×2), variant? }`
- **beats:**
  1. `show` "อินเวอร์ส: สลับ → กลับเครื่องหมาย → หาร"
  2. `swap`: a กับ d สลับที่ (animate)
  3. `negate`: b กับ c เปลี่ยนเครื่องหมาย อยู่ที่เดิม
  4. `det`: det = ad − bc = {{det}}
  5. `divide`: ทุกตัวหารด้วย det
  6. `check` (ไม่บังคับ): A·A⁻¹ = I
- **compare:** ไฮไลต์ beat ที่นักเรียนข้ามไป พร้อม caption ตาม variant
  - NO_SWAP "ลืมสลับ a กับ d"
  - NO_NEGATE "ลืมเปลี่ยนเครื่องหมาย b กับ c"
  - NO_DIVIDE "ลืมหารด้วย det"
  - TIMES_DET "คูณด้วย det แทนที่จะหาร"
  - TRANSPOSED "b กับ c ไม่ต้องสลับที่ แค่เปลี่ยนเครื่องหมาย"
  - RECIPROCAL "อินเวอร์สไม่ใช่การกลับเศษทีละตัว"
- **ตัวอย่าง:** A=[[3,1],[4,2]], det 2 → A⁻¹=[[1,−1/2],[−2,3/2]]

### 3.5 `worked_solution`: วิธีทำทีละขั้น (fallback กลาง)
- **params:** `{ steps: Step[] }` จาก `workedSteps(item, focus?)` โดย Step = { labelKey, latex, value }
- **การแสดง:** เปิดทีละขั้น เรนเดอร์สูตรด้วย KaTeX
- **ใช้กับ:**
  - "ดูวิธีทำ"
  - hint L3 (โฟกัสขั้นหรือช่องเดียว)
  - misconception ที่ไม่มี template เฉพาะ (M05, M07, M15)
- **ตัวอย่างขั้น (mult ช่อง 1,1):** c₁₁ = a₁₁b₁₁ + a₁₂b₂₁ = 2·1 + 1·2 = 4

## 4. Tier B
- **`cell_locator` (M02):**
  - `row` ไฮไลต์แถว i "แถวที่ {{i}} คือแนวนอน"
  - `col` ไฮไลต์หลัก j "หลักที่ {{j}} คือแนวตั้ง"
  - `hit` จุดตัด "จุดตัดคือ {{name}}"
  - `compare` ช่อง (j, i) สีเตือน "อันนี้คือ {{name}} ที่สลับเลขกัน"
- **`transpose_flip` (M03):**
  - วาดเส้นทแยงหลัก แล้วแถวที่ 1 ย้ายไปเป็นหลักที่ 1 ของ Aᵀ ทีละแถว (`row_1`, `row_2`, …) วางสองเมทริกซ์คู่กันเพราะมิติของ A กับ Aᵀ อาจต่างกัน
  - `compare` วางผลการหมุนของนักเรียนไว้ข้าง A
    - ROT_CW และ ROT_CCW "หมุน ≠ สะท้อนตามเส้นทแยง"
    - ANTI "เส้นทแยงรอง ≠ เส้นทแยงหลัก"
    - FLIP_H และ FLIP_V "พลิก ≠ สะท้อนตามเส้นทแยง"
    - SAME "ยังไม่ได้เปลี่ยนแถวเป็นหลัก"
- **`sarrus` (M12, M13):**
  - **3×3 (`copy` → `compare` → `down` → `up` → `result`):**
    - คัด 2 หลักแรกต่อท้าย
    - 3 เส้นลง (บวก, เขียว) พร้อมผลคูณ
    - 3 เส้นขึ้น (ลบ, สีเตือน) พร้อมผลคูณ
    - รวมผล
  - **2×2 (`compare` → `down` → `up` → `result`):** เส้นลง ad (บวก) และเส้นขึ้น bc (ลบ)
  - **compare ตาม variant:**
    - ALL_PLUS: เส้นขึ้นกระพริบ "เส้นขึ้นต้องลบ ไม่ใช่บวก"
    - NO_ALT_SIGN: แสดงแพทเทิร์น + − + "แถวแรกต้องสลับเครื่องหมาย + − +"
    - TWO_DIAG: "ต้องครบ 6 เส้น"
    - ADD: สองเส้นทแยง "ที่ทำมา: บวกสองเส้น แต่ต้องลบกัน"
    - REVERSE: สองเส้นทแยง "ที่ทำมา: เอาเส้นขึ้นตั้ง ต้องเอาเส้นลงตั้ง"
    - PAIRS_ROW: เส้นตามแถว "ที่ทำมา: คูณตามแถว ต้องคูณตามแนวทแยง"
    - PAIRS_COL: เส้นตามหลัก "ที่ทำมา: คูณตามหลัก ต้องคูณตามแนวทแยง"
- **สี:** ธีมไม่มีสีแดง ใช้สี `warn` ของแอปแทน ความหมายเดียวกับสีเตือนใน `FeedbackCard`

## 5. Intro ของแต่ละ unit (≤ 40 วิ ประกอบจาก template ด้วยตัวอย่างชีวิตจริง)
- **U1:** ตารางยอดขาย ร้าน × สินค้า ก็คือเมทริกซ์ แถวกับหลักบอกอะไร ด้วย `dimension_match` single ที่มีป้ายร้านและสินค้า
- **U2:** ยอดขายสองสาขารวมกัน (A + B) และสั่งของเพิ่มเป็น k เท่า (kA) ด้วย `worked_solution`
- **U3:** จำนวนสินค้า × ราคา = รายได้ (แถว·หลัก) ด้วย `row_col_dot`
- **U4:** det = พื้นที่ขยายกี่เท่า ด้วย `grid_transform` det_area
- **U5:** อินเวอร์ส = ย้อนการแปลง ด้วย `grid_transform` undo (ธีม "ถอดรหัส" ใช้เป็นโจทย์ประยุกต์ข้อสุดท้ายได้ 1 ข้อ)

### 5.1 คลิปนำของแต่ละ skill (concept scene)
เล่นก่อนข้อแรกของ skill ใหม่ (SPEC §4) และเมื่อกดปุ่ม "ไม่เข้าใจ" ตัวอย่างมาจาก generator ด้วย seed ใหม่ที่ไม่แตะ counter (SPEC §6) และต้องไม่ใช่ข้อที่กำลังทำหรือกำลังจะทำ ไม่มีคำตอบเดียวกับข้อนั้น และต้องแสดงสิ่งที่คลิปสอนได้จริง เช่น ไม่ใช้ตัวอย่างที่ทุกคู่คูณกันได้ 0, k = ±1 หรือเมทริกซ์สมมาตร

| skill | template | โหมด |
|---|---|---|
| `dim` | `dimension_match` | single |
| `index` | `cell_locator` | |
| `transpose` | `transpose_flip` | |
| `addsub` | `dimension_match` | add |
| `scalar` | `worked_solution` | ไฮไลต์ทุกช่อง |
| `mult_defined` | `dimension_match` | mult |
| `mult` | `row_col_dot` | ไม่มี beat compare |
| `mult_noncomm` | `grid_transform` | compose |
| `det2` | `sarrus` | 2×2 |
| `det3` | `sarrus` | 3×3 |
| `det_props` | `grid_transform` | scale_k |
| `invertible` | `grid_transform` | det_zero |
| `inv2` | `inverse_recipe` | ไม่มี beat compare |

**ความยาว:** ถ้ารวมแล้วเกิน 20 วินาที ให้ลดเวลาต่อ beat หรือตัด beat ที่ไม่จำเป็น เช่น `fill_rest`

## 6. Implementation notes
- **การวาด:** SVG + `motion` ตัวเลขย้ายช่องด้วย transform ที่รู้ตำแหน่งปลายทางอยู่แล้ว ต้องลื่นบน Android รุ่นล่าง: animate แค่ transform/opacity
- **`MatrixView`:** เป็น HTML จึงใช้ในโจทย์และ `worked_solution` ส่วน template ที่วาดบน SVG ใช้ตัววาดใน `components/scenes/svg.tsx` ที่หน้าตาเหมือนกัน (ฟอนต์ วงเล็บ เศษส่วนซ้อน)
- **`/dev/scenes`:** gallery ที่เลือก template, mode, variant และตัวเลขได้ ใช้ตรวจงานและอัดวิดีโอ
- **ทดสอบ:**
  - ทุก ★ misconception ต้องมี scene ที่เล่นได้ด้วยตัวเลขจาก generator (snapshot ของ SceneSpec)
  - ทุก ★ skill ต้องมี concept scene ที่เล่นได้ และไม่เกิน 20 วินาที
  - caption ไม่ล้นบรรทัดที่ 360px

## 7. Stretch
- **คลิป hook ต่อ unit:** อัดจาก `/dev/scenes` โหมด presentation หรือทำด้วย Manim ล่วงหน้า (ไม่สร้างตอน runtime)
- **เสียงพากย์ไทย:** ลอง Web Speech API `th-TH` ถ้าเครื่องรองรับ หรือใช้ TTS แบบ pre-render
