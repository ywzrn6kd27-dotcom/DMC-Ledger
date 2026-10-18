// Suggested fabric size: stitched area (stitches / count) plus a margin on every side,
// rounded up to the next whole inch.
export function fabricSize(width, height, count, margin = 3) {
  if (!(width > 0) || !(height > 0) || !(count > 0)) return null;
  const stitchW = width / count;
  const stitchH = height / count;
  return {
    stitchW,
    stitchH,
    w: Math.ceil(stitchW + 2 * margin - 1e-9),
    h: Math.ceil(stitchH + 2 * margin - 1e-9),
  };
}

export const fmtInches = (n) => String(Math.round(n * 10) / 10);
