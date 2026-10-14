#!/usr/bin/env npx tsx
/**
 * Validate data/catalogue. On a pull request, also refuse edits to an
 * existing source_release_id (GITHUB_BASE_REF).
 *
 *   npx tsx scripts/publish-check.ts
 *   npx tsx scripts/publish-check.ts --dir path --baseline path
 */
import { publishCheckExitCode } from "../src/lib/catalogue/publish-check";

try {
  process.exit(publishCheckExitCode());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
