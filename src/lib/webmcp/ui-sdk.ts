/**
 * `@ui-sdk/react` `registerTools` (see `@ui-sdk/core` agent) registers only
 * `snapshot`, `query` and `act` on `document.modelContext`. It takes an agent
 * and an `allow` callback. It has no argument for custom tools.
 *
 * `act` can press any button (`consequentialHint`). `query` with `closed: true`
 * can open tabs and sections. Grid does not call `registerTools`, so those
 * tools are not registered. Domain tools use `document.modelContext.registerTool`.
 */
export const UI_SDK_REGISTER_TOOLS_SUPPORTS_CUSTOM_TOOLS = false;
