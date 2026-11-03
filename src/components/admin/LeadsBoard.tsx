"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLeadStatus } from "@/actions/leads";
import { cn } from "@/lib/cn";

export type BoardLead = { id: string; name: string; company: string; contact: string; source: string; status: string; date: string; preview: string; totalCents: number; products: number };

const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: "NEW", label: "Nauja", accent: "bg-blue-500" },
  { key: "CONTACTED", label: "Susisiekta", accent: "bg-yellow-500" },
  { key: "QUALIFIED", label: "Kvalifikuota", accent: "bg-purple-500" },
  { key: "WON", label: "Laimėta", accent: "bg-green-600" },
  { key: "LOST", label: "Prarasta", accent: "bg-zinc-400" },
];

const eur = (cents: number) => `${(cents / 100).toLocaleString("lt-LT", { maximumFractionDigits: 0 })} €`;

/** Inquiries as columns by status; drag a card to another column (or pick the status on it) to move it. */
export function LeadsBoard({ leads: initial }: { leads: BoardLead[] }) {
  const [leads, setLeads] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();

  const move = (id: string, status: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    start(async () => {
      try {
        await updateLeadStatus(id, status);
      } catch {
        setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: lead.status } : l)));
      }
    });
  };

  return (
    <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-5">
      {COLUMNS.map((col) => {
        const items = leads.filter((l) => l.status === col.key);
        const value = items.reduce((n, l) => n + l.totalCents, 0);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragging;
              if (id) move(id, col.key);
              setDragging(null);
              setOver(null);
            }}
            className={cn("flex min-h-[420px] min-w-[240px] flex-col rounded-xl bg-zinc-200/60 p-3 transition", over === col.key && "bg-zinc-300/70 ring-2 ring-zinc-900/20")}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", col.accent)} />
                <p className="text-sm font-semibold text-zinc-800">{col.label}</p>
                <span className="rounded-full bg-white px-2 text-xs text-zinc-600">{items.length}</span>
              </div>
              {value > 0 && <p className="text-xs text-zinc-500" title="Orientacinė užklausų suma">{eur(value)}</p>}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", l.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(l.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={cn("cursor-grab rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-zinc-200 active:cursor-grabbing", dragging === l.id && "opacity-50")}
                >
                  <Link href={`/admin/leads/${l.id}`} className="block font-medium text-zinc-900 hover:underline">
                    {l.name}
                  </Link>
                  {l.company && <p className="text-xs text-zinc-500">{l.company}</p>}
                  {l.preview && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-zinc-600">{l.preview}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                    <span>{l.date}</span>
                    <span>· {l.source}</span>
                    {l.products > 0 && <span>· {l.products} produkt.</span>}
                    {l.totalCents > 0 && <span className="font-medium text-zinc-700">· {eur(l.totalCents)}</span>}
                  </div>
                  {l.contact && <p className="mt-1 truncate text-[11px] text-zinc-400">{l.contact}</p>}
                  <select
                    value={l.status}
                    onChange={(e) => move(l.id, e.target.value)}
                    aria-label="Būsena"
                    className="mt-2 w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {items.length === 0 && <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400">Nutempkite čia</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
