"use client";

import { Toast, ToastRegion, ToastTitle, toast } from "@ui-sdk/react/toast";

export function announce(title: string): void {
  toast(title, { duration: 1400 });
}

export function Announcer() {
  return (
    <ToastRegion className="pointer-events-none fixed top-0 left-0 h-px w-px overflow-hidden">
      {() => (
        <Toast>
          <ToastTitle />
        </Toast>
      )}
    </ToastRegion>
  );
}
