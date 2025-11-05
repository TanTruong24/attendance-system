// lib/db/users.ts
import { adminDb } from "@/lib/firebase/admin";
import type { Timestamp } from "firebase-admin/firestore";
import { hashCccd, nowTS, toLowerOrNull } from "./utils";

export type UserRole = "admin" | "staff" | "attendee";
export type UserStatus = "active" | "disabled";

export type User = {
    id: string;
    name: string;
    email?: string | null;
    username?: string | null;
    role: UserRole;
    group?: string | null;
    cccdLast4?: string | null;
    cccdHash?: string | null;
    status: UserStatus;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

const col = () => adminDb.collection("users");

function toUser(snap: FirebaseFirestore.DocumentSnapshot): User {
    const d = snap.data()!;
    return {
        id: snap.id,
        name: d.name,
        email: d.email ?? null,
        username: d.username ?? null,
        role: d.role,
        group: d.group ?? null,
        cccdLast4: d.cccdLast4 ?? null,
        cccdHash: d.cccdHash ?? null,
        status: d.status ?? "active",
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    };
}

/* ==================== LIST ==================== */
export async function listUsers(limit = 50): Promise<User[]> {
    const snap = await col().orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map(toUser);
}

/* ==================== CREATE ==================== */
export async function createUser(input: {
    name: string;
    email?: string | null;
    username?: string;
    role: UserRole;
    group?: string | null;
    cccd: string;
    status?: UserStatus;
}) {
    if (!input?.name?.trim()) throw new Error("Thiếu tên người dùng.");
    if (!input?.role) throw new Error("Thiếu vai trò.");
    if (!input?.cccd?.trim()) throw new Error("Thiếu số CCCD.");

    // chuẩn hóa/validate CCCD (tùy quy định: 12 số)
    const cccd = input.cccd.trim();
    if (!/^\d{12}$/.test(cccd))
        throw new Error("CCCD không hợp lệ (phải gồm 12 chữ số).");

    const emailLower = toLowerOrNull(input.email ?? null);
    const usernameLower = toLowerOrNull(input.username ?? null);

    if (emailLower) {
        const dup = await col()
            .where("emailLower", "==", emailLower)
            .limit(1)
            .get();
        if (!dup.empty) throw new Error("Email đã tồn tại.");
    }
    if (usernameLower) {
        const dup = await col()
            .where("usernameLower", "==", usernameLower)
            .limit(1)
            .get();
        if (!dup.empty) throw new Error("Username đã tồn tại.");
    }

    // 👉 kiểm tra trùng CCCD qua hash
    const cccdHash = hashCccd(cccd);
    const dupCccd = await col()
        .where("cccdHash", "==", cccdHash)
        .limit(1)
        .get();
    if (!dupCccd.empty) throw new Error("CCCD đã tồn tại.");

    const ref = await col().add({
        name: input.name.trim(),
        email: input.email ?? null,
        emailLower,
        username: input.username ?? null,
        usernameLower,
        role: input.role,
        group: input.group ?? null,
        cccdLast4: cccd.slice(-4),
        cccdHash,
        status: input.status ?? "active",
        createdAt: nowTS(),
        updatedAt: nowTS(),
    });

    const snap = await ref.get();
    return toUser(snap);
}

/* ==================== UPDATE ==================== */
export async function updateUser(
    id: string,
    patch: Partial<{
        name: string;
        email: string | null;
        username: string | null;
        role: UserRole;
        group: string | null;
        status: UserStatus;
        cccd: string;
    }>
) {
    const ref = col().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("User không tồn tại.");

    const data: any = { updatedAt: nowTS() };

    if (patch.name !== undefined) data.name = patch.name?.trim() || null;

    if (patch.email !== undefined) {
        const emailLower = toLowerOrNull(patch.email);
        if (emailLower) {
            const dup = await col()
                .where("emailLower", "==", emailLower)
                .limit(1)
                .get();
            if (!dup.empty && dup.docs[0].id !== id)
                throw new Error("Email đã tồn tại.");
        }
        data.email = patch.email ?? null;
        data.emailLower = emailLower;
    }

    if (patch.username !== undefined) {
        const usernameLower = toLowerOrNull(patch.username);
        if (usernameLower) {
            const dup = await col()
                .where("usernameLower", "==", usernameLower)
                .limit(1)
                .get();
            if (!dup.empty && dup.docs[0].id !== id)
                throw new Error("Username đã tồn tại.");
        }
        data.username = patch.username ?? null;
        data.usernameLower = usernameLower;
    }

    if (patch.role !== undefined) data.role = patch.role;
    if (patch.group !== undefined) data.group = patch.group ?? null;
    if (patch.status !== undefined) data.status = patch.status;

    if (patch.cccd !== undefined) {
        const cccd = (patch.cccd || "").trim();
        if (!cccd) throw new Error("CCCD không được để trống.");
        if (!/^\d{12}$/.test(cccd))
            throw new Error("CCCD không hợp lệ (phải gồm 12 chữ số).");

        const cccdHash = hashCccd(cccd);
        const dup = await col()
            .where("cccdHash", "==", cccdHash)
            .limit(1)
            .get();
        if (!dup.empty && dup.docs[0].id !== id)
            throw new Error("CCCD đã tồn tại.");

        data.cccdLast4 = cccd.slice(-4);
        data.cccdHash = cccdHash;
    }

    await ref.update(data);
    const after = await ref.get();
    return toUser(after);
}

/* ==================== DELETE ==================== */
export async function deleteUser(id: string) {
    const ref = col().doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { ok: true };

    await ref.delete();
    return { ok: true };
}

/* ===== READ ONE ===== */
export async function getUserById(id: string): Promise<User | null> {
    if (!id) return null;
    const doc = await col().doc(id).get();
    return doc.exists ? toUser(doc) : null;
}
