import Link from "next/link";
import { LIVE_MIX_PROMPT } from "@/lib/intent/recovery";

export function LiveMixPrompt({ className = "" }: { className?: string }) {
  return (
    <p className={`max-w-3xl border-l-2 border-gray-alpha-400 pl-3 text-copy-16 text-gray-1000 ${className}`.trim()}>
      {LIVE_MIX_PROMPT} See{" "}
      <Link href="/today" className="text-blue-700 underline-offset-2 hover:underline">
        Today
      </Link>
      .
    </p>
  );
}
