function generateHTML(gameData, config, currentPlayer, totalPlayers, word) {
  const { hashedSeed, terrainMap, terrainColors, passwordMap, startingPositions, enemyStartPositions } = gameData;
  
  const terrainData = JSON.stringify(terrainMap);
  const terrainColorsData = JSON.stringify(terrainColors);
  const passwordData = JSON.stringify(passwordMap);
  const startingPosData = JSON.stringify(startingPositions);
  const enemyStartData = JSON.stringify(enemyStartPositions);
  const enemyConfigData = JSON.stringify(config.enemies);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1" />
  <title>Connect Game</title>
  <link rel="stylesheet" href="/css/styles.css">
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
  
  <script type="text/babel" src="/js/App.js?v=8"></script>
  <script type="text/babel">
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
      enemyConfig: ${enemyConfigData}
    };
    
    ReactDOM.createRoot(document.getElementById('root')).render(<App gameData={gameData} />);
  </script>
</body>
</html>
  `;
}

module.exports = generateHTML;
