/**
 * Marks a form label as required. Purely decorative (`aria-hidden`) — pair it
 * with `required`/`aria-required="true"` on the actual control, since a
 * screen reader must learn this from the control, not from a visual asterisk.
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  )
}
