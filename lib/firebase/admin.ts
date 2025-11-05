// lib/firebase/admin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
    getFirestore,
    FieldValue as AdminFieldValue,
    Timestamp as AdminTimestamp,
} from "firebase-admin/firestore";

/**
 * Lưu ý ENV:
 *  - FIREBASE_ADMIN_PROJECT_ID
 *  - FIREBASE_ADMIN_CLIENT_EMAIL
 *  - FIREBASE_ADMIN_PRIVATE_KEY (giữ \n, code sẽ replace)
 */
function required(name: string, value?: string) {
    if (!value) {
        throw new Error(`[firebase-admin] Missing env ${name}`);
    }
    return value;
}

const PRIVATE_KEY = required(
    "FIREBASE_ADMIN_PRIVATE_KEY",
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
).replace(/\\n/g, "\n");

const adminApp: App =
    getApps().length
        ? getApps()[0]!
        : initializeApp({
            credential: cert({
                projectId: required("FIREBASE_ADMIN_PROJECT_ID", process.env.FIREBASE_ADMIN_PROJECT_ID),
                clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL", process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
                privateKey: PRIVATE_KEY,
            }),
        });

// --- Exports chính dùng khắp dự án ---
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

// Re-export để dùng thống nhất ở layer DB
export const FieldValue = AdminFieldValue;
export type Timestamp = AdminTimestamp;

// --- Helpers (tuỳ chọn) ---
/** Tạo session cookie từ Firebase ID token */
export async function createSessionCookie(idToken: string, maxDays = 5) {
    const expiresIn = maxDays * 24 * 60 * 60 * 1000;
    const cookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    return { cookie, maxAgeSec: Math.floor(expiresIn / 1000) };
}

/** Verify session cookie (throw nếu không hợp lệ). Trả về decoded token. */
export function verifySessionCookie(sessionCookie: string, checkRevoked = true) {
    return adminAuth.verifySessionCookie(sessionCookie, checkRevoked);
}

/** Revoke toàn bộ refresh tokens của 1 user (dùng khi logout toàn cục) */
export async function revokeUserSessions(uid: string) {
    await adminAuth.revokeRefreshTokens(uid);
}
