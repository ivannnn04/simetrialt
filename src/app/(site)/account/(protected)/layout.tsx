import { headers } from "next/headers";
import { requireCustomer } from "@/lib/customer-auth";
import { PATHNAME_HEADER } from "@/i18n/config";

// Albums belong to a customer account: visitors who are not signed in go to the login page and
// come back here afterwards.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get(PATHNAME_HEADER) || "/account/albums";
  await requireCustomer(path.startsWith("/") ? path : "/account/albums");
  return <>{children}</>;
}
