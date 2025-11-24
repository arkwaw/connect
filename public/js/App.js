const { useState, useEffect, useRef } = React;

function App({ gameData }) {
  const [gameStarted, setGameStarted] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [gameWon, setGameWon] = useState(false);
  const [enemyOnPlayer, setEnemyOnPlayer] = useState(false);
  const [smartphoneMode, setSmartphoneMode] = useState(false);
  
  const boardRef = useRef(null);
  const playerRef = useRef(null);
  const enemiesRef = useRef([]);
  const inputHandlerRef = useRef(null);
  
  const [, forceUpdate] = useState({});
  
  // Detect smartphone mode
  useEffect(() => {
    const checkSmartphone = () => {
      setSmartphoneMode(window.innerWidth <= 768);
    };
    checkSmartphone();
    window.addEventListener('resize', checkSmartphone);
    return () => window.removeEventListener('resize', checkSmartphone);
  }, []);
  
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
  
  // Edge tap handlers for smartphone mode
  const handleEdgeTap = (e, direction) => {
    if (!smartphoneMode || !inputHandler || !inputHandler.onMove) return;
    e.preventDefault();
    e.stopPropagation();
    inputHandler.onMove(direction);
  };
  
  const handleBoardTap = (e) => {
    if (!smartphoneMode || !inputHandler || !inputHandler.onRevealPassword) return;
    e.preventDefault();
    e.stopPropagation();
    inputHandler.onRevealPassword();
  };
  
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
    
    inputHandler.onMove = (key) => {
      const wasEnemyOnPlayer = enemies.some(e => e.isAtPosition(player.position.x, player.position.y));
      
      player.processKeyPress(key, board);
      
      // Check if player moved onto enemy or escaped from enemy after move
      const isEnemyOnPlayer = enemies.some(e => e.isAtPosition(player.position.x, player.position.y));
      
      // If player just moved onto enemy (wasn't caught before, is caught now)
      if (!wasEnemyOnPlayer && isEnemyOnPlayer) {
        // Apply penalty immediately when player moves onto enemy
        player.timeRemaining = Math.max(0, player.timeRemaining - gameData.enemyConfig.timePenaltyPerSecond);
      }
      
      setEnemyOnPlayer(isEnemyOnPlayer);
      
      forceUpdate({});
    };
    
    inputHandler.attach();
    
    return () => {
      inputHandler.detach();
      inputHandler.setGameActive(false);
    };
  }, [gameStarted, gameWon, showPassword, player, board, inputHandler, gameData.passwordRevealSeconds]);
  
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
        // Only move enemy if it's not on the same position as player
        const isOnPlayer = enemy.isAtPosition(player.position.x, player.position.y);
        if (!isOnPlayer) {
          // Decide whether to move towards player or randomly
          const shouldChase = Math.random() < gameData.enemyConfig.chaseMoveProbability;
          
          if (shouldChase) {
            enemy.moveTowards(player.position, board);
          } else {
            enemy.moveRandom(board);
          }
          
          // Check if enemy landed on player after move
          const nowCaught = enemy.isAtPosition(player.position.x, player.position.y);
          if (nowCaught) {
            setEnemyOnPlayer(true);
            // Apply penalty immediately when caught
            player.timeRemaining = Math.max(0, player.timeRemaining - gameData.enemyConfig.timePenaltyPerSecond);
          }
        }
      });
      
      // Apply time penalty every second if still caught
      const isEnemyOnPlayer = enemies.some(e => e.isAtPosition(player.position.x, player.position.y));
      if (isEnemyOnPlayer) {
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
    if (passwordInput && player) {
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
          const isPlayerCaught = isPlayer && enemies.some(e => e.isAtPosition(player.position.x, player.position.y));
          const bgColor = isPlayerCaught ? '#ff0000' : terrainColor;
          
          cells.push(
            <div 
              key={`${x}-${y}`} 
              className="cell"
              style={{ backgroundColor: bgColor, width: 30, height: 30, fontSize: 20 }}
            >
              {isPlayer ? player.texture : enemyHere ? enemyHere.texturePatrol : ''}
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
          const isPlayerCaught = isPlayer && enemies.some(e => e.isAtPosition(player.position.x, player.position.y));
          const bgColor = isPlayerCaught ? '#ff0000' : terrainColor;
          
          cells.push(
            <div 
              key={`${dx}-${dy}`} 
              className="cell"
              style={{ backgroundColor: bgColor }}
            >
              {isPlayer ? player.texture : enemyHere ? enemyHere.texturePatrol : ''}
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
          
          {smartphoneMode ? (
            <div className="game-container-smartphone">
              <div className="edge-button edge-top" onTouchEnd={(e) => handleEdgeTap(e, 'ArrowUp')} onClick={(e) => handleEdgeTap(e, 'ArrowUp')}>↑</div>
              <div className="edge-button edge-left" onTouchEnd={(e) => handleEdgeTap(e, 'ArrowLeft')} onClick={(e) => handleEdgeTap(e, 'ArrowLeft')}>←</div>
              <div className="edge-button edge-right" onTouchEnd={(e) => handleEdgeTap(e, 'ArrowRight')} onClick={(e) => handleEdgeTap(e, 'ArrowRight')}>→</div>
              <div className="edge-button edge-bottom" onTouchEnd={(e) => handleEdgeTap(e, 'ArrowDown')} onClick={(e) => handleEdgeTap(e, 'ArrowDown')}>↓</div>
              <div 
                className="game-board" 
                style={{
                  gridTemplateColumns: `repeat(${showFullMap ? gameData.gridSize : 5}, 30px)`
                }}
                onTouchEnd={handleBoardTap}
                onClick={handleBoardTap}
              >
                {renderBoard()}
              </div>
            </div>
          ) : (
            <>
              <div 
                className="game-board" 
                style={{
                  gridTemplateColumns: `repeat(${showFullMap ? gameData.gridSize : 5}, ${showFullMap ? 30 : 40}px)`
                }}
              >
                {renderBoard()}
              </div>
              
              <div style={{ marginTop: 10, color: '#666', fontSize: 14 }}>
                Use arrow keys to move ↑ ↓ ← → | Press Space to reveal password
              </div>
            </>
          )}
          
          <div style={{ marginTop: 10 }}>
            <input 
              type="text"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="passphrase"
              maxLength="3"
              style={{ 
                padding: 8, 
                fontSize: 16, 
                fontFamily: 'monospace',
                width: 80,
                textAlign: 'center',
                border: '2px solid #ccc',
                borderRadius: '4px'
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
