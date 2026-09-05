import { useNavigate } from 'react-router-dom';

/**
 * Global app header.
 *
 * Every control here was scaffolding with no handler attached — a search box
 * that swallowed keystrokes, a bell with a permanent "unread" dot behind
 * nothing, and a primary "+ New Brief" CTA that did nothing on every page.
 * Will reported it as "some of the stuff on top doesn't work" (Loom, Aug-27).
 * The CTA now works; the fake unread dot is gone; the non-functional global
 * search box was removed rather than left pretending. (Each list view has its
 * own working search.)
 *
 * The bell outlived that pass: the fake unread dot was removed but the button
 * itself stayed, with a hover state and aria-label="Notifications", and NO
 * onClick. It still read as a control and still did nothing. Removed on the
 * same principle as the search box — when notifications exist, add it back
 * with a handler. (Walkthrough, 2026-09-05.)
 */
export function Header() {
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-[#0A0A0A]/95 backdrop-blur border-b border-white/5 flex items-center justify-end px-8 sticky top-0 z-10">
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => navigate('/briefs', { state: { newBrief: true } })}
          className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(212,175,55,0.15)] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          + New Brief
        </button>
      </div>
    </header>
  );
}
