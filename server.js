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
  
  // Validate parameters
  const totalPlayers = parseInt(numPlayers);
  const currentPlayer = parseInt(playerNum);
  
  if (isNaN(totalPlayers) || totalPlayers <= 0) {
    return res.status(400).send('Invalid number of players');
  }
  
  if (isNaN(currentPlayer) || currentPlayer < 1 || currentPlayer > totalPlayers) {
    return res.status(400).send('Invalid player number');
  }
  
  // Generate game data
  const gameData = gameDataGenerator.generateGameData(word, totalPlayers);
  
  // Send HTML with game data
  res.send(generateHTML(gameData, config, currentPlayer, totalPlayers, word));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/2/testgame/1`);
});
