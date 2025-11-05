import { NextResponse } from "next/server";
import { deleteEvent, getEventById, updateEvent } from "@/lib/db/events";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
    const { id } = await ctx.params; // 👈 phải await
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
        status: ev.status,
        url: ev.url ?? null,
        createdBy: ev.createdBy ?? null,
    });
}

export async function PUT(req: Request, ctx: Ctx) {
    const { id } = await ctx.params; // 👈 phải await
    const eid = (id ?? "").trim();
    if (!eid)
        return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json();
    const ev = await updateEvent(eid, body);
    return NextResponse.json({
        id: ev.id,
        code: ev.code,
        title: ev.title,
        startAt: ev.startAt.toDate().toISOString(),
        endAt: ev.endAt.toDate().toISOString(),
        status: ev.status,
        url: ev.url ?? null,
        createdBy: ev.createdBy ?? null,
    });
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { id } = await ctx.params; // 👈 phải await
    const eid = (id ?? "").trim();
    if (!eid)
        return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const ok = await deleteEvent(eid);
    return NextResponse.json(ok);
}
