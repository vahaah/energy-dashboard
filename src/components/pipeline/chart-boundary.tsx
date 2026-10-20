"use client";

import { Component, type ReactNode } from "react";
import { PIPELINE_CHART_FAILED } from "@/lib/pipeline/copy";

export class PipelineChartBoundary extends Component<
  { children: ReactNode; fail?: boolean },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    if (this.state.failed || this.props.fail) {
      return <ChartFailed />;
    }
    return this.props.children;
  }
}

export function ChartFailed() {
  return <p className="break-words text-copy-14 text-gray-900">{PIPELINE_CHART_FAILED}</p>;
}
