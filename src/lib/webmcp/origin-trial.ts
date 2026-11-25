/**
 * Chrome WebMCP origin-trial token.
 *
 * The token is public: the root layout serves it in
 * <meta http-equiv="origin-trial" content="...">.
 * It is not a credential. Do not log it.
 *
 * Read at build time from WEBMCP_ORIGIN_TRIAL_TOKEN.
 * The value is trimmed. Unset, empty, or whitespace emits no tag.
 */
export const WEBMCP_ORIGIN_TRIAL_TOKEN = (process.env.WEBMCP_ORIGIN_TRIAL_TOKEN ?? "").trim();
