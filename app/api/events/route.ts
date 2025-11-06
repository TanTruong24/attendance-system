// app/api/events/route.ts
import { NextResponse } from "next/server";
import { listEvents, createEvent } from "@/lib/db/events";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limitParam = Number(searchParams.get("limit") ?? "100");
        const limit =
            Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 100;

        const items = (await listEvents(limit)).map((ev) => ({
            id: ev.id,
            code: ev.code,
            title: ev.title,
            startAt: ev.startAt.toDate().toISOString(),
            endAt: ev.endAt.toDate().toISOString(),
            // NEW: trả về 2 field để UI list hiển thị “Cửa sổ chấm công”
            checkinOpenAt: ev.checkinOpenAt
                ? ev.checkinOpenAt.toDate().toISOString()
                : null,
            checkinCloseAt: ev.checkinCloseAt
                ? ev.checkinCloseAt.toDate().toISOString()
                : null,
            status: ev.status,
        }));

        return NextResponse.json({ items });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // body: { code, title, startAt, endAt, checkinOpenAt?, checkinCloseAt?, createdBy?, status?, url? }
        const created = await createEvent({
            code: body.code,
            title: body.title,
            startAt: body.startAt,
            endAt: body.endAt,
            // NEW: truyền 2 field mới nếu có, hoặc null
            checkinOpenAt: body.checkinOpenAt ?? null,
            checkinCloseAt: body.checkinCloseAt ?? null,
            createdBy: body.createdBy ?? null,
            status: body.status ?? "published",
            url: body.url ?? null,
        });

        return NextResponse.json(
            {
                id: created.id,
                code: created.code,
                title: created.title,
                startAt: created.startAt.toDate().toISOString(),
                endAt: created.endAt.toDate().toISOString(),
                // NEW: trả về 2 field mới
                checkinOpenAt: created.checkinOpenAt
                    ? created.checkinOpenAt.toDate().toISOString()
                    : null,
                checkinCloseAt: created.checkinCloseAt
                    ? created.checkinCloseAt.toDate().toISOString()
                    : null,
                status: created.status,
            },
            { status: 201 }
        );
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
