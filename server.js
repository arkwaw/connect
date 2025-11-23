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
  
  // Generate terrain map from seed
  const terrainTypes = Object.keys(config.terrain);
  const terrainWeights = terrainTypes.map(type => config.terrain[type].percentage);
  const terrainColors = terrainTypes.map(type => config.terrain[type].color);
  
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
  
  const terrainData = JSON.stringify(terrainMap);
  const terrainColorsData = JSON.stringify(config.terrain);
  
  // Generate unique passwords for each field per player
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
  const passwordData = JSON.stringify(passwordMap);
  
  // Generate starting positions for each player
  const startingPositions = {};
  for (let p = 1; p <= totalPlayers; p++) {
    const posSeed = crypto.createHash('sha256')
      .update(`${hashedSeed}-startpos-player${p}`)
      .digest('hex');
    const xPos = parseInt(posSeed.substring(0, 8), 16) % config.gridSize;
    const yPos = parseInt(posSeed.substring(8, 16), 16) % config.gridSize;
    startingPositions[p] = { x: xPos, y: yPos };
  }
  const startingPosData = JSON.stringify(startingPositions);
  
  // Generate enemy starting positions
  const enemyStartPositions = [];
  for (let e = 0; e < config.enemies.count; e++) {
    const enemySeed = crypto.createHash('sha256')
      .update(`${hashedSeed}-enemy${e}`)
      .digest('hex');
    const xPos = parseInt(enemySeed.substring(0, 8), 16) % config.gridSize;
    const yPos = parseInt(enemySeed.substring(8, 16), 16) % config.gridSize;
    enemyStartPositions.push({ x: xPos, y: yPos });
  }
  const enemyStartData = JSON.stringify(enemyStartPositions);
  
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
  
  <!-- Game Classes -->
  <script src="/js/Board.js"></script>
  <script src="/js/Player.js"></script>
  <script src="/js/EnemyPatrol.js"></script>
  <script src="/js/InputHandler.js"></script>
  
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;
    
    function App() {
      const [gameStarted, setGameStarted] = useState(false);
      const [showFullMap, setShowFullMap] = useState(false);
      const [gameLost, setGameLost] = useState(false);
      const [showPassword, setShowPassword] = useState(false);
      const [passwordInput, setPasswordInput] = useState('');
      const [gameWon, setGameWon] = useState(false);
      
      const boardRef = useRef(null);
      const playerRef = useRef(null);
      const enemiesRef = useRef([]);
      const inputHandlerRef = useRef(null);
      
      const [, forceUpdate] = useState({});
      const moveIntervalRef = useRef(null);
      
      const gameData = {
        seed: '${hashedSeed}',
        playerNum: ${currentPlayer},
        totalPlayers: ${totalPlayers},
        word: '${word}',
        gridSize: ${config.gridSize},
        timerSeconds: ${config.timerSeconds},
        passwordRevealSeconds: ${config.passwordRevealSeconds},
        moveDelayMs: ${config.moveDelayMs},
        terrainMap: ${terrainData},
        terrainColors: ${terrainColorsData},
        passwordMap: ${passwordData},
        startingPositions: ${startingPosData},
        enemyStartPositions: ${enemyStartData},
        enemyConfig: ${JSON.stringify(config.enemies)}
      };
      
      // Initialize game objects
      useEffect(() => {
        boardRef.current = new Board(
          gameData.gridSize,
          gameData.terrainMap,
          gameData.terrainColors,
          gameData.passwordMap
        );
        
        const startPos = gameData.startingPositions[gameData.playerNum];
        playerRef.current = new Player(gameData.playerNum, startPos);
        playerRef.current.timeRemaining = gameData.timerSeconds;
        
        enemiesRef.current = gameData.enemyStartPositions.map((pos, idx) => 
          new EnemyPatrol(idx, pos)
        );
        
        inputHandlerRef.current = new InputHandler();
        
        forceUpdate({});
      }, []);
      
      const player = playerRef.current;
      const board = boardRef.current;
      const enemies = enemiesRef.current;
      const inputHandler = inputHandlerRef.current;
      
      // Setup input handlers
      useEffect(() => {
        if (!gameStarted || gameWon || !player || !inputHandler) return;
        
        inputHandler.setGameActive(true);
        
        inputHandler.onShowFullMap = () => {
          setShowFullMap(true);
          setTimeout(() => setShowFullMap(false), 3000);
        };
        
        inputHandler.onRevealPassword = () => {
          if (!showPassword) {
            player.applyTimePenalty(gameData.passwordRevealSeconds);
            setShowPassword(true);
            forceUpdate({});
          }
        };
        
        inputHandler.attach();
        
        return () => {
          inputHandler.detach();
          inputHandler.setGameActive(false);
        };
      }, [gameStarted, gameWon, showPassword, player, inputHandler, gameData.passwordRevealSeconds]);
      
      // Process movement at consistent intervals
      useEffect(() => {
        if (!gameStarted || gameWon || gameLost || !player || !board || !inputHandler) {
          if (moveIntervalRef.current) {
            clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = null;
          }
          return;
        }
        
        moveIntervalRef.current = setInterval(() => {
          const key = inputHandler.getActiveKey();
          if (!key) return;
          
          player.processKeyPress(key, board);
          forceUpdate({});
        }, gameData.moveDelayMs);
        
        return () => {
          if (moveIntervalRef.current) {
            clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = null;
          }
        };
      }, [gameStarted, gameWon, gameLost, player, inputHandler, gameData.moveDelayMs]);
      
      // Hide password when player moves
      useEffect(() => {
        if (player) {
          setShowPassword(false);
        }
      }, [player?.position.x, player?.position.y]);
      
      // Timer countdown
      useEffect(() => {
        if (!gameStarted || gameLost || !player) return;
        
        const interval = setInterval(() => {
          player.timeRemaining -= 1;
          if (player.timeRemaining <= 0) {
            player.timeRemaining = 0;
            setGameLost(true);
            setGameStarted(false);
          }
          forceUpdate({});
        }, 1000);
        
        return () => clearInterval(interval);
      }, [gameStarted, gameLost]);
      
      // Enemy movement and time penalty
      useEffect(() => {
        if (!gameStarted || gameLost || gameWon || !player || !board || enemies.length === 0) return;
        
        const interval = setInterval(() => {
          enemies.forEach(enemy => {
            enemy.updateChaseState(player.position, board, 2);
            
            if (enemy.isChasing) {
              enemy.moveTowards(player.position, board);
            } else {
              enemy.moveRandom(board);
            }
          });
          
          // Apply time penalty if enemy on same field as player
          const enemyOnPlayer = enemies.some(e => e.isAtPosition(player.position.x, player.position.y));
          if (enemyOnPlayer) {
            player.timeRemaining = Math.max(0, player.timeRemaining - gameData.enemyConfig.timePenaltyPerSecond);
          }
          
          forceUpdate({});
        }, 1000);
        
        return () => clearInterval(interval);
      }, [gameStarted, gameLost, gameWon, player, board, gameData.enemyConfig]);
      
      const handlePasswordSubmit = () => {
        if (!player || !board) return;
        
        // Check all other players' passwords for this field
        for (let p = 1; p <= gameData.totalPlayers; p++) {
          if (p !== gameData.playerNum && !player.hasCollectedFrom(p)) {
            const expectedPassword = board.getPassword(player.position.x, player.position.y, p);
            if (passwordInput.toUpperCase() === expectedPassword) {
              player.collectPassphrase(p);
              setPasswordInput('');
              
              // Win if collected all other players' passphrases
              if (player.collectedPassphrases.length >= gameData.totalPlayers - 1) {
                setGameWon(true);
              }
              forceUpdate({});
              return;
            }
          }
        }
      };
      
      // Auto-check password on input change
      useEffect(() => {
        if (passwordInput && playerPos) {
          handlePasswordSubmit();
        }
      }, [passwordInput]);
      
      const renderBoard = () => {
        if (!player || !board) return null;
        const viewportSize = showFullMap ? gameData.gridSize : 5;
        const halfView = Math.floor(viewportSize / 2);
        
        const cells = [];
        
        if (showFullMap) {
          // Render entire map
          for (let y = 0; y < gameData.gridSize; y++) {
            for (let x = 0; x < gameData.gridSize; x++) {
              const terrainColor = board.getTerrainColor(x, y);
              const isPlayer = player.position.x === x && player.position.y === y;
              const enemyHere = enemies.find(e => e.isAtPosition(x, y));
              
              cells.push(
                <div 
                  key={\`\${x}-\${y}\`} 
                  className="cell"
                  style={{ backgroundColor: terrainColor, width: 30, height: 30, fontSize: 20 }}
                >
                  {isPlayer ? player.texture : enemyHere ? enemyHere.getTexture() : ''}
                </div>
              );
            }
          }
        } else {
          // Render 5x5 viewport
          for (let dy = -halfView; dy <= halfView; dy++) {
            for (let dx = -halfView; dx <= halfView; dx++) {
              // Wrap coordinates around the grid
              const worldX = board.wrapCoordinate(player.position.x + dx);
              const worldY = board.wrapCoordinate(player.position.y + dy);
              
              const terrainColor = board.getTerrainColor(worldX, worldY);
              const isPlayer = dx === 0 && dy === 0;
              const enemyHere = enemies.find(e => e.isAtPosition(worldX, worldY));
              
              cells.push(
                <div 
                  key={\`\${dx}-\${dy}\`} 
                  className="cell"
                  style={{ backgroundColor: terrainColor }}
                >
                  {isPlayer ? player.texture : enemyHere ? enemyHere.getTexture() : ''}
                </div>
              );
            }
          }
        }
        
        return cells;
      };
      
      return (
        <div className="container">
          
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
          ) : gameLost ? (
            <>
              <div style={{ marginTop: 20, color: 'red', fontSize: 24, fontWeight: 'bold' }}>
                Time's Up! You Lost!
              </div>
              <button onClick={() => window.location.reload()} style={{ marginTop: 20 }}>
                Try Again
              </button>
            </>
          ) : gameWon ? (
            <>
              <div style={{ marginTop: 20, color: 'green', fontSize: 24, fontWeight: 'bold' }}>
                You Win! 🎉
              </div>
              <div style={{ marginTop: 10, fontSize: 18 }}>
                You collected all {gameData.totalPlayers - 1} passphrases!
              </div>
              <button onClick={() => window.location.reload()} style={{ marginTop: 20 }}>
                Play Again
              </button>
            </>
          ) : (
            <>
              {player && (
                <>
                  {showFullMap && (
                    <div className="info-bar">
                      <span>Player {gameData.playerNum}/{gameData.totalPlayers}</span>
                      <span>Position: ({player.position.x}, {player.position.y})</span>
                    </div>
                  )}
                  
                  <div style={{ 
                    textAlign: 'center', 
                    fontSize: 18, 
                    fontWeight: 'bold', 
                    marginTop: 10, 
                    marginBottom: 10,
                    color: player.timeRemaining <= 30 ? 'red' : 'black'
                  }}>
                    {Math.floor(player.timeRemaining / 60)}:{String(player.timeRemaining % 60).padStart(2, '0')}
                  </div>
                  
                  {player.collectedPassphrases.length > 0 && (
                    <div style={{ textAlign: 'center', fontSize: 12, color: '#28a745', marginBottom: 5 }}>
                      Collected: {player.collectedPassphrases.length}/{gameData.totalPlayers - 1}
                    </div>
                  )}
                  
                  {showPassword && (
                    <div style={{ 
                      textAlign: 'center',
                      marginTop: 10,
                      marginBottom: 10
                    }}>
                      <div style={{ fontSize: 28, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 3 }}>
                        {board.getPassword(player.position.x, player.position.y, gameData.playerNum)}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
                        Visible until you move (-{gameData.passwordRevealSeconds}s penalty applied)
                      </div>
                    </div>
                  )}
              
              <div 
                className="game-board" 
                style={{
                  gridTemplateColumns: \`repeat(\${showFullMap ? gameData.gridSize : 5}, \${showFullMap ? 30 : 40}px)\`
                }}
              >
                {renderBoard()}
              </div>
              
              <div style={{ marginTop: 10, color: '#666', fontSize: 14 }}>
                Use arrow keys to move ↑ ↓ ← → | Press Space to reveal password
              </div>
              
              <div style={{ marginTop: 15 }}>
                <input 
                  type="text"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="passphrase"
                  style={{ 
                    padding: 6, 
                    fontSize: 14, 
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    width: 100,
                    textAlign: 'center'
                  }}
                />
              </div>
                </>
              )}
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
  console.log(`Try: http://localhost:${PORT}/2/testgame/1`);
});
