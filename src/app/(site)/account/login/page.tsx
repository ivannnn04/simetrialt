import { AuthPage } from "@/components/account/AuthPage";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).auth.loginMeta };
}

export default function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  return <AuthPage mode="login" searchParams={props.searchParams} />;
}
