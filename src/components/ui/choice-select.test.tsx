// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { ChoiceSelect } from "@/components/ui/choice-select";

HTMLElement.prototype.showPopover = function showPopover() {
  this.removeAttribute("hidden");
  this.removeAttribute("data-closed");
  this.setAttribute("data-open", "");
};
HTMLElement.prototype.hidePopover = function hidePopover() {
  this.setAttribute("hidden", "");
  this.removeAttribute("data-open");
  this.setAttribute("data-closed", "");
};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function scrollIntoView() {};
Element.prototype.checkVisibility = () => true;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: "", label: "All" },
  { value: "wind", label: "Wind" },
] as const;

function Filter() {
  const [value, setValue] = useState("wind");
  return (
    <ChoiceSelect
      label="Technology"
      name="technology"
      value={value}
      onValueChange={setValue}
      options={OPTIONS}
    />
  );
}

it("keeps an empty-string All option selectable", async () => {
  const user = userEvent.setup();
  render(<Filter />);
  const trigger = screen.getByRole("combobox", { name: "Technology" });
  await user.click(trigger);
  const all = screen.getAllByRole("option", { hidden: true }).find((option) => option.textContent === "All");
  if (!all) {
    throw new Error("All option missing");
  }
  await user.click(all);
  expect(trigger.textContent).toContain("All");
});
