import { NextResponse } from "next/server";
import { deleteEvent, getEventById, updateEvent } from "@/lib/db/events";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const eid = (id ?? "").trim();
    if (!eid)
        return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const ev = await getEventById(eid);
    if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
        id: ev.id,
        code: ev.code,
        title: ev.title,
        startAt: ev.startAt.toDate().toISOString(),
        endAt: ev.endAt.toDate().toISOString(),
        // NEW: đưa 2 field mới ra response
        checkinOpenAt: ev.checkinOpenAt
            ? ev.checkinOpenAt.toDate().toISOString()
            : null,
        checkinCloseAt: ev.checkinCloseAt
            ? ev.checkinCloseAt.toDate().toISOString()
            : null,
        status: ev.status,
        url: ev.url ?? null,
        createdBy: ev.createdBy ?? null,
    });
}

export async function PUT(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const eid = (id ?? "").trim();
    if (!eid)
        return NextResponse.json({ error: "Missing id" }, { status: 400 });

    try {
        const body = await req.json();
        const ev = await updateEvent(eid, {
            code: body.code,
            title: body.title,
            startAt: body.startAt,
            endAt: body.endAt,
            checkinOpenAt: body.checkinOpenAt ?? null,
            checkinCloseAt: body.checkinCloseAt ?? null,
            status: body.status,
            url: body.url,
            createdBy: body.createdBy,
        });

        return NextResponse.json({
            id: ev.id,
            code: ev.code,
            title: ev.title,
            startAt: ev.startAt.toDate().toISOString(),
            endAt: ev.endAt.toDate().toISOString(),
            checkinOpenAt: ev.checkinOpenAt
                ? ev.checkinOpenAt.toDate().toISOString()
                : null,
            checkinCloseAt: ev.checkinCloseAt
                ? ev.checkinCloseAt.toDate().toISOString()
                : null,
            status: ev.status,
            url: ev.url ?? null,
            createdBy: ev.createdBy ?? null,
        });
    } catch (e: any) {
        // NEW: báo lỗi validation về 400 thay vì 500
        return NextResponse.json(e?.message || "Bad request", { status: 400 });
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const eid = (id ?? "").trim();
    if (!eid)
        return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const ok = await deleteEvent(eid);
    return NextResponse.json(ok);
}
