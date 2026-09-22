import { HeaderClient, type HeaderAccount } from "@/components/site/HeaderClient";
import { currentCustomer, currentOrGuestCustomer } from "@/lib/customer-auth";
import { db } from "@/lib/db";

type Props = { variant?: "overlay" | "solid" };

/** Server wrapper: resolves the signed-in customer and album count, then renders the client header. */
export async function SiteHeader({ variant = "solid" }: Props) {
  // Anonymous visitors get the mock count from the albums page (3 sample collections).
  let account: HeaderAccount = { signedIn: false, albums: 0 };
  try {
    const signedIn = await currentCustomer();
    const customer = signedIn ?? (await currentOrGuestCustomer());
    const albums = await db.collection.count({ where: { customerId: customer.id } });
    account = { signedIn: Boolean(signedIn), albums: albums || (signedIn ? 0 : 3), name: customer.name };
  } catch {
    // Database unavailable: render the anonymous header rather than failing the page.
  }
  return <HeaderClient variant={variant} account={account} />;
}
