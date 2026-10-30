import { CONFIG } from '@/lib/config';

// All Thai UI copy lives here. Draft copy stays marked TODO(review) until Potter and a math teacher check it.
export const th = {
  home: {
    // TODO(review)
    tagline: 'ฝึกเมทริกซ์ทีละขั้น ดูคลิปสั้นๆ แล้วลองทำเอง',
    // TODO(review)
    description: `ถ้าตอบผิด ${CONFIG.tutorName}จะพาดูว่าคลาดเคลื่อนตรงไหน แล้วเลือกขั้นต่อไปให้เหมาะกับคุณ`,
    // TODO(review)
    numberSample: 'ตัวอย่างตัวเลขในเมทริกซ์',
    // TODO(review)
    status: 'กำลังสร้าง เปิดให้เรียนเร็วๆ นี้',
  },
} as const;
