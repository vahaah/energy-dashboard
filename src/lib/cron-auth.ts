export function isCronAuthorized(
  authHeader: string | null,
  cronSecret: string | undefined
): boolean {
  if (!cronSecret) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}
