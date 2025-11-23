// Level 1 — encapsulated logic for expected sequences, chosen answers and interactions
// This file attaches a `window.levelLogic` object used by the generic room UI.
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

  // prepare: produce expectedSequences and chosenAnswers for a level
  function prepare(opts) {
    // opts: { seed: string, levelData: array-of-riddles, themeList: array-of-labels }
    const seed = opts.seed || '';
    const levelData = opts.levelData || [];
    const themeList = Array.isArray(opts.themeList) ? opts.themeList : [];
    const baseSeed = hashStringToSeed(seed);
    const colorMaps = []; // per-riddle player2 color map (random 21 cells)
    const colColorMaps = []; // per-riddle player1 column-based color map
    const rowColorMaps = []; // per-riddle player1 row-based color map
    const expectedSequences = []; // per-riddle indices player1 must select (intersection of row & player2 colors)
    const activeColors = [];
    const chosenAnswers = [];
    const labelsPerRiddle = [];
    for (let ri = 0; ri < levelData.length; ri++) {
      const riddle = levelData[ri];
      const objCount = (riddle.descriptiveObjects && riddle.descriptiveObjects.length) || (riddle.runes && riddle.runes.length) || 0;
      const prng = mulberry32((baseSeed + ri) >>> 0);

      // 1) build player2's random color map: choose 21 distinct positions and assign 7 green, 7 red, 7 blue
      const indices = Array.from({length: objCount}, (_,i)=>i);
      const shuffled = seededShuffle(indices, prng);
      const pick21 = shuffled.slice(0, Math.min(21, shuffled.length));
      const player2Map = Array.from({length: objCount}, ()=>null);
      // assign colors in blocks of 7
      for (let k = 0; k < pick21.length; k++) {
        const i = pick21[k];
        if (k < 7) player2Map[i] = 'green';
        else if (k < 14) player2Map[i] = 'red';
        else player2Map[i] = 'blue';
      }

      // 2) choose three distinct columns for player1 column-highlights (grid is 7x7 columns 0..6)
      const cols = Array.from({length:7}, (_,i)=>i);
      const colPrng = mulberry32((baseSeed + ri + 98765) >>> 0);
      const colShuffle = seededShuffle(cols, colPrng);
      const chosenCols = colShuffle.slice(0,3);
      const colorForCol = { green: chosenCols[0], red: chosenCols[1], blue: chosenCols[2] };

      const player1ColMap = Array.from({length: objCount}, ()=>null);
      for (let i = 0; i < objCount; i++) {
        const col = i % 7;
        if (col === colorForCol.green) player1ColMap[i] = 'green';
        else if (col === colorForCol.red) player1ColMap[i] = 'red';
        else if (col === colorForCol.blue) player1ColMap[i] = 'blue';
      }

      // 3) choose three distinct rows for player1 row-highlights (grid is 7x7 rows 0..6)
      const rows = Array.from({length:7}, (_,i)=>i);
      const rowPrng = mulberry32((baseSeed + ri + 192837) >>> 0);
      const rowShuffle = seededShuffle(rows, rowPrng);
      const chosenRows = rowShuffle.slice(0,3);
      const colorForRow = { green: chosenRows[0], red: chosenRows[1], blue: chosenRows[2] };

      const player1RowMap = Array.from({length: objCount}, ()=>null);
      for (let i = 0; i < objCount; i++) {
        const row = Math.floor(i / 7);
        if (row === colorForRow.green) player1RowMap[i] = 'green';
        else if (row === colorForRow.red) player1RowMap[i] = 'red';
        else if (row === colorForRow.blue) player1RowMap[i] = 'blue';
      }

      // expected sequence for player1: intersection of player1ColMap/rowMap and player2Map
      const expected = [];
      for (let i = 0; i < objCount; i++) {
        const rowColor = player1RowMap[i];
        const colColor = player1ColMap[i];
        const p2 = player2Map[i];
        if (p2) {
          if (rowColor && rowColor === p2) expected.push(i);
          else if (colColor && colColor === p2) expected.push(i);
        }
      }

      // generate labels for each object deterministically from seed + themeList
      const labels = [];
      if (themeList && themeList.length) {
        // shuffle a copy of themeList deterministically and fill labels by cycling
        const tl = themeList.slice();
        const tlRand = mulberry32((baseSeed + ri + 424242) >>> 0);
        for (let i = tl.length - 1; i > 0; i--) {
          const j = Math.floor(tlRand() * (i + 1));
          const tmp = tl[i]; tl[i] = tl[j]; tl[j] = tmp;
        }
        for (let i = 0; i < objCount; i++) {
          labels[i] = tl[i % tl.length];
        }
      }

      colorMaps[ri] = player2Map;
      colColorMaps[ri] = player1ColMap;
      rowColorMaps[ri] = player1RowMap;
      expectedSequences[ri] = expected;
      activeColors[ri] = null;
      labelsPerRiddle[ri] = labels;

      // choose answer deterministically from candidates (kept for backward compat)
      const candidates = (riddle.candidates && riddle.candidates.slice()) || [];
      let chosen = null;
      if (candidates.length > 0) {
        const pick = Math.floor(prng() * candidates.length);
        chosen = candidates[pick];
      }
      chosenAnswers[ri] = chosen;
    }
    // reveal is automatic when selection matches expected set
    return { colorMaps, colColorMaps, rowColorMaps, expectedSequences, activeColors, chosenAnswers, labelsPerRiddle, confirmRequired: false };
  }

  // onRuneClick: given current sequence and riddle index, produce new sequence + reveal flag
  function onRuneClick(state, i) {
    // state: { riddleIndex, sequence, generated }
    const seq = (state.sequence || []).slice();
    const gen = state.generated || {};
    const idx = state.riddleIndex || 0;
    // toggle selection: remove if present, add if not
    const pos = seq.indexOf(i);
    if (pos >= 0) {
      seq.splice(pos, 1);
    } else {
      seq.push(i);
    }
    // determine if selection completes the expected set (order-independent)
    const expected = (gen.expectedSequences && gen.expectedSequences[idx]) || [];
    let reveal = false;
    if (Array.isArray(expected) && expected.length > 0 && seq.length === expected.length) {
      // compare as sets
      const sset = new Set(seq.slice().sort((a,b)=>a-b));
      const eset = new Set(expected.slice().sort((a,b)=>a-b));
      if (sset.size === eset.size) {
        let all = true;
        for (const v of sset) if (!eset.has(v)) { all = false; break; }
        if (all) reveal = true;
      }
    }
    return { sequence: seq, showPassword: reveal };
  }

  function resetSequence() {
    return { sequence: [], showPassword: false };
  }

  function submitAnswer(state, input) {
    // state: { riddleIndex, generated, levelData, sequence }
    const idx = state.riddleIndex || 0;
    const gen = state.generated || {};
    const seq = (state.sequence || []).slice();
    // if input provided and is text, check text answer (back-compat)
    const val = (typeof input === 'string' ? input.trim().toLowerCase() : (input || '') ).toLowerCase();
    if (val) {
      if (val === 'test') return true;
      const expectedAnswer = (gen.chosenAnswers && gen.chosenAnswers[idx]) || ((state.levelData && state.levelData[idx] && state.levelData[idx].answer) || null);
      return expectedAnswer && val === String(expectedAnswer).toLowerCase();
    }
    // otherwise, compare sequence to expectedSequences (order-independent set match)
    const expectedSeq = (gen.expectedSequences && gen.expectedSequences[idx]) || [];
    if (!Array.isArray(expectedSeq) || expectedSeq.length === 0) return false;
    if (seq.length !== expectedSeq.length) return false;
    const sset = new Set(seq.slice().sort((a,b)=>a-b));
    const eset = new Set(expectedSeq.slice().sort((a,b)=>a-b));
    if (sset.size !== eset.size) return false;
    for (const v of sset) if (!eset.has(v)) return false;
    return true;
  }

  window.levelLogic = {
    prepare,
    onRuneClick,
    resetSequence,
    submitAnswer
  };
})();
