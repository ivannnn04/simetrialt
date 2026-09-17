import { ContactForm } from "@/components/ContactForm";

export const metadata = { title: "Kontaktai — Simetria LT" };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Kontaktai</h1>
      <p className="mb-8 text-zinc-600">
        Parašykite mums — atsakysime kaip įmanoma greičiau.
      </p>
      <ContactForm
        initialMessage={product ? `Sveiki, domiuosi produktu „${product}“.\n\n` : undefined}
      />
    </div>
  );
}
