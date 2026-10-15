import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkCatalogue } from "@/lib/catalogue/check";
import { CATALOGUE_FILES } from "@/lib/catalogue/schema";
import { checkNationalGasSpike } from "@/lib/ingest/national-gas/check";

const BRANCH_REF = /^[A-Za-z0-9._/-]+$/;

export function catalogueRoot(cwd = process.cwd()): string {
  return resolve(cwd, "data/catalogue");
}

function readFlag(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a path`);
  }
  return value;
}

function gitShow(repoRoot: string, spec: string): string | null {
  try {
    return execFileSync("git", ["show", spec], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

/**
 * On a pull request, compare releases to the base branch. A catalogue that is
 * new on this branch has nothing to compare, so the immutability check waits
 * until the files exist on the base.
 */
export function baselineDirFromGit(repoRoot: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const refName = env.GITHUB_BASE_REF?.trim() ?? "";
  if (refName.length === 0) {
    return null;
  }
  if (!BRANCH_REF.test(refName)) {
    throw new Error(`refusing to fetch baseline ref ${refName}`);
  }
  execFileSync("git", ["fetch", "origin", refName, "--depth=1"], {
    cwd: repoRoot,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ref = `origin/${refName}`;
  const releaseSpec = `${ref}:data/catalogue/${CATALOGUE_FILES.releases}`;
  if (gitShow(repoRoot, releaseSpec) === null) {
    return null;
  }
  const bodies = new Map<string, string>();
  for (const file of Object.values(CATALOGUE_FILES)) {
    const body = gitShow(repoRoot, `${ref}:data/catalogue/${file}`);
    if (body === null) {
      throw new Error(`baseline ${ref} is missing data/catalogue/${file}`);
    }
    bodies.set(file, body);
  }
  const dir = mkdtempSync(join(tmpdir(), "catalogue-baseline-"));
  for (const [file, body] of bodies) {
    writeFileSync(join(dir, file), body);
  }
  return dir;
}

export function publishCheckExitCode(
  argv: readonly string[] = process.argv.slice(2),
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): number {
  const dirFlag = readFlag(argv, "--dir");
  const baselineFlag = readFlag(argv, "--baseline");
  const dir = dirFlag ? resolve(cwd, dirFlag) : catalogueRoot(cwd);
  let gitBaseline: string | null = null;
  try {
    const baselineDir = baselineFlag ? resolve(cwd, baselineFlag) : baselineDirFromGit(cwd, env);
    gitBaseline = baselineFlag ? null : baselineDir;
    const result = checkCatalogue(dir, baselineDir ? { baselineDir } : {});
    const gasErrors = dirFlag ? [] : checkNationalGasSpike();
    if (!result.ok || gasErrors.length > 0) {
      for (const error of result.ok ? [] : result.errors) {
        console.error(error);
      }
      for (const error of gasErrors) {
        console.error(error);
      }
      return 1;
    }
    console.log(`catalogue ok (${dir})`);
    return 0;
  } finally {
    if (gitBaseline) {
      rmSync(gitBaseline, { recursive: true, force: true });
    }
  }
}
