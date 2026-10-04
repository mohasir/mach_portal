// Must match WheelColumn's `h-11` rows (and `h-22` spacers = 2 rows above/below the center):
// the selected index is derived from scrollTop.
export const WHEEL_ITEM_HEIGHT_PX = 44;

// Quiet time after the last scroll event before the centered row counts as the new value;
// momentum scrolling on touch devices keeps firing events until it settles.
export const WHEEL_SETTLE_MS = 120;
