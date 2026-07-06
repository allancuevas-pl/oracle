// Shared entrance animations — one source of truth so every screen reveals
// content the same way. Uses an ease-out-quint curve (no bounce, no elastic).
//
// The row stagger is CAPPED: long lists (Comps can load hundreds of rows) must
// not cascade for seconds. After STAGGER_CAP rows, every remaining row shares
// the same small delay, so the whole reveal always finishes in ~0.3s.

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1];

export const STAGGER_STEP = 0.025; // seconds between consecutive rows
export const STAGGER_CAP = 12;     // rows past this share the cap delay

/** Spread onto a <motion.tr>/<motion.div> list row: {...rowEntrance(index)} */
export const rowEntrance = (index = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: {
    delay: Math.min(index, STAGGER_CAP) * STAGGER_STEP,
    duration: 0.35,
    ease: EASE_OUT_QUINT,
  },
});

/** A single, non-staggered fade-up for whole containers / headers / panels. */
export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: EASE_OUT_QUINT },
};
