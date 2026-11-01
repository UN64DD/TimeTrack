'use server';

import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/server/auth/require-role';
import {
  MAX_SEARCH_LENGTH,
  PARTICIPANT_SEARCH_LIMIT,
  isSearchableTerm,
  maskIcPassport,
  normalizeSearchTerm,
  type ParticipantSearchResult,
} from '@/lib/participant-search';

interface ParticipantSearchRpcRow {
  participant_id: string;
  full_name: string;
  ic_passport: string | null;
  bib_name: string | null;
  bib_number: string | null;
  category_id: string | null;
  category_name: string | null;
  registration_id: string;
  order_number: string;
  registration_status: string;
}

const searchInputSchema = z.object({
  eventId: z.string().trim().min(1),
  query: z.string().max(MAX_SEARCH_LENGTH),
});

/**
 * Search one event's participants by name, IC/passport number or order number.
 *
 * Access is checked against the event row, not just the caller's role: an
 * organizer can only search their own events, while admins can search any. The
 * SQL function is SECURITY INVOKER, so row-level policies still apply.
 */
export async function searchEventParticipantsAction(
  eventId: string,
  query: string
): Promise<ParticipantSearchResult[]> {
  const parsed = searchInputSchema.parse({ eventId, query: query ?? '' });
  const term = normalizeSearchTerm(parsed.query);
  if (!isSearchableTerm(term)) return [];

  const { user, role } = await requireRole(['ORGANIZER', 'ADMIN', 'SUPER_ADMIN']);

  const supabase = await createSupabaseServerClient();

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', parsed.eventId)
    .is('deleted_at', null)
    .single();

  if (eventError || !event) throw new Error('Event not found');

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  if (!isAdmin && event.organizer_id !== user.id) {
    throw new Error('Forbidden: you cannot search participants for this event');
  }

  const { data, error } = await supabase.rpc('search_event_participants', {
    p_event_id: parsed.eventId,
    p_query: term,
    p_limit: PARTICIPANT_SEARCH_LIMIT,
  });

  if (error) throw new Error(error.message);

  return ((data ?? []) as ParticipantSearchRpcRow[]).map((row) => ({
    participant_id: row.participant_id,
    full_name: row.full_name,
    ic_passport: maskIcPassport(row.ic_passport),
    bib_name: row.bib_name ?? null,
    bib_number: row.bib_number ?? null,
    category_id: row.category_id ?? null,
    category_name: row.category_name ?? null,
    registration_id: row.registration_id,
    order_number: row.order_number,
    registration_status: row.registration_status,
  }));
}
