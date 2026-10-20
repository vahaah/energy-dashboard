import type { ChangeEvent } from "@/lib/projects/schema";

export type PreparedChange = {
  event: ChangeEvent;
  index: number;
  superseded: boolean;
  supersedes: boolean;
};

/**
 * A correction replaces every earlier event for the same entity and field.
 * File order is the order. A later line wins when observed_at is equal.
 */
export function prepareChanges(events: readonly ChangeEvent[]): PreparedChange[] {
  const superseded = new Set<number>();
  const supersedes = new Set<number>();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || event.comparison !== "correction") {
      continue;
    }
    for (let earlier = 0; earlier < index; earlier += 1) {
      const previous = events[earlier];
      if (!previous) {
        continue;
      }
      if (previous.entity === event.entity && previous.field === event.field) {
        superseded.add(earlier);
        supersedes.add(index);
      }
    }
  }
  return events.map((event, index) => ({
    event,
    index,
    superseded: superseded.has(index),
    supersedes: supersedes.has(index),
  }));
}
