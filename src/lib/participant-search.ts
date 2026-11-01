/**
 * Shared participant search helpers.
 *
 * Search runs against existing columns:
 * - participants.full_name  (partial, case-insensitive)
 * - participants.ic_passport (partial or exact, separator-insensitive)
 * - registrations.registration_number (the participant's order number)
 *
 * IC/passport values are stored exactly as the athlete typed them, so every
 * comparison normalizes away spaces, dashes and other separators first.
 */

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;
export const PARTICIPANT_SEARCH_LIMIT = 25;

export interface ParticipantSearchResult {
  participant_id: string;
  full_name: string;
  /** Masked value: only the last four characters are shown. */
  ic_passport: string | null;
  bib_name: string | null;
  bib_number: string | null;
  category_id: string | null;
  category_name: string | null;
  registration_id: string;
  order_number: string;
  registration_status: string;
}

export interface ParticipantSearchableFields {
  full_name?: string | null;
  ic_passport?: string | null;
  order_number?: string | null;
}

/** Trim, collapse repeated whitespace and cap the query length. */
export function normalizeSearchTerm(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_LENGTH);
}

/** Reduce an IC/passport number to comparable characters (letters + digits). */
export function normalizeIc(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** True when a query is long enough to run a search. */
export function isSearchableTerm(value: unknown): boolean {
  return normalizeSearchTerm(value).length >= MIN_SEARCH_LENGTH;
}

/**
 * Hide all but the last four characters of an IC/passport number so search
 * results do not print full identity documents.
 */
export function maskIcPassport(value: unknown): string | null {
  const normalized = normalizeIc(value);
  if (!normalized) return null;
  if (normalized.length <= 4) return '*'.repeat(normalized.length);
  return `${'*'.repeat(normalized.length - 4)}${normalized.slice(-4)}`;
}

/**
 * Matching used by the local backend and tests. Mirrors the SQL predicate in
 * `search_event_participants` so both backends return the same rows.
 */
export function matchesParticipantSearch(
  fields: ParticipantSearchableFields,
  query: unknown
): boolean {
  const term = normalizeSearchTerm(query);
  if (!term) return true;

  const lowerTerm = term.toLowerCase();
  const name = (fields.full_name || '').toLowerCase();
  const orderNumber = (fields.order_number || '').toLowerCase();
  if (name.includes(lowerTerm)) return true;
  if (orderNumber.includes(lowerTerm)) return true;

  const icTerm = normalizeIc(term);
  if (icTerm && normalizeIc(fields.ic_passport).includes(icTerm)) return true;

  return false;
}

/** Escape SQL LIKE wildcards so user input is matched literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
