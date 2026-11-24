"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { DashboardSearchParams } from "@/lib/dashboard-search-params";
import { shareFocusRedirectPath } from "@/lib/page-metadata";
import { PAGE_STACK_CLASS } from "@/components/ui/card";

export function ShareFocusRedirect({
  focus,
}: {
  focus: DashboardSearchParams["focus"];
}) {
  const href = shareFocusRedirectPath(focus);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    window.location.replace(
      shareFocusRedirectPath(focus, {
        date: query.get("date"),
        period: query.get("period"),
      }),
    );
  }, [focus]);

  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <main className={PAGE_STACK_CLASS}>
        <p className="text-copy-16 text-gray-900">Opening Grid…</p>
        <p className="mt-3 text-copy-16">
          <Link href={href} className="text-blue-700 underline-offset-2 hover:underline">
            Continue to Grid
          </Link>
        </p>
      </main>
    </div>
  );
}
