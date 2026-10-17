/**
 * measure_alignment.js — run INSIDE the Arkify page context (paste via agent-browser eval).
 * Reports frame-relative left/right margins of the widest content blocks so
 * alignment symmetry can be judged numerically instead of by eye.
 * Returns a compact JSON string.
 */
(() => {
  const root = document.getElementById('root');
  if (!root) return 'NO_ROOT';
  // The app frame is the centered max-420 container.
  let frame = root;
  while (frame.firstElementChild && frame !== document.body) {
    const r = frame.getBoundingClientRect();
    if (r.width <= 421) break;
    frame = frame.firstElementChild;
  }
  const fr = frame.getBoundingClientRect();

  // Walk all leaf-ish blocks; keep those at least 60% of frame width (real
  // content rows, not icons/chips) and fully inside the frame.
  const all = [...frame.querySelectorAll('div')];
  const rows = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width < fr.width * 0.6 || r.width > fr.width + 1) continue;
    if (r.height < 12 || r.height > 700) continue;
    if (r.left < fr.left - 1 || r.right > fr.right + 1) continue;
    const kids = el.children.length;
    if (kids === 0) continue;
    rows.push({ el, r });
  }
  // Deduplicate by geometry (keep outermost).
  const kept = rows.filter(({ r }) =>
    !rows.some(({ r: r2 }) => r2 !== r && r2.left <= r.left + 1 && r2.right >= r.right - 1 && r2.height >= r.height - 1 && r2 !== r && (r2.height > r.height || r2.top < r.top))
  );
  const seen = new Set();
  const out = [];
  for (const { r } of kept) {
    const key = `${Math.round(r.left)}|${Math.round(r.right)}|${Math.round(r.top)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      top: Math.round(r.top - fr.top),
      L: +(r.left - fr.left).toFixed(1),
      R: +(fr.right - r.right).toFixed(1),
      W: Math.round(r.width),
    });
  }
  out.sort((a, b) => a.top - b.top);
  return JSON.stringify(out.slice(0, 14));
})();
