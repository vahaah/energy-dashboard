import { TITLE_MAX_CHARS } from "@/lib/site";

const SUFFIX = " | Grid";

/** `{name}: {detail}, {place} | Grid`, dropping the place and then shortening the name past 60 characters. */
export function fitDetailTitle(name: string, detail: string, place?: string | null): string {
  const cleanPlace = place?.trim() ? place.trim() : null;
  if (cleanPlace) {
    const withPlace = `${name}: ${detail}, ${cleanPlace}${SUFFIX}`;
    if ([...withPlace].length <= TITLE_MAX_CHARS) {
      return withPlace;
    }
  }

  const base = `${name}: ${detail}${SUFFIX}`;
  if ([...base].length <= TITLE_MAX_CHARS) {
    return base;
  }

  const tail = `: ${detail}${SUFFIX}`;
  const room = TITLE_MAX_CHARS - [...tail].length;
  if (room <= 1) {
    return `${[...base].slice(0, TITLE_MAX_CHARS - 1).join("")}…`;
  }
  return `${[...name].slice(0, room - 1).join("")}…: ${detail}${SUFFIX}`;
}
