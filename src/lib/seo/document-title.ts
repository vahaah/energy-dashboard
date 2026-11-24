import { TITLE_MAX_CHARS } from "@/lib/site";

const SUFFIX = " | Grid";

/** `{name}: {detail}, {place} | Grid`, dropping the place and then shortening the name on a word boundary. */
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
  return `${clipAtWord(name, room)}: ${detail}${SUFFIX}`;
}

/** Shorten on a space. A single token longer than the room is cut only when no space fits. */
export function clipAtWord(name: string, room: number): string {
  const chars = [...name];
  if (room >= chars.length) {
    return name;
  }
  if (room <= 1) {
    return "…";
  }
  const sliced = chars.slice(0, room - 1).join("");
  const atWord = sliced.replace(/\s+\S*$/u, "").trimEnd();
  const body = [...atWord].length > 0 ? atWord : sliced.trimEnd();
  return `${body}…`;
}
