function normalizeAccessEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function parseEmailList(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map(normalizeAccessEmail)
    .filter(Boolean);
}

export function hasComplimentaryFullAccess(email: string | null | undefined) {
  const normalizedEmail = normalizeAccessEmail(email);
  if (!normalizedEmail) return false;

  const configuredEmails = parseEmailList(
    process.env.PLANMYWORKDAY_COMPLIMENTARY_ACCESS_EMAILS ?? process.env.PLANMYWORKDAY_FULL_ACCESS_EMAILS,
  );
  return configuredEmails.includes(normalizedEmail);
}
