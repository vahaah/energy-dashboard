/**
 * `@ui-sdk/react` 0.1.0-beta.17 `registerTools(agent, { allow })` registers only
 * `snapshot`, `query` and `act` on `document.modelContext`. Confirmed in
 * `@ui-sdk/core` `agent.d.ts` and `agent.js`: there is no argument for custom
 * tools, and the cleanup is the function it returns, not an AbortSignal.
 *
 * `act` is `consequentialHint` and can press any button. `query` and `act`
 * are not `readOnlyHint`. Calling the helper would add those three tools
 * beside the eight read-only Grid tools. Grid keeps `document.modelContext.registerTool`
 * for get_live_mix, get_carbon_intensity, get_wholesale_price, get_price_cap,
 * search_grid, get_page_dataset, get_balancing_summary and get_data_health.
 */
export const UI_SDK_REGISTER_TOOLS_SUPPORTS_CUSTOM_TOOLS = false;
