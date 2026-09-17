import { AuthPage } from "@/components/account/AuthPage";

export const metadata = { title: "Sign in — Simetria LT" };

export default function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  return <AuthPage mode="login" searchParams={props.searchParams} />;
}
