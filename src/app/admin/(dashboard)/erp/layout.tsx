import { requireEditor } from "@/lib/auth";
import { ErpTabs } from "@/components/erp/ErpTabs";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  await requireEditor();
  return (
    <div className="mx-auto max-w-[1400px]">
      <ErpTabs />
      {children}
    </div>
  );
}
