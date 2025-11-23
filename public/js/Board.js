class Board {
  constructor(gridSize, terrainMap, terrainColors, passwordMap) {
    this.gridSize = gridSize;
    this.terrainMap = terrainMap;
    this.terrainColors = terrainColors;
    this.passwordMap = passwordMap;
  }
  
  getTerrainType(x, y) {
    const index = y * this.gridSize + x;
    return this.terrainMap[index];
  }
  
  getTerrainColor(x, y) {
    const terrainType = this.getTerrainType(x, y);
    return this.terrainColors[terrainType]?.color || '#e8e8e8';
  }
  
  getPassword(x, y, playerNum) {
    const index = y * this.gridSize + x;
    return this.passwordMap[index]?.[playerNum] || '';
  }
  
  wrapCoordinate(coord) {
    return (coord + this.gridSize) % this.gridSize;
  }
}
