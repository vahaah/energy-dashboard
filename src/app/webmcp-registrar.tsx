"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { modelContextFor } from "@/lib/webmcp/support";

/**
 * Feature-detects document.modelContext and lazy-loads the tool registrar.
 * Browsers without registerTool do not download that module.
 * Navigation aborts the previous registration.
 */
export function WebMcpRegistrar() {
  const pathname = usePathname();

  useEffect(() => {
    const context = modelContextFor(document);
    if (!context) {
      return;
    }
    const controller = new AbortController();
    const pending = import("@/lib/webmcp/register")
      .then((mod) => {
        if (controller.signal.aborted) {
          return;
        }
        return mod.registerGridTools(context, controller.signal);
      })
      .catch(() => undefined);
    if (typeof context.waitForToolsUntil === "function") {
      void context.waitForToolsUntil(pending);
    }
    return () => {
      controller.abort();
    };
  }, [pathname]);

  return null;
}
