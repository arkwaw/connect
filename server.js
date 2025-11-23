const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
  
  // Calculate seed: hash of (3-minute timestamp bucket + word)
  const now = Date.now();
  const bucket = Math.floor(now / (3 * 60 * 1000)); // 3-minute buckets
  const seedString = `${bucket}-${word}`;
  const hashedSeed = crypto.createHash('sha256').update(seedString).digest('hex');
  
  // Send HTML with embedded data
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect Game</title>
  <style>
    body { 
      font-family: system-ui, -apple-system, Arial, sans-serif; 
      background: #f5f5f5; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh; 
      margin: 0;
    }
    .container { 
      background: white; 
      padding: 40px; 
      border-radius: 12px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 500px;
    }
    .seed { 
      font-family: monospace; 
      background: #f0f0f0; 
      padding: 12px; 
      border-radius: 6px; 
      margin: 20px 0;
      word-break: break-all;
      font-size: 14px;
    }
    .player-info {
      font-size: 24px;
      font-weight: bold;
      margin: 20px 0;
      color: #333;
    }
    button {
      background: #007bff;
      color: white;
      border: none;
      padding: 14px 32px;
      font-size: 18px;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 20px;
    }
    button:hover {
      background: #0056b3;
    }
    h1 {
      color: #333;
      margin-top: 0;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <script type="text/babel">
    const { useState } = React;
    
    function App() {
      const [gameStarted, setGameStarted] = useState(false);
      
      const gameData = {
        seed: '${hashedSeed}',
        playerNum: ${currentPlayer},
        totalPlayers: ${totalPlayers},
        word: '${word}'
      };
      
      return (
        <div className="container">
          <h1>Connect Game</h1>
          
          <div className="seed">
            <strong>Seed:</strong><br/>
            {gameData.seed}
          </div>
          
          <div className="player-info">
            Player {gameData.playerNum} of {gameData.totalPlayers}
          </div>
          
          {!gameStarted ? (
            <button onClick={() => setGameStarted(true)}>
              Start Game
            </button>
          ) : (
            <div style={{ marginTop: 20, color: '#28a745', fontSize: 20 }}>
              Game started! 🎮
            </div>
          )}
        </div>
      );
    }
    
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/4/testgame/1`);
});
