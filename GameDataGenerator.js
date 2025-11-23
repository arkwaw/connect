const crypto = require('crypto');

class GameDataGenerator {
  static generateSeed(word) {
    const now = Date.now();
    const bucket = Math.floor(now / (3 * 60 * 1000)); // 3-minute buckets
    const seedString = `${bucket}-${word}`;
    return crypto.createHash('sha256').update(seedString).digest('hex');
  }

  static generateTerrainMap(hashedSeed, config) {
    const terrainTypes = Object.keys(config.terrain);
    const terrainWeights = terrainTypes.map(type => config.terrain[type].percentage);
    
    // Create weighted array for terrain selection
    const weightedTerrain = [];
    terrainTypes.forEach((type, idx) => {
      for (let i = 0; i < terrainWeights[idx]; i++) {
        weightedTerrain.push(type);
      }
    });
    
    // Generate deterministic terrain for each cell
    const terrainMap = [];
    for (let i = 0; i < config.gridSize * config.gridSize; i++) {
      const cellSeed = crypto.createHash('sha256')
        .update(`${hashedSeed}-${i}`)
        .digest('hex');
      const index = parseInt(cellSeed.substring(0, 8), 16) % weightedTerrain.length;
      terrainMap.push(weightedTerrain[index]);
    }
    
    return terrainMap;
  }

  static generatePasswordMap(hashedSeed, config, totalPlayers) {
    const passwordMap = {}; // { fieldIndex: { playerNum: password } }
    for (let i = 0; i < config.gridSize * config.gridSize; i++) {
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

  static generateStartingPositions(hashedSeed, config, totalPlayers) {
    const startingPositions = {};
    for (let p = 1; p <= totalPlayers; p++) {
      const posSeed = crypto.createHash('sha256')
        .update(`${hashedSeed}-startpos-player${p}`)
        .digest('hex');
      const xPos = parseInt(posSeed.substring(0, 8), 16) % config.gridSize;
      const yPos = parseInt(posSeed.substring(8, 16), 16) % config.gridSize;
      startingPositions[p] = { x: xPos, y: yPos };
    }
    return startingPositions;
  }

  static generateEnemyStartPositions(hashedSeed, config) {
    const enemyStartPositions = [];
    for (let e = 0; e < config.enemies.count; e++) {
      const enemySeed = crypto.createHash('sha256')
        .update(`${hashedSeed}-enemy${e}`)
        .digest('hex');
      const xPos = parseInt(enemySeed.substring(0, 8), 16) % config.gridSize;
      const yPos = parseInt(enemySeed.substring(8, 16), 16) % config.gridSize;
      enemyStartPositions.push({ x: xPos, y: yPos });
    }
    return enemyStartPositions;
  }

  static generateGameData(word, config, totalPlayers) {
    const hashedSeed = this.generateSeed(word);
    
    return {
      seed: hashedSeed,
      terrainMap: this.generateTerrainMap(hashedSeed, config),
      terrainColors: config.terrain,
      passwordMap: this.generatePasswordMap(hashedSeed, config, totalPlayers),
      startingPositions: this.generateStartingPositions(hashedSeed, config, totalPlayers),
      enemyStartPositions: this.generateEnemyStartPositions(hashedSeed, config)
    };
  }
}

module.exports = GameDataGenerator;
