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

/**
 * Props for a sortable column header.
 *
 * Deliberately NOT `rowProps`: a `<th role="button">` stops being a
 * `columnheader`, which is worse for a screen-reader user than the mouse-only
 * header we started with — it breaks the table's structure to fix one control.
 * So this keeps the native role and adds only what is missing: focus, key
 * activation, and `aria-sort` so the current sort is actually announced.
 */
export function sortHeaderProps(onSort, label, { active, direction } = {}) {
  return {
    onClick: onSort,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSort(e);
      }
    },
    tabIndex: 0,
    'aria-label': label,
    'aria-sort': active ? (direction === 'desc' ? 'descending' : 'ascending') : 'none',
  };
}

/**
 * Props for a div or cell that is really a checkbox.
 *
 * Several selection controls here are a styled `<div>` with a tick icon. They
 * toggle on click and nothing else: no focus, no Space, and a screen reader
 * gets no hint that anything is selectable, let alone what is currently
 * selected. `role="checkbox"` + `aria-checked` is the minimum that fixes both.
 */
export function toggleProps(onToggle, label, checked) {
  return {
    onClick: onToggle,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(e);
      }
    },
    role: 'checkbox',
    'aria-checked': !!checked,
    tabIndex: 0,
    'aria-label': label,
  };
}
