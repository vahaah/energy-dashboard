import { z } from "zod";
import { isUtcInstant } from "@/lib/catalogue/schema";

export const OPERATORS = ["ukpn", "ssen", "nged", "npg", "enw", "spen", "nie"] as const;
export const AREAS = [
  "EPN",
  "LPN",
  "SPN",
  "SHEPD",
  "SEPD",
  "EMID",
  "WMID",
  "SWALES",
  "SWEST",
  "NE",
  "YORKS",
  "ENW",
  "SPD",
  "SPM",
  "NI",
] as const;
export const NATIONS = ["England", "Scotland", "Wales", "Northern Ireland"] as const;
export const KINDS = ["planned", "unplanned"] as const;
export const INCIDENT_STATUSES = ["active", "restored"] as const;
export const SOURCE_STATUSES = ["ok", "absent", "stale", "unlicensed"] as const;

export const operatorSchema = z.enum(OPERATORS);
export const areaSchema = z.enum(AREAS);
export const nationSchema = z.enum(NATIONS);
export const kindSchema = z.enum(KINDS);
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);
export const sourceStatusSchema = z.enum(SOURCE_STATUSES);

export type Operator = z.infer<typeof operatorSchema>;
export type Area = z.infer<typeof areaSchema>;
export type Nation = z.infer<typeof nationSchema>;
export type PowerCutKind = z.infer<typeof kindSchema>;
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

const pointSchema = z
  .tuple([z.number(), z.number()])
  .nullable()
  .refine((point) => point == null || (point[0] !== 0 || point[1] !== 0), "point must not be (0, 0)");

export const powerCutSchema = z
  .object({
    id: z.string().min(3),
    operator: operatorSchema,
    area: areaSchema,
    nation: nationSchema,
    kind: kindSchema,
    status: incidentStatusSchema,
    startedAt: z.string().refine(isUtcInstant, "expected a UTC instant"),
    estimatedRestorationAt: z.string().refine(isUtcInstant, "expected a UTC instant").nullable(),
    customersOff: z.number().finite().nullable(),
    postcodes: z.array(z.string()),
    point: pointSchema,
    sourceUrl: z.string().regex(/^https:\/\/\S+$/),
  })
  .strict()
  .refine((row) => row.id.startsWith(`${row.operator}:`), "id is operator:sourceId");

export type PowerCut = z.infer<typeof powerCutSchema>;

export const sourceReportSchema = z
  .object({
    status: sourceStatusSchema,
    fetchedAt: z.string().refine(isUtcInstant, "expected a UTC instant").nullable(),
    count: z.number().int().nonnegative(),
    error: z.string().optional(),
  })
  .strict();

export type SourceReport = z.infer<typeof sourceReportSchema>;

export const powerCutsSnapshotSchema = z
  .object({
    fetchedAt: z.string().refine(isUtcInstant, "expected a UTC instant"),
    sources: z
      .object({
        ukpn: sourceReportSchema,
        ssen: sourceReportSchema,
        nged: sourceReportSchema,
        npg: sourceReportSchema,
        enw: sourceReportSchema,
        spen: sourceReportSchema,
        nie: sourceReportSchema,
      })
      .strict(),
    incidents: z.array(powerCutSchema),
  })
  .strict();

export type PowerCutsSnapshot = z.infer<typeof powerCutsSnapshotSchema>;

export const POWER_CUTS_CACHE_TAG = "power-cuts";
export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_MAX_RETRIES = 2;
export const FETCH_MAX_BYTES = 10 * 1024 * 1024;
export const FETCH_BACKOFF_MS = [200, 800] as const;
export const FETCH_JITTER_MS = 250;
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
export const ARCHIVE_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
