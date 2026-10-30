import { AuthPage } from "@/components/account/AuthPage";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).auth.registerMeta };
}

export default function RegisterPage(props: { searchParams: Promise<{ next?: string }> }) {
  return <AuthPage mode="register" searchParams={props.searchParams} />;
}
