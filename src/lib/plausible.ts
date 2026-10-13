/**
 * Cookieless Plausible (plausible.io cloud) for grid.vahaah.com.
 *
 * The browser loads a first-party `/js/script.js` and posts to `/api/event`.
 * `next.config.ts` rewrites those to Plausible. The upstream file is the
 * outbound-links + file-downloads build of `https://plausible.io/js/script.js`.
 * `data-domain` attributes the events; `data-api` sends them through the proxy
 * (the script also falls back to its own origin + `/api/event`).
 *
 * Tags render only when `VERCEL_ENV === "production"`. Preview and local
 * builds omit them so they do not write stats. There is no Content-Security-Policy
 * in this app; the proxy keeps both requests same-origin if one is added later.
 * Vercel rewrites forward the visitor IP in `X-Forwarded-For`, which Plausible
 * needs for location and bot filtering. `/api/event` overrides `Cookie` to empty
 * before that forward (a deleted header is not an override).
 */

export const PLAUSIBLE_DOMAIN = "grid.vahaah.com";

/** First-party path. Rewrite destination is {@link PLAUSIBLE_UPSTREAM_SCRIPT}. */
export const PLAUSIBLE_SCRIPT_PATH = "/js/script.js";

/** First-party path. Rewrite destination is {@link PLAUSIBLE_UPSTREAM_EVENT}. */
export const PLAUSIBLE_EVENT_PATH = "/api/event";

export const PLAUSIBLE_UPSTREAM_SCRIPT =
  "https://plausible.io/js/script.outbound-links.file-downloads.js";

export const PLAUSIBLE_UPSTREAM_EVENT = "https://plausible.io/api/event";

export const PLAUSIBLE_DATA_POLICY_URL = "https://plausible.io/data-policy";

/**
 * Queue stub. The upstream script drains `window.plausible.q` when it loads
 * and replaces this function.
 */
export const PLAUSIBLE_QUEUE_STUB =
  "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}";

export function isPlausibleEnabled(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return vercelEnv === "production";
}
