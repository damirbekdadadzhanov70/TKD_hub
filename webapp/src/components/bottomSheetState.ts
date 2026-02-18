// Shared state for BottomSheet overflow lock — separate file to avoid react-refresh/only-export-components

/** Selector for open BottomSheet portals in the DOM */
const SHEET_SELECTOR = '[data-bottomsheet]';

/** Monotonic version — bumped on force-reset so stale rAF callbacks become no-ops */
let resetVersion = 0;

function restoreOverflow() {
  document.documentElement.style.overflow = '';
  document.documentElement.style.paddingRight = '';
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

export function lockOverflow() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

/** Called when a BottomSheet unmounts — restore overflow only if no sheets remain in DOM */
export function unlockOverflowIfNone() {
  const ver = resetVersion;
  // Use rAF to let React finish removing the portal element before checking DOM
  requestAnimationFrame(() => {
    // If a force-reset happened after this was scheduled, skip — it's already clean
    if (ver !== resetVersion) return;
    if (document.querySelectorAll(SHEET_SELECTOR).length === 0) {
      restoreOverflow();
    }
  });
}

/** Force-reset overflow lock — call on route change or app mount as safety net */
export function resetBottomSheetOverflow() {
  resetVersion++;
  restoreOverflow();
}
