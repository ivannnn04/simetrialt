/**
 * Content overrides edited in the admin are stored as a flat map of dot-paths to values
 * ("home.hero.text" → "..."). They are applied over the dictionary shipped in the code without
 * mutating it, so functions and untouched branches stay shared.
 */
export type Overrides = Record<string, string | string[]>;

type Tree = Record<string, unknown>;

function setPath(root: Tree, path: string[], value: unknown): Tree {
  const [head, ...rest] = path;
  const copy: Tree = Array.isArray(root) ? ([...(root as unknown[])] as unknown as Tree) : { ...root };
  if (rest.length === 0) {
    copy[head] = value;
    return copy;
  }
  const child = root[head];
  const base: Tree = child && typeof child === "object" ? (child as Tree) : {};
  copy[head] = setPath(base, rest, value);
  return copy;
}

export function applyOverrides<T extends object>(dict: T, overrides: Overrides | undefined): T {
  if (!overrides) return dict;
  const keys = Object.keys(overrides);
  if (keys.length === 0) return dict;
  let out = dict as unknown as Tree;
  for (const key of keys) {
    out = setPath(out, key.split("."), overrides[key]);
  }
  return out as unknown as T;
}

/** Reads a dot-path from a dictionary-like object. */
export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Tree)[k] : undefined), obj);
}

export type Field = { path: string; kind: "text" | "lines"; value: string | string[] };

/**
 * Flattens the editable leaves of a dictionary branch: strings become text fields, arrays of
 * strings become "one item per line" fields; functions and other values are skipped.
 */
export function collectFields(value: unknown, prefix = ""): Field[] {
  if (typeof value === "string") return [{ path: prefix, kind: "text", value }];
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) return [{ path: prefix, kind: "lines", value: value as string[] }];
    return value.flatMap((v, i) => collectFields(v, prefix ? `${prefix}.${i}` : String(i)));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Tree).flatMap(([k, v]) => collectFields(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}
