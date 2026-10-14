import {
  CircleDashed,
  CircleOff,
  Clock,
  CloudSun,
  Hourglass,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { DATA_STATE_LABEL, type DataState } from "@/lib/data-state";

export function DataStateNotice({ state }: { state: DataState }) {
  return (
    <span
      data-state={state}
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-alpha-400 px-1.5 py-0.5 text-label-12 text-gray-900"
    >
      <StateIcon state={state} />
      {DATA_STATE_LABEL[state]}
    </span>
  );
}

function StateIcon({ state }: { state: DataState }) {
  const className = "size-3 shrink-0";
  switch (state) {
    case "loading":
      return <LoaderCircle className={`${className} motion-reduce:animate-none animate-spin`} aria-hidden="true" />;
    case "partial":
      return <CircleDashed className={className} aria-hidden="true" />;
    case "stale":
      return <Clock className={className} aria-hidden="true" />;
    case "unavailable":
      return <CircleOff className={className} aria-hidden="true" />;
    case "revised":
      return <RefreshCw className={className} aria-hidden="true" />;
    case "provisional":
      return <TriangleAlert className={className} aria-hidden="true" />;
    case "forecast":
      return <CloudSun className={className} aria-hidden="true" />;
    case "not_yet_available":
      return <Hourglass className={className} aria-hidden="true" />;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
