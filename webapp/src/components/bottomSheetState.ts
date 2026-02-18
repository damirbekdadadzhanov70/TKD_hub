// Shared state for BottomSheet overflow lock — separate file to avoid react-refresh/only-export-components

/** How many sheets are currently open */
export let openCount = 0;

export function incrementOpen() {
  openCount++;
}

export function decrementOpen() {
  openCount--;
  if (openCount < 0) openCount = 0;
}

/** Reset overflow lock — call on route change to handle navigating away while a sheet is open */
export function resetBottomSheetOverflow() {
  openCount = 0;
  document.documentElement.style.overflow = '';
  document.documentElement.style.paddingRight = '';
}
