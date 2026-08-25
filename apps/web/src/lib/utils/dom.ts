const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function blurActiveElementOnTouch() {
  if (typeof window === 'undefined') return;
  if (!window.matchMedia(COARSE_POINTER_QUERY).matches) return;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
