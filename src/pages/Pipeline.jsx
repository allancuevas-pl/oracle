import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AvatarStack } from '../components/briefs/AssigneePicker';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import { PageLoader } from '../components/ui/Loading';
import {
  Building2,
  FileText,
  DollarSign,
  MapPin,
  Layers,
  ArrowRight,
  TrendingUp,
  Scale,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { stalenessOf, formatStageAge } from '../utils/dealAge';

// ─── Stage Definitions ────────────────────────────────────────────
// Neutral treatment for all 8 progression stages — one consistent visual
// language. Only two semantic exceptions carry their own color:
//   Client Rejected  → red  (terminal loss)
//   Settlement       → gold (terminal win, matches Oracle brand)

const NEUTRAL = {
  color:  'rgba(249,249,249,0.55)',
  bg:     'rgba(255,255,255,0.025)',
  border: 'rgba(255,255,255,0.07)',
};

const STAGES = [
  { id: 'Shortlisted',        label: 'Shortlisted',        group: 'early',      ...NEUTRAL },
  { id: 'Prepping',           label: 'Prepping',           group: 'early',      ...NEUTRAL },
  { id: 'Report Ready',       label: 'Report Ready',       group: 'early',      ...NEUTRAL },
  { id: 'Under Review',       label: 'Under Review',       group: 'early',      ...NEUTRAL },
  { id: 'Client Approved',    label: 'Client Approved',    group: 'early',      ...NEUTRAL },
  { id: 'Offer Submitted',    label: 'Offer Submitted',    group: 'commercial', ...NEUTRAL },
  { id: 'Under Offer',        label: 'Under Offer',        group: 'commercial', ...NEUTRAL },
  { id: 'Negotiating',        label: 'Negotiating',        group: 'commercial', ...NEUTRAL },
  { id: 'Offer Accepted',     label: 'Offer Accepted',     group: 'commercial', ...NEUTRAL },
  { id: 'Contract Execution', label: 'Contract Execution', group: 'closing',    ...NEUTRAL },
  { id: 'Due Diligence',      label: 'Due Diligence',      group: 'closing',    ...NEUTRAL },
  { id: 'Unconditional',      label: 'Unconditional',      group: 'closing',    ...NEUTRAL },
  {
    id: 'Settlement', label: 'Settlement', group: 'won', terminal: true,
    color:  '#D4AF37',
    bg:     'rgba(212,175,55,0.06)',
    border: 'rgba(212,175,55,0.18)',
  },
  {
    id: 'Client Rejected', label: 'Client Rejected', group: 'dead', terminal: true,
    color:  '#F87171',
    bg:     'rgba(248,113,113,0.04)',
    border: 'rgba(248,113,113,0.15)',
  },
];

const STAGE_IDS = STAGES.map((s) => s.id);

// Legacy stage name map — existing records with old stage names render in
// the correct new column rather than disappearing from the board.
const LEGACY_MAP = {
  'Client Accepted': 'Client Approved',
  Rejected:          'Client Rejected',
  Offered:           'Under Offer',
  Accepted:          'Offer Accepted',
};

function resolveStage(status) {
  return LEGACY_MAP[status] || status;
}

function formatPrice(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Deal Card ────────────────────────────────────────────────────
function DealCard({ match, isDragging = false, usersMap = {} }) {
  const { property, brief } = match;
  const resolvedId = resolveStage(match.status);
  const stage = STAGES.find((s) => s.id === resolvedId);
  // Null when the deal is finished or has no timestamp yet — a flag that nags
  // should say nothing rather than guess.
  const age = stalenessOf(match, stage);

  return (
    <div
      style={{
        opacity: isDragging ? 0.45 : 1,
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: 10,
        padding: '13px 14px',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      className="hover:border-white/[0.14] hover:bg-white/[0.04] hover:shadow-md"
    >
      {/* Property.
          The address is the most prominent thing on the card and used to be
          plain text: the card was drag-only, and its single navigable element
          was a 12px arrow that went to the BRIEF. You could see a property on
          the board and have no way to open it.
          Safe inside the draggable — the PointerSensor needs 5px of movement
          before a drag starts, so a plain click still reaches the link. */}
      <div className="flex items-start gap-2 mb-2.5">
        <Building2 size={12} className="text-brand-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <Link
            to={`/properties/${match.propertyId}`}
            onClick={(e) => e.stopPropagation()}
            title={property?.address ? `Open ${property.address}` : undefined}
            className="block text-brand-50 text-[13px] font-medium leading-snug truncate hover:text-brand-400 hover:underline decoration-brand-500/40 underline-offset-2 transition-colors"
          >
            {property?.address || 'Unknown Property'}
          </Link>
          {property?.location && (
            <p className="text-brand-400/70 text-[10px] mt-0.5 flex items-center gap-1">
              <MapPin size={9} />
              {property.location}
            </p>
          )}
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {property?.assetType && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-800/50 text-brand-300/80 border border-brand-700/30">
            {property.assetType}
          </span>
        )}
        {property?.askingPrice && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-800/50 text-brand-300/80 border border-brand-700/30 flex items-center gap-0.5">
            <DollarSign size={7} />{formatPrice(property.askingPrice)}
          </span>
        )}
        {property?.status && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-800/50 text-brand-300/80 border border-brand-700/30">
            {property.status}
          </span>
        )}
      </div>

      {/* Brief footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText size={10} className="text-brand-500 shrink-0" />
          <Link
            to={`/briefs/${match.briefId}`}
            onClick={(e) => e.stopPropagation()}
            title={brief?.clientName ? `Open ${brief.clientName}'s brief` : undefined}
            className="text-brand-400/80 text-[11px] truncate hover:text-brand-400 hover:underline decoration-brand-500/40 underline-offset-2 transition-colors"
          >
            {brief?.clientName || 'Unknown Brief'}
          </Link>
          {brief?.briefId && (
            <span className="text-brand-600 text-[10px] shrink-0">#{brief.briefId}</span>
          )}
        </div>
        {age && (
          <span
            title={age.isStale
              ? `No movement for ${age.days} days — over the ${age.threshold}-day mark for ${stage?.label}`
              : `${age.days} days in ${stage?.label}`}
            className={`text-[10px] shrink-0 ml-2 px-1.5 py-0.5 rounded-full border tabular-nums ${
              age.isStale
                ? 'text-amber-300/90 bg-amber-500/10 border-amber-500/25'
                : 'text-brand-100/35 bg-transparent border-transparent'
            }`}
          >
            {formatStageAge(age.days)}
          </span>
        )}
        <Link
          to={`/briefs/${match.briefId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-brand-500/60 hover:text-brand-400 transition-colors shrink-0 ml-2"
        >
          <ArrowRight size={12} />
        </Link>
      </div>

      {brief?.assignees?.length > 0 && (
        <div className="pt-1.5 mt-0.5">
          <AvatarStack assignees={brief.assignees} usersMap={usersMap} max={4} />
        </div>
      )}
    </div>
  );
}

// ─── Sortable wrapper ─────────────────────────────────────────────
function SortableDealCard({ match, usersMap }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: match._id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <DealCard match={match} isDragging={isDragging} usersMap={usersMap} />
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────
function PipelineColumn({ stage, matches, usersMap }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div style={{ minWidth: 252, maxWidth: 268 }} className="flex flex-col h-full shrink-0">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-lg mb-3"
        style={{ background: stage.bg, border: `1px solid ${stage.border}` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stage.color }} />
          <span className="text-xs font-semibold truncate" style={{ color: stage.color }}>
            {stage.label}
          </span>
        </div>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2"
          style={{ background: `${stage.color}22`, color: stage.color }}
        >
          {matches.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2.5 flex-1 min-h-[100px] rounded-lg transition-all"
        style={{
          background: isOver ? 'rgba(212,175,55,0.05)' : 'transparent',
          outline: isOver ? '2px dashed rgba(212,175,55,0.25)' : '2px dashed transparent',
          padding: isOver ? 6 : 0,
          transition: 'all 0.15s',
        }}
      >
        <SortableContext
          items={matches.map((m) => m._id)}
          strategy={verticalListSortingStrategy}
        >
          {matches.length === 0 ? (
            <div
              className="flex-1 rounded-lg flex items-center justify-center"
              style={{ border: `1px dashed ${stage.border}`, minHeight: 72, opacity: 0.6 }}
            >
              <p className="text-[10px]" style={{ color: stage.color, opacity: 0.5 }}>Drop here</p>
            </div>
          ) : (
            matches.map((match) => (
              <SortableDealCard key={match._id} match={match} usersMap={usersMap} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Pipeline Page ────────────────────────────────────────────────
export function Pipeline() {
  const allMatches = useQuery(api.matches.getAllMatches);
  const allUsers   = useQuery(api.users.getUsers);

  // Optimistic update: move the card to the target column in the local cache
  // immediately on drop — no round-trip snap-back. Convex auto-reverts on failure.
  const updateMatch = useMutation(api.matches.updateMatch).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.matches.getAllMatches, {});
      if (current === undefined) return;
      localStore.setQuery(
        api.matches.getAllMatches,
        {},
        current.map((m) =>
          m._id === args.id ? { ...m, status: args.status } : m
        )
      );
    }
  );

  const [activeId, setActiveId] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);

  const usersMap = useMemo(() => {
    if (!allUsers) return {};
    return Object.fromEntries(allUsers.map((u) => [u._id, u]));
  }, [allUsers]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Stages visible on the board — terminal columns hidden by default to keep
  // the board uncluttered; toggled back in via the "Show closed" button.
  const visibleStages = useMemo(
    () => (showTerminal ? STAGES : STAGES.filter((s) => !s.terminal)),
    [showTerminal]
  );

  // Group matches by resolved stage (handles legacy names)
  const columns = useMemo(() => {
    if (!allMatches) return {};
    return STAGES.reduce((acc, stage) => {
      acc[stage.id] = allMatches.filter((m) => resolveStage(m.status) === stage.id);
      return acc;
    }, {});
  }, [allMatches]);

  // Active (non-terminal) deal count for the header subtitle
  const activeMatchCount = useMemo(() => {
    if (!allMatches) return 0;
    return allMatches.filter((m) => {
      const stage = STAGES.find((s) => s.id === resolveStage(m.status));
      return !stage?.terminal;
    }).length;
  }, [allMatches]);

  // Aggregate stats for the header
  const stats = useMemo(() => {
    if (!allMatches) return null;
    const commercial = ['Under Offer', 'Negotiating', 'Offer Accepted']
      .reduce((n, id) => n + (columns[id]?.length || 0), 0);
    const closing = ['Contract Execution', 'Due Diligence']
      .reduce((n, id) => n + (columns[id]?.length || 0), 0);
    const won      = columns['Settlement']?.length || 0;
    const rejected = columns['Client Rejected']?.length || 0;
    return { commercial, closing, won, rejected };
  }, [columns, allMatches]);

  const activeMatch = useMemo(
    () => allMatches?.find((m) => m._id === activeId),
    [activeId, allMatches]
  );

  const collisionDetection = useMemo(
    () => (args) => {
      const pointerHits = pointerWithin(args).filter((c) => STAGE_IDS.includes(c.id));
      return pointerHits.length > 0 ? pointerHits : rectIntersection(args);
    },
    []
  );

  function findStageForMatch(id) {
    if (STAGE_IDS.includes(id)) return id;
    const match = allMatches?.find((m) => m._id === id);
    return match ? resolveStage(match.status) : null;
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const fromStage = findStageForMatch(active.id);
    const toStage   = findStageForMatch(over.id);
    if (!fromStage || !toStage || fromStage === toStage) return;

    try {
      await updateMatch({ id: active.id, status: toStage });
      toast.success(`Moved to ${toStage}`);
    } catch {
      toast.error('Failed to update deal stage');
    }
  }

  if (allMatches === undefined) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-8 pt-7 pb-5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-brand-50 tracking-tight flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-brand-500 shrink-0" />
              Deal Pipeline
            </h1>
            <p className="text-brand-400/60 text-sm mt-1">
              {activeMatchCount} active deal{activeMatchCount !== 1 ? 's' : ''} across {
                new Set(
                  allMatches
                    .filter(m => !STAGES.find(s => s.id === resolveStage(m.status))?.terminal)
                    .map(m => m.briefId)
                ).size
              } brief{
                new Set(
                  allMatches
                    .filter(m => !STAGES.find(s => s.id === resolveStage(m.status))?.terminal)
                    .map(m => m.briefId)
                ).size !== 1 ? 's' : ''
              }
              {!showTerminal && (stats?.won || stats?.rejected)
                ? ` · ${(stats.won || 0) + (stats.rejected || 0)} closed`
                : ''}
            </p>
          </div>

          {/* Aggregate stat pills + terminal toggle */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {stats && allMatches.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <StatPill icon={TrendingUp}   label="Commercial" count={stats.commercial} color="rgba(249,249,249,0.45)" />
                <StatPill icon={Scale}        label="Closing"    count={stats.closing}    color="rgba(249,249,249,0.45)" />
                <StatPill icon={CheckCircle2} label="Settled"    count={stats.won}        color="#D4AF37" />
                <StatPill icon={XCircle}      label="Rejected"   count={stats.rejected}   color="#F87171" />
              </div>
            )}
            <button
              onClick={() => setShowTerminal(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={{
                background: showTerminal ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.03)',
                border: showTerminal ? '1px solid rgba(212,175,55,0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: showTerminal ? '#D4AF37' : 'rgba(249,249,249,0.4)',
              }}
            >
              {showTerminal ? <EyeOff size={11} /> : <Eye size={11} />}
              {showTerminal ? 'Hide closed' : 'Show closed'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Board ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto px-8 py-6">
        {allMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Layers className="w-14 h-14 text-brand-800" />
            <h2 className="text-lg font-semibold text-brand-200">No deals in the pipeline yet</h2>
            <p className="text-brand-500/70 text-sm max-w-xs">
              Open a Client Brief, match a property to it, and it will appear here automatically.
            </p>
            <Link
              to="/briefs"
              className="px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-400 text-sm hover:bg-brand-500/20 transition-colors"
            >
              Go to Client Briefs →
            </Link>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="flex gap-4 h-full items-start">
              {visibleStages.map((stage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  matches={columns[stage.id] || []}
                  usersMap={usersMap}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeMatch ? (
                <div style={{ width: 252 }}>
                  <DealCard match={activeMatch} usersMap={usersMap} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

// ─── Header stat pill ─────────────────────────────────────────────
function StatPill({ icon: Icon, label, count, color }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: `${color}12`,
        border: `1px solid ${color}30`,
        color,
      }}
    >
      <Icon size={12} />
      <span className="text-white/40 font-normal">{label}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}
