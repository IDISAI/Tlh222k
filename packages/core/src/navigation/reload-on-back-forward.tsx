/**
 * Force a fresh load when the browser lands on this page via Back/Forward.
 *
 * The roadmap builder navigates with full page loads (`window.location.assign`
 * — cross-zone-safe by design). Browser Back then restores the document from
 * the HTTP cache; in dev the cached HTML can reference stale hashed chunks, so
 * React never hydrates and client-fetched pages freeze on their skeleton. Even
 * when hydration works, the restored canvas would be stale against the latest
 * edits. Reloading on `back_forward` fixes both: after the reload the
 * navigation type is "reload", so this never loops.
 *
 * Rendered as an inline <script> from a SERVER component so it runs during
 * HTML parse — before (and independent of) hydration. Client-side SPA
 * navigations never re-run it.
 */
const SNIPPET = `(function () {
  try {
    // Reload ONLY if a chunk load error is detected (dev-server rebuild recovery)
    window.addEventListener("error", function (e) {
      var msg = e.message || "";
      if (msg.indexOf("chunk") > -1 || msg.indexOf("Loading CSS") > -1 || msg.indexOf("Loading chunk") > -1) {
        location.reload();
      }
    }, true);
    // bfcache restore: dispatch event so React components can refetch silently without full reload
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) {
        window.dispatchEvent(new CustomEvent("bfcache-restore"));
      }
    });
  } catch (e) { /* never break the page */ }
})();`

export function ReloadOnBackForward() {
  return <script dangerouslySetInnerHTML={{ __html: SNIPPET }} />
}
