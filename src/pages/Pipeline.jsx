import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
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
import {
  Building2,
  FileText,
  DollarSign,
  MapPin,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

const STAGES = [
  { id: 'Shortlisted', label: 'Shortlisted', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
  { id: 'Under Review', label: 'Under Review', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  { id: 'Offered',      label: 'Offered',      color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
  { id: 'Accepted',     label: 'Accepted',     color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  { id: 'Rejected',     label: 'Rejected',     color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
];

function formatPrice(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Single Deal Card ────────────────────────────────────────────
function DealCard({ match, isDragging = false }) {
  const { property, brief } = match;
  const stage = STAGES.find((s) => s.id === match.status);

  return (
    <div
      style={{
        opacity: isDragging ? 0.5 : 1,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'grab',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      className="hover:border-brand-500/30 hover:shadow-lg"
    >
      {/* Property */}
      <div className="flex items-start gap-2 mb-3">
        <Building2 size={13} className="text-brand-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-brand-50 text-sm font-medium leading-tight truncate">
            {property?.address || 'Unknown Property'}
          </p>
          {property?.location && (
            <p className="text-brand-400 text-xs mt-0.5 flex items-center gap-1">
              <MapPin size={10} />
              {property.location}
            </p>
          )}
        </div>
      </div>

      {/* Chips row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {property?.assetType && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-800/60 text-brand-300 border border-brand-700/40">
            {property.assetType}
          </span>
        )}
        {property?.askingPrice && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-800/60 text-brand-300 border border-brand-700/40 flex items-center gap-1">
            <DollarSign size={8} />{formatPrice(property.askingPrice)}
          </span>
        )}
        {property?.status && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-800/60 text-brand-300 border border-brand-700/40">
            {property.status}
          </span>
        )}
      </div>

      {/* Brief link */}
      <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText size={11} className="text-brand-500 shrink-0" />
          <span className="text-brand-400 text-xs truncate">
            {brief?.clientName || 'Unknown Brief'}
          </span>
          {brief?.briefId && (
            <span className="text-brand-600 text-[10px]">#{brief.briefId}</span>
          )}
        </div>
        <Link
          to={`/briefs/${match.briefId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-brand-500 hover:text-brand-300 transition-colors"
        >
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

// ─── Sortable wrapper ─────────────────────────────────────────────
function SortableDealCard({ match }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: match._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, cursor: isDragging ? 'grabbing' : 'grab' }}
      {...attributes}
      {...listeners}
    >
      <DealCard match={match} isDragging={isDragging} />
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────
function PipelineColumn({ stage, matches }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      style={{ minWidth: 280, maxWidth: 300 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-lg mb-3"
        style={{ background: stage.bg, border: `1px solid ${stage.border}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: stage.color }}
          />
          <span className="text-sm font-semibold" style={{ color: stage.color }}>
            {stage.label}
          </span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: stage.border, color: stage.color }}
        >
          {matches.length}
        </span>
      </div>

      {/* Cards drop zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-3 flex-1 min-h-[120px] rounded-lg transition-colors"
        style={{
          background: isOver ? stage.bg : 'transparent',
          outline: isOver ? `2px dashed ${stage.border}` : '2px dashed transparent',
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
              style={{
                border: `1px dashed ${stage.border}`,
                minHeight: 80,
              }}
            >
              <p className="text-brand-600 text-xs">Drop here</p>
            </div>
          ) : (
            matches.map((match) => (
              <SortableDealCard key={match._id} match={match} />
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
  const updateMatch = useMutation(api.matches.updateMatch);

  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Group matches by stage
  const columns = useMemo(() => {
    if (!allMatches) return {};
    return STAGES.reduce((acc, stage) => {
      acc[stage.id] = allMatches.filter((m) => m.status === stage.id);
      return acc;
    }, {});
  }, [allMatches]);

  const activeMatch = useMemo(
    () => allMatches?.find((m) => m._id === activeId),
    [activeId, allMatches]
  );

  const STAGE_IDS = useMemo(() => STAGES.map(s => s.id), []);

  // Custom collision detection: prefer pointer-within for cross-column accuracy
  const collisionDetection = useMemo(() => (args) => {
    // First check if pointer is directly inside a column droppable
    const pointerCollisions = pointerWithin(args);
    const columnCollisions = pointerCollisions.filter(c => STAGE_IDS.includes(c.id));
    if (columnCollisions.length > 0) return columnCollisions;

    // Fall back to rect intersection for card-over-card within same column
    return rectIntersection(args);
  }, [STAGE_IDS]);

  function findStageForMatch(id) {
    // Is the id itself a stage?
    if (STAGE_IDS.includes(id)) return id;
    // Otherwise look up which stage the card belongs to
    return STAGES.find((stage) =>
      columns[stage.id]?.some((m) => m._id === id)
    )?.id;
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const fromStage = findStageForMatch(active.id);
    const toStage = findStageForMatch(over.id);

    if (!fromStage || !toStage || fromStage === toStage) return;

    try {
      await updateMatch({ id: active.id, status: toStage });
      toast.success(`Moved to ${toStage}`);
    } catch (e) {
      toast.error('Failed to update deal stage');
    }
  }

  if (allMatches === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Layers className="w-8 h-8 text-brand-500 animate-pulse" />
          <p className="text-brand-400 text-sm">Loading pipeline…</p>
        </div>
      </div>
    );
  }

  const totalDeals = allMatches.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-6 border-b border-brand-800/50 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-brand-50 tracking-tight flex items-center gap-3">
              <Layers className="w-6 h-6 text-brand-500" />
              Deal Pipeline
            </h1>
            <p className="text-brand-400 text-sm mt-1">
              {totalDeals} active deal{totalDeals !== 1 ? 's' : ''} across all client briefs
            </p>
          </div>

          {/* Stage summary pills */}
          <div className="flex items-center gap-2">
            {STAGES.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: stage.bg, border: `1px solid ${stage.border}`, color: stage.color }}
              >
                <span>{stage.label}</span>
                <span className="font-bold">{columns[stage.id]?.length ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-8 py-6">
        {allMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Layers className="w-16 h-16 text-brand-700" />
            <h2 className="text-xl font-semibold text-brand-200">No deals in the pipeline yet</h2>
            <p className="text-brand-500 text-sm max-w-sm">
              Start by opening a Client Brief and matching a property to it. It will appear here automatically.
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
            <div className="flex gap-5 h-full items-start">
              {STAGES.map((stage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  matches={columns[stage.id] || []}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeMatch ? (
                <div style={{ width: 280 }}>
                  <DealCard match={activeMatch} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
