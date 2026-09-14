/* Pure, versioned growth rules. No dates, tokens, or decoration rewards here. */
(function (root) {
  const thresholds = Object.freeze([0, 6, 16, 32, 56, 88]);
  const phases = Object.freeze(['bud', 'swelling', 'opening', 'bloom']);
  const flowering = new Set(['nasturtium', 'african-violet', 'phalaenopsis-orchid', 'hoya-carnosa', 'peace-lily', 'hydrangea', 'anthurium']);
  const score = p => p.growthCalibration && Number.isFinite(p.growthCalibration.score) && Number.isFinite(p.growthCalibration.points)
    ? Math.max(0,p.growthCalibration.score + Math.max(0,(Number(p.points)||0)-p.growthCalibration.points))
    : Math.max(0, Number(p.points) || 0) + Math.max(0, Number(p.growthV2Offset) || 0);
  const stage = p => Math.max(0, thresholds.findLastIndex(value => score(p) >= value));
  function migrate(projects) {
    for (const p of projects) {
      if (p.growthVersion === 2) continue;
      // Preserve the established identity and old records without crediting
      // fictional events. Older mature plants continue at stage five of six.
      const old = Math.min(3, Math.floor(Math.max(0, Number(p.points) || 0) / 3));
      const floor = p.plantSpecies ? thresholds[[0, 2, 3, 4][old]] : 0;
      p.growthV2Offset = Math.max(0, floor - (Number(p.points) || 0));
      p.growthVersion = 2;
    }
  }
  function organs(p, points = p.points, capacity = 8) {
    if (!p.plantSpecies) return [];
    const energy = score({ ...p, points }) - 48;
    if (energy < 0) return [];
    const newest = Math.floor(energy / 16);
    // Keep a readable canopy. After a full set, one old organ at a time is
    // replaced by the next growth cycle; cumulative progress never stops.
    return Array.from({ length: Math.min(capacity, newest + 1) }, (_, slot) => {
      const number = newest - ((newest - slot) % capacity + capacity) % capacity;
      const age = energy - number * 16;
      return { slot, number: number + 1, age, phase: phases[Math.min(3, Math.floor(age / 4))] };
    });
  }
  function progress(p) {
    const s = stage(p), value = score(p);
    if (s < 5) return { stage: s, ratio: (value-thresholds[s])/(thresholds[s+1]-thresholds[s]), remaining: thresholds[s+1]-value, cycle: false };
    return { stage: s, ratio: ((value-48)%16)/16, remaining: 16-((value-48)%16), cycle: true };
  }
  const api = { thresholds, phases, flowering: [...flowering], score, stage, migrate, organs, progress };
  if (typeof module !== 'undefined') module.exports = api;
  else root.GardenGrowth = api;
})(typeof window === 'undefined' ? globalThis : window);
