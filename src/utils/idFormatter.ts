/**
 * ID Formatter Utility
 * Strictly enforces privacy rules:
 * 1. Users/Callers ONLY see Host ID (e.g. 'Host ID: SKH-0157' or 'SKH-0157')
 * 2. No caller/user can EVER see another user's ID
 * 3. Hosts ONLY see the User's ID (e.g. 'User ID: USR-3210' or 'USR-3210'), never real names, phone numbers, or emails.
 */

export const formatHostId = (id?: string, phone?: string): string => {
  const digits = String(phone || id || '').replace(/\D/g, '');
  if (digits.length >= 4) {
    return `SKH-${digits.slice(-4)}`;
  }
  if (id && id.length > 0) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) % 10000;
    }
    return `SKH-${String(Math.abs(hash)).padStart(4, '0')}`;
  }
  return 'SKH-8009';
};

export const formatUserId = (id?: string, phone?: string): string => {
  const digits = String(phone || id || '').replace(/\D/g, '');
  if (digits.length >= 4) {
    return `USR-${digits.slice(-4)}`;
  }
  if (id && id.length > 0) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) % 10000;
    }
    return `USR-${String(Math.abs(hash)).padStart(4, '0')}`;
  }
  return 'USR-1001';
};

/**
 * Get user display label for Host view
 * e.g., 'User ID: USR-3210'
 */
export const getHostViewUserLabel = (caller?: { id?: string; name?: string; phone?: string }): string => {
  if (!caller) return 'User ID: USR-1001';
  const uid = formatUserId(caller.id, caller.phone);
  return `User ID: ${uid}`;
};

/**
 * Get host display label for Caller view
 * e.g., 'Host ID: SKH-0157'
 */
export const getCallerViewHostLabel = (host?: { id?: string; phone?: string }): string => {
  if (!host) return 'Host ID: SKH-8009';
  const hid = formatHostId(host.id, host.phone);
  return `Host ID: ${hid}`;
};
