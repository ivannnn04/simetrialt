import { redirect } from "next/navigation";
import { localizeHref } from "@/i18n/config";
import { getLocale } from "@/i18n/server";

export default async function AccountIndex() {
  redirect(localizeHref(await getLocale(), "/account/albums"));
}
