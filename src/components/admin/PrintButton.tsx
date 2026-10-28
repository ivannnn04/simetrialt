"use client";

import { PrimaryButton } from "@/components/admin/ui";

export function PrintButton() {
  return (
    <PrimaryButton type="button" onClick={() => window.print()}>
      Spausdinti / išsaugoti PDF
    </PrimaryButton>
  );
}
