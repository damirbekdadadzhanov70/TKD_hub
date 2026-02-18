// Shared state for BottomSheet overflow lock — separate file to avoid react-refresh/only-export-components

/** How many sheets are currently open */
let openCount = 0;

export function incrementOpen() {
  openCount++;
}

function restoreOverflow() {
  document.documentElement.style.overflow = '';
  document.documentElement.style.paddingRight = '';
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

export function decrementOpen() {
  openCount--;
  if (openCount <= 0) {
    openCount = 0;
    restoreOverflow();
  }
}

/** Reset overflow lock — call on route change to handle navigating away while a sheet is open */
export function resetBottomSheetOverflow() {
  openCount = 0;
  restoreOverflow();
}
