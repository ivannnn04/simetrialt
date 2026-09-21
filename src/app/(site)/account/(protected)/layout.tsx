// Sign-in is enforced per page for now (the albums overview is public while the site is
// being built); the album detail page still calls requireCustomer itself.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
