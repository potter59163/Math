// Thai copy for the vector topic pack (docs/VECTORS.md). Code and comments are English; only the
// strings are Thai. Every block was drafted by the engine author and waits for Potter and a maths
// teacher to check wording and maths.

const FIGURE_POINTS = ['A', 'B', 'C', 'D', 'M', 'N'] as const;
const FIGURE_SCALES = { '': '', '2': '2', '1/2': '½' } as const;

type FigurePoint = (typeof FIGURE_POINTS)[number];
type FigureScale = keyof typeof FIGURE_SCALES;

/** A named vector of a geometry figure, such as "DC", "2MN" or "1/2BC" (shown as ½BC). */
export type FigureVectorKey = `${FigureScale}${FigurePoint}${FigurePoint}`;

function figureVectorLabels(): Record<FigureVectorKey, string> {
  const labels: Partial<Record<FigureVectorKey, string>> = {};
  for (const [scale, shown] of Object.entries(FIGURE_SCALES) as [FigureScale, string][]) {
    for (const from of FIGURE_POINTS) {
      for (const to of FIGURE_POINTS) labels[`${scale}${from}${to}`] = `${shown}${from}${to}`;
    }
  }
  return labels as Record<FigureVectorKey, string>;
}

export const thVector = {
  // TODO(review): unit titles, in the order of สสวท. คณิตศาสตร์เพิ่มเติม ม.5 เล่ม 1 บทที่ 3.
  units: {
    11: 'เวกเตอร์เชิงเรขาคณิต',
    12: 'เวกเตอร์ในระบบพิกัดฉาก',
    13: 'ขนาดและเวกเตอร์หนึ่งหน่วย',
    14: 'ผลคูณเชิงสเกลาร์',
    15: 'ผลคูณเชิงเวกเตอร์',
  },

  // TODO(review): how a unit is badged on the path.
  unitBadges: {
    11: 'V1',
    12: 'V2',
    13: 'V3',
    14: 'V4',
    15: 'V5',
  },

  // TODO(review): skill names from docs/VECTORS.md §2.
  skills: {
    v_quantity: 'ปริมาณเวกเตอร์ การเท่ากัน นิเสธ',
    v_geom: 'บวก ลบ คูณสเกลาร์ในรูป',
    v_points: 'เวกเตอร์จากจุดสองจุด',
    v_linear: 'บวก ลบ คูณสเกลาร์ในพิกัด',
    v_parallel: 'เวกเตอร์ขนานกัน',
    v_magnitude: 'ขนาดของเวกเตอร์',
    v_unit: 'เวกเตอร์หนึ่งหน่วย',
    v_dot: 'ผลคูณเชิงสเกลาร์',
    v_angle: 'มุมระหว่างเวกเตอร์',
    v_perp: 'เวกเตอร์ตั้งฉากกัน',
    v_cross: 'ผลคูณเชิงเวกเตอร์',
    v_area: 'พื้นที่จากผลคูณเชิงเวกเตอร์',
    v_volume: 'ปริมาตรทรงสี่เหลี่ยมด้านขนาน',
  },

  // TODO(review): names from the headings of docs/VECTORS.md §4.
  misconceptionNames: {
    V01_QUANTITY_MIX: 'สับสนปริมาณสเกลาร์กับเวกเตอร์',
    V02_EQUAL_IGNORES_DIRECTION: 'คิดว่ายาวเท่ากันและขนานกันแล้วเท่ากัน ไม่ดูทิศ',
    V03_GEOM_SUB_DIRECTION: 'ลบเวกเตอร์แล้วได้ทิศกลับ',
    V04_GEOM_ADD_JOIN_TIPS: 'บวกเวกเตอร์ด้วยการลากเชื่อมปลาย',
    V05_POINTS_REVERSED: 'หา AB ด้วย A − B',
    V06_SCALAR_PARTIAL: 'คูณสเกลาร์แค่องค์ประกอบแรก',
    V07_COMBO_SIGN: 'ลืมเครื่องหมายลบหน้าสเกลาร์ตัวหลัง',
    V08_PARALLEL_RATIO_FLIP: 'ตั้งอัตราส่วนของเวกเตอร์ขนานกลับด้าน',
    V09_MAG_NO_ROOT: 'ลืมถอดรากที่สอง',
    V10_MAG_SUM_COMPONENTS: 'คิดว่าขนาดคือผลบวกขององค์ประกอบ',
    V11_MAG_ADDITIVE: 'คิดว่า |u + v| = |u| + |v|',
    V12_UNIT_SQUARED: 'หารด้วย |v|² แทน |v|',
    V13_UNIT_DIVIDE_SUM: 'หารด้วยผลบวกขององค์ประกอบ',
    V14_DOT_AS_DET: 'คิดผลคูณเชิงสเกลาร์แบบ det',
    V15_DOT_NO_COS: 'ลืมคูณ cos θ',
    V16_DOT_SIN: 'ใช้ sin θ แทน cos θ',
    V17_ANGLE_ABS: 'ได้มุมแหลมแทนมุมป้าน',
    V18_ANGLE_SQUARED_NORMS: 'หารด้วย |u|²|v|² (ลืมถอดราก)',
    V19_PERP_AS_PARALLEL: 'ใช้เงื่อนไขขนานแทนเงื่อนไขตั้งฉาก',
    V20_CROSS_MIDDLE_SIGN: 'ลืมเครื่องหมายลบขององค์ประกอบกลาง',
    V21_CROSS_ORDER: 'คิดว่า u × v = v × u',
    V22_CROSS_COMPONENTWISE: 'คูณองค์ประกอบตำแหน่งเดียวกัน',
    V23_TRIANGLE_NO_HALF: 'ลืม ½ ตอนหาพื้นที่สามเหลี่ยม',
    V24_AREA_DOT: 'ใช้ผลคูณเชิงสเกลาร์หาพื้นที่',
    V25_VOLUME_SIGNED: 'ตอบปริมาตรติดลบ',
    V26_VOLUME_MAG_PRODUCT: 'คูณขนาดทั้งสามแทน',
  },

  // TODO(review): short names, at most 16 code units so a path note fits one line.
  misconceptionShort: {
    V01_QUANTITY_MIX: 'สับสนสเกลาร์',
    V02_EQUAL_IGNORES_DIRECTION: 'ไม่ดูทิศ',
    V03_GEOM_SUB_DIRECTION: 'ลบแล้วทิศกลับ',
    V04_GEOM_ADD_JOIN_TIPS: 'ลากเชื่อมปลาย',
    V05_POINTS_REVERSED: 'ต้นลบปลาย',
    V06_SCALAR_PARTIAL: 'คูณ k ไม่ครบ',
    V07_COMBO_SIGN: 'ลืมเครื่องหมายลบ',
    V08_PARALLEL_RATIO_FLIP: 'อัตราส่วนกลับ',
    V09_MAG_NO_ROOT: 'ลืมถอดราก',
    V10_MAG_SUM_COMPONENTS: 'บวกองค์ประกอบ',
    V11_MAG_ADDITIVE: 'บวกขนาดตรงๆ',
    V12_UNIT_SQUARED: 'หารด้วย |v|²',
    V13_UNIT_DIVIDE_SUM: 'หารด้วยผลบวก',
    V14_DOT_AS_DET: 'คูณไขว้แบบ det',
    V15_DOT_NO_COS: 'ลืมคูณ cos',
    V16_DOT_SIN: 'ใช้ sin แทน cos',
    V17_ANGLE_ABS: 'ได้มุมแหลม',
    V18_ANGLE_SQUARED_NORMS: 'ลืมถอดรากตัวหาร',
    V19_PERP_AS_PARALLEL: 'ใช้เงื่อนไขขนาน',
    V20_CROSS_MIDDLE_SIGN: 'ลืมลบตัวกลาง',
    V21_CROSS_ORDER: 'คิดว่าสลับได้',
    V22_CROSS_COMPONENTWISE: 'คูณทีละตำแหน่ง',
    V23_TRIANGLE_NO_HALF: 'ลืมคูณครึ่ง',
    V24_AREA_DOT: 'ใช้ดอทหาพื้นที่',
    V25_VOLUME_SIGNED: 'ปริมาตรติดลบ',
    V26_VOLUME_MAG_PRODUCT: 'คูณขนาดสามตัว',
  },

  // TODO(review): L2 hints, from docs/VECTORS.md §4.
  hints: {
    V01_QUANTITY_MIX: 'ถามตัวเองว่า บอกแค่ขนาดพอไหม หรือต้องบอกทิศด้วย',
    V02_EQUAL_IGNORES_DIRECTION: 'เท่ากันต้องยาวเท่ากัน และชี้ไปทางเดียวกันด้วย',
    V03_GEOM_SUB_DIRECTION: 'u − v คือเวกเตอร์ที่บวกกับ v แล้วได้ u ลูกศรจึงชี้ไปหาตัวตั้ง',
    V04_GEOM_ADD_JOIN_TIPS: 'ย้ายตัวหลังไปต่อหัวตัวแรก (หัวต่อหาง) แล้วลากจากหางแรกไปหัวสุดท้าย',
    V05_POINTS_REVERSED: 'ปลายลบต้น: B − A',
    V06_SCALAR_PARTIAL: 'k ต้องคูณทุกองค์ประกอบ เหมือนคูณสเกลาร์กับเมทริกซ์',
    V07_COMBO_SIGN: 'เขียนพจน์ที่มีเครื่องหมายลบออกมาเป็นเวกเตอร์ก่อน แล้วค่อยบวก',
    V08_PARALLEL_RATIO_FLIP: 'ขนานกันแปลว่า u = kv หา k จากองค์ประกอบที่รู้ทั้งคู่ก่อน',
    V09_MAG_NO_ROOT: 'ยกกำลังสอง บวก แล้วอย่าลืมถอดราก',
    V10_MAG_SUM_COMPONENTS: 'ขนาดคือความยาวเส้นตรงจากหางถึงหัว ใช้พีทาโกรัส',
    V11_MAG_ADDITIVE: 'บวกเวกเตอร์ก่อน แล้วค่อยหาขนาด ทางอ้อมยาวกว่าทางตรงเสมอ',
    V12_UNIT_SQUARED: 'หารด้วยความยาว |v| ไม่ใช่ความยาวยกกำลังสอง แล้วตรวจว่ายาว 1 จริงไหม',
    V13_UNIT_DIVIDE_SUM: 'เวกเตอร์หนึ่งหน่วยยาว 1 จึงต้องหารด้วยขนาด',
    V14_DOT_AS_DET: 'คู่ตำแหน่งเดียวกัน: ตัวแรกคูณตัวแรก ตัวที่สองคูณตัวที่สอง แล้วบวก',
    V15_DOT_NO_COS: 'u · v = |u||v|cos θ',
    V16_DOT_SIN: 'u · v = |u||v|cos θ',
    V17_ANGLE_ABS: 'u · v ติดลบแปลว่ามุมป้าน',
    V18_ANGLE_SQUARED_NORMS: 'ตัวหารคือขนาด (มีราก) ไม่ใช่ขนาดยกกำลังสอง',
    V19_PERP_AS_PARALLEL: 'ตั้งฉากกันแปลว่า u · v = 0',
    V20_CROSS_MIDDLE_SIGN: 'กระจายแถว i, j, k แล้วเครื่องหมายเป็น + − +',
    V21_CROSS_ORDER: 'สลับลำดับแล้วทิศกลับ: v × u = −(u × v)',
    V22_CROSS_COMPONENTWISE: 'u × v ต้องตั้งฉากกับทั้ง u และ v ลองเอาคำตอบดอทกับ u ดู',
    V23_TRIANGLE_NO_HALF: 'สามเหลี่ยมเป็นครึ่งหนึ่งของสี่เหลี่ยมด้านขนาน',
    V24_AREA_DOT: 'พื้นที่ใช้ขนาดของ u × v',
    V25_VOLUME_SIGNED: 'ปริมาตร = |u · (v × w)| ไม่มีทางติดลบ',
    V26_VOLUME_MAG_PRODUCT: 'กล่องเอียงเตี้ยกว่ากล่องตั้งตรง ใช้ u · (v × w)',
  },

  // TODO(review): L1 hints, one principle per item form, with no tokens to fill.
  hintL1: {
    quantity_kind: 'ปริมาณเวกเตอร์ต้องบอกทั้งขนาดและทิศทาง',
    figure_equal: 'เวกเตอร์สองตัวเท่ากันเมื่อยาวเท่ากันและชี้ทางเดียวกัน',
    figure_expr: 'ต่อลูกศรแบบหัวต่อหาง แล้วลากจากหางแรกไปหัวสุดท้าย',
    points: 'เวกเตอร์จาก A ไป B คือจุดปลายลบจุดต้น',
    fourth_vertex: 'ด้านตรงข้ามของสี่เหลี่ยมด้านขนานเป็นเวกเตอร์ที่เท่ากัน',
    linear: 'คูณสเกลาร์และบวกลบกันทีละองค์ประกอบ',
    parallel: 'u ขนานกับ v เมื่อ u = kv สำหรับจำนวนจริง k',
    magnitude: 'ขนาดคือรากที่สองของผลบวกกำลังสองขององค์ประกอบ',
    magnitude_combo: 'หาเวกเตอร์ผลลัพธ์ให้เสร็จก่อน แล้วค่อยหาขนาด',
    distance: 'ระยะระหว่างจุดคือขนาดของเวกเตอร์ที่เชื่อมสองจุด',
    unit: 'เวกเตอร์หนึ่งหน่วยได้จากการหารเวกเตอร์ด้วยขนาดของมัน',
    scaled_unit: 'หาเวกเตอร์หนึ่งหน่วยก่อน แล้วคูณด้วยความยาวที่ต้องการ',
    direction_cosines: 'โคไซน์แสดงทิศทางคือองค์ประกอบของเวกเตอร์หนึ่งหน่วย',
    dot: 'ผลคูณเชิงสเกลาร์ได้จากการคูณคู่ตำแหน่งเดียวกันแล้วบวก',
    dot_polar: 'ผลคูณเชิงสเกลาร์คือขนาดคูณขนาดคูณ cos ของมุม',
    cos_angle: 'cos θ คือผลคูณเชิงสเกลาร์หารด้วยผลคูณของขนาด',
    angle: 'หา cos θ ก่อน แล้วอ่านมุมมาตรฐานที่มี cos ค่านั้น',
    perp: 'u ตั้งฉากกับ v เมื่อ u · v = 0',
    perp_property: '(u + v) · (u − v) เท่ากับ |u|² − |v|²',
    cross: 'ผลคูณเชิงเวกเตอร์ได้จากการกระจาย det ตามแถว i, j, k',
    area_parallelogram: 'พื้นที่สี่เหลี่ยมด้านขนานคือขนาดของผลคูณเชิงเวกเตอร์ของด้านประชิด',
    area_triangle: 'พื้นที่สามเหลี่ยมเป็นครึ่งหนึ่งของสี่เหลี่ยมด้านขนาน',
    volume: 'ปริมาตรคือค่าสัมบูรณ์ของ u · (v × w)',
  },

  // TODO(review): item prompts, kept short for a 360px screen. The givens show below the prompt.
  prompts: {
    quantity_vector: 'ข้อใดเป็นปริมาณเวกเตอร์',
    quantity_scalar: 'ข้อใดเป็นปริมาณสเกลาร์',
    figure_equal: 'เวกเตอร์ใดเท่ากับ {{v}}',
    figure_negative: 'เวกเตอร์ใดเป็นนิเสธของ {{v}}',
    figure_expr: '{{expr}} เท่ากับเวกเตอร์ใด',
    points_find: 'จงหาเวกเตอร์ AB',
    fourth_vertex: 'จงหาจุด D ที่ทำให้ ABCD เป็นสี่เหลี่ยมด้านขนาน',
    linear_find: 'จงหา {{expr}}',
    parallel_find: 'u ขนานกับ v จงหาค่า {{x}}',
    magnitude_find: 'จงหาขนาดของ v',
    magnitude_combo: 'จงหา |{{expr}}|',
    distance_find: 'จงหาระยะระหว่างจุด A และ B',
    unit_find: 'จงหาเวกเตอร์หนึ่งหน่วยที่มีทิศเดียวกับ v',
    scaled_unit: 'จงหาเวกเตอร์ที่ยาว {{length}} หน่วย และมีทิศเดียวกับ v',
    direction_cosines: 'จงหาโคไซน์แสดงทิศทางของ v',
    dot_find: 'จงหา u · v',
    dot_polar: '|u| = {{u}}, |v| = {{v}} และ u ทำมุม {{theta}}° กับ v จงหา u · v',
    cos_find: 'จงหา cos θ เมื่อ θ เป็นมุมระหว่าง u และ v',
    angle_find: 'จงหามุมระหว่าง u และ v (องศา)',
    perp_find: 'u ตั้งฉากกับ v จงหาค่า k',
    perp_property: 'u + v ตั้งฉากกับ u − v จงหาค่า k ที่เป็นบวก',
    cross_uv: 'จงหา u × v',
    cross_vu: 'จงหา v × u',
    area_parallelogram: 'จงหาพื้นที่สี่เหลี่ยมด้านขนานที่มี u และ v เป็นด้านประชิด',
    area_triangle: 'จงหาพื้นที่สามเหลี่ยม ABC',
    volume_find: 'จงหาปริมาตรทรงสี่เหลี่ยมด้านขนานที่มี u, v, w เป็นด้าน',
  },

  // TODO(review): choice labels. Figure vectors are point names; the UI draws the arrow over them.
  choices: {
    q_velocity: 'ความเร็ว',
    q_speed: 'อัตราเร็ว',
    q_displacement: 'การกระจัด',
    q_distance: 'ระยะทาง',
    q_weight: 'น้ำหนัก',
    q_mass: 'มวล',
    q_force: 'แรง',
    q_acceleration: 'ความเร่ง',
    q_momentum: 'โมเมนตัม',
    q_temperature: 'อุณหภูมิ',
    q_time: 'เวลา',
    q_volume: 'ปริมาตร',
    q_energy: 'พลังงาน',
    q_area: 'พื้นที่',
    ...figureVectorLabels(),
  },

  // TODO(review): captions of worked steps. Numbers stay in the formula beside each caption.
  worked: {
    quantity_rule: 'ปริมาณเวกเตอร์ต้องบอกทั้งขนาดและทิศทาง',
    quantity_answer: 'ข้อนี้จึงเป็นคำตอบ',
    figure_length: 'ยาวเท่ากันและขนานกัน',
    figure_equal_result: 'ชี้ไปทางเดียวกันด้วย จึงเท่ากัน',
    figure_negative_result: 'ชี้ไปทางตรงข้าม จึงเป็นนิเสธ',
    geom_reverse: 'ลบเวกเตอร์คือบวกเวกเตอร์ที่กลับทิศ',
    geom_half: 'ครึ่งหนึ่งของเวกเตอร์ไปถึงจุดกึ่งกลาง',
    geom_translate: 'เลื่อนเวกเตอร์ไปต่อหัว โดยยาวและทิศเท่าเดิม',
    geom_chain: 'หัวต่อหาง: ลากจากหางแรกไปหัวสุดท้าย',
    geom_same: 'เป็นเวกเตอร์เดียวกับตัวเลือกนี้',
    points_component: 'องค์ประกอบที่ {{i}}: ปลายลบต้น',
    points_result: 'ได้เวกเตอร์ AB',
    vertex_rule: 'ABCD เป็นสี่เหลี่ยมด้านขนาน จึงได้ AD = BC',
    vertex_bc: 'หา BC จาก C − B',
    vertex_component: 'องค์ประกอบที่ {{i}} ของ D: A บวก BC',
    vertex_result: 'D = A + BC',
    linear_read: 'เขียน ai + bj + ck เป็น (a, b, c)',
    linear_scale: 'คูณ {{k}} เข้าทุกองค์ประกอบของ {{name}}',
    linear_component: 'รวมองค์ประกอบที่ {{i}}',
    linear_result: 'ครบทุกองค์ประกอบแล้ว',
    parallel_k: 'ขนานกัน จึงมี k ที่ u = kv หา k จากคู่ที่รู้ทั้งสองตัว',
    parallel_solve: 'ใช้ k เดิมกับองค์ประกอบที่มี {{x}}',
    magnitude_vector: 'หาเวกเตอร์ให้เสร็จก่อน',
    magnitude_square: 'ยกกำลังสองทุกองค์ประกอบแล้วบวก',
    magnitude_root: 'ถอดรากที่สอง แล้วทำให้อยู่ในรูปอย่างง่าย',
    unit_norm: 'หาขนาดของ v ก่อน',
    unit_component: 'หารองค์ประกอบที่ {{i}} ด้วย |v|',
    unit_result: 'ได้เวกเตอร์หนึ่งหน่วย',
    scaled_result: 'คูณเวกเตอร์หนึ่งหน่วยด้วย {{length}}',
    dircos_result: 'โคไซน์แสดงทิศทางคือองค์ประกอบของเวกเตอร์หนึ่งหน่วย',
    dot_pairs: 'คูณคู่ตำแหน่งเดียวกัน แล้วบวก',
    dot_cos: 'ค่า cos ของมุมนี้',
    dot_polar: 'u · v = |u||v|cos θ',
    angle_dot: 'หา u · v',
    angle_norms: 'หาขนาดของ u และ v',
    cos_result: 'cos θ คือ u · v หารด้วย |u||v|',
    angle_result: 'อ่านมุมมาตรฐานจาก cos θ',
    perp_dot: 'ตั้งฉากกัน จึงได้ u · v = 0',
    perp_solve: 'แก้สมการหา k',
    perp_property_rule: '(u + v) · (u − v) = |u|² − |v|² = 0 จึงได้ |u| = |v|',
    perp_property_norms: 'หา |u|² และ |v|²',
    perp_property_solve: 'แก้สมการ แล้วเลือก k ที่เป็นบวก',
    cross_i: 'องค์ประกอบ i: ปิดหลัก i แล้วคูณไขว้',
    cross_j: 'องค์ประกอบ j: ปิดหลัก j คูณไขว้ แล้วกลับเครื่องหมาย',
    cross_k: 'องค์ประกอบ k: ปิดหลัก k แล้วคูณไขว้',
    cross_check: 'ตรวจ: ดอทกับเวกเตอร์ทั้งสองต้องได้ 0',
    cross_result: 'ได้ผลคูณเชิงเวกเตอร์',
    area_sides: 'หาเวกเตอร์ด้าน AB และ AC',
    area_cross: 'หาผลคูณเชิงเวกเตอร์ของด้านประชิด',
    area_norm: 'พื้นที่สี่เหลี่ยมด้านขนานคือขนาดของผลคูณนี้',
    area_half: 'สามเหลี่ยมเป็นครึ่งหนึ่งของสี่เหลี่ยมด้านขนาน',
    volume_cross: 'หา v × w',
    volume_dot: 'ดอทกับ u',
    volume_abs: 'ปริมาตรคือค่าสัมบูรณ์',
  },
} as const;

export type VectorPromptKey = keyof typeof thVector.prompts;
export type VectorChoiceKey = keyof typeof thVector.choices;
export type VectorHintKey = keyof typeof thVector.hints;
export type VectorHintL1Key = keyof typeof thVector.hintL1;
export type VectorWorkedKey = keyof typeof thVector.worked;
export type VectorUnitId = keyof typeof thVector.units;
