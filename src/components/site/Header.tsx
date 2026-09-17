import { HeaderClient, type HeaderAccount } from "@/components/site/HeaderClient";
import { currentCustomer } from "@/lib/customer-auth";
import { db } from "@/lib/db";

type Props = { variant?: "overlay" | "solid" };

/** Server wrapper: resolves the signed-in customer and album count, then renders the client header. */
export async function SiteHeader({ variant = "solid" }: Props) {
  let account: HeaderAccount = { signedIn: false, albums: 0 };
  try {
    const customer = await currentCustomer();
    if (customer) {
      const albums = await db.collection.count({ where: { customerId: customer.id } });
      account = { signedIn: true, albums, name: customer.name };
    }
  } catch {
    // Database unavailable: render the anonymous header rather than failing the page.
  }
  return <HeaderClient variant={variant} account={account} />;
}
