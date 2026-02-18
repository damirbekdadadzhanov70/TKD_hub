// Shared state for BottomSheet overflow lock — separate file to avoid react-refresh/only-export-components

/** Number of currently mounted BottomSheet instances */
let openCount = 0;

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
  if (openCount === 0) {
    savedScrollY = window.scrollY;
  }
  openCount++;
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

/** Called when a BottomSheet unmounts — restore overflow only if no sheets remain */
export function unlockOverflowIfNone() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) {
    restoreOverflow();
  }
}

/** Force-reset overflow lock — call on route change or app mount as safety net */
export function resetBottomSheetOverflow() {
  openCount = 0;
  restoreOverflow();
}
