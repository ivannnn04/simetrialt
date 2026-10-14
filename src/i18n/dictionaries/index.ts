import type { Locale } from "@/i18n/config";
import { en, type Dictionary } from "@/i18n/dictionaries/en";
import { lt } from "@/i18n/dictionaries/lt";

export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, lt };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? en;
}

/** Translates a catalogue term (category, typology, menu group) by its English value; unknown terms pass through. */
export function term(t: Dictionary, value: string): string {
  return t.terms[value.toLowerCase()] ?? value;
}
