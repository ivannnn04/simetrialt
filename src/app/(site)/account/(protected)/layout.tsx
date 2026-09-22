// TEMPORARY: sign-in is not enforced anywhere while the site is being built; anonymous visitors
// act as a shared guest customer (see currentOrGuestCustomer).
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
