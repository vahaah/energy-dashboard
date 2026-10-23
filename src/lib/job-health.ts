import { getRedis } from "@/lib/redis-cache";

/** One row per cron. Order is the `/api/health` payload. */
export const CRON_JOB_IDS = [
  "cron",
  "cron-warm",
  "cron-prices",
  "cron-yesterday",
  "cron-map-layers",
  "cron-gas",
  "cron-constraints",
  "cron-directory",
  "cron-tec",
  "cron-northern-ireland",
] as const;

export type CronJobId = (typeof CRON_JOB_IDS)[number];

export type JobHealth = {
  job: CronJobId;
  last_error: string | null;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
};

type StoredJobHealth = Omit<JobHealth, "job">;

const JOB_HEALTH_TTL_SECONDS = 30 * 24 * 60 * 60;
const ERROR_MAX = 300;

const SECRET_ENV = [
  "BLOB_READ_WRITE_TOKEN",
  "DIRECTORY_BLOB_READ_WRITE_TOKEN",
  "CRON_SECRET",
  "TINYBIRD_TOKEN",
  "TINYBIRD_READ_TOKEN",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "EIA_API_KEY",
  "INDEXNOW_KEY",
  "OIL_PRICE_API_KEY",
  "FRED_API_KEY",
] as const;

const memory = new Map<CronJobId, StoredJobHealth>();

export function resetJobHealthForTests(): void {
  memory.clear();
}

function jobKey(job: CronJobId): string {
  return `grid:job-health:${job}`;
}

function emptyJob(job: CronJobId): JobHealth {
  return {
    job,
    last_error: null,
    consecutive_failures: 0,
    last_success_at: null,
    last_failure_at: null,
  };
}

/** Drop bearer tokens and live env values before the string is stored or returned. */
export function publicJobError(message: string): string {
  let text = message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  for (const key of SECRET_ENV) {
    const value = process.env[key];
    if (value && value.length >= 8 && text.includes(value)) {
      text = text.split(value).join("[redacted]");
    }
  }
  return text.slice(0, ERROR_MAX);
}

function isStored(value: unknown): value is StoredJobHealth {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Partial<StoredJobHealth>;
  return (
    (row.last_error == null || typeof row.last_error === "string") &&
    typeof row.consecutive_failures === "number" &&
    (row.last_success_at == null || typeof row.last_success_at === "string") &&
    (row.last_failure_at == null || typeof row.last_failure_at === "string")
  );
}

async function readStored(job: CronJobId): Promise<StoredJobHealth | null> {
  const redis = getRedis();
  if (!redis) {
    return memory.get(job) ?? null;
  }
  const value = await redis.get<StoredJobHealth | string>(jobKey(job));
  return isStored(value) ? value : null;
}

async function writeStored(job: CronJobId, value: StoredJobHealth): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.set(job, value);
    return;
  }
  await redis.set(jobKey(job), value, { ex: JOB_HEALTH_TTL_SECONDS });
}

export async function recordJobSuccess(job: CronJobId, now = new Date()): Promise<void> {
  try {
    const previous = await readStored(job);
    await writeStored(job, {
      last_error: null,
      consecutive_failures: 0,
      last_success_at: now.toISOString(),
      last_failure_at: previous?.last_failure_at ?? null,
    });
  } catch {
    console.warn("[job-health] write failed", { job });
  }
}

export async function recordJobFailure(job: CronJobId, error: string, now = new Date()): Promise<void> {
  try {
    const previous = await readStored(job);
    await writeStored(job, {
      last_error: publicJobError(error),
      consecutive_failures: (previous?.consecutive_failures ?? 0) + 1,
      last_success_at: previous?.last_success_at ?? null,
      last_failure_at: now.toISOString(),
    });
  } catch {
    console.warn("[job-health] write failed", { job });
  }
}

export async function loadJobHealth(): Promise<JobHealth[]> {
  const rows: JobHealth[] = [];
  for (const job of CRON_JOB_IDS) {
    try {
      const stored = await readStored(job);
      rows.push(stored ? { job, ...stored } : emptyJob(job));
    } catch {
      console.warn("[job-health] read failed", { job });
      rows.push(emptyJob(job));
    }
  }
  return rows;
}
