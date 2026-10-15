import { z } from "zod";
import { instantSchema } from "@/lib/catalogue/schema";
import { REDIS_DNO_POINTER_KEY } from "@/lib/map/constants";
import { getRedis, type RedisCommands } from "@/lib/redis-cache";

const SHA256 = /^sha256:[a-f0-9]{64}$/;

export const layerPointerSchema = z
  .object({
    layer_id: z.string().min(1),
    edition: z.string().min(1),
    url: z.string().min(1),
    sha256: z.string().regex(SHA256),
    bytes: z.number().int().positive(),
    source_url: z.string().min(1),
    source_etag: z.string().nullable(),
    source_sha256: z.string().regex(SHA256),
    status: z.enum(["current", "changed"]),
    checked_at: instantSchema,
  })
  .strict();

export type LayerPointer = z.infer<typeof layerPointerSchema>;

export function parseLayerPointer(value: unknown): LayerPointer | null {
  const parsed = layerPointerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Read-only. A page request must not write the pointer. */
export async function readDnoLayerFlag(redis: RedisCommands | null = getRedis()): Promise<LayerPointer | null> {
  if (!redis) {
    return null;
  }
  try {
    const pointer = parseLayerPointer(await redis.get(REDIS_DNO_POINTER_KEY));
    if (!pointer || pointer.status !== "changed") {
      return null;
    }
    return pointer;
  } catch {
    return null;
  }
}
