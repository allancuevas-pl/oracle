/**
 * Props that make a clickable row or card behave like the control it already is.
 *
 * Nearly every record in this app is opened by clicking a `<div>` or `<tr>`
 * that carries an onClick — dashboard rows, client rows, the linked-brief card,
 * the matched-property card. They work with a mouse and are invisible to
 * everything else: you cannot Tab to them, Enter does nothing, and a screen
 * reader announces a row of text with no hint that it opens anything.
 *
 * That is not an edge case here. It is the PRIMARY way to open a record.
 *
 * A real <button> or <Link> is still the better answer where the markup allows
 * it — this exists for the places where it doesn't, like a <tr>.
 *
 *   <tr {...rowProps(() => navigate(`/briefs/${b._id}`), `Open ${b.clientName}`)}>
 */
export function rowProps(onActivate, label) {
  return {
    onClick: onActivate,
    onKeyDown: (e) => {
      // Space scrolls the page by default; Enter submits. Both should open the
      // row, which is what a real button would do.
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate(e);
      }
    },
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
  };
}
