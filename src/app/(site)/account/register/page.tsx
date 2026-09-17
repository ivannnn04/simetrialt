import { AuthPage } from "@/components/account/AuthPage";

export const metadata = { title: "Create account — Simetria LT" };

export default function RegisterPage(props: { searchParams: Promise<{ next?: string }> }) {
  return <AuthPage mode="register" searchParams={props.searchParams} />;
}
