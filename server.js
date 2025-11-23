const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

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
      max-width: 800px;
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
    .game-board {
      display: inline-grid;
      gap: 0;
      margin: 20px auto;
    }
    .cell {
      width: 40px;
      height: 40px;
      background: #e8e8e8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    .info-bar {
      display: flex;
      justify-content: space-between;
      margin: 20px 0;
      padding: 10px;
      background: #f9f9f9;
      border-radius: 6px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <script type="text/babel">
    const { useState, useEffect } = React;
    
    function App() {
      const [gameStarted, setGameStarted] = useState(false);
      const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
      
      const gameData = {
        seed: '${hashedSeed}',
        playerNum: ${currentPlayer},
        totalPlayers: ${totalPlayers},
        word: '${word}',
        gridSize: ${config.gridSize}
      };
      
      // Arrow key movement
      useEffect(() => {
        if (!gameStarted) return;
        
        const handleKeyDown = (e) => {
          setPlayerPos(prev => {
            let newPos = { ...prev };
            
            switch(e.key) {
              case 'ArrowUp':
                newPos.y = (prev.y - 1 + gameData.gridSize) % gameData.gridSize;
                e.preventDefault();
                break;
              case 'ArrowDown':
                newPos.y = (prev.y + 1) % gameData.gridSize;
                e.preventDefault();
                break;
              case 'ArrowLeft':
                newPos.x = (prev.x - 1 + gameData.gridSize) % gameData.gridSize;
                e.preventDefault();
                break;
              case 'ArrowRight':
                newPos.x = (prev.x + 1) % gameData.gridSize;
                e.preventDefault();
                break;
            }
            
            return newPos;
          });
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [gameStarted, gameData.gridSize]);
      
      const renderBoard = () => {
        const viewportSize = 5;
        const halfView = Math.floor(viewportSize / 2);
        
        const cells = [];
        for (let dy = -halfView; dy <= halfView; dy++) {
          for (let dx = -halfView; dx <= halfView; dx++) {
            // Wrap coordinates around the grid
            const worldX = (playerPos.x + dx + gameData.gridSize) % gameData.gridSize;
            const worldY = (playerPos.y + dy + gameData.gridSize) % gameData.gridSize;
            
            const isPlayer = dx === 0 && dy === 0;
            cells.push(
              <div key={\`\${dx}-\${dy}\`} className="cell">
                {isPlayer ? '♞' : ''}
              </div>
            );
          }
        }
        return cells;
      };
      
      return (
        <div className="container">
          <h1>Connect Game</h1>
          
          {!gameStarted ? (
            <>
              <div className="seed">
                <strong>Seed:</strong><br/>
                {gameData.seed}
              </div>
              
              <div className="player-info">
                Player {gameData.playerNum} of {gameData.totalPlayers}
              </div>
              
              <button onClick={() => setGameStarted(true)}>
                Start Game
              </button>
            </>
          ) : (
            <>
              <div className="info-bar">
                <span>Player {gameData.playerNum}/{gameData.totalPlayers}</span>
                <span>Position: ({playerPos.x}, {playerPos.y})</span>
                <span>Grid: {gameData.gridSize}x{gameData.gridSize}</span>
              </div>
              
              <div 
                className="game-board" 
                style={{
                  gridTemplateColumns: \`repeat(5, 40px)\`
                }}
              >
                {renderBoard()}
              </div>
              
              <div style={{ marginTop: 10, color: '#666', fontSize: 14 }}>
                Use arrow keys to move ↑ ↓ ← →
              </div>
            </>
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
