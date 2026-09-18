/**
 * Temporary stand-in for every photo on the site until real imagery is added.
 * Override with NEXT_PUBLIC_PLACEHOLDER_IMAGE, or set it to an empty string to
 * fall back to the per-section files under public/images.
 */
const DEFAULT = "https://unsplash.com/photos/9M66C_w_ToM/download?force=true&w=1920";

const env = process.env.NEXT_PUBLIC_PLACEHOLDER_IMAGE;
export const PLACEHOLDER_IMAGE: string | null = env === undefined ? DEFAULT : env || null;
