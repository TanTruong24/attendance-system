// lib/db/utils.ts
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const nowTS = () => FieldValue.serverTimestamp();

export function toTS(v: Date | string | number | undefined | null): Timestamp {
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (typeof v === "string" || typeof v === "number") return Timestamp.fromDate(new Date(v));
  return Timestamp.now();
}

// Chuẩn hóa field để so sánh/unique không phân biệt hoa thường
export const toLowerOrNull = (v?: string | null) => (v ? v.toLowerCase() : null);
