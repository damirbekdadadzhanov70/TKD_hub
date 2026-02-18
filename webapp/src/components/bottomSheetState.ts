// Shared state for BottomSheet overflow lock — separate file to avoid react-refresh/only-export-components

/** Selector for open BottomSheet portals in the DOM */
const SHEET_SELECTOR = '[data-bottomsheet]';

/** Monotonic version — bumped on force-reset so stale rAF callbacks become no-ops */
let resetVersion = 0;

/** Saved scroll position before overflow lock */
let savedScrollY = 0;

function restoreOverflow() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.documentElement.style.overflow = '';
  document.documentElement.style.paddingRight = '';
  window.scrollTo(0, savedScrollY);
}

export function lockOverflow() {
  // Only save scroll position if not already locked (avoid overwriting with 0)
  if (document.body.style.position !== 'fixed') {
    savedScrollY = window.scrollY;
  }
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.documentElement.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
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
