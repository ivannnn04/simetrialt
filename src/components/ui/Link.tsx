"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/i18n/client";
import { localizeHref } from "@/i18n/config";

type Props = Omit<ComponentProps<typeof NextLink>, "href"> & { href: string };

/** next/link that keeps the visitor in the active language ("/about" → "/lt/about"). */
export default function Link({ href, ...rest }: Props) {
  const locale = useLocale();
  return <NextLink href={localizeHref(locale, href)} {...rest} />;
}
