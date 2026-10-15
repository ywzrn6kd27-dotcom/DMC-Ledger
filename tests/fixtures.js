// Small synthetic FlossCross-style chart (same shape as a real v133 export).
export function makeFcjson({ title = 'Test chart', extra = {} } = {}) {
  const flossIndexes = [
    { rgb: [32, 32, 31], hex: 2105375, sys: 'DMC', id: '310', name: 'Black', state: {}, active: true, symbol: 'sm0', order: 0 },
    { rgb: [203, 203, 204], hex: 13355980, sys: 'DMC', id: '01', name: 'Tin - White', state: {}, active: true, symbol: 'sm4', order: 1 },
    { rgb: [252, 253, 253], hex: 16580093, sys: 'DMC', id: 'B5200', name: 'Snow White', state: {}, active: true, symbol: 'sm6', order: 2 },
    { rgb: [200, 0, 0], hex: 0, sys: 'DMC', id: '666', name: 'Bright Red', state: {}, active: false, symbol: 'sm9', order: 3 },
  ];
  // 4x3 grid: 5x color0, 3x color1, 1x color2, 3 empty; color3 unused
  const cross = [0, 0, 0, 1, 1, 1, 0, 0, 2, -1, -1, -1];
  return JSON.stringify({
    sv: 1, v: 133, software: 'FlossCross', modelId: 'x',
    model: {
      images: [{
        width: 4, height: 3, flossIndexes,
        crossIndexes: flossIndexes.map((_, i) => ({ tp: 'cr', fi: i })),
        sources: [], layers: [{ width: 4, height: 3, position: { top: 0, left: 0 }, cross, backstitch: [] }],
        defaults: { crossStrands: 2, bsStrands: 1 }, cloth: { type: 'aida' },
      }],
      id: 'x', renderFilter: { gamma: 0.7 },
    },
    info: { title, description: '' }, ts: 1, srcs: [], ...extra,
  });
}
