import { CONFIG } from '@/lib/config';

// All Thai UI copy lives here. Draft copy stays marked TODO(review) until Potter and a math teacher check it.
export const th = {
  // TODO(review): everything in this block.
  home: {
    // Two lines, split at the one plain space: the first holds a no-break space. The trial clip's end
    // card splits it the same way. It speaks for the whole app, so it names no single topic.
    tagline: 'คณิต ม.ปลาย ที่คิดมาเพื่อคุณคนเดียว',
    demoLabel: `ตัวอย่าง: สมุดที่${CONFIG.tutorName}ตรวจแล้ว ข้อที่ผิดคือแยก log ของผลบวก`,
    demoNote: ['log แยกผลบวกไม่ได้นะ', 'แยกได้เฉพาะผลคูณ'],
    // The first page speaks for all of it, and this keeps it honest about what is open today.
    opening: 'เปิดเรื่องแรกแล้ว เรื่องอื่นกำลังตามมา',
    signIn: 'เข้าสู่ระบบด้วย Google',
    signingIn: 'กำลังพาไปหน้า Google…',
    tryFirst: 'ลองเรียนก่อน',
    continue: 'เรียนต่อ',
    privacy: 'ความเป็นส่วนตัว',
    loginFailed: 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง',
    inApp: {
      title: 'เปิดในเบราว์เซอร์ก่อน',
      body: 'Google ไม่ให้ล็อกอินจากในแอปนี้ กดเมนูของแอป แล้วเลือกเปิดใน Chrome หรือ Safari',
      line: 'เปิดในเบราว์เซอร์',
    },
  },

  common: {
    // TODO(review)
    loading: 'กำลังโหลด…',
    // TODO(review)
    errorTitle: 'มีบางอย่างผิดพลาด',
    // TODO(review)
    errorBody: 'ข้อที่ส่งไปแล้วยังอยู่ครบ ลองใหม่ได้เลย',
    // TODO(review)
    retry: 'ลองอีกครั้ง',
    // TODO(review)
    xpLabel: '{{xp}} XP',
    // TODO(review)
    comboLabel: 'ตอบถูกติดกัน {{combo}} ข้อ',
    // TODO(review)
    back: 'ย้อนกลับ',
    // TODO(review)
    next: 'ต่อไป',
    // TODO(review)
    close: 'ปิด',
    // TODO(review)
    save: 'บันทึก',
    // TODO(review)
    saved: 'บันทึกแล้ว',
  },

  // TODO(review): everything in this block.
  welcome: {
    step: 'ขั้นที่ {{n}} จาก {{total}}',
    nameTitle: 'ให้เรียกคุณว่าอะไรดี',
    nameHelp: 'เพื่อนจะเห็นชื่อนี้ในตารางอันดับ ใช้ชื่อเล่นก็ได้',
    nameLabel: 'ชื่อที่แสดง',
    nameTooLong: 'ยาวไปหน่อย ขอไม่เกิน {{max}} ตัวอักษร',
    avatarTitle: 'เลือกสัญลักษณ์ของคุณ',
    themeTitle: 'ยกตัวอย่างเรื่องอะไรดี',
    consentTitle: 'ก่อนเริ่มเรียน',
    consentIntro: 'แอปนี้เป็นส่วนหนึ่งของโครงงานนวัตกรรมของนักเรียน',
    consentItems: [
      'เก็บชื่อที่ตั้ง คำตอบ และเวลาที่ใช้ เพื่อปรับบทเรียนให้คุณ และวิเคราะห์แบบไม่ระบุตัวตนเพื่อส่งประกวด',
      // TODO(review) the consent wording changed with sign-in: the app no longer receives an email.
      'ล็อกอินด้วย Google แต่แอปไม่ได้รับอีเมลหรือชื่อจริงของคุณ',
      'ข้อมูลบางส่วนที่ระบุตัวคุณไม่ได้จะส่งให้ AI (Claude ของบริษัท Anthropic) ช่วยเลือกบทเรียน',
      'ไม่เก็บรูป เสียง หรือตำแหน่ง',
      'ลบบัญชีเองได้ทุกเมื่อในตั้งค่า และข้อมูลทั้งหมดจะถูกลบภายใน 31 มี.ค. 2570',
    ],
    consentAgree: 'อ่านแล้วและยินยอม',
    start: 'เริ่มเรียน',
    failed: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง',
    pretestTitle: `ให้${CONFIG.tutorName}รู้จักคุณก่อนไหม`,
    pretestBody: 'แบบทดสอบ 14 ข้อ ราว 20 นาที เรื่องที่ทำได้แล้วจะได้ข้ามไปเลย',
    pretestYes: 'ทำแบบทดสอบ',
    pretestNo: 'ข้ามไปเรียนเลย',
  },

  // TODO(review): everything in this block.
  themes: {
    shop: { name: 'ร้านค้า' },
    game: { name: 'เกม' },
    sport: { name: 'กีฬา' },
    music: { name: 'ดนตรี' },
    food: { name: 'อาหาร' },
  },

  // TODO(review): everything in this block.
  avatars: {
    bracket: 'วงเล็บเมทริกซ์',
    sigma: 'ซิกมา',
    pi: 'พาย',
    delta: 'เดลตา',
    theta: 'ทีตา',
    infinity: 'อนันต์',
  },

  // TODO(review): everything in this block.
  tabs: {
    nav: 'เมนูหลัก',
    learn: 'บทเรียน',
    leaderboard: 'อันดับ',
    profile: 'โปรไฟล์',
    settings: 'ตั้งค่า',
  },

  // Names from docs/SPEC.md §3.
  units: {
    1: 'พื้นฐาน',
    2: 'บวก ลบ สเกลาร์',
    3: 'คูณ',
    4: 'ดีเทอร์มิแนนต์',
    5: 'อินเวอร์ส',
  },

  // TODO(review): everything in this block.
  learn: {
    title: 'บทเรียน',
    topic: 'เมทริกซ์',
    topicNote: 'เรื่องแรกของคณิต ม.ปลาย',
    unit: 'หน่วยที่ {{n}}',
    status: {
      passed: 'ผ่านแล้ว',
      current: 'กำลังเรียน',
      open: 'เปิดแล้ว',
      locked: 'ยังไม่เปิด',
    },
    recommend: {
      start: 'เริ่มที่{{skill}}ก่อนเลย',
      fix: 'เรื่อง "{{m}}" ยังค้างอยู่ เคลียร์ให้จบเลย',
      stuck: 'เรื่อง{{skill}} ยากจริง ค่อยๆ ดูทีละขั้น',
      review: 'ไม่ได้ทำเรื่อง{{skill}} มาสักพัก ลองอีกรอบ',
      next: 'เรื่องต่อไป: {{skill}}',
      carryOn: 'ทำเรื่อง{{skill}} ต่อจากเมื่อกี้',
      done: 'ผ่านครบทุกเรื่องแล้ว ทบทวนให้แม่นขึ้นได้เลย',
    },
    start: 'เริ่มเรียน',
    continue: 'เรียนต่อ',
    keepPracticing: 'ทบทวนต่อ',
    dailyGoal: 'วันนี้',
    dailyCount: '{{n}}/{{goal}} ข้อ',
    dailyDone: 'ครบแล้ว',
    streak: '{{n}} วันติด',
    mastery: 'แม่น {{p}}%',
    sheetStart: 'เรียนเรื่องนี้',
    sheetContinue: 'เรียนต่อ',
    sheetAgain: 'ฝึกอีกรอบ',
    sheetLocked: 'ต้องผ่าน {{skills}} ก่อน',
    myPath: 'เส้นทางของฉัน',
    guestAction: 'ล็อกอินเพื่อเก็บความคืบหน้า',
    offline: 'ออฟไลน์อยู่ ข้อที่ทำจะส่งให้เมื่อกลับมาออนไลน์',
  },

  // TODO(review): everything in this block.
  board: {
    title: 'อันดับสัปดาห์นี้',
    resets: 'เริ่มใหม่ทุกวันจันทร์',
    you: 'คุณ',
    xp: '{{xp}} XP',
    rank: 'อันดับ {{n}}',
    empty: 'สัปดาห์นี้ยังไม่มีใครได้ XP เริ่มก่อนใครเลย',
    hidden: 'คุณซ่อนชื่ออยู่ เปิดได้ในตั้งค่า',
    guest: 'ล็อกอินเพื่อแข่งกับเพื่อนในตารางอันดับ',
    failed: 'โหลดตารางไม่สำเร็จ',
    notYet: 'ทำสักข้อเพื่อขึ้นตาราง',
  },

  // TODO(review): everything in this block.
  profile: {
    title: 'โปรไฟล์',
    guestName: 'ผู้มาลองเรียน',
    stats: {
      xp: 'XP',
      streak: 'วันติดกัน',
      items: 'ข้อที่ทำ',
      bestCombo: 'ถูกติดกันสูงสุด',
    },
    week: '7 วันที่ผ่านมา',
    weekLabel: '{{day}}: {{n}} ข้อ',
    days: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'],
    mastery: 'ความแม่นแต่ละเรื่อง',
    badges: 'เหรียญ',
    fixed: 'ความเข้าใจผิดที่แก้ได้',
    open: 'กำลังแก้',
    tests: 'แบบทดสอบ',
    pre: 'ก่อนเรียน',
    post: 'หลังเรียน',
    take: 'ทำเลย',
    testBlocked: {
      already_learning: 'ทำได้ก่อนเริ่มฝึกเท่านั้น',
      too_early: 'เปิดเมื่อฝึกครบ {{n}} ข้อ',
    },
    score: '{{score}}/{{total}} คะแนน',
    improved: 'ดีขึ้น {{points}} คะแนน',
  },

  // TODO(review): everything in this block.
  settings: {
    title: 'ตั้งค่า',
    account: 'บัญชี',
    displayName: 'ชื่อที่แสดง',
    avatar: 'สัญลักษณ์',
    showOnBoard: 'แสดงชื่อในตารางอันดับ',
    learning: 'การเรียน',
    theme: 'ยกตัวอย่างเรื่องอะไร',
    sound: 'เสียงพากย์ในคลิป',
    display: 'หน้าจอ',
    colorScheme: 'โหมดสี',
    schemes: { system: 'ตามเครื่อง', light: 'สว่าง', dark: 'มืด' },
    reduceMotion: 'ลดการเคลื่อนไหว',
    about: 'เกี่ยวกับ',
    privacy: 'ความเป็นส่วนตัว',
    signOut: 'ออกจากระบบ',
    signIn: 'เข้าสู่ระบบด้วย Google',
    guestNote: 'ล็อกอินแล้วความคืบหน้าในเครื่องนี้จะตามไปด้วย',
    resetGuest: 'เริ่มใหม่ทั้งหมด',
    resetGuestConfirm: 'ความคืบหน้าในเครื่องนี้จะหายไป เริ่มใหม่เลยไหม',
    dangerZone: 'ลบบัญชี',
    deleteBody: 'ลบบัญชีและข้อมูลการเรียนทั้งหมด กู้คืนไม่ได้',
    deleteType: 'พิมพ์คำว่า {{word}} เพื่อยืนยัน',
    deleteWord: 'ลบ',
    deleteAction: 'ลบบัญชีถาวร',
    deleteFailed: 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง',
  },

  // TODO(review): everything in this block. Have the advisor check it before the trial.
  privacy: {
    title: 'ความเป็นส่วนตัว',
    sections: [
      {
        title: 'เก็บอะไรบ้าง',
        // TODO(review) this page changed with sign-in and the database.
        body: 'ชื่อที่คุณตั้ง รูปประจำตัวที่เลือก คำตอบ เวลาที่ใช้ การกดขอใบ้ และการดูคลิป เก็บในฐานข้อมูลบน MongoDB Atlas',
      },
      {
        title: 'ไม่เก็บอะไร',
        body: 'ไม่เก็บอีเมล ชื่อจริง หรือรูปจาก Google ไม่เก็บรูปถ่าย เสียง หรือตำแหน่ง',
      },
      {
        title: 'ใครเห็นอะไร',
        body: 'คนอื่นเห็นแค่ชื่อที่ตั้ง รูปประจำตัว และ XP สัปดาห์นี้ในตารางอันดับ ซึ่งปิดได้ในตั้งค่า',
      },
      {
        title: 'ส่งอะไรให้ AI',
        body: `${CONFIG.tutorName}ใช้ Claude ของบริษัท Anthropic ผลการเรียนและคำตอบล่าสุดจึงถูกส่งไปที่นั่น โดยไม่มีชื่อ อีเมล หรือข้อมูลที่ระบุตัวคุณ`,
      },
      {
        title: 'ใช้ทำอะไร',
        body: 'ปรับบทเรียนให้เหมาะกับคุณ และวิเคราะห์แบบไม่ระบุตัวตนเพื่อส่งประกวดโครงงานนวัตกรรม',
      },
      {
        title: 'ลบเมื่อไหร่',
        body: 'ลบบัญชีได้เองทุกเมื่อในตั้งค่า และข้อมูลทั้งหมดจะถูกลบภายใน 31 มี.ค. 2570',
      },
    ],
  },

  // TODO(review): everything in this block. Rules-mode words: praise the thinking, never the student.
  tutor: {
    thinking: `${CONFIG.tutorName}กำลังคิด…`,
    name: CONFIG.tutorName,
    messages: {
      level_up: [
        'ถูกติดกันแล้ว ขยับให้ยากขึ้นอีกนิด',
        'วิธีนี้ใช้ได้เลย ลองข้อที่ยากขึ้น',
        'จับทางได้แล้ว งั้นเพิ่มความยากอีกขั้น',
      ],
      same_level: [
        'วิธีนี้ถูกแล้ว ขออีกข้อให้ชัวร์',
        'คิดถูกแล้ว ลองอีกข้อ เลขไม่เหมือนเดิม',
        'ถูกแล้ว ขออีกข้อให้แน่ใจว่าแม่นจริง',
      ],
      advance: [
        'เรื่องนี้แน่นแล้ว ไปเรื่องใหม่ได้',
        'ถึงเกณฑ์แล้ว ไปเรื่องต่อไปเลย',
        'เรื่องต่อไปต่อยอดจากเรื่องนี้เลย',
      ],
      review: [
        'เรื่องนี้ผ่านมาสักพักแล้ว ลองดูว่ายังจำได้ไหม',
        'ขอแทรกเรื่องเก่าสักข้อ จะได้จำได้นานขึ้น',
      ],
      fixing: ['ข้อนี้ถูกแล้ว ขอเช็กอีกข้อให้แน่ใจ', 'เริ่มเข้าทางแล้ว ลองอีกข้อเรื่องเดิม'],
      fixed: ['เรื่องที่เคยคลาด ตอนนี้แก้ได้แล้ว', 'เรื่องที่เคยพลาด ตอนนี้ทำถูกติดกันแล้ว'],
      caught_cell: [
        'ดูช่องแถว {{i}} หลัก {{j}} ที่ตอบ {{studentCell}} คลิปนี้ใช้เลขจากข้อเมื่อกี้เลย',
        'จุดที่คลาดอยู่ตรงช่องแถว {{i}} หลัก {{j}} ดูว่าเลขนี้ควรมาจากไหน',
      ],
      caught: [
        'หลายคนก็คิดแบบนี้ ดูก่อนว่าคลาดตรงไหน แล้วลองใหม่อีกข้อ',
        'ดูจุดที่คลาดจากข้อเมื่อกี้ก่อน แล้วลองอีกข้อ',
      ],
      caught_again: [
        'เรื่องนี้ต้องใช้เวลา ลองอีกข้อโดยดูทีละขั้น',
        'ยังคลาดจุดเดิมอยู่ ไม่เป็นไร ลองช้าลงแล้วคิดทีละขั้น',
      ],
      slip: ['เกือบแล้ว วิธีถูก พลาดแค่ช่องเดียว', 'วิธีคิดถูกแล้ว น่าจะแค่พลาดตอนคิดเลข'],
      unknown: [
        'ไม่เป็นไร ดูทีละขั้นก่อน แล้วค่อยลองอีกข้อ',
        'คำตอบนี้ยังไม่เข้าทาง ไล่ดูทีละขั้นกันก่อน',
      ],
      stuck: [
        'เรื่องนี้ยากจริง พักข้อยากก่อน ดูทีละขั้น แล้วเริ่มใหม่จากข้อง่าย',
        'ผิดติดกันไม่ได้แปลว่าทำไม่ได้ ดูทีละขั้น แล้วเริ่มใหม่จากข้อง่าย',
      ],
    },
  },

  // TODO(review): everything in this block.
  test: {
    titles: { pre: 'แบบทดสอบก่อนเรียน', post: 'แบบทดสอบหลังเรียน' },
    blocked: {
      already_learning: 'แบบทดสอบก่อนเรียนต้องทำก่อนเริ่มฝึก คุณเริ่มไปแล้ว เรียนต่อได้เลย',
      too_early: 'แบบทดสอบหลังเรียนเปิดเมื่อฝึกครบ {{n}} ข้อ ตอนนี้ฝึกไปแล้ว {{done}} ข้อ',
    },
    intro: {
      pre: 'ทำเท่าที่ทำได้ ไม่มีใบ้และไม่บอกผลระหว่างทำ คะแนนนี้ไม่มีผลกับเกรด',
      post: 'ทำได้ครั้งเดียว ถ้าครูนัดเวลาไว้ให้รอทำตอนนั้น ไม่มีใบ้และไม่บอกผลระหว่างทำ',
    },
    begin: 'เริ่มทำ',
    progress: 'ข้อ {{n}} จาก {{total}}',
    next: 'ข้อถัดไป',
    skip: 'ข้ามข้อนี้',
    finish: 'ส่งแบบทดสอบ',
    failed: 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง',
    resultTitle: 'ส่งแล้ว',
    result: 'ได้ {{score}} จาก {{total}} คะแนน',
    resultNote: {
      pre: 'เรื่องที่ทำได้แล้ว จะข้ามคลิปนำให้',
      post: 'ดูผลเทียบกับก่อนเรียนได้ในหน้าโปรไฟล์',
    },
    goLearn: 'ไปเรียนต่อ',
    done: 'คุณทำแบบทดสอบนี้แล้ว',
    guest: 'ต้องล็อกอินก่อนจึงจะทำแบบทดสอบได้',
    unavailable: 'โหลดแบบทดสอบไม่สำเร็จ',
  },

  session: {
    // TODO(review)
    stop: 'พอแค่นี้',
    // TODO(review)
    level: 'ระดับ {{level}} จาก {{max}}',
    // TODO(review)
    hint: 'ขอใบ้',
    // TODO(review)
    hintMore: 'ขอใบ้เพิ่ม',
    // TODO(review)
    hintsUsedUp: 'ใบ้ครบแล้ว',
    // TODO(review)
    hintTitle: 'ใบ้ขั้นที่ {{level}}',
    // TODO(review)
    help: 'ไม่เข้าใจ',
    // TODO(review)
    watchScene: 'ดูคลิปอธิบาย',
    // TODO(review)
    undefined: 'หาค่าไม่ได้',
    // TODO(review)
    send: 'ส่ง',
    // TODO(review)
    next: 'ข้อถัดไป',
    // TODO(review)
    nextSkill: 'ไปเรื่องถัดไป',
    // TODO(review)
    showWorked: 'ดูวิธีทำ',
    // TODO(review)
    workedTitle: 'วิธีทำทีละขั้น',
    // TODO(review)
    close: 'ปิด',
    // TODO(review)
    yourAnswer: 'คำตอบของคุณ: {{answer}}',
    // TODO(review)
    skillPassed: 'ผ่านเรื่อง {{skill}} แล้ว',
    // TODO(review)
    unitPassed: 'ผ่านหน่วยที่ {{unit}} แล้ว',
    // TODO(review)
    allDone: 'ผ่านครบทุกเรื่องที่เปิดแล้ว ฝึกทบทวนต่อได้เลย',
    // TODO(review)
    misconceptionFixed: 'แก้ความเข้าใจผิดเรื่อง "{{m}}" ได้แล้ว {{xp}}',
    issues: {
      // TODO(review)
      incomplete: 'กรอกให้ครบทุกช่องก่อนส่งนะ',
      // TODO(review)
      invalid: 'ตัวเลขในช่องนี้ยังไม่ครบ',
      // TODO(review)
      zero_denominator: 'ตัวส่วนเป็น 0 ไม่ได้',
      // TODO(review)
      noChoice: 'เลือกคำตอบก่อนส่งนะ',
    },
    box: {
      // TODO(review)
      cell: 'แถว {{i}} หลัก {{j}}',
      // TODO(review)
      dimFirst: 'ตัวเลขตัวแรก',
      // TODO(review)
      dimSecond: 'ตัวเลขตัวหลัง',
      // TODO(review)
      answer: 'คำตอบ',
      // TODO(review)
      filled: '{{label}}: {{value}}',
      // TODO(review)
      answerArea: 'ช่องตอบ',
    },
    keys: {
      // TODO(review)
      backspace: 'ลบตัวเลข',
      // TODO(review)
      next: 'ช่องถัดไป',
      // TODO(review)
      minus: 'เครื่องหมายลบ',
      // TODO(review)
      slash: 'เศษส่วน',
      // TODO(review)
      point: 'จุดทศนิยม',
    },
  },

  // Immediate feedback (SPEC §9). Unmarked wording comes from the table there.
  feedback: {
    correct: 'ถูกต้อง!',
    // TODO(review)
    xpGained: '+{{xp}} XP',
    // TODO(review)
    wrong: 'ยังไม่ถูก',
    // TODO(review)
    almost: 'เกือบแล้ว',
    slip: 'ผิดแค่ช่องแถว {{i}} หลัก {{j}}',
    unknown: 'มาดูทีละขั้นกัน',
    // One message per way of being wrong. No numbers from the item, so none can give the answer away.
    misconceptions: {
      // TODO(review)
      M01_DIM_SWAP: 'คำตอบนี้สลับเป็น หลัก × แถว มิติต้องบอกจำนวนแถวก่อนนะ',
      // TODO(review)
      M02_INDEX_SWAP: 'คำตอบนี้อ่านเป็นแถว j หลัก i ใน aᵢⱼ ตัวเลขแรกคือแถวนะ',
      M03_TRANSPOSE_WRONG: {
        // TODO(review)
        ROT_CW: 'คำตอบนี้คือการหมุนเมทริกซ์ ทรานสโพสคือการเปลี่ยนแถวเป็นหลัก',
        // TODO(review)
        ROT_CCW: 'คำตอบนี้คือการหมุนเมทริกซ์ ทรานสโพสคือการเปลี่ยนแถวเป็นหลัก',
        // TODO(review)
        ANTI: 'คำตอบนี้สะท้อนตามเส้นทแยงรอง ทรานสโพสต้องสะท้อนตามเส้นทแยงหลัก',
        // TODO(review)
        FLIP_H: 'คำตอบนี้คือการพลิกซ้ายขวา ทรานสโพสคือการเปลี่ยนแถวเป็นหลัก',
        // TODO(review)
        FLIP_V: 'คำตอบนี้คือการพลิกบนล่าง ทรานสโพสคือการเปลี่ยนแถวเป็นหลัก',
        // TODO(review)
        SAME: 'คำตอบนี้ยังเหมือน A เดิม ทรานสโพสต้องเปลี่ยนแถวเป็นหลักก่อน',
      },
      // TODO(review)
      M04_ADD_DIM_MISMATCH: 'บวกลบได้เฉพาะเมทริกซ์มิติเดียวกัน ลองเทียบมิติของ A กับ B ก่อนลงมือนะ',
      // TODO(review)
      M05_SUB_REVERSED: 'คำตอบนี้คือ B − A ลำดับสลับกันอยู่ A − B ต้องเอาค่าใน A ตั้งนะ',
      M07_SCALAR_PARTIAL: {
        // TODO(review)
        FIRST_ROW: 'คำตอบนี้คูณแค่แถวแรก สเกลาร์ต้องคูณเข้าไปทุกช่องนะ',
        // TODO(review)
        DIAGONAL: 'คำตอบนี้คูณแค่แนวทแยง สเกลาร์ต้องคูณเข้าไปทุกช่องนะ',
        // TODO(review)
        ADD: 'คำตอบนี้เอาค่ามาบวก สเกลาร์ต้องคูณเข้าไปทุกช่องนะ',
      },
      M08_MULT_DIM_RULE: {
        // TODO(review)
        SAME_DIMS: 'คูณได้หรือไม่ ไม่ได้ดูว่ามิติเท่ากันไหม แต่ดูว่าตัวเลขด้านในเท่ากันไหม',
        // TODO(review)
        RESULT_INNER:
          'คำตอบนี้ใช้ตัวเลขด้านใน ตัวเลขด้านในบอกว่าคูณได้ไหม ส่วนมิติผลคูณมาจากตัวเลขด้านนอก',
        // TODO(review)
        RESULT_FIRST:
          'คำตอบนี้เป็นมิติของตัวหน้า ลองเช็กตัวเลขด้านในก่อน แล้วมิติผลคูณมาจากตัวเลขด้านนอก',
        // TODO(review)
        RESULT_SWAPPED:
          'คำตอบนี้สลับลำดับมิติ ลองเช็กตัวเลขด้านในก่อน แล้วมิติผลคูณคือ แถวของตัวหน้า × หลักของตัวหลัง',
        // TODO(review)
        RESULT_OUTER:
          'คำตอบนี้ใช้ตัวเลขด้านนอกเลย แต่ต้องเช็กตัวเลขด้านในก่อน เพราะตัวเลขด้านในบอกว่าคูณได้ไหม',
      },
      // TODO(review)
      M09_MULT_ELEMENTWISE:
        'คำตอบนี้คูณทีละช่องตรงตำแหน่ง การคูณเมทริกซ์ต้องใช้แถวของตัวหน้าคู่กับหลักของตัวหลังนะ',
      M10_MULT_ROW_ROW: {
        // TODO(review)
        ROW_ROW: 'คำตอบนี้ใช้แถวคู่กับแถว การคูณต้องใช้แถวของตัวหน้าคู่กับหลักของตัวหลังนะ',
        // TODO(review)
        COL_COL: 'คำตอบนี้ใช้หลักคู่กับหลัก การคูณต้องใช้แถวของตัวหน้าคู่กับหลักของตัวหลังนะ',
      },
      // TODO(review)
      M11_MULT_COMMUTATIVE: 'ลำดับการคูณสำคัญนะ AB กับ BA ต้องคิดแยกกัน และมักได้ผลไม่เท่ากัน',
      M12_DET2_FORMULA: {
        // TODO(review)
        ADD: 'คำตอบนี้เอาสองแนวทแยงมาบวกกัน det คือ ทแยงลง ลบ ทแยงขึ้น',
        // TODO(review)
        REVERSE: 'คำตอบนี้ลบสลับข้าง det คือ ทแยงลง ลบ ทแยงขึ้น',
        // TODO(review)
        PAIRS_ROW: 'คำตอบนี้คูณตามแถว det ต้องคูณตามแนวทแยง: ทแยงลง ลบ ทแยงขึ้น',
        // TODO(review)
        PAIRS_COL: 'คำตอบนี้คูณตามหลัก det ต้องคูณตามแนวทแยง: ทแยงลง ลบ ทแยงขึ้น',
      },
      M13_DET3_SIGN: {
        // TODO(review)
        ALL_PLUS: 'คำตอบนี้บวกครบทั้ง 6 เส้น แต่ 3 เส้นขึ้นต้องเป็นลบนะ',
        // TODO(review)
        NO_ALT_SIGN: 'คำตอบนี้กระจายตามแถวแรกโดยไม่สลับเครื่องหมาย พจน์ตรงกลางต้องเป็นลบนะ',
        // TODO(review)
        TWO_DIAG: 'คำตอบนี้ใช้แค่ 2 เส้น det 3×3 ต้องใช้ครบ 3 เส้นลงและ 3 เส้นขึ้น',
      },
      // TODO(review)
      M14_DET_SCALAR_LINEAR:
        'คำตอบนี้ดึง k ออกมาตัวเดียว แต่ k คูณเข้าไปทุกแถว จึงดึงออกมาได้แถวละตัวนะ',
      // TODO(review)
      M15_DET_ADDITIVE: 'คำตอบนี้แยก det ของผลบวก det แยกผลบวกไม่ได้ ต้องบวกเมทริกซ์ให้เสร็จก่อนนะ',
      // TODO(review)
      M18_INV_SINGULAR: 'ลองหา det ก่อนตัดสินนะ ถ้า det เป็น 0 จะย้อนกลับไม่ได้ จึงไม่มีอินเวอร์ส',
      // TODO(review)
      M19_INV_ZERO_ENTRY: 'การมีเลข 0 ในเมทริกซ์ไม่ได้ทำให้ไม่มีอินเวอร์ส ให้ดูที่ det นะ',
      M20_INV2_RECIPE: {
        // TODO(review)
        NO_SWAP: 'คำตอบนี้ลืมสลับ a กับ d',
        // TODO(review)
        NO_NEGATE: 'คำตอบนี้ลืมเปลี่ยนเครื่องหมาย b กับ c',
        // TODO(review)
        NO_DIVIDE: 'คำตอบนี้ลืมหารด้วย det',
        // TODO(review)
        TIMES_DET: 'คำตอบนี้คูณด้วย det แทนที่จะหาร',
        // TODO(review)
        TRANSPOSED: 'b กับ c ไม่ต้องสลับที่ แค่เปลี่ยนเครื่องหมาย',
      },
      // TODO(review)
      M21_INV_RECIPROCAL:
        'อินเวอร์สไม่ใช่การกลับเศษทีละตัว ต้องใช้ขั้นตอน สลับ → กลับเครื่องหมาย → หาร',
    },
  },

  summary: {
    // TODO(review)
    title: 'สรุป',
    // TODO(review)
    xp: 'XP',
    // TODO(review)
    bestCombo: 'ถูกติดกันสูงสุด',
    // TODO(review)
    itemsDone: 'ข้อที่ทำ',
    // TODO(review)
    passed: 'เรื่องที่ผ่านแล้ว',
    // TODO(review)
    unitPassed: 'ผ่านหน่วยที่ {{n}}',
    // TODO(review)
    fixed: 'ความเข้าใจผิดที่แก้ได้',
    // TODO(review)
    badges: 'เหรียญ',
    // TODO(review)
    badgeFixed: 'แก้ความเข้าใจผิดได้',
    // TODO(review)
    continue: 'เรียนต่อ',
    // TODO(review)
    toMap: 'กลับหน้าบทเรียน',
  },

  // Names from docs/SPEC.md §3.
  // TODO(review) a new kind of clip, on a preview page for now.
  clip: {
    back: 'ย้อนกลับ',
    forward: 'ไปจังหวะถัดไป',
    pause: 'หยุด',
    play: 'เล่นต่อ',
    skip: 'ข้าม',
    again: 'ดูอีกครั้ง',
    progress: 'จังหวะที่ {{beat}} จาก {{total}}',
    start: 'เริ่มเล่น',
    soundOn: 'เปิดเสียง',
    soundOff: 'ปิดเสียง',
    mine: 'ที่คุณตอบ',
    right: 'ที่ถูก',
    preview: {
      title: 'คลิปทั้งหมด',
      again: 'เปลี่ยนเลขและเรื่อง',
      next: 'คลิปถัดไป',
      intro: 'เปิดบท',
      concept: 'สอนแนวคิด',
      remediate: 'แก้ความเข้าใจผิด',
      worked: 'ดูวิธีทำ',
      unit: 'หน่วยที่ {{n}}',
    },
    receipt: {
      total: 'รวม',
      rowWord: 'แถว',
      colWord: 'หลัก',
      pairWith: 'คู่กับ',
      ringed: 'ช่องที่วงไว้ใช้',
      rowChip: 'แถว {{n}} ของ {{name}}',
      colChip: 'หลัก {{n}} ของ {{name}}',
      rowHint: 'ดูว่าช่องที่วงไว้อยู่แถวไหน: แถว {{n}}',
      colHint: 'ดูว่าช่องที่วงไว้อยู่หลักไหน: หลัก {{n}}',
      product: 'คูณได้',
      // The story of a bill, on a student who multiplied cell by cell.
      captions: {
        compare: 'ช่องที่วงไว้ คุณตอบ {{mine}}\nแต่ที่ถูกคือ {{right}}',
        pick_row: 'ลองคิดแบบของจริง\n[r:แถวนี้ของ A] คือ{{qty}}ของ{{who}}',
        pick_col: '[c:หลักนี้ของ B]\nคือ{{price}}ของแต่ละอย่าง',
        only_first: 'ที่คุณคูณไปคือบรรทัดของ{{theirs}}เท่านั้น\nแล้ว[w:{{other}}]ล่ะ?',
        sum: 'ต้องคิดครบทุกบรรทัด\nแล้วค่อยบวกกัน',
        place: 'รวมได้ {{right}}\nช่องนี้จึงไม่ใช่ {{mine}}',
        end: '[r:แถว]คู่กับ[c:หลัก]\nไม่ใช่ช่องคู่กับช่อง',
      },
    },
  },

  // Said aloud, and the same for every student, so a line names no number and no item: the screen shows
  // those. Spelled as spoken, with no digits or Latin letters, and "คุณ" kept away from "คูณ", which can
  // sound alike. Each group is one recording. Changing a line means recording that group again, and
  // that spends ElevenLabs credits: npm run voice
  // TODO(review)
  voice: {
    table: {
      intro_blocks: 'ตัวเลขที่เรียงเป็นตารางแบบนี้ เรียกว่าเมทริกซ์',
      blocks: 'เมทริกซ์นี้มีกี่แถว กี่หลัก',
      compare: 'ที่ตอบมาสลับกันอยู่ เอาหลักขึ้นก่อนแถว',
      count_rows: 'แถวคือแนวนอน นับลงมาได้กี่แถว',
      count_cols: 'หลักคือแนวตั้ง นับไปทางขวาได้กี่หลัก',
      intro_result: 'สองตัวนี้คือมิติของเมทริกซ์ บอกแถวก่อน แล้วค่อยบอกหลัก',
      result: 'มิติบอกแถวก่อน แล้วค่อยบอกหลักเสมอ',
      try: 'ตาคุณ ตัวนี้มิติเท่าไร',
      hint: 'นับแถวก่อน แล้วค่อยนับหลัก',
      try_done: 'ใช่เลย แถวก่อน หลักทีหลัง',
    },
    cell: {
      compare: 'ช่องที่ตอบมา สลับแถวกับหลักกันอยู่',
      row: 'เลขห้อยตัวแรก บอกว่าอยู่แถวไหน',
      col: 'เลขห้อยตัวหลัง บอกว่าอยู่หลักไหน',
      hit: 'จุดที่ตัดกัน คือช่องที่ถาม',
      try: 'ตาคุณ ช่องนี้อยู่ตรงไหน แตะเลย',
      hint: 'เลขตัวแรกคือแถว เลขตัวหลังคือหลัก',
      try_done: 'ใช่เลย แถวก่อน หลักทีหลัง',
    },
    flip: {
      compare_turn: 'ที่ทำมาคือการหมุน แต่ทรานสโพสไม่ใช่การหมุน',
      compare_anti: 'ที่ทำมาสะท้อนตามเส้นทแยงอีกเส้น ต้องใช้เส้นทแยงหลัก',
      compare_mirror: 'ที่ทำมาคือการพลิก แต่ทรานสโพสไม่ใช่การพลิก',
      compare_same: 'ที่ทำมายังไม่ได้เปลี่ยนแถวเป็นหลักเลย',
      setup: 'ทรานสโพส คือเปลี่ยนแถวให้เป็นหลัก',
      row_1: 'แถวแรก กลายเป็นหลักแรก',
      row_2: 'แถวที่สอง กลายเป็นหลักที่สอง',
      row_3: 'แถวที่สาม กลายเป็นหลักที่สาม',
      done: 'ครบทุกแถว ได้ทรานสโพสแล้ว',
      try: 'ตาคุณ แถวนี้ไปเป็นหลักไหน แตะเลย',
      hint: 'แถวที่เท่าไร ก็เป็นหลักที่เท่านั้น',
    },
    sheet: {
      intro_setup: 'ยอดสองชุดรวมกัน ก็เอาช่องเดียวกันมาบวกกัน',
      setup_add: 'บวกเมทริกซ์ ให้ช่องเดียวกันบวกกัน',
      setup_sub: 'ลบเมทริกซ์ ให้ช่องเดียวกันลบกัน ตัวหน้าเป็นตัวตั้ง',
      setup_scalar: 'คูณด้วยตัวเลข ต้องคูณเข้าไปทุกช่อง',
      cell_1: 'เริ่มจากช่องนี้',
      cell_2: 'ช่องต่อไป ก็ทำแบบเดียวกัน',
      rest: 'ช่องที่เหลือก็เหมือนกัน',
      done: 'ครบทุกช่องแล้ว',
      also: 'ส่วนการคูณด้วยตัวเลข ก็คูณเข้าไปทุกช่องเหมือนกัน',
      compare_REVERSED: 'ที่ทำมา เอาตัวหลังลบตัวหน้า ลำดับเลยสลับกัน',
      compare_FIRST_ROW: 'ที่ทำมา คูณแค่แถวแรก แถวอื่นยังเหมือนเดิม',
      compare_DIAGONAL: 'ที่ทำมา คูณแค่แนวทแยง ช่องอื่นยังเหมือนเดิม',
      compare_ADD: 'ที่ทำมา เอาตัวเลขไปบวก แต่โจทย์ให้คูณ',
      try: 'ตาคุณ ช่องนี้ต้องเขียนแบบไหน',
      hint_sub: 'ตัวหน้าเป็นตัวตั้งเสมอ',
      hint_scalar: 'ตัวเลขนี้ต้องคูณเข้าไปทุกช่อง',
      try_done: 'ใช่เลย ทุกช่องทำแบบนี้',
    },
    fit: {
      blocks: 'ดูมิติของทั้งสองตัวก่อน',
      add_check: 'จะบวกหรือลบกันได้ มิติต้องเท่ากันทั้งคู่',
      add_ok: 'มิติเท่ากัน ทุกช่องมีคู่ จึงบวกลบกันได้',
      add_no: 'มิติไม่เท่ากัน มีช่องที่ไม่มีคู่ จึงหาค่าไม่ได้',
      mult_check: 'จะคูณกันได้ ตัวเลขด้านในต้องเท่ากัน',
      mult_ok: 'ตัวเลขด้านนอก คือมิติของผลคูณ',
      mult_no: 'ด้านในไม่เท่ากัน จึงคูณกันไม่ได้',
      compare_add: 'ที่ตอบมาเป็นตัวเลข แต่ข้อนี้หาค่าไม่ได้',
      compare_SAME_DIMS: 'ที่ตอบดูว่ามิติเท่ากันไหม แต่การคูณดูแค่ตัวเลขด้านใน',
      compare_RESULT_INNER: 'ที่ตอบใช้ตัวเลขด้านใน แต่มิติของผลคูณคือด้านนอก',
      compare_RESULT_FIRST: 'ที่ตอบเอามิติของตัวแรกมาเลย แต่ต้องใช้ด้านนอกทั้งสองฝั่ง',
      compare_RESULT_SWAPPED: 'ที่ตอบสลับลำดับตัวเลขด้านนอก',
      compare_RESULT_OUTER: 'ที่ตอบข้ามการเช็กตัวเลขด้านในไป',
      try_add: 'ตาคุณ คู่นี้บวกกันได้ไหม',
      try_can: 'ตาคุณ คู่นี้คูณกันได้ไหม',
      try_dims: 'ตาคุณ คู่นี้คูณแล้วได้มิติเท่าไร',
      hint_add: 'ดูว่ามิติเท่ากันทั้งคู่ไหม',
      hint_can: 'ดูแค่ตัวเลขด้านใน',
      hint_dims: 'ใช้ตัวเลขด้านนอก',
      done_add: 'ใช่เลย มิติต้องเท่ากันทั้งคู่',
      done_mult: 'ใช่เลย ตัวในต้องเท่ากัน ตัวนอกคือคำตอบ',
    },
    bill: {
      intro_setup: 'การคูณเมทริกซ์ คือการคิดยอดรวมแบบนี้',
      setup: 'หาคำตอบของช่องนี้กัน',
      story_pick_row: 'แถวนี้ของเอ คือจำนวนของแต่ละอย่าง',
      story_pick_col: 'ส่วนหลักนี้ของบี คือค่าของแต่ละอย่าง',
      pair: 'แต่ละอย่าง คู่กับค่าของมัน',
      story_multiply: 'จำนวนคูณค่า ทีละบรรทัด',
      story_sum: 'บวกทุกบรรทัด ได้ยอดรวม',
      story_place: 'ยอดรวมนี้แหละ คือคำตอบของช่องนี้',
      story_fill: 'ช่องอื่นก็คิดแบบเดียวกัน แถวคู่กับหลัก',
      pick_row: 'ใช้แถวนี้ของตัวหน้า ทั้งแถว',
      pick_col: 'คู่กับหลักนี้ของตัวหลัง ทั้งหลัก',
      multiply: 'เรียงคู่กันตามลำดับ แล้วคูณทีละคู่',
      sum: 'แล้วบวกกันทั้งหมด',
      place: 'ได้คำตอบของช่องนี้แล้ว',
      fill_rest: 'ช่องอื่นก็ทำแบบเดียวกัน แถวคู่กับหลัก',
      compare_elementwise: 'ช่องที่วงไว้ เอาตำแหน่งเดียวกันมาคูณกัน',
      compare_row_row: 'ที่ทำมา เอาแถวคู่กับแถว แต่ต้องเป็นแถวคู่กับหลัก',
      compare_col_col: 'ที่ทำมา เอาหลักคู่กับหลัก แต่ต้องเป็นแถวคู่กับหลัก',
      compare_reversed: 'ที่ทำมา คูณสลับลำดับกับที่โจทย์ถาม',
      only_first: 'ที่คูณไป คิดแค่บรรทัดเดียว แล้วบรรทัดอื่นล่ะ',
      all_lines: 'ต้องคิดให้ครบทุกบรรทัด แล้วค่อยบวกกัน',
      try_row: 'ตาคุณแล้ว ช่องที่วงไว้ ใช้แถวไหนของตัวหน้า',
      try_col: 'แล้วคู่กับหลักไหนของตัวหลัง',
      hint_row: 'ดูอีกทีว่าช่องที่วงไว้อยู่แถวไหน',
      hint_col: 'ดูอีกทีว่าช่องที่วงไว้อยู่หลักไหน',
      try_done: 'ใช่เลย ทุกช่องคิดแบบเดียวกันหมด',
      end: 'แถวคู่กับหลัก ไม่ใช่ช่องคู่กับช่อง',
      end_plain: 'จำไว้ แถวของตัวหน้า คู่กับหลักของตัวหลัง',
    },
    order: {
      compare: 'ที่ตอบมา คิดว่าสลับลำดับแล้วเท่าเดิม',
      unit: 'ลองทำสองการแปลงนี้ คนละลำดับ',
      first: 'ซ้ายทำบีก่อน ขวาทำเอก่อน',
      second: 'แล้วทำอีกตัวต่อ',
      differ: 'ลำดับต่างกัน ผลก็ต่างกัน เหมือนใส่ถุงเท้ากับรองเท้า',
      try: 'ตาคุณ เอบีเท่ากับบีเอเสมอไหม',
      hint: 'ดูสองรูปนี้อีกที ได้ผลเท่ากันไหม',
      try_done: 'ใช่เลย สลับลำดับแล้วอาจได้ผลไม่เท่ากัน',
    },
    area: {
      intro_unit: 'ดีเทอร์มิแนนต์ หรือเดต บอกว่าเมทริกซ์ขยายพื้นที่กี่เท่า',
      unit: 'สี่เหลี่ยมนี้พื้นที่หนึ่งหน่วย',
      apply: 'เมทริกซ์แปลงสี่เหลี่ยมนี้ รูปจึงเปลี่ยนไป',
      area: 'พื้นที่ใหม่กี่เท่าของเดิม นั่นคือขนาดของเดต',
      flip: 'ถ้าเดตติดลบ รูปจะพลิกด้านด้วย',
      compare_scale: 'ที่ตอบมา คูณตัวเลขนี้แค่ครั้งเดียว',
      scale_start: 'เริ่มจากเมทริกซ์ที่มีเดตเท่านี้',
      scale: 'คูณทุกช่องด้วยตัวเลข รูปจึงขยายทั้งสองแกน',
      scale_area: 'สองแกน พื้นที่จึงขยายเป็นกำลังสอง',
      cube: 'ถ้าเป็นสามคูณสาม มีสามแกน จึงเป็นกำลังสาม',
      try: 'ตาคุณ ข้อนี้คำตอบคือเท่าไร',
      hint: 'ตัวเลขนี้คูณกี่ครั้ง ดูจากจำนวนแกน',
      try_done: 'ใช่เลย คูณตามจำนวนแกน',
    },
    cross: {
      copy: 'คัดสองหลักแรกมาต่อท้าย จะได้เห็นครบทุกเส้น',
      down2: 'ทแยงลง คูณกัน เป็นบวก',
      up2: 'ทแยงขึ้น คูณกัน เป็นลบ',
      down3: 'สามเส้นลง คูณแล้วเป็นบวก',
      up3: 'สามเส้นขึ้น คูณแล้วเป็นลบ',
      result: 'เอาเส้นลง ลบด้วยเส้นขึ้น ก็ได้เดต',
      compare_ADD: 'ที่ทำมา บวกสองเส้น แต่ต้องลบกัน',
      compare_REVERSE: 'ที่ทำมา เอาเส้นขึ้นตั้ง แต่ต้องเอาเส้นลงตั้ง',
      compare_PAIRS_ROW: 'ที่ทำมา คูณตามแถว แต่ต้องคูณตามแนวทแยง',
      compare_PAIRS_COL: 'ที่ทำมา คูณตามหลัก แต่ต้องคูณตามแนวทแยง',
      compare_ALL_PLUS: 'ที่ทำมา บวกครบทุกเส้น แต่เส้นขึ้นต้องลบ',
      compare_NO_ALT_SIGN: 'ที่ทำมา กระจายแถวแรกโดยไม่สลับเครื่องหมาย',
      compare_TWO_DIAG: 'ที่ทำมา ใช้แค่สองเส้น แต่ต้องครบหกเส้น',
      try: 'ตาคุณ เส้นขึ้นเป็นบวกหรือลบ',
      hint: 'เส้นลงเป็นบวก แล้วเส้นขึ้นล่ะ',
    },
    sum: {
      compare: 'ที่ทำมา หาเดตทีละตัวแล้วเอามาบวกกัน',
      try: 'ตาคุณ ต้องทำอะไรก่อน',
      hint: 'ในวงเล็บต้องทำก่อน',
      add_first: 'ต้องบวกเมทริกซ์ให้เสร็จก่อน',
      det_of_sum: 'แล้วค่อยหาเดตของผลบวก',
      differ: 'ผลไม่เท่ากัน เดตแยกผลบวกไม่ได้',
    },
    undo: {
      intro_unit: 'เมทริกซ์แปลงรูปนี้ได้',
      unit: 'สี่เหลี่ยมนี้พื้นที่หนึ่งหน่วย',
      flatten: 'เมทริกซ์นี้ บีบรูปจนแบนเป็นเส้น',
      cant_undo: 'พื้นที่เป็นศูนย์ ย้อนกลับไม่ได้ จึงไม่มีอินเวอร์ส',
      apply: 'แปลงด้วยเมทริกซ์นี้',
      undo: 'อินเวอร์สคือการแปลงย้อนกลับ',
      back: 'กลับมาเป็นรูปเดิม จึงมีอินเวอร์ส',
      compare_M18: 'ที่ตอบมาว่ามีอินเวอร์ส แต่เดตของตัวนี้เป็นศูนย์',
      compare_M19: 'ที่ตอบมาว่าไม่มี เพราะเห็นเลขศูนย์ในช่อง',
      zero_entry: 'มีเลขศูนย์ก็ยังมีอินเวอร์สได้ ถ้าเดตไม่เป็นศูนย์',
      try_M18: 'ตาคุณ เดตเป็นศูนย์ มีอินเวอร์สไหม',
      try_M19: 'ตาคุณ มีอินเวอร์สไหม ต้องดูที่อะไร',
      hint_M18: 'พื้นที่เป็นศูนย์ ย้อนกลับได้ไหม',
      hint_M19: 'ดูที่เดต ไม่ใช่ดูว่ามีเลขศูนย์ไหม',
      done: 'ใช่เลย ดูที่เดตเสมอ',
    },
    recipe: {
      show: 'อินเวอร์สมีสามขั้น สลับ กลับเครื่องหมาย แล้วหาร',
      swap: 'ขั้นแรก สลับตัวบนซ้ายกับล่างขวา',
      negate: 'ขั้นสอง กลับเครื่องหมายอีกสองตัว แต่ไม่ต้องย้ายที่',
      det: 'หาเดตไว้เป็นตัวหาร',
      divide: 'ขั้นสาม หารทุกช่องด้วยเดต',
      compare_NO_SWAP: 'ตรงนี้ที่ลืม ต้องสลับตัวบนซ้ายกับล่างขวา',
      compare_NO_NEGATE: 'ตรงนี้ที่ลืม ต้องกลับเครื่องหมายอีกสองตัว',
      compare_NO_DIVIDE: 'ตรงนี้ที่ลืม ต้องหารทุกช่องด้วยเดต',
      compare_TIMES_DET: 'ตรงนี้ เอาเดตไปคูณ แต่ต้องหาร',
      compare_TRANSPOSED: 'อีกสองตัวไม่ต้องย้ายที่ แค่กลับเครื่องหมาย',
      compare_RECIPROCAL: 'อินเวอร์สไม่ใช่การกลับเศษทีละช่อง',
      try: 'ตาคุณ ขั้นที่พลาดไปคือขั้นไหน',
      hint: 'ย้อนดูขั้นที่ขึ้นสีแดง',
      try_done: 'ใช่เลย สลับ กลับเครื่องหมาย แล้วหาร',
    },
    worked: {
      dim_rows: 'นับแถว ตามแนวนอน',
      dim_cols: 'นับหลัก ตามแนวตั้ง',
      dim_result: 'มิติเขียนเป็น แถว คูณ หลัก',
      index_locate: 'ไปที่แถวนั้น แล้วดูหลักนั้น',
      index_row: 'นี่คือแถวที่ถาม ไล่ไปที่หลักที่ถาม',
      transpose_row: 'แถวนี้ กลายเป็นหลักของทรานสโพส',
      transpose_result: 'ได้ทรานสโพสแล้ว',
      addsub_dims: 'ดูมิติของทั้งสองตัวก่อน',
      addsub_undefined: 'มิติไม่เท่ากัน จึงหาค่าไม่ได้',
      addsub_cell: 'ทำทีละช่อง',
      scalar_cell: 'คูณเข้าไปที่ช่องนี้',
      all_cells: 'ครบทุกช่องแล้ว',
      combo_scale_a: 'คูณเอด้วยตัวเลขของมัน',
      combo_scale_b: 'คูณบีด้วยตัวเลขของมัน',
      combo_cell: 'ลบกันทีละช่อง',
      defined_inner: 'ดูตัวเลขด้านในก่อน',
      defined_result: 'ตัวในเท่ากัน มิติของผลคูณคือตัวเลขด้านนอก',
      defined_undefined: 'ตัวในไม่เท่ากัน จึงหาค่าไม่ได้',
      abc_first: 'เริ่มจากเอบี',
      abc_second: 'แล้วเอาผลไปคูณกับซี',
      mult_cell: 'แถวของตัวหน้า คู่กับหลักของตัวหลัง',
      noncomm_example: 'ลองดูตัวอย่างคู่หนึ่ง',
      noncomm_example_swapped: 'สลับลำดับดู',
      noncomm_example_differ: 'ได้ผลต่างกัน จึงสลับที่ไม่ได้',
      noncomm_ab: 'หาเอบีก่อน',
      noncomm_ba: 'แล้วหาบีเอ',
      noncomm_same: 'ได้ผลเท่ากัน คู่นี้สลับที่ได้',
      noncomm_differ: 'ได้ผลต่างกัน คู่นี้สลับที่ไม่ได้',
      det2_formula: 'ทแยงลง ลบ ทแยงขึ้น',
      det3_down: 'รวมสามเส้นลง',
      det3_up: 'รวมสามเส้นขึ้น',
      det3_result: 'เส้นลง ลบ เส้นขึ้น',
      det_scaled_rule: 'ตัวเลขคูณเข้าไปทุกแถว จึงดึงออกมาได้ตามจำนวนแถว',
      det_scaled_value: 'แล้วแทนค่า',
      det_product_rule: 'เดตของผลคูณ เท่ากับผลคูณของเดต',
      det_sum_add: 'บวกเมทริกซ์ให้เสร็จก่อน',
      det_sum_det: 'แล้วค่อยหาเดต',
      det_transpose_rule: 'ทรานสโพสไม่เปลี่ยนค่าเดต',
      det_inverse_rule: 'เดตของอินเวอร์ส คือส่วนกลับของเดต',
      invertible_det: 'หาเดตก่อน',
      invertible_has: 'เดตไม่เป็นศูนย์ จึงมีอินเวอร์ส',
      invertible_none: 'เดตเป็นศูนย์ จึงไม่มีอินเวอร์ส',
      inv2_swap: 'สลับตัวบนซ้ายกับล่างขวา',
      inv2_negate: 'กลับเครื่องหมายอีกสองตัว',
      inv2_det: 'แล้วหาเดต',
      inv2_divide: 'หารทุกช่องด้วยเดต',
    },
  },

  skills: {
    dim: 'มิติของเมทริกซ์',
    index: 'ตำแหน่งสมาชิก',
    transpose: 'ทรานสโพส',
    addsub: 'บวก/ลบเมทริกซ์',
    scalar: 'คูณด้วยสเกลาร์',
    mult_defined: 'คูณได้ไหม / มิติผลคูณ',
    mult: 'คูณเมทริกซ์',
    mult_noncomm: 'AB กับ BA',
    det2: 'det 2×2',
    det3: 'det 3×3',
    det_props: 'สมบัติของ det',
    invertible: 'มีอินเวอร์สไหม',
    inv2: 'อินเวอร์ส 2×2',
  },

  // Names from docs/MISCONCEPTIONS.md §3.
  misconceptionNames: {
    M01_DIM_SWAP: 'สลับมิติ (ตอบหลัก×แถว)',
    M02_INDEX_SWAP: 'อ่าน aᵢⱼ เป็นแถว j หลัก i',
    M03_TRANSPOSE_WRONG: 'ทรานสโพสด้วยการหมุนหรือพลิก แทนการสะท้อนตามเส้นทแยงหลัก',
    M04_ADD_DIM_MISMATCH: 'คิดว่าบวก/ลบเมทริกซ์ต่างมิติได้',
    M05_SUB_REVERSED: 'ลบสลับลำดับ (คิด B − A)',
    M07_SCALAR_PARTIAL: 'คูณสเกลาร์ไม่ครบทุกช่อง',
    M08_MULT_DIM_RULE: 'กฎมิติของการคูณผิด',
    M09_MULT_ELEMENTWISE: 'คูณทีละช่อง',
    M10_MULT_ROW_ROW: 'ใช้แถวคูณแถว (หรือหลักคูณหลัก)',
    M11_MULT_COMMUTATIVE: 'คิดว่า AB = BA',
    M12_DET2_FORMULA: 'สูตร det 2×2 ผิด',
    M13_DET3_SIGN: 'det 3×3 เครื่องหมายผิด',
    M14_DET_SCALAR_LINEAR: 'คิดว่า det(kA) = k·det(A)',
    M15_DET_ADDITIVE: 'คิดว่า det(A+B) = det A + det B',
    M18_INV_SINGULAR: 'คิดว่ามีอินเวอร์สทั้งที่ det = 0',
    M19_INV_ZERO_ENTRY: 'คิดว่ามีสมาชิกเป็น 0 แล้วจะไม่มีอินเวอร์ส',
    M20_INV2_RECIPE: 'สูตรอินเวอร์ส 2×2 ขาดขั้น',
    M21_INV_RECIPROCAL: 'คิดว่าอินเวอร์สคือกลับเศษทีละช่อง',
  },

  // Short names from docs/AI_DIRECTOR.md §3.2, at most 16 code units so a path note fits one line.
  misconceptionShort: {
    // TODO(review)
    M01_DIM_SWAP: 'ตอบมิติสลับกัน',
    // TODO(review)
    M02_INDEX_SWAP: 'อ่านแถวหลักสลับ',
    // TODO(review)
    M03_TRANSPOSE_WRONG: 'หมุนแทนการสะท้อน',
    // TODO(review)
    M04_ADD_DIM_MISMATCH: 'บวกต่างมิติ',
    // TODO(review)
    M05_SUB_REVERSED: 'ลบสลับลำดับ',
    // TODO(review)
    M07_SCALAR_PARTIAL: 'คูณ k ไม่ครบช่อง',
    // TODO(review)
    M08_MULT_DIM_RULE: 'ใช้กฎมิติผิด',
    // TODO(review)
    M09_MULT_ELEMENTWISE: 'คูณทีละช่อง',
    // TODO(review)
    M10_MULT_ROW_ROW: 'จับแถวคู่แถว',
    // TODO(review)
    M11_MULT_COMMUTATIVE: 'คิดว่า AB = BA',
    // TODO(review)
    M12_DET2_FORMULA: 'ใช้สูตร det ผิด',
    // TODO(review)
    M13_DET3_SIGN: 'เครื่องหมายผิด',
    // TODO(review)
    M14_DET_SCALAR_LINEAR: 'ลืมยกกำลัง k',
    // TODO(review)
    M15_DET_ADDITIVE: 'แยก det ของผลบวก',
    // TODO(review)
    M18_INV_SINGULAR: 'ไม่ได้ดู det',
    // TODO(review)
    M19_INV_ZERO_ENTRY: 'ดูแค่เลขศูนย์',
    // TODO(review)
    M20_INV2_RECIPE: 'ขาดขั้นอินเวอร์ส',
    // TODO(review)
    M21_INV_RECIPROCAL: 'กลับเศษทีละช่อง',
  },

  // Why this step (docs/AI_DIRECTOR.md §3.2): at most 40 code units, no digits, gives nothing away.
  pathNotes: {
    // TODO(review)
    probe: 'เพิ่มข้อนี้เพราะเมื่อกี้{{m}}',
    // TODO(review)
    pretest_probe: 'ตอนแบบทดสอบ{{m}}',
    // TODO(review)
    remediate: 'พาดูคลิปนี้เพราะเมื่อกี้{{m}}',
    // TODO(review)
    level_up: 'ตอบถูกต่อเนื่อง เลยขยับให้ยากขึ้น',
    // TODO(review)
    level_down: 'ปรับให้ง่ายลงก่อน แล้วค่อยไปต่อ',
    // TODO(review)
    same_level: 'ฝึกอีกข้อให้แม่นขึ้น',
    // TODO(review)
    worked: 'พาดูทีละขั้นก่อนลองอีกข้อ',
    // TODO(review)
    concept: 'ดูแนวคิดเรื่องนี้ก่อนลองอีกข้อ',
    // TODO(review)
    review: 'เรื่องนี้ผ่านมาสักพัก ขอทบทวนหน่อย',
    // TODO(review)
    advance: 'ผ่านเรื่องนี้แล้ว ไปเรื่องถัดไป',
    // TODO(review)
    back: 'ทบทวนแล้ว กลับมาเรื่องที่ทำค้างไว้',
    // TODO(review)
    skip_clip: 'เรื่องนี้ทำได้แล้ว เลยข้ามคลิปให้',
    // TODO(review)
    request: 'เปิดคลิปนี้ตามที่ขอ',
    // TODO(review)
    chosen: 'ฝึกเรื่องนี้ตามที่เลือก',
    // TODO(review)
    start: 'เริ่มจากเรื่องนี้ก่อน',
    // The control group sees no reasons (AI_DIRECTOR §3.1).
    fixed: '',
  },

  // Why the rules offered each candidate, for the teacher (docs/AI_DIRECTOR.md §3). Digits are allowed.
  ruleReasons: {
    // TODO(review)
    stuck: 'ผิดครั้งแรกติดกัน {{n}} ข้อ → ดูวิธีทำ แล้วกลับไประดับ 1',
    // TODO(review)
    review: 'ไม่ได้เจอ {{skill}} มา {{n}} ข้อ → แทรกข้อทบทวน',
    // TODO(review)
    scene_then_probe: 'เจอ{{m}} ครั้งที่ {{n}} → อธิบายด้วยคลิป แล้วให้ข้อทดสอบ',
    // TODO(review)
    probe_only: 'เจอ{{m}} → ให้ข้อทดสอบซ้ำโดยไม่อธิบาย',
    // TODO(review)
    probe_after_scenes: 'ดูคลิปเรื่อง{{m}} มาแล้ว {{n}} ครั้ง → ให้ข้อทดสอบเลย',
    // TODO(review)
    worked_then_probe: 'เจอ{{m}} → ดูวิธีทำทีละขั้น แล้วให้ข้อทดสอบที่ง่ายลง',
    // TODO(review)
    slip: 'พลาดช่องเดียว → ให้ข้อระดับเดิม',
    // TODO(review)
    slip_with_hint: 'พลาดช่องเดียว → ให้ข้อระดับเดิมพร้อมใบ้ขั้นแรก',
    // TODO(review)
    worked_then_easier: 'ยังไม่รู้สาเหตุ → ดูวิธีทำ แล้วให้ข้อที่ง่ายลง',
    // TODO(review)
    concept_then_same: 'ยังไม่รู้สาเหตุ → ดูคลิปแนวคิด แล้วให้ข้อระดับเดิม',
    // TODO(review)
    advance: 'ผ่าน {{skill}} แล้ว → ไป {{next}}',
    // TODO(review)
    all_passed: 'ผ่านครบทุกเรื่องที่เปิดแล้ว → ทบทวน {{skill}}',
    // TODO(review)
    challenge: 'ผ่าน {{skill}} แล้ว → ข้อท้าทายระดับ {{level}}',
    // TODO(review)
    probe_again: 'ยังแก้{{m}}ไม่สำเร็จ → ให้ข้อทดสอบอีกข้อ',
    // TODO(review)
    practice: 'ยังไม่ผ่าน {{skill}} → ฝึกต่อที่ระดับ {{level}}',
    // TODO(review)
    start: 'เริ่มที่เรื่องแรกที่ยังไม่ผ่าน: {{skill}}',
    // TODO(review)
    start_probe: 'พบ{{m}} → เริ่มด้วยข้อทดสอบ',
    // TODO(review)
    request: 'นักเรียนกด "ไม่เข้าใจ" → เปิดคลิปแนวคิดด้วยตัวอย่างอื่น',
    // TODO(review)
    chosen: 'นักเรียนเลือกฝึก {{skill}} เอง',
    // TODO(review)
    fixed: 'เส้นทางตายตัว: {{skill}} ระดับ {{level}}',
  },

  // L1 hints (SPEC §9), one principle per item form. The unmarked one is the example in SPEC §9.
  hintL1: {
    // TODO(review)
    dim: 'มิติของเมทริกซ์บอกจำนวนแถวและจำนวนหลัก โดยบอกแถวก่อน',
    // TODO(review)
    index: 'aᵢⱼ คือสมาชิกที่อยู่แถว i หลัก j',
    // TODO(review)
    transpose: 'ทรานสโพสคือการเปลี่ยนแถวให้เป็นหลัก',
    // TODO(review)
    addsub: 'บวกลบกันได้เมื่อมิติเท่ากัน แล้วทำทีละช่องตรงตำแหน่งกัน',
    // TODO(review)
    scalar: 'คูณเมทริกซ์ด้วยจำนวนจริง ได้เมทริกซ์มิติเดิม โดยทำทีละช่อง',
    // TODO(review)
    combo: 'คูณสเกลาร์ให้เสร็จก่อน แล้วค่อยลบกันทีละช่อง',
    // TODO(review)
    mult_defined: 'ผลคูณหาค่าได้เมื่อจำนวนหลักของตัวหน้าเท่ากับจำนวนแถวของตัวหลัง',
    // TODO(review)
    mult_defined_abc: 'คูณทีละคู่จากซ้ายไปขวา แล้วเช็กมิติทุกครั้ง',
    mult: 'ช่องแถว i หลัก j ของ AB มาจากแถว i ของ A กับหลัก j ของ B',
    // TODO(review)
    noncomm_statement: 'ลองนึกถึงตัวอย่างที่คูณกันจริง แล้วสลับลำดับดู',
    // TODO(review)
    noncomm_find_ba: 'BA ใช้แถวของ B คู่กับหลักของ A จึงต้องคูณใหม่',
    // TODO(review)
    noncomm_pair: 'คูณ AB และ BA แล้วเทียบกันทีละช่อง',
    // TODO(review)
    det2: 'det ของเมทริกซ์ 2×2 ได้จากผลคูณตามแนวทแยง',
    // TODO(review)
    det3: 'det ของเมทริกซ์ 3×3 ใช้ผลคูณตามเส้นทแยง 6 เส้น',
    // TODO(review)
    det_scaled: 'k คูณเข้าไปทุกแถวของ A ลองนึกว่า det เปลี่ยนไปกี่เท่า',
    // TODO(review)
    det_product: 'det ของผลคูณหาได้จาก det ของแต่ละตัว',
    // TODO(review)
    det_sum: 'det(A + B) คือ det ของเมทริกซ์ที่ได้จากการบวก',
    // TODO(review)
    det_transpose: 'ทรานสโพสสลับแถวกับหลัก ลองนึกว่า det เปลี่ยนไหม',
    // TODO(review)
    det_inverse: 'A คูณ A⁻¹ ได้เมทริกซ์เอกลักษณ์ ซึ่งมี det เท่ากับ 1',
    // TODO(review)
    invertible: 'เมทริกซ์มีอินเวอร์สก็ต่อเมื่อ det ไม่เป็น 0',
    // TODO(review)
    inv2: 'อินเวอร์ส 2×2 มีสูตร 3 ขั้น: จัดตำแหน่ง a, b, c, d ใหม่ แล้วหารด้วย det',
  },

  // L2 wording for first steps whose worked caption would reveal a number or say too little alone.
  hintFirstStep: {
    // TODO(review)
    dim_rows: 'เริ่มจากนับแถว (แนวนอน) แล้วค่อยนับหลัก (แนวตั้ง)',
    // TODO(review)
    addsub_cell: 'เริ่มจากช่องแถว {{i}} หลัก {{j}}: ใช้ค่าตำแหน่งเดียวกันของ A และ B',
    // TODO(review)
    noncomm_example: 'ลองยกตัวอย่างเมทริกซ์สองตัว แล้วคูณทั้งสองลำดับดู',
  },

  // L2 hints (SPEC §9). Unmarked ones come from docs/MISCONCEPTIONS.md §3.
  hints: {
    M01_DIM_SWAP: 'นับแถว (แนวนอน) ก่อน แล้วค่อยนับหลัก (แนวตั้ง)',
    // TODO(review)
    M02_INDEX_SWAP: 'ใน aᵢⱼ ตัวเลขแรกคือแถว ตัวเลขหลังคือหลัก ดูแถวก่อนแล้วค่อยดูหลัก',
    M03_TRANSPOSE_WRONG: 'แถวที่ 1 กลายเป็นหลักที่ 1, แถวที่ 2 กลายเป็นหลักที่ 2…',
    M04_ADD_DIM_MISMATCH: 'บวกลบได้เฉพาะเมทริกซ์มิติเดียวกันเท่านั้น',
    // TODO(review)
    M05_SUB_REVERSED: 'A − B คือเอาค่าใน A ตั้ง แล้วลบด้วยค่าใน B ทีละช่อง',
    M07_SCALAR_PARTIAL: 'k ต้องคูณเข้าไปทุกช่อง',
    M08_MULT_DIM_RULE: 'ตัวเลขด้านในต้องเท่ากัน ส่วนตัวเลขด้านนอกคือมิติของผลคูณ',
    M09_MULT_ELEMENTWISE: 'ช่องแถว i หลัก j ใช้แถว i ของ A ทั้งแถว คู่กับหลัก j ของ B ทั้งหลัก',
    // TODO(review)
    M10_MULT_ROW_ROW: 'ตัวหน้าใช้แถว ตัวหลังใช้หลัก: แถวของ A ต้องคู่กับหลักของ B เสมอ',
    // TODO(review)
    M11_MULT_COMMUTATIVE: 'สลับลำดับการคูณแล้วผลมักเปลี่ยน AB กับ BA ต้องคิดแยกกัน',
    M12_DET2_FORMULA: 'ทแยงลง (ad) ลบ ทแยงขึ้น (bc)',
    M13_DET3_SIGN: '3 เส้นลงเป็นบวก 3 เส้นขึ้นเป็นลบ',
    M14_DET_SCALAR_LINEAR: 'k คูณเข้าไปทุกแถว แต่ละแถวดึง k ออกมาได้ 1 ตัว',
    // TODO(review)
    M15_DET_ADDITIVE: 'det แยกผลบวกไม่ได้ ต้องบวกเมทริกซ์ให้เสร็จก่อน แล้วค่อยหา det',
    // TODO(review)
    M18_INV_SINGULAR: 'ลองหา det ก่อน ถ้า det เป็น 0 จะย้อนกลับไม่ได้ จึงไม่มีอินเวอร์ส',
    M19_INV_ZERO_ENTRY: 'ดูที่ det ไม่ใช่ดูว่ามี 0 ไหม',
    M20_INV2_RECIPE: 'สลับ (a↔d) → กลับเครื่องหมาย (b, c) → หารด้วย det',
    // TODO(review)
    M21_INV_RECIPROCAL: 'อินเวอร์สไม่ใช่การกลับเศษทีละตัว ใช้ขั้นตอน สลับ → กลับเครื่องหมาย → หาร',
  },

  // Item prompts. Unmarked ones come from docs/SPEC.md §5.
  prompts: {
    // TODO(review)
    dim_find: 'เมทริกซ์ A มีมิติเท่าใด',
    // TODO(review)
    index_find: 'จงหา a{{sub}}',
    // TODO(review)
    transpose_find: 'จงหา Aᵀ',
    // TODO(review)
    addsub_add: 'จงหา A + B',
    // TODO(review)
    addsub_sub: 'จงหา A − B',
    // TODO(review)
    scalar_find: 'จงหา {{k}}A',
    // TODO(review)
    combo_find: 'จงหา {{p}}A − {{q}}B',
    mult_defined_ab:
      'A มีมิติ {{dimsA}} และ B มีมิติ {{dimsB}} แล้ว AB หาค่าได้ไหม ถ้าได้มีมิติเท่าใด',
    // TODO(review)
    mult_defined_ba:
      'A มีมิติ {{dimsA}} และ B มีมิติ {{dimsB}} แล้ว BA หาค่าได้ไหม ถ้าได้มีมิติเท่าใด',
    // TODO(review)
    mult_defined_abc:
      'A มีมิติ {{dimsA}}, B มีมิติ {{dimsB}} และ C มีมิติ {{dimsC}} แล้ว ABC หาค่าได้ไหม ถ้าได้มีมิติเท่าใด',
    mult_find: 'จงหา AB',
    // TODO(review)
    noncomm_always_equal: 'ถ้า A และ B เป็นเมทริกซ์จัตุรัสมิติเดียวกัน แล้ว AB = BA เสมอ',
    // TODO(review)
    noncomm_may_differ: 'มีเมทริกซ์จัตุรัส A และ B มิติเดียวกันที่ทำให้ AB ≠ BA',
    // TODO(review)
    noncomm_swap_keeps_product: 'ถ้าสลับลำดับการคูณจาก AB เป็น BA ผลคูณจะไม่เปลี่ยนเสมอ',
    // TODO(review)
    noncomm_find_ba: 'กำหนด A, B และ AB ให้ จงหา BA',
    // TODO(review)
    noncomm_pair: 'เมทริกซ์คู่นี้สลับที่การคูณได้ไหม (AB = BA หรือไม่)',
    det_find: 'จงหา det(A)',
    det_scaled: 'ถ้า A เป็นเมทริกซ์ {{n}}×{{n}} และ det(A) = {{d}} จงหา det({{k}}A)',
    // TODO(review)
    det_product:
      'A และ B เป็นเมทริกซ์จัตุรัสมิติเดียวกัน โดย det(A) = {{p}} และ det(B) = {{q}} จงหา det(AB)',
    // TODO(review)
    det_sum: 'จงหา det(A + B)',
    // TODO(review)
    det_transpose: 'ถ้า det(A) = {{d}} จงหา det(Aᵀ)',
    // TODO(review)
    det_inverse: 'ถ้า det(A) = {{d}} จงหา det(A⁻¹)',
    // TODO(review)
    invertible_find: 'เมทริกซ์ A มีอินเวอร์สไหม',
    // TODO(review)
    inv2_find: 'จงหา A⁻¹',
  },

  choices: {
    // TODO(review)
    true: 'จริง',
    // TODO(review)
    false: 'เท็จ',
    // TODO(review)
    has_inverse: 'มี',
    // TODO(review)
    no_inverse: 'ไม่มี',
    // TODO(review)
    swap_yes: 'สลับได้',
    // TODO(review)
    swap_no: 'สลับไม่ได้',
  },

  // Scene copy. Unmarked wording comes from docs/SCENES.md; a test checks that it still does.
  scenes: {
    player: {
      // TODO(review)
      next: 'ต่อไป',
      // TODO(review)
      replay: 'เล่นซ้ำ',
      // TODO(review)
      skip: 'ข้าม',
      // TODO(review)
      progress: 'ขั้นที่ {{beat}} จาก {{total}}',
      done: {
        // TODO(review)
        intro: 'เริ่มทำโจทย์',
        // TODO(review)
        concept: 'เริ่มทำโจทย์',
        // TODO(review)
        remediate: 'ข้อถัดไป',
        // TODO(review)
        request: 'กลับไปทำข้อนี้',
        // TODO(review)
        reveal: 'ปิด',
      },
      // TODO(review)
      unitTitle: 'หน่วยที่ {{n}}: {{name}}',
      // TODO(review)
      student: 'ที่ทำมา',
      // TODO(review)
      undefined: 'หาค่าไม่ได้',
    },
    rowCol: {
      // TODO(review)
      setup: 'หาช่องแถว {{i}} หลัก {{j}} ของ {{result}}',
      // TODO(review)
      pick_row: 'ใช้แถวที่ {{i}} ของ {{left}} ทั้งแถว',
      // TODO(review)
      pick_col: 'คู่กับหลักที่ {{j}} ของ {{right}} ทั้งหลัก',
      pair: 'ตัวแรกคู่ตัวแรก ตัวที่สองคู่ตัวที่สอง…',
      multiply: 'คูณแต่ละคู่',
      sum: 'บวกผลคูณทั้งหมด',
      place: 'ได้ค่าของช่องนี้แล้ว',
      // TODO(review)
      fill_rest: 'ช่องอื่นก็ทำแบบเดียวกัน',
      compare: {
        elementwise: 'ที่ทำมา: เอาตัวเลขตำแหน่งเดียวกันมาคูณกัน',
        row_row: 'ที่ทำมา: ใช้แถวของ B แต่ต้องใช้หลัก',
        col_col: 'ที่ทำมา: ใช้หลักของ A แต่ต้องใช้แถว',
        reversed: 'ที่ทำมา: คูณสลับลำดับกับที่โจทย์ถาม',
      },
      // TODO(review)
      try_row: 'ตาคุณแล้ว ช่องที่วงไว้\nต้องใช้แถวไหนของ {{left}} แตะเลย',
      // TODO(review)
      try_col: 'แล้วคู่กับหลักไหนของ {{right}} แตะเลย',
      // TODO(review)
      try_done: 'ใช่เลย\nทุกช่องคิดแบบเดียวกันหมด',
      // TODO(review)
      end: '[r:แถวของ {{left}}] คู่กับ\n[c:หลักของ {{right}}] เสมอ',
      // TODO(review)
      pairLabel: 'คู่ที่ {{n}}',
      // TODO(review)
      cellLabel: 'ช่องแถว {{i}} หลัก {{j}}',
      // TODO(review)
      rowLabel: 'แถว {{i}}',
      // TODO(review)
      colLabel: 'หลัก {{j}}',
    },
    dimension: {
      // TODO(review)
      single_blocks: 'เมทริกซ์นี้มีกี่แถว กี่หลัก',
      // TODO(review)
      count_rows: 'นับแถวก่อน (แนวนอน) ได้ {{rows}} แถว',
      // TODO(review)
      count_cols: 'แล้วนับหลัก (แนวตั้ง) ได้ {{cols}} หลัก',
      single_result: 'แถวก่อน หลักทีหลัง',
      // TODO(review)
      pair_blocks: '{{first}} มีมิติ {{dimsFirst}} และ {{second}} มีมิติ {{dimsSecond}}',
      add_check: 'มิติต้องเท่ากันทั้งคู่',
      // TODO(review)
      add_ok: 'มิติเท่ากัน จึงบวกลบกันได้',
      // TODO(review)
      add_no: 'มิติไม่เท่ากัน จึงหาค่าไม่ได้',
      mult_check: 'ตัวในต้องเท่ากัน',
      mult_ok: 'ตัวนอกคือมิติของผลคูณ',
      // TODO(review)
      mult_no: 'ตัวในไม่เท่ากัน จึงหาค่าไม่ได้',
      // TODO(review)
      compare_single: 'คุณตอบ {{student}} คือเอาหลักขึ้นก่อนแถว',
      // TODO(review)
      compare: {
        // TODO(review)
        ADD: 'ที่ตอบมาเป็นตัวเลข แต่ข้อนี้หาค่าไม่ได้',
        // TODO(review)
        SAME_DIMS: 'ที่ตอบดูว่ามิติเท่ากันไหม แต่ต้องดูแค่ตัวใน',
        // TODO(review)
        RESULT_INNER: 'ที่ตอบใช้ตัวใน แต่มิติผลคูณคือตัวนอก',
        // TODO(review)
        RESULT_FIRST: 'ที่ตอบเอามิติตัวแรกมาเลย แต่ต้องใช้ตัวนอก',
        // TODO(review)
        RESULT_SWAPPED: 'ที่ตอบสลับลำดับตัวนอก',
        // TODO(review)
        RESULT_OUTER: 'ที่ตอบข้ามการเช็กตัวใน',
      },
      try: {
        // TODO(review)
        single: 'ตาคุณ เมทริกซ์นี้มิติเท่าไร',
        // TODO(review)
        add: 'ตาคุณ คู่นี้บวกกันได้ไหม',
        // TODO(review)
        can: 'ตาคุณ คู่นี้คูณกันได้ไหม',
        // TODO(review)
        dims: 'ตาคุณ คู่นี้คูณแล้วได้มิติเท่าไร',
      },
      hint: {
        // TODO(review)
        single: 'นับแถวก่อน แล้วค่อยนับหลัก',
        // TODO(review)
        add: 'ดูว่ามิติเท่ากันทั้งคู่ไหม',
        // TODO(review)
        can: 'ดูแค่ตัวเลขด้านใน',
        // TODO(review)
        dims: 'ใช้ตัวเลขด้านนอก',
      },
      done: {
        // TODO(review)
        single: 'ใช่เลย แถวก่อน หลักทีหลัง',
        // TODO(review)
        add: 'ใช่เลย มิติต้องเท่ากันทั้งคู่',
        // TODO(review)
        mult: 'ใช่เลย ตัวในต้องเท่ากัน ตัวนอกคือคำตอบ',
      },
      // TODO(review)
      rows: 'แถว',
      // TODO(review)
      cols: 'หลัก',
      // TODO(review)
      can: 'ได้',
      // TODO(review)
      cannot: 'ไม่ได้',
    },
    grid: {
      unit: 'สี่เหลี่ยมนี้พื้นที่ 1 หน่วย',
      // TODO(review)
      example: 'ลองดูเมทริกซ์ 2×2 ตัวอย่างนี้',
      // TODO(review)
      apply: 'แปลงด้วย {{name}} รูปจึงเปลี่ยนไป',
      area: 'พื้นที่ใหม่ = |det| = {{absDet}} เท่า',
      flip: 'พลิกด้านด้วย',
      // TODO(review)
      flatten: 'แปลงด้วย {{name}} แล้วรูปแบนเป็นเส้น',
      cant_undo: 'พื้นที่เป็น 0 ย้อนกลับไม่ได้ จึงไม่มีอินเวอร์ส',
      // TODO(review)
      scale_start: 'det(A) = {{d}} พื้นที่จึงเป็น {{absD}} เท่า',
      scale_up: 'ขยายทั้งสองแกน แกนละ {{absK}} เท่า',
      // TODO(review)
      scale_flip: 'ขยาย {{absK}} เท่า และกลับทิศทั้งสองแกน',
      // TODO(review)
      scale_minus_one: 'กลับทิศทั้งสองแกน ขนาดเท่าเดิม',
      scale_area: 'พื้นที่จึงขยาย {{kPow2}} = {{factor}} เท่า',
      scale_cube: '3×3 มีสามแกน จึงเป็น {{kPow3}} เท่า',
      // TODO(review)
      compose_setup: 'ลองทำสองการแปลงนี้คนละลำดับ',
      // TODO(review)
      compose_first: 'ซ้ายทำ {{N}} ก่อน ขวาทำ {{M}} ก่อน',
      // TODO(review)
      compose_second: 'แล้วทำอีกตัวต่อ ซ้าย {{M}} ขวา {{N}}',
      differ: 'ลำดับต่างกัน ผลต่างกัน',
      // TODO(review)
      undo_apply: 'แปลงด้วย {{name}}',
      // TODO(review)
      undo: 'แล้วแปลงกลับด้วย {{name}}⁻¹',
      // TODO(review)
      back: 'กลับมาเป็นรูปเดิม จึงมีอินเวอร์ส',
      // TODO(review)
      zero_entry: 'มีเลข 0 ก็ยังมีอินเวอร์สได้ ถ้า det ไม่เป็น 0',
      compare: {
        // TODO(review)
        M11: 'ที่ตอบมา คิดว่า AB เท่ากับ BA เสมอ',
        // TODO(review)
        M14: 'ที่ตอบมา คูณ {{k}} แค่ครั้งเดียว',
        // TODO(review)
        M18: 'ที่ตอบมาว่ามีอินเวอร์ส แต่ det เป็น 0',
        // TODO(review)
        M19: 'ที่ตอบมาว่าไม่มี เพราะเห็นเลข 0 ในช่อง',
      },
      try: {
        // TODO(review)
        M11: 'ตาคุณ AB เท่ากับ BA เสมอไหม',
        // TODO(review)
        M14: 'ตาคุณ ข้อนี้คำตอบคือเท่าไร',
        // TODO(review)
        M18: 'ตาคุณ det เป็น 0 มีอินเวอร์สไหม',
        // TODO(review)
        M19: 'ตาคุณ มีอินเวอร์สไหม ต้องดูที่อะไร',
      },
      hint: {
        // TODO(review)
        M11: 'ดูสองรูปนี้อีกที ได้ผลเท่ากันไหม',
        // TODO(review)
        M14: 'ตัวเลขนี้คูณกี่ครั้ง ดูจากจำนวนแกน',
        // TODO(review)
        M18: 'พื้นที่เป็น 0 ย้อนกลับได้ไหม',
        // TODO(review)
        M19: 'ดูที่ det ไม่ใช่ดูว่ามีเลข 0 ไหม',
      },
      done: {
        // TODO(review)
        M11: 'ใช่เลย สลับลำดับแล้วอาจได้ผลไม่เท่ากัน',
        // TODO(review)
        M14: 'ใช่เลย คูณตามจำนวนแกน',
        // TODO(review)
        M18: 'ใช่เลย ดูที่ det เสมอ',
        // TODO(review)
        M19: 'ใช่เลย ดูที่ det เสมอ',
      },
      options: {
        // TODO(review)
        always: 'เท่ากันเสมอ',
        // TODO(review)
        notAlways: 'ไม่เสมอไป',
        // TODO(review)
        has: 'มี',
        // TODO(review)
        none: 'ไม่มี',
        // TODO(review)
        det: 'ดูที่ det',
        // TODO(review)
        zero: 'ดูเลข 0',
      },
      mark: {
        // TODO(review)
        area: 'พื้นที่ × {{n}}',
        // TODO(review)
        flat: 'พื้นที่ = 0',
        // TODO(review)
        back: 'กลับรูปเดิม',
        // TODO(review)
        differ: 'ไม่เท่ากัน',
      },
    },
    inverse: {
      show: 'อินเวอร์ส: สลับ → กลับเครื่องหมาย → หาร',
      // TODO(review)
      swap: 'สลับ a กับ d',
      // TODO(review)
      negate: 'กลับเครื่องหมาย b กับ c แต่อยู่ที่เดิม',
      // TODO(review)
      det: 'หา det = ad − bc',
      // TODO(review)
      divide: 'หารทุกช่องด้วย det',
      // TODO(review)
      check: 'คูณกลับแล้วได้เมทริกซ์เอกลักษณ์',
      compare: {
        NO_SWAP: 'ลืมสลับ a กับ d',
        NO_NEGATE: 'ลืมเปลี่ยนเครื่องหมาย b กับ c',
        NO_DIVIDE: 'ลืมหารด้วย det',
        TIMES_DET: 'คูณด้วย det แทนที่จะหาร',
        TRANSPOSED: 'b กับ c ไม่ต้องสลับที่ แค่เปลี่ยนเครื่องหมาย',
        RECIPROCAL: 'อินเวอร์สไม่ใช่การกลับเศษทีละตัว',
      },
      // TODO(review)
      try: 'ตาคุณ ขั้นที่พลาดไปคือขั้นไหน',
      // TODO(review)
      hint: 'ย้อนดูขั้นที่ขึ้นสีแดง',
      // TODO(review)
      try_done: 'ใช่เลย สลับ กลับเครื่องหมาย แล้วหาร',
      steps: {
        // TODO(review)
        swap: 'สลับ a กับ d',
        // TODO(review)
        negate: 'กลับเครื่องหมาย b กับ c',
        // TODO(review)
        divide: 'หารด้วย det',
      },
    },
    cell: {
      row: 'แถวที่ {{i}} คือแนวนอน',
      col: 'หลักที่ {{j}} คือแนวตั้ง',
      // TODO(review)
      hit: 'จุดตัดคือ {{name}}',
      // TODO(review)
      compare: 'อันนี้คือ {{name}} ที่สลับเลขกัน',
      // TODO(review)
      try: 'ตาคุณ {{name}} อยู่ตรงไหน แตะเลย',
      // TODO(review)
      hint: 'เลขตัวแรกคือแถว เลขตัวหลังคือหลัก',
      // TODO(review)
      try_done: 'ใช่เลย แถวก่อน หลักทีหลัง',
    },
    transpose: {
      // TODO(review)
      setup: 'เส้นทแยงหลักคือแกนสะท้อน',
      // TODO(review)
      row: 'แถวที่ {{k}} กลายเป็นหลักที่ {{k}}',
      // TODO(review)
      done: 'ครบทุกแถวแล้ว ได้ Aᵀ',
      compare: {
        ROT_CW: 'หมุน ≠ สะท้อนตามเส้นทแยง',
        ROT_CCW: 'หมุน ≠ สะท้อนตามเส้นทแยง',
        // TODO(review)
        ANTI: 'เส้นทแยงรอง ≠ เส้นทแยงหลัก',
        // TODO(review)
        FLIP_H: 'พลิก ≠ สะท้อนตามเส้นทแยง',
        // TODO(review)
        FLIP_V: 'พลิก ≠ สะท้อนตามเส้นทแยง',
        // TODO(review)
        SAME: 'ยังไม่ได้เปลี่ยนแถวเป็นหลัก',
      },
      // TODO(review)
      try: 'ตาคุณ แถวนี้ไปเป็นหลักไหน แตะเลย',
      // TODO(review)
      hint: 'แถวที่ {{k}} ก็เป็นหลักที่ {{k}}',
      // TODO(review)
      rowWord: 'แถว {{k}}',
      // TODO(review)
      colWord: 'หลัก {{k}}',
      // TODO(review)
      rule: 'แถว กลายเป็น หลัก',
    },
    sarrus: {
      // TODO(review)
      copy: 'คัด 2 หลักแรกมาต่อท้าย',
      // TODO(review)
      down3: '3 เส้นลงเป็นบวก',
      // TODO(review)
      up3: '3 เส้นขึ้นเป็นลบ',
      // TODO(review)
      down2: 'ทแยงลง (ad) เป็นบวก',
      // TODO(review)
      up2: 'ทแยงขึ้น (bc) เป็นลบ',
      // TODO(review)
      result: 'เส้นลง ลบ เส้นขึ้น',
      // TODO(review)
      downLabel: 'เส้นลง',
      // TODO(review)
      upLabel: 'เส้นขึ้น',
      compare: {
        // TODO(review)
        ALL_PLUS: 'เส้นขึ้นต้องลบ ไม่ใช่บวก',
        // TODO(review)
        NO_ALT_SIGN: 'แถวแรกต้องสลับเครื่องหมาย + − +',
        TWO_DIAG: 'ต้องครบ 6 เส้น',
        // TODO(review)
        ADD: 'ที่ทำมา: บวกสองเส้น แต่ต้องลบกัน',
        // TODO(review)
        REVERSE: 'ที่ทำมา: เอาเส้นขึ้นตั้ง ต้องเอาเส้นลงตั้ง',
        // TODO(review)
        PAIRS_ROW: 'ที่ทำมา: คูณตามแถว ต้องคูณตามแนวทแยง',
        // TODO(review)
        PAIRS_COL: 'ที่ทำมา: คูณตามหลัก ต้องคูณตามแนวทแยง',
      },
      // TODO(review)
      try: 'ตาคุณ เส้นขึ้นเป็นบวกหรือลบ',
      // TODO(review)
      hint: 'เส้นลงเป็นบวก แล้วเส้นขึ้นล่ะ',
    },
    // Real-life unit intros (SCENES §5).
    cellByCell: {
      setup: {
        // TODO(review)
        add: 'บวกทีละช่อง ตำแหน่งเดียวกันบวกกัน',
        // TODO(review)
        sub: 'ลบทีละช่อง โดยเอาค่าของตัวหน้าตั้ง',
        // TODO(review)
        scalar: 'สเกลาร์คูณเข้าไปทุกช่อง',
      },
      // TODO(review)
      cell: 'แถว {{i}} หลัก {{j}}: {{expression}}',
      // TODO(review)
      rest: 'ช่องที่เหลือก็ทำแบบเดียวกัน',
      // TODO(review)
      done: 'ครบทุกช่องแล้ว',
      compare: {
        // TODO(review)
        REVERSED: 'ที่ทำมา: เอาตัวหลังลบตัวหน้า ลำดับจึงสลับกัน',
        // TODO(review)
        FIRST_ROW: 'ที่ทำมา: คูณแค่แถวแรก แถวอื่นยังเหมือนเดิม',
        // TODO(review)
        DIAGONAL: 'ที่ทำมา: คูณแค่แนวทแยง ช่องอื่นยังเหมือนเดิม',
        // TODO(review)
        ADD: 'ที่ทำมา: เอาค่ามาบวก แต่ต้องคูณทุกช่อง',
      },
      // TODO(review)
      try: 'ตาคุณ ช่องนี้ต้องเขียนแบบไหน',
      // TODO(review)
      hint_sub: 'ตัวหน้าเป็นตัวตั้งเสมอ',
      // TODO(review)
      hint_scalar: 'ตัวเลขนี้ต้องคูณเข้าไปทุกช่อง',
      // TODO(review)
      try_done: 'ใช่เลย ทุกช่องทำแบบนี้',
      // TODO(review)
      rule: { add: 'ช่องเดียวกัน บวกกัน', sub: 'ตัวหน้า ลบ ตัวหลัง', scalar: 'คูณทุกช่อง' },
    },
    detSum: {
      // TODO(review)
      compare: 'ที่ทำมา: หา det ทีละตัวแล้วเอามาบวกกัน',
      // TODO(review)
      add_first: 'ต้องบวกเมทริกซ์ให้เสร็จก่อน',
      // TODO(review)
      det_of_sum: 'แล้วค่อยหา det ของผลบวก',
      // TODO(review)
      differ: 'ได้ {{right}} ไม่ใช่ {{wrong}} det แยกผลบวกไม่ได้',
      // TODO(review)
      try: 'ตาคุณ ต้องทำอะไรก่อน',
      // TODO(review)
      hint: 'ในวงเล็บต้องทำก่อน',
      // TODO(review)
      addFirst: 'บวกเมทริกซ์ก่อน',
      // TODO(review)
      detFirst: 'หา det ก่อน',
    },
    intro: {
      // TODO(review)
      u1_result: 'ตารางตัวเลขนี้คือเมทริกซ์มิติ {{dims}}',
      // TODO(review)
      u2_rest: 'ช่องที่เหลือก็บวกแบบเดียวกัน',
      // TODO(review)
      u3_pick_col: 'ราคาต่อหน่วย: ใช้หลักที่ {{j}}',
      // TODO(review)
      u3_pair: 'แต่ละอย่างคู่กับราคาของมัน',
      // TODO(review)
      u3_multiply: 'จำนวน × ราคา ของแต่ละอย่าง',
      stories: {
        shop: {
          labels: { rows: ['ร้าน ก', 'ร้าน ข'], cols: ['สมุด', 'ปากกา', 'ยางลบ'] },
          u1: {
            // TODO(review)
            blocks: 'ยอดขายของแต่ละร้าน เขียนเป็นตารางได้',
            // TODO(review)
            count_rows: 'แถวบอกว่าเป็นร้านไหน มี {{rows}} แถว',
            // TODO(review)
            count_cols: 'หลักบอกว่าเป็นสินค้าอะไร มี {{cols}} หลัก',
          },
          u2: {
            // TODO(review)
            left: 'สาขา 1',
            // TODO(review)
            right: 'สาขา 2',
            // TODO(review)
            result: 'รวม',
            // TODO(review)
            setup: 'ยอดรวมสองสาขา: บวกทีละช่อง',
            // TODO(review)
            done: 'ได้ยอดรวมของทุกสินค้า',
            // TODO(review)
            also: 'สั่งของเพิ่มเป็น {{k}} เท่าของสาขาแรก: คูณทุกช่อง',
          },
          u3: {
            // TODO(review)
            left: 'จำนวน',
            // TODO(review)
            right: 'ราคา',
            // TODO(review)
            result: 'รายได้',
            // TODO(review)
            setup: 'จำนวนสินค้า × ราคา = รายได้',
            // TODO(review)
            pick_row: 'ร้านแรกขายอะไรไปเท่าไร: ใช้แถวที่ {{i}}',
            // TODO(review)
            sum: 'รวมเป็นรายได้ของร้านแรก',
            // TODO(review)
            fill_rest: 'ร้านที่สองก็ทำแบบเดียวกัน',
          },
        },
        game: {
          labels: { rows: ['ผู้เล่น ก', 'ผู้เล่น ข'], cols: ['ดาบ', 'โล่', 'ยา'] },
          u1: {
            // TODO(review)
            blocks: 'ไอเทมของผู้เล่นแต่ละคน เขียนเป็นตารางได้',
            // TODO(review)
            count_rows: 'แถวบอกว่าเป็นผู้เล่นคนไหน มี {{rows}} แถว',
            // TODO(review)
            count_cols: 'หลักบอกว่าเป็นไอเทมอะไร มี {{cols}} หลัก',
          },
          u2: {
            // TODO(review)
            left: 'ด่าน 1',
            // TODO(review)
            right: 'ด่าน 2',
            // TODO(review)
            result: 'รวม',
            // TODO(review)
            setup: 'ไอเทมรวมสองด่าน: บวกทีละช่อง',
            // TODO(review)
            done: 'ได้จำนวนไอเทมรวมของทุกอย่าง',
            // TODO(review)
            also: 'ได้โบนัส {{k}} เท่าจากด่านแรก: คูณทุกช่อง',
          },
          u3: {
            // TODO(review)
            left: 'จำนวน',
            // TODO(review)
            right: 'ราคา',
            // TODO(review)
            result: 'เหรียญ',
            // TODO(review)
            setup: 'จำนวนไอเทม × ราคา = เหรียญที่ใช้',
            // TODO(review)
            pick_row: 'ผู้เล่นคนแรกซื้ออะไรเท่าไร: ใช้แถวที่ {{i}}',
            // TODO(review)
            sum: 'รวมเป็นเหรียญที่คนแรกใช้',
            // TODO(review)
            fill_rest: 'คนที่สองก็ทำแบบเดียวกัน',
          },
        },
        sport: {
          labels: { rows: ['ทีม ก', 'ทีม ข'], cols: ['ชนะ', 'เสมอ', 'แพ้'] },
          u1: {
            // TODO(review)
            blocks: 'ผลการแข่งของแต่ละทีม เขียนเป็นตารางได้',
            // TODO(review)
            count_rows: 'แถวบอกว่าเป็นทีมไหน มี {{rows}} แถว',
            // TODO(review)
            count_cols: 'หลักบอกว่าเป็นผลแบบไหน มี {{cols}} หลัก',
          },
          u2: {
            // TODO(review)
            left: 'ครึ่งแรก',
            // TODO(review)
            right: 'ครึ่งหลัง',
            // TODO(review)
            result: 'รวม',
            // TODO(review)
            setup: 'ผลรวมสองช่วงของฤดูกาล: บวกทีละช่อง',
            // TODO(review)
            done: 'ได้ผลรวมของทั้งฤดูกาล',
            // TODO(review)
            also: 'ถ้าแข่ง {{k}} เท่าของครึ่งแรก: คูณทุกช่อง',
          },
          u3: {
            // TODO(review)
            left: 'จำนวนนัด',
            // TODO(review)
            right: 'แต้ม',
            // TODO(review)
            result: 'แต้มรวม',
            // TODO(review)
            setup: 'จำนวนนัด × แต้มต่อนัด = แต้มรวม',
            // TODO(review)
            pick_row: 'ทีมแรกแข่งไปกี่นัด: ใช้แถวที่ {{i}}',
            // TODO(review)
            sum: 'รวมเป็นแต้มของทีมแรก',
            // TODO(review)
            fill_rest: 'ทีมที่สองก็ทำแบบเดียวกัน',
          },
        },
        music: {
          labels: { rows: ['วง ก', 'วง ข'], cols: ['ป๊อป', 'ร็อก', 'แจ๊ส'] },
          u1: {
            // TODO(review)
            blocks: 'เพลงที่แต่ละวงเล่น เขียนเป็นตารางได้',
            // TODO(review)
            count_rows: 'แถวบอกว่าเป็นวงไหน มี {{rows}} แถว',
            // TODO(review)
            count_cols: 'หลักบอกว่าเป็นแนวเพลงอะไร มี {{cols}} หลัก',
          },
          u2: {
            // TODO(review)
            left: 'รอบบ่าย',
            // TODO(review)
            right: 'รอบค่ำ',
            // TODO(review)
            result: 'รวม',
            // TODO(review)
            setup: 'บัตรที่ขายได้สองรอบ: บวกทีละช่อง',
            // TODO(review)
            done: 'ได้จำนวนบัตรรวมของทุกโซน',
            // TODO(review)
            also: 'เปิดขาย {{k}} เท่าของรอบบ่าย: คูณทุกช่อง',
          },
          u3: {
            // TODO(review)
            left: 'จำนวนบัตร',
            // TODO(review)
            right: 'ราคา',
            // TODO(review)
            result: 'รายได้',
            // TODO(review)
            setup: 'จำนวนบัตร × ราคา = รายได้',
            // TODO(review)
            pick_row: 'วงแรกขายบัตรไปเท่าไร: ใช้แถวที่ {{i}}',
            // TODO(review)
            sum: 'รวมเป็นรายได้ของวงแรก',
            // TODO(review)
            fill_rest: 'วงที่สองก็ทำแบบเดียวกัน',
          },
        },
        food: {
          labels: { rows: ['ร้าน ก', 'ร้าน ข'], cols: ['ชานม', 'ข้าวมัน', 'ลูกชิ้น'] },
          u1: {
            // TODO(review)
            blocks: 'เมนูที่แต่ละร้านขายได้ เขียนเป็นตารางได้',
            // TODO(review)
            count_rows: 'แถวบอกว่าเป็นร้านไหน มี {{rows}} แถว',
            // TODO(review)
            count_cols: 'หลักบอกว่าเป็นเมนูอะไร มี {{cols}} หลัก',
          },
          u2: {
            // TODO(review)
            left: 'มื้อเช้า',
            // TODO(review)
            right: 'มื้อเย็น',
            // TODO(review)
            result: 'รวม',
            // TODO(review)
            setup: 'ยอดขายสองมื้อรวมกัน: บวกทีละช่อง',
            // TODO(review)
            done: 'ได้ยอดขายรวมของทุกเมนู',
            // TODO(review)
            also: 'เตรียมของ {{k}} เท่าของมื้อเช้า: คูณทุกช่อง',
          },
          u3: {
            // TODO(review)
            left: 'จำนวนจาน',
            // TODO(review)
            right: 'ราคา',
            // TODO(review)
            result: 'ยอดเงิน',
            // TODO(review)
            setup: 'จำนวนจาน × ราคา = ยอดเงิน',
            // TODO(review)
            pick_row: 'โต๊ะแรกสั่งอะไรเท่าไร: ใช้แถวที่ {{i}}',
            // TODO(review)
            sum: 'รวมเป็นยอดเงินของโต๊ะแรก',
            // TODO(review)
            fill_rest: 'โต๊ะที่สองก็ทำแบบเดียวกัน',
          },
        },
      },
      u4: {
        // TODO(review)
        apply: 'เมทริกซ์แปลงระนาบ รูปจึงเปลี่ยนไป',
      },
      u5: {
        // TODO(review)
        unit: 'เมทริกซ์แปลงรูปนี้ได้',
        // TODO(review)
        undo: 'อินเวอร์สคือการแปลงย้อนกลับ',
        // TODO(review)
        back: 'ได้รูปเดิม A⁻¹ ย้อนสิ่งที่ A ทำ',
      },
    },
  },

  // Captions of worked-solution steps. Formulas come from the engine as LaTeX.
  worked: {
    // TODO(review)
    dim_rows: 'นับแถว (แนวนอน) ได้ {{rows}} แถว',
    // TODO(review)
    dim_cols: 'นับหลัก (แนวตั้ง) ได้ {{cols}} หลัก',
    // TODO(review)
    dim_result: 'มิติเขียนเป็น แถว × หลัก',
    // TODO(review)
    index_locate: 'ไปที่แถว {{i}} แล้วดูหลัก {{j}}',
    // TODO(review)
    index_row: 'นี่คือแถว {{i}} ลองไล่ไปที่หลัก {{j}}',
    // TODO(review)
    transpose_row: 'แถวที่ {{i}} ของ A กลายเป็นหลักที่ {{i}} ของ Aᵀ',
    // TODO(review)
    transpose_result: 'ได้ Aᵀ',
    // TODO(review)
    addsub_dims: 'ดูมิติ: A เป็น {{dimsA}} และ B เป็น {{dimsB}}',
    // TODO(review)
    addsub_undefined: 'มิติไม่เท่ากัน จึงหาค่าไม่ได้',
    // TODO(review)
    addsub_cell: 'ช่องแถว {{i}} หลัก {{j}}',
    // TODO(review)
    addsub_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    scalar_cell: 'คูณ {{k}} เข้าไปที่ช่องแถว {{i}} หลัก {{j}}',
    // TODO(review)
    scalar_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    combo_scale_a: 'คูณ A ด้วย {{p}}',
    // TODO(review)
    combo_scale_b: 'คูณ B ด้วย {{q}}',
    // TODO(review)
    combo_cell: 'ลบกันที่ช่องแถว {{i}} หลัก {{j}}',
    // TODO(review)
    combo_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    defined_inner: 'ดูตัวเลขด้านใน: {{n}} กับ {{r}}',
    // TODO(review)
    defined_result: 'ตัวในเท่ากัน มิติของผลคูณคือตัวเลขด้านนอก',
    // TODO(review)
    defined_undefined: 'ตัวในไม่เท่ากัน จึงหาค่าไม่ได้',
    // TODO(review)
    abc_first: 'เริ่มจาก AB',
    // TODO(review)
    abc_second: 'ต่อด้วย (AB)C',
    // TODO(review)
    mult_cell: 'ช่องแถว {{i}} หลัก {{j}}: แถว {{i}} ของตัวหน้า คู่กับหลัก {{j}} ของตัวหลัง',
    // TODO(review)
    mult_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    noncomm_example: 'ลองดูตัวอย่างคู่หนึ่ง: คูณ XY',
    // TODO(review)
    noncomm_example_swapped: 'สลับลำดับเป็น YX',
    // TODO(review)
    noncomm_example_differ: 'ได้ผลต่างกัน จึงสรุปว่า AB กับ BA อาจไม่เท่ากัน',
    // TODO(review)
    noncomm_ab: 'หา AB',
    // TODO(review)
    noncomm_ba: 'หา BA',
    // TODO(review)
    noncomm_same: 'ได้ผลเท่ากัน คู่นี้สลับที่ได้',
    // TODO(review)
    noncomm_differ: 'ได้ผลต่างกัน คู่นี้สลับที่ไม่ได้',
    // TODO(review)
    det2_formula: 'ทแยงลง (ad) ลบ ทแยงขึ้น (bc)',
    // TODO(review)
    det3_down: 'รวม 3 เส้นลง',
    // TODO(review)
    det3_up: 'รวม 3 เส้นขึ้น',
    // TODO(review)
    det3_result: 'เส้นลง ลบ เส้นขึ้น',
    // TODO(review)
    det_scaled_rule: 'k คูณเข้าไป {{n}} แถว จึงดึง k ออกมาได้ {{n}} ตัว',
    // TODO(review)
    det_scaled_value: 'แทนค่า',
    // TODO(review)
    det_product_rule: 'det ของผลคูณเท่ากับผลคูณของ det',
    // TODO(review)
    det_sum_add: 'บวกเมทริกซ์ให้เสร็จก่อน',
    // TODO(review)
    det_sum_det: 'แล้วค่อยหา det',
    // TODO(review)
    det_transpose_rule: 'ทรานสโพสไม่เปลี่ยนค่า det',
    // TODO(review)
    det_inverse_rule: 'det ของอินเวอร์สคือส่วนกลับของ det',
    // TODO(review)
    invertible_det: 'หา det ก่อน',
    // TODO(review)
    invertible_has: 'det ไม่เป็น 0 จึงมีอินเวอร์ส',
    // TODO(review)
    invertible_none: 'det เป็น 0 จึงไม่มีอินเวอร์ส',
    // TODO(review)
    inv2_swap: 'สลับ a กับ d',
    // TODO(review)
    inv2_negate: 'กลับเครื่องหมาย b กับ c',
    // TODO(review)
    inv2_det: 'หา det = ad − bc',
    // TODO(review)
    inv2_divide: 'หารทุกช่องด้วย det',
  },
} as const;

export type PromptKey = keyof typeof th.prompts;
export type ChoiceKey = keyof typeof th.choices;
export type HintKey = keyof typeof th.hints;
export type WorkedKey = keyof typeof th.worked;
