// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import { ChoiceRow } from "@/components/ui/choice-row";

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
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
});

function Periods() {
  const [value, setValue] = useState("day");
  return (
    <ChoiceRow
      ariaLabel="Time period"
      value={value}
      onChange={setValue}
      options={[
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
      ]}
    />
  );
}

it("moves a segmented choice with the arrow keys", async () => {
  const user = userEvent.setup();
  render(<Periods />);
  const day = screen.getByRole("radio", { name: "Day" });
  expect(day.getAttribute("aria-checked")).toBe("true");
  day.focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "Week" }).getAttribute("aria-checked")).toBe("true");
  expect(day.getAttribute("aria-checked")).toBe("false");
});

it("returns focus to a menu trigger on Escape", async () => {
  const user = userEvent.setup();
  render(
    <Menu>
      <MenuTrigger>System</MenuTrigger>
      <MenuContent>
        <MenuItem value="storage">Storage</MenuItem>
      </MenuContent>
    </Menu>,
  );
  const trigger = screen.getByRole("button", { name: "System" });
  await user.click(trigger);
  const item = await screen.findByText("Storage");
  expect(item.getAttribute("data-slot")).toBe("menu-item");
  await user.keyboard("{Escape}");
  expect(item.closest("[data-slot='menu-content']")?.hasAttribute("data-open")).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it("closes a dialog on Escape and keeps its title as the name", async () => {
  const user = userEvent.setup();
  function About() {
    const [open, setOpen] = useState(true);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>About these layers</DialogTitle>
        </DialogContent>
      </Dialog>
    );
  }
  render(<About />);
  const dialog = screen.getByRole("dialog", { hidden: true });
  expect(dialog.textContent).toContain("About these layers");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
});

it("closes a tooltip on Escape without moving focus", async () => {
  const user = userEvent.setup();
  render(
    <Tooltip>
      <TooltipTrigger aria-label="What is nominal duration?">?</TooltipTrigger>
      <TooltipContent>A ratio of the two capacities.</TooltipContent>
    </Tooltip>,
  );
  const trigger = screen.getByRole("button", { name: "What is nominal duration?" });
  const tip = screen.getByRole("tooltip", { hidden: true });
  expect(tip.textContent).toContain("A ratio of the two capacities.");
  trigger.focus();
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(trigger);
  expect(screen.getByRole("tooltip", { hidden: true }).textContent).toContain("A ratio of the two capacities.");
});
