"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type EventItem = {
    id: string;
    code: string;
    title: string;
    startAt: any;
    endAt: any;
    status: string;
};

export default function Page() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [code, setCode] = useState("");
    const [title, setTitle] = useState("");

    async function refresh() {
        const d = await (await fetch("/api/events")).json();
        setEvents(d.items ?? []);
    }
    useEffect(() => {
        refresh();
    }, []);

    async function create() {
        await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code,
                title,
                startAt: new Date(),
                endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
            }),
        });
        setCode("");
        setTitle("");
        refresh();
    }

    return (
        <main style={{ padding: 24 }}>
            <h1>Events</h1>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                    placeholder="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                />
                <input
                    placeholder="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <button onClick={create}>Create</button>
            </div>

            <ul style={{ marginTop: 16 }}>
                {events.map((ev) => (
                    <li key={ev.id} style={{ padding: "8px 0" }}>
                        <Link href={`/events/${ev.code}`}>{ev.code}</Link> —{" "}
                        {ev.title}
                    </li>
                ))}
            </ul>
        </main>
    );
}
