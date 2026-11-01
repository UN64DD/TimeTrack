'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Calendar, MapPin, Users, DollarSign, Plus, Trash2, Edit2, Loader2, ArrowLeft, Check, X, ShieldAlert, Layers, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { EventCoverUpload } from '@/components/events/event-cover-upload';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEvent } from '@/hooks/use-events';
import { useOrganizerRegistrations, useParticipantSearch } from '@/hooks/use-registrations';
import { MIN_SEARCH_LENGTH } from '@/lib/participant-search';
import { updateEventStatusAction, deleteEventAction } from '@/lib/server/actions/event.actions';
import { toast } from 'sonner';
import { Award } from 'lucide-react';

type EventTab = 'overview' | 'categories' | 'registrations';

export default function EventDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-700" /></div>}>
      <EventDetailContent />
    </Suspense>
  );
}

function EventDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();
  const [tab, setTab] = useState<EventTab>('overview');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingCerts, setGeneratingCerts] = useState(false);

  // Fetch Event
  const { data: event, isLoading: eventLoading, refetch: refetchEvent } = useEvent(id);

  // Fetch Registrations for this specific event
  const { data: regs, isLoading: regsLoading } = useOrganizerRegistrations(id);

  // Mutations for categories
  const addCategoryMutation = useMutation({
    mutationFn: async (cat: { name: string; base_price: number; max_slots: number | null }) => {
      const { error } = await supabase.from('event_categories').insert({
        ...cat,
        event_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Category added successfully');
      refetchEvent();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add category');
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (catId: string) => {
      const { error } = await supabase.from('event_categories').delete().eq('id', catId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Category removed successfully');
      refetchEvent();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove category');
    }
  });

  // Handle Event Status change
  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Event status updated to ${newStatus}`);
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
      refetchEvent();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle Event Deletion
  const handleDeleteEvent = async () => {
    if (!confirm('Are you sure you want to delete this event? This action is irreversible.')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Event deleted successfully');
      qc.setQueryData(['organizer-events'], (old: any) => {
        if (!old) return old;
        return old.filter((e: any) => e.id !== id);
      });
      qc.invalidateQueries({ queryKey: ['organizer-events'] });
      router.push('/organizer/dashboard?tab=events');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  // Handle Certificate Generation
  const handleGenerateCertificates = async () => {
    setGeneratingCerts(true);
    try {
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('*, participants(full_name, registrations(athlete_id))')
        .eq('event_id', id);

      if (resultsError) throw new Error(resultsError.message);
      
      const count = results?.length || 0;
      if (count > 0) {
        const certificates = results.map((result: any) => ({
          event_id: id,
          user_id: result.participants?.registrations?.athlete_id || null,
          participant_name: result.participants?.full_name || 'Unknown Participant',
        }));

        const { error: insertError } = await supabase
          .from('certificates')
          .insert(certificates);

        if (insertError) throw new Error(insertError.message);
      }
      
      toast.success(`Successfully generated ${count} certificates!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate certificates');
    } finally {
      setGeneratingCerts(false);
    }
  };

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-700" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert size={48} className="text-red-700 mb-4 animate-bounce" />
        <h1 className="text-2xl font-display font-semibold normal-case tracking-tight text-slate-900 mb-2">Event Not Found</h1>
        <p className="text-xs text-slate-600 normal-case tracking-normal max-w-sm mb-6">
          The event you are trying to manage does not exist or has been deleted.
        </p>
        <button onClick={() => router.push('/organizer/dashboard?tab=events')} className="btn-primary text-xs">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <DashboardFrame variant="organizer" title={event.title} description="Manage your event details, cover, categories, and participants.">
      <div className="min-w-0">
        {/* Header */}
        <header className="border border-slate-300 bg-white p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/organizer/dashboard?tab=events')}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-lg font-display font-semibold normal-case tracking-tight line-clamp-1">
                  {event.title}
                </h1>
                <p className="text-xs font-semibold normal-case tracking-normal text-slate-600">
                  Manage Event Details & Participants
                </p>
              </div>
            </div>
            
            {/* Action Badges / Status */}
            <div className="flex flex-wrap items-center gap-3">
              {event.status === 'COMPLETED' && (
                <button
                  onClick={handleGenerateCertificates}
                  disabled={generatingCerts}
                  className="px-3 py-1.5 text-xs bg-purple-500/10 text-purple-700 font-semibold normal-case tracking-normal rounded-lg hover:bg-purple-500/20 transition-all flex items-center gap-2"
                >
                  {generatingCerts ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} />}
                  Generate Certificates
                </button>
              )}

              <span className={`text-xs font-semibold normal-case tracking-normal px-2.5 py-1 rounded-full ${
                event.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                event.status === 'LIVE' ? 'bg-green-500/10 text-green-700' :
                event.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700' :
                'bg-blue-500/10 text-blue-700'
              }`}>{event.status}</span>
              
              <div className="flex items-center gap-2">
                {event.status === 'DRAFT' && (
                  <button
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('LIVE')}
                    className="px-3 py-1.5 text-xs bg-green-500/10 text-green-700 font-semibold normal-case tracking-normal rounded-lg hover:bg-green-500/20 transition-all"
                  >
                    Go Live
                  </button>
                )}
                {event.status === 'LIVE' && (
                  <button
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('COMPLETED')}
                    className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-700 font-semibold normal-case tracking-normal rounded-lg hover:bg-blue-500/20 transition-all"
                  >
                    Mark Completed
                  </button>
                )}
                <button
                  disabled={deleting}
                  onClick={handleDeleteEvent}
                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/50 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Inner Content Area */}
        <div className="p-4 lg:p-8 max-w-6xl mx-auto w-full">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-300 mb-8 pb-px overflow-x-auto no-scrollbar whitespace-nowrap">
            {['overview', 'categories', 'registrations'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t as EventTab)}
                className={`px-4 py-2.5 text-xs font-semibold normal-case tracking-normal border-b-2 transition-all shrink-0 ${
                  tab === t ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab Rendering */}
          <div className="space-y-6">
            {tab === 'overview' && <><EventCoverUpload eventId={id} image={event.cover_image} onSaved={() => { refetchEvent(); qc.invalidateQueries({ queryKey: ['organizer-events'] }); }} /><OverviewSection event={event} /></>}
            {tab === 'categories' && (
              <CategoriesSection
                event={event}
                onAdd={(cat) => addCategoryMutation.mutate(cat)}
                onDelete={(catId) => deleteCategoryMutation.mutate(catId)}
                adding={addCategoryMutation.isPending}
              />
            )}
            {tab === 'registrations' && (
              <RegistrationsSection regs={regs} loading={regsLoading} eventId={id} />
            )}
          </div>
        </div>
      </div>
    </DashboardFrame>
  );
}

function OverviewSection({ event }: { event: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Details Card */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-semibold normal-case tracking-normal text-slate-600">Event Description</h3>
          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            {event.description || 'No description provided.'}
          </p>
        </div>

        {/* Venue/Info Card */}
        <div className="glass rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Venue</span>
            <p className="text-sm font-bold flex items-center gap-1.5"><MapPin size={14} className="text-blue-700" />{event.venue_name || 'TBA'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Event Date</span>
            <p className="text-sm font-bold flex items-center gap-1.5"><Calendar size={14} className="text-blue-700" />{new Date(event.event_date).toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Address</span>
            <p className="text-xs text-slate-600 leading-relaxed">{event.address || '—'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">City / Country</span>
            <p className="text-xs text-slate-600 leading-relaxed">{event.city ? `${event.city}, ` : ''}{event.country || 'Malaysia'}</p>
          </div>
        </div>

        {/* Terms Card */}
        {event.terms_and_conditions && (
          <div className="glass rounded-2xl p-6 space-y-3">
            <h3 className="text-xs font-semibold normal-case tracking-normal text-slate-600">Terms & Conditions</h3>
            <div className="text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto no-scrollbar font-medium leading-relaxed">
              {event.terms_and_conditions}
            </div>
          </div>
        )}
      </div>

      {/* Side Meta Widgets */}
      <div className="space-y-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-semibold normal-case tracking-normal text-slate-600">Registration Windows</h3>
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Opens</span>
              <p className="text-xs font-bold">{new Date(event.registration_open).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Closes</span>
              <p className="text-xs font-bold">{new Date(event.registration_close).toLocaleString()}</p>
            </div>
            <div className="pt-2 border-t border-slate-300">
              <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Bib Format</span>
              <p className="text-xs font-mono font-bold text-blue-700">{event.bib_format || 'RUN-####'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Max Participants</span>
              <p className="text-xs font-bold">{event.max_participants ? `${event.max_participants} entries` : 'Unlimited'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoriesSection({
  event,
  onAdd,
  onDelete,
  adding
}: {
  event: any;
  onAdd: (cat: { name: string; base_price: number; max_slots: number | null }) => void;
  onDelete: (id: string) => void;
  adding: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('50.00');
  const [slots, setSlots] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onAdd({
      name,
      base_price: Number(price) || 0,
      max_slots: slots ? Number(slots) : null
    });
    setName('');
    setSlots('');
    setShowAdd(false);
  };

  const categories = event.event_categories || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Race Categories</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 text-blue-700 font-semibold normal-case tracking-normal rounded-full hover:bg-blue-500/20 transition-all"
        >
          <Plus size={12} /> Add Category
        </button>
      </div>

      {showAdd && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div>
            <label className="label-text">Category Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input-field" placeholder="e.g. 5KM Fun Run" />
          </div>
          <div>
            <label className="label-text">Base Price (RM)</label>
            <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="label-text">Max Slots (Optional)</label>
            <input type="number" value={slots} onChange={e => setSlots(e.target.value)} className="input-field" placeholder="Unlimited" />
          </div>
          <div className="md:col-span-3 flex gap-2 pt-2">
            <button type="submit" disabled={adding} className="btn-primary text-xs">
              {adding ? <Loader2 size={12} className="animate-spin" /> : null}
              Add Category
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-xs">Cancel</button>
          </div>
        </motion.form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <p className="text-xs text-slate-600 font-bold normal-case tracking-normal">No categories defined yet</p>
          </div>
        ) : (
          categories.map((cat: any) => (
            <div key={cat.id} className="glass rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-sm font-semibold normal-case tracking-tight">{cat.name}</h4>
                  <button
                    onClick={() => onDelete(cat.id)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500/40 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Price</span>
                    <p className="text-sm font-bold text-blue-700">RM{Number(cat.base_price).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold normal-case tracking-normal text-slate-600">Max Slots</span>
                    <p className="text-sm font-bold">{cat.max_slots || 'Unlimited'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RegistrationsSection({ regs, loading, eventId }: { regs: any[] | undefined; loading: boolean; eventId: string }) {
  return (
    <div className="space-y-6">
      <ParticipantSearchPanel eventId={eventId} />

      <div className="glass rounded-2xl overflow-hidden overflow-x-auto w-full">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Reg Number</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Athlete Name</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Billing Email</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Total Amount</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
            <th className="text-left p-4 text-xs font-semibold normal-case tracking-normal text-slate-600">Date</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="p-8 text-center">
                <Loader2 size={20} className="animate-spin mx-auto text-blue-700" />
              </td>
            </tr>
          ) : !regs?.length ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-xs text-slate-600 font-bold normal-case tracking-normal">
                No athletes registered for this event yet
              </td>
            </tr>
          ) : (
            regs.map(r => (
              <tr key={r.id} className="border-b border-slate-300 hover:bg-slate-100 transition-colors">
                <td className="p-4 font-mono text-xs font-bold text-blue-700">{r.registration_number}</td>
                <td className="p-4 text-xs font-bold">
                  {r.participants?.[0]?.full_name || 'Unknown'}
                  {r.participants?.length > 1 && ` (+${r.participants.length - 1} more)`}
                </td>
                <td className="p-4 text-xs text-slate-600">{r.billing_details?.email || '—'}</td>
                <td className="p-4 text-xs font-bold">RM{Number(r.total_amount).toFixed(2)}</td>
                <td className="p-4">
                  <span className={`text-xs font-semibold normal-case tracking-normal px-2 py-0.5 rounded-full ${
                    r.status === 'PAID' ? 'bg-green-500/10 text-green-700' :
                    r.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700' :
                    'bg-red-500/10 text-red-700'
                  }`}>{r.status}</span>
                </td>
                <td className="p-4 text-xs text-slate-600">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function ParticipantSearchPanel({ eventId }: { eventId: string }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const isActive = trimmed.length >= MIN_SEARCH_LENGTH;
  const isTooShort = query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH;

  const { data: results, isFetching, isError, error, refetch } = useParticipantSearch(eventId, debouncedQuery);

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold normal-case tracking-normal text-slate-600">Find a participant</h3>
        <p className="text-[11px] text-slate-600 font-medium normal-case tracking-normal">
          Search by name, IC number or order number. Partial matches are supported and IC numbers can be entered with or without dashes.
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, IC number or order number..."
          aria-label="Search participants by name, IC number or order number"
          className="input-field pl-10 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear participant search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isTooShort && !isActive && (
        <p className="text-[11px] font-semibold text-slate-600">Type at least {MIN_SEARCH_LENGTH} characters to search.</p>
      )}

      {isActive && (
        <div className="overflow-hidden overflow-x-auto w-full border border-slate-300 rounded-xl">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="text-left p-3 text-xs font-semibold normal-case tracking-normal text-slate-600">Participant</th>
                <th className="text-left p-3 text-xs font-semibold normal-case tracking-normal text-slate-600">IC Number</th>
                <th className="text-left p-3 text-xs font-semibold normal-case tracking-normal text-slate-600">Order Number</th>
                <th className="text-left p-3 text-xs font-semibold normal-case tracking-normal text-slate-600">Category</th>
                <th className="text-left p-3 text-xs font-semibold normal-case tracking-normal text-slate-600">BIB</th>
                <th className="text-left p-3 text-xs font-semibold normal-case tracking-normal text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && !results ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loader2 size={20} className="animate-spin mx-auto text-blue-700" />
                    <p className="mt-2 text-xs text-slate-600">Searching participants…</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <AlertCircle size={20} className="mx-auto text-red-700 mb-2" />
                    <p className="text-xs font-semibold text-red-700">
                      {error instanceof Error ? error.message : 'Could not search participants.'}
                    </p>
                    <button type="button" onClick={() => refetch()} className="btn-secondary text-xs mt-3 inline-flex items-center gap-1.5">
                      <RefreshCw size={12} /> Try again
                    </button>
                  </td>
                </tr>
              ) : !results?.length ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <p className="text-xs font-bold normal-case tracking-normal text-slate-600">
                      No participants match “{trimmed}” in this event.
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">Try a different name, IC number or order number.</p>
                  </td>
                </tr>
              ) : (
                results.map((p) => (
                  <tr key={p.participant_id} className="border-b border-slate-300 last:border-0 hover:bg-slate-100 transition-colors">
                    <td className="p-3 text-xs font-bold">{p.full_name}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{p.ic_passport || '—'}</td>
                    <td className="p-3 font-mono text-xs font-bold text-blue-700">{p.order_number}</td>
                    <td className="p-3 text-xs text-slate-600">{p.category_name || '—'}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{p.bib_number || '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold normal-case tracking-normal px-2 py-0.5 rounded-full ${
                        p.registration_status === 'PAID' || p.registration_status === 'CONFIRMED' ? 'bg-green-500/10 text-green-700' :
                        p.registration_status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700' :
                        'bg-red-500/10 text-red-700'
                      }`}>{p.registration_status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {results && results.length > 0 && (
            <p className="p-3 text-[11px] text-slate-600 border-t border-slate-300">
              Showing {results.length} participant{results.length === 1 ? '' : 's'} for this event. IC numbers are partially masked.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
