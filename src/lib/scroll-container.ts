// Element.scrollIntoView() / a naive window.scrollTo() walk up and scroll
// every scrollable ancestor to reveal the target, including the
// (overflow: hidden) <body>/<html> that ArticleChatPanel locks while its
// docked "AI解读" panel is open on desktop — those stay programmatically
// scrollable even while CSS-locked, so the window ends up scrolled
// underneath the fixed-height docked layout, exposing blank space below.
// Find the actual scrollable ancestor of a reference element instead (the
// docked article's own overflow-y-auto box, or null when nothing is
// docked so callers should fall back to the window).
export function findScrollContainer(el: Element | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node && node !== document.body) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}
