const express = require('express');
const path = require('path');
const fs = require('fs');
const GameDataGenerator = require('./gameDataGenerator');
const generateHTML = require('./htmlTemplate');

const app = express();
const PORT = process.env.PORT || 3000;

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const gameDataGenerator = new GameDataGenerator(config);

// Serve static files from public directory
app.use(express.static('public'));

// Handle the game URL pattern: /<numPlayers>/<word>/<playerNum>
app.get('/:numPlayers/:word/:playerNum', (req, res) => {
  const { numPlayers, word, playerNum } = req.params;
  const { grid, enemies, time } = req.query;
  
  // Validate parameters
  const totalPlayers = parseInt(numPlayers);
  const currentPlayer = parseInt(playerNum);
  const gridSize = parseInt(grid) || config.gridSize;
  const enemyCount = parseInt(enemies) !== undefined ? parseInt(enemies) : config.enemies.count;
  const timerSeconds = parseInt(time) || config.timerSeconds;
  
  if (isNaN(totalPlayers) || totalPlayers <= 0) {
    return res.status(400).send('Invalid number of players');
  }
  
  if (isNaN(currentPlayer) || currentPlayer < 1 || currentPlayer > totalPlayers) {
    return res.status(400).send('Invalid player number');
  }
  
  // Override config for this game
  const gameConfig = {
    ...config,
    gridSize: gridSize,
    timerSeconds: timerSeconds,
    enemies: {
      ...config.enemies,
      count: enemyCount
    }
  };
  
  // Generate game data with custom config
  const customGenerator = new GameDataGenerator(gameConfig);
  const gameData = customGenerator.generateGameData(word, totalPlayers);
  
  // Send HTML with game data
  res.send(generateHTML(gameData, gameConfig, currentPlayer, totalPlayers, word));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/2/testgame/1`);
});
