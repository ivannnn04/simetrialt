import { requireCustomer } from "@/lib/customer-auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer();
  return <>{children}</>;
}
