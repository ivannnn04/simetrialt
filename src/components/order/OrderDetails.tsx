"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CaretIcon } from "@/components/ui/Icons";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

export type OrderItem = {
  id: string;
  name: string;
  qty: number;
  color: string;
  /** unit price in cents */
  priceCents: number;
  image?: string | null;
};

const eur = (cents: number) => `€${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Sum of every line (unit price × quantity), whether or not all lines are shown. */
export const orderTotalCents = (items: OrderItem[]) => items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);

const PREVIEW = 3;

/** Figma "Order Details" card (node 4217:46505): three items, "Show all N items" reveals the rest, total line. */
export function OrderDetails({ items }: { items: OrderItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, PREVIEW);
  const hidden = items.length > PREVIEW;
  const total = eur(orderTotalCents(items));

  return (
    <div className="flex w-full max-w-[706px] flex-col bg-white">
      <div className="border-b border-line p-6">
        <h2 className="text-[20px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1b2a41]">Order Details</h2>
      </div>
      <ul>
        {visible.map((item) => (
          <li key={item.id} className="flex items-center border-b border-line">
            <div className="flex items-center gap-6 p-6">
              <div className="flex size-[70px] shrink-0 items-center justify-center bg-[#f2f2f2]">
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="max-h-[60%] max-w-[70%] object-contain" />
                )}
              </div>
              <div className="flex min-w-[140px] flex-col gap-2 leading-none">
                <p className="text-[18px] font-semibold tracking-[-0.04em] text-[#1b2a41]">{item.name}</p>
                <p className="text-[14px] tracking-[-0.04em] text-tertiary">Qty {item.qty}</p>
                <p className="text-[14px] tracking-[-0.04em] text-tertiary">Color: {item.color}</p>
              </div>
            </div>
            <p className="ml-auto pr-6 text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41]">{eur(item.priceCents * item.qty)}</p>
          </li>
        ))}
      </ul>
      {hidden && (
        <div className="flex justify-end border-b border-line px-6 py-4">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-[27px] items-center gap-2 border-b border-black pb-1.5 text-[18px] font-medium leading-none tracking-[-0.04em] text-black transition-colors hover:border-accent hover:text-accent"
          >
            {expanded ? "Show less" : `Show all ${items.length} items`}
            <CaretIcon className={cn("size-5 transition-transform duration-300", expanded && "rotate-180")} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between p-6 text-[20px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1b2a41]">
        <p>Total</p>
        <p>{total}</p>
      </div>
    </div>
  );
}

/** Placeholder order shown until checkout exists (Figma mock: six "Okha Repose sofa" lines, 2 × €210 = €420 each). */
export const SAMPLE_ORDER: OrderItem[] = Array.from({ length: 6 }, (_, i) => ({
  id: `line-${i + 1}`,
  name: "Okha Repose sofa",
  qty: 2,
  color: "White",
  priceCents: 21000,
  image: PRODUCT_PLACEHOLDER_IMAGE,
}));
