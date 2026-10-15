// Skein estimates from stitch counts.
//
// A DMC skein is 8 m long and has 6 strands. For each full cross stitch we
// assume two diagonals on the front (2 * sqrt(2) stitch-widths) plus about two
// stitch-widths of travel on the back, per strand used. A waste buffer covers
// tails, tension and thread-ends. These are estimates: tune the waste % after
// finishing a project or two so they match how you stitch.

export const SKEIN_CM = 800;
export const SKEIN_STRANDS = 6;
export const FABRIC_COUNTS = [14, 16, 18];
export const CM_PER_INCH = 2.54;

export function crossCmPerStitch(fabricCount) {
  return ((2 * Math.SQRT2 + 2) / fabricCount) * CM_PER_INCH;
}

// Backstitch: ~1 stitch-width on the front plus ~2 on the back per segment.
export function backstitchCmPerSegment(fabricCount) {
  return (3 / fabricCount) * CM_PER_INCH;
}

export function estimateSkeins({
  stitches = 0,
  bsStitches = 0,
  fabricCount = 14,
  strands = 2,
  bsStrands = 1,
  waste = 25,
}) {
  const count = Math.max(1, Number(fabricCount) || 14);
  const strandCm =
    stitches * crossCmPerStitch(count) * strands +
    bsStitches * backstitchCmPerSegment(count) * bsStrands;
  return (strandCm * (1 + waste / 100)) / (SKEIN_CM * SKEIN_STRANDS);
}

// Round up to the nearest quarter skein (a partial skein can cover a small need).
export function roundUpQuarter(x) {
  if (!(x > 0)) return 0;
  return Math.max(0.25, Math.ceil(x * 4 - 1e-9) / 4);
}
