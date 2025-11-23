// Level 2 logic: present 10 runes to player1, choose 4 expected indices deterministically from seed
(function(){
  function hashStringToSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }
  function seededShuffle(array, rand) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // prepare: choose 4 indices out of available runes per riddle
  function prepare(opts) {
    const seed = opts.seed || '';
    const levelData = opts.levelData || [];
    const baseSeed = hashStringToSeed(seed);
    // expectedIndices may be per-riddle array
    const expectedIndices = [];
    for (let ri = 0; ri < levelData.length; ri++) {
      const riddle = levelData[ri];
      const runeCount = (riddle.runes && riddle.runes.length) || 0;
      const want = riddle.sequenceLength || 4;
      const prng = mulberry32((baseSeed + ri) >>> 0);
      const indices = Array.from({length: runeCount}, (_,i)=>i);
      const shuffled = seededShuffle(indices, prng);
      expectedIndices[ri] = shuffled.slice(0, Math.min(want, runeCount));
    }
    return { expectedIndices, confirmRequired: true };
  }

  // Toggle selection on click
  function onRuneClick(state, i) {
    const seq = (state.sequence || []).slice();
    const idx = state.riddleIndex || 0;
    // toggle
    const pos = seq.indexOf(i);
    if (pos >= 0) seq.splice(pos,1);
    else seq.push(i);
    // don't auto-reveal; require explicit Confirm
    return { sequence: seq, showPassword: false };
  }

  function resetSequence() {
    return { sequence: [], showPassword: false };
  }

  function submitAnswer(state, input) {
    // For level2, check selected indices match expectedIndices (order not important)
    const idx = state.riddleIndex || 0;
    const gen = state.generated || {};
    const selected = (state.sequence || []).slice().sort((a,b)=>a-b);
    const expected = (gen.expectedIndices && (gen.expectedIndices[idx] || gen.expectedIndices)) || [];
    const expSorted = expected.slice().sort((a,b)=>a-b);
    // special debug override: if input text equals 'test', accept
    if (typeof input === 'string' && input.trim().toLowerCase() === 'test') return true;
    if (selected.length !== expSorted.length) return false;
    for (let i = 0; i < selected.length; i++) if (selected[i] !== expSorted[i]) return false;
    return true;
  }

  window.levelLogic = { prepare, onRuneClick, resetSequence, submitAnswer };
})();
