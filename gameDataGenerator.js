const crypto = require('crypto');

class GameDataGenerator {
  constructor(config) {
    this.config = config;
  }

  generateSeed(word) {
    const now = Date.now();
    const bucket = Math.floor(now / (3 * 60 * 1000)); // 3-minute buckets
    const seedString = `${bucket}-${word}`;
    return crypto.createHash('sha256').update(seedString).digest('hex');
  }

  generateTerrainMap(hashedSeed) {
    const terrainTypes = Object.keys(this.config.terrain);
    const terrainWeights = terrainTypes.map(type => this.config.terrain[type].percentage);
    
    // Create weighted array for terrain selection
    const weightedTerrain = [];
    terrainTypes.forEach((type, idx) => {
      for (let i = 0; i < terrainWeights[idx]; i++) {
        weightedTerrain.push(type);
      }
    });
    
    // Generate deterministic terrain for each cell
    const terrainMap = [];
    for (let i = 0; i < this.config.gridSize * this.config.gridSize; i++) {
      const cellSeed = crypto.createHash('sha256')
        .update(`${hashedSeed}-${i}`)
        .digest('hex');
      const index = parseInt(cellSeed.substring(0, 8), 16) % weightedTerrain.length;
      terrainMap.push(weightedTerrain[index]);
    }
    
    return terrainMap;
  }

  generatePasswordMap(hashedSeed, totalPlayers) {
    const passwordMap = {}; // { fieldIndex: { playerNum: password } }
    for (let i = 0; i < this.config.gridSize * this.config.gridSize; i++) {
      passwordMap[i] = {};
      for (let p = 1; p <= totalPlayers; p++) {
        const passSeed = crypto.createHash('sha256')
          .update(`${hashedSeed}-field${i}-player${p}`)
          .digest('hex');
        // Generate 6-character password from hex
        const password = passSeed.substring(0, 6).toUpperCase();
        passwordMap[i][p] = password;
      }
    }
    return passwordMap;
  }

  generateStartingPositions(hashedSeed, totalPlayers) {
    const startingPositions = {};
    for (let p = 1; p <= totalPlayers; p++) {
      const posSeed = crypto.createHash('sha256')
        .update(`${hashedSeed}-startpos-player${p}`)
        .digest('hex');
      const xPos = parseInt(posSeed.substring(0, 8), 16) % this.config.gridSize;
      const yPos = parseInt(posSeed.substring(8, 16), 16) % this.config.gridSize;
      startingPositions[p] = { x: xPos, y: yPos };
    }
    return startingPositions;
  }

  generateEnemyPositions(hashedSeed) {
    const enemyStartPositions = [];
    for (let e = 0; e < this.config.enemies.count; e++) {
      const enemySeed = crypto.createHash('sha256')
        .update(`${hashedSeed}-enemy${e}`)
        .digest('hex');
      const xPos = parseInt(enemySeed.substring(0, 8), 16) % this.config.gridSize;
      const yPos = parseInt(enemySeed.substring(8, 16), 16) % this.config.gridSize;
      enemyStartPositions.push({ x: xPos, y: yPos });
    }
    return enemyStartPositions;
  }

  generateGameData(word, totalPlayers) {
    const hashedSeed = this.generateSeed(word);
    const terrainMap = this.generateTerrainMap(hashedSeed);
    const passwordMap = this.generatePasswordMap(hashedSeed, totalPlayers);
    const startingPositions = this.generateStartingPositions(hashedSeed, totalPlayers);
    const enemyStartPositions = this.generateEnemyPositions(hashedSeed);

    return {
      hashedSeed,
      terrainMap,
      passwordMap,
      startingPositions,
      enemyStartPositions,
      terrainColors: this.config.terrain
    };
  }
}

module.exports = GameDataGenerator;
