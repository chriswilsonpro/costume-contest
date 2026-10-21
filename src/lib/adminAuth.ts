const SESSION_KEY = 'costume_admin_unlocked';

export function getAdminPassword(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? 'costume';
}

export function isAdminUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function unlockAdmin(password: string): boolean {
  if (password !== getAdminPassword()) return false;
  sessionStorage.setItem(SESSION_KEY, '1');
  return true;
}

export function lockAdmin(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
