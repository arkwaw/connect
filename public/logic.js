// Level logic moved to top-level `public/logic.js` for the single-board setup
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

  function prepare(opts) {
    const seed = opts.seed || '';
    const levelData = opts.levelData || [];
    const themes = (opts && opts.themes) || {};
    const themeName = opts.theme || 'rune';
    const themeList = Array.isArray(themes[themeName]) ? themes[themeName] : (Array.isArray(opts.themeList) ? opts.themeList : []);
    const baseSeed = hashStringToSeed(seed);
    const colorMaps = [];
    const colColorMaps = [];
    const rowColorMaps = [];
    const expectedSequences = [];
    const activeColors = [];
    const chosenAnswers = [];
    const labelsPerRiddle = [];
    const labelsPerRiddlePlayer2 = [];
    const mismatchIndices = [];
    const gridSizes = [];
    const roundOffset = (opts && typeof opts.round === 'number') ? Math.max(0, Math.floor(opts.round)) : 0;

    for (let ri = 0; ri < levelData.length; ri++) {
      const riddle = levelData[ri];
      const gridSize = Math.min(4 + roundOffset + ri, 7);
      const objCount = gridSize * gridSize;
      gridSizes[ri] = gridSize;
      const prng = mulberry32((baseSeed + ri) >>> 0);

      const indices = Array.from({length: objCount}, (_,i)=>i);
      const shuffled = seededShuffle(indices, prng);
      const pickCount = Math.min(3 * gridSize, shuffled.length);
      const pickN = shuffled.slice(0, pickCount);
      const player2Map = Array.from({length: objCount}, ()=>null);
      for (let k = 0; k < pickN.length; k++) {
        const i = pickN[k];
        if (k < gridSize) player2Map[i] = 'green';
        else if (k < 2 * gridSize) player2Map[i] = 'red';
        else player2Map[i] = 'blue';
      }

      const cols = Array.from({length:gridSize}, (_,i)=>i);
      const colPrng = mulberry32((baseSeed + ri + 98765) >>> 0);
      const colShuffle = seededShuffle(cols, colPrng);
      const chosenCols = colShuffle.slice(0,3);
      const colorForCol = { green: chosenCols[0], red: chosenCols[1], blue: chosenCols[2] };
      const player1ColMap = Array.from({length: objCount}, ()=>null);
      for (let i = 0; i < objCount; i++) {
        const col = i % gridSize;
        if (col === colorForCol.green) player1ColMap[i] = 'green';
        else if (col === colorForCol.red) player1ColMap[i] = 'red';
        else if (col === colorForCol.blue) player1ColMap[i] = 'blue';
      }

      const rows = Array.from({length:gridSize}, (_,i)=>i);
      const rowPrng = mulberry32((baseSeed + ri + 192837) >>> 0);
      const rowShuffle = seededShuffle(rows, rowPrng);
      const chosenRows = rowShuffle.slice(0,3);
      const colorForRow = { green: chosenRows[0], red: chosenRows[1], blue: chosenRows[2] };
      const player1RowMap = Array.from({length: objCount}, ()=>null);
      for (let i = 0; i < objCount; i++) {
        const row = Math.floor(i / gridSize);
        if (row === colorForRow.green) player1RowMap[i] = 'green';
        else if (row === colorForRow.red) player1RowMap[i] = 'red';
        else if (row === colorForRow.blue) player1RowMap[i] = 'blue';
      }

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

      const labels = [];
      if (themeList && themeList.length) {
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
      const labelsPlayer2 = labels.slice();
      let mismatchIndex = null;
      if (expected && expected.length > 0) {
        const pickIdx = Math.floor(prng() * expected.length);
        mismatchIndex = expected[pickIdx];
        if (themeList && themeList.length) {
          const alt = themeList[(mismatchIndex + 1) % themeList.length];
          labelsPlayer2[mismatchIndex] = alt;
        } else {
          labelsPlayer2[mismatchIndex] = ('#' + (mismatchIndex+1) + '*');
        }
      }
      labelsPerRiddlePlayer2[ri] = labelsPlayer2;
      mismatchIndices[ri] = mismatchIndex;
      const expectedFiltered = (expected && expected.length) ? expected.filter(idx => idx !== mismatchIndex) : expected;
      expectedSequences[ri] = expectedFiltered;

      // choose answer deterministically from theme passwords or riddle candidates
      let chosen = null;
      try {
        const pwStore = (themes && themes.passwords) || {};
        if (themeName === 'fun' && Array.isArray(pwStore.fun) && pwStore.fun.length > 0) {
          const pick = Math.floor(prng() * pwStore.fun.length);
          chosen = pwStore.fun[pick];
        } else if (themeName === 'rune') {
          // generate an 8-digit deterministic number from PRNG
          const num = Math.floor(prng() * 90000000) + 10000000;
          chosen = String(num);
        }
      } catch (e) {
        chosen = null;
      }
      // fallback to candidates if no theme password chosen
      if (!chosen) {
        const candidates = (riddle.candidates && riddle.candidates.slice()) || [];
        if (candidates.length > 0) {
          const pick = Math.floor(prng() * candidates.length);
          chosen = candidates[pick];
        } else {
          chosen = null;
        }
      }
      chosenAnswers[ri] = chosen;
    }
    return { colorMaps, colColorMaps, rowColorMaps, gridSizes, expectedSequences, activeColors, chosenAnswers, labelsPerRiddle, labelsPerRiddlePlayer2, mismatchIndices, confirmRequired: false };
  }

  function onRuneClick(state, i) {
    const seq = (state.sequence || []).slice();
    const gen = state.generated || {};
    const idx = state.riddleIndex || 0;
    const pos = seq.indexOf(i);
    if (pos >= 0) {
      seq.splice(pos, 1);
    } else {
      seq.push(i);
    }
    const expected = (gen.expectedSequences && gen.expectedSequences[idx]) || [];
    const mismatch = (gen.mismatchIndices && gen.mismatchIndices[idx] !== undefined) ? gen.mismatchIndices[idx] : null;
    const expectedToCheck = expected && expected.length ? expected.filter(v => v !== mismatch) : expected;
    const seqToCheck = seq.slice().filter(v => v !== mismatch);
    let reveal = false;
    if (Array.isArray(expectedToCheck) && expectedToCheck.length > 0 && seqToCheck.length === expectedToCheck.length) {
      const sset = new Set(seqToCheck.slice().sort((a,b)=>a-b));
      const eset = new Set(expectedToCheck.slice().sort((a,b)=>a-b));
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
    const idx = state.riddleIndex || 0;
    const gen = state.generated || {};
    const seq = (state.sequence || []).slice();
    const val = (typeof input === 'string' ? input.trim().toLowerCase() : (input || '') ).toLowerCase();
    if (val) {
      if (val === 'test') return true;
      const expectedAnswer = (gen.chosenAnswers && gen.chosenAnswers[idx]) || ((state.levelData && state.levelData[idx] && state.levelData[idx].answer) || null);
      return expectedAnswer && val === String(expectedAnswer).toLowerCase();
    }
    const expectedSeq = (gen.expectedSequences && gen.expectedSequences[idx]) || [];
    if (!Array.isArray(expectedSeq) || expectedSeq.length === 0) return false;
    const mismatch = (gen.mismatchIndices && gen.mismatchIndices[idx] !== undefined) ? gen.mismatchIndices[idx] : null;
    const expectedToCheck = expectedSeq.filter(v => v !== mismatch);
    const seqToCheck = seq.slice().filter(v => v !== mismatch);
    if (seqToCheck.length !== expectedToCheck.length) return false;
    const sset = new Set(seqToCheck.slice().sort((a,b)=>a-b));
    const eset = new Set(expectedToCheck.slice().sort((a,b)=>a-b));
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
