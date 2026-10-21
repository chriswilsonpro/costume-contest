const COOKIE_NAME = 'costume_ballot_id';
const MAX_AGE_DAYS = 30;

function cookieMaxAgeSeconds(): number {
  return MAX_AGE_DAYS * 24 * 60 * 60;
}

export function getBallotId(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.split('=').slice(1).join('=')) || null;
}

export function setBallotId(id: string): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=${cookieMaxAgeSeconds()}; SameSite=Lax`;
}

export function ensureBallotId(): string {
  const existing = getBallotId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  setBallotId(id);
  return id;
}
