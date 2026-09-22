import { SiteFooter } from "@/components/site/Footer";
import { CursorLabel } from "@/components/ui/CursorLabel";
import { SavedProvider } from "@/components/catalogue/SavedProvider";
import { getSavedProductIds } from "@/actions/collections";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const saved = await getSavedProductIds();
  return (
    <SavedProvider initial={saved}>
      <div className="flex min-h-screen flex-col bg-cream">
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
        <CursorLabel />
      </div>
    </SavedProvider>
  );
}
