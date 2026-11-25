"use client";

import { useEffect, useRef, useState } from "react";
import { ChoiceSelect } from "@/components/ui/choice-select";

export function JumpTo({
  items,
}: {
  items: readonly { href: string; label: string }[];
}) {
  const navRef = useRef<HTMLElement>(null);
  const [section, setSection] = useState("");

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }
    const write = () => {
      document.documentElement.style.setProperty("--jump-bar-height", `${nav.getBoundingClientRect().height}px`);
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--jump-bar-height", "0px");
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="On this page"
      className="sticky z-10 -mx-[var(--card-pad)] border-b border-gray-alpha-400 bg-background-100 px-[var(--card-pad)] py-2"
      style={{ top: "var(--site-header-height, 4rem)" }}
    >
      <div className="flex min-h-11 items-center gap-2 lg:hidden">
        <ChoiceSelect
          label="Jump to"
          name="section"
          value={section}
          onValueChange={(href) => {
            setSection(href);
            if (href) {
              window.location.hash = href;
            }
          }}
          options={[{ value: "", label: "Choose a section" }, ...items.map((item) => ({ value: item.href, label: item.label }))]}
          className="min-w-0 flex-1"
        />
      </div>
      <ul className="hidden flex-wrap gap-x-4 gap-y-1 lg:flex">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="inline-flex min-h-11 items-center text-label-13 text-gray-900 underline-offset-2 hover:text-gray-1000 hover:underline lg:min-h-8"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
