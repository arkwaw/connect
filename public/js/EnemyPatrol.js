class EnemyPatrol {
  constructor(id, startPos, texturePatrol = '♟', textureChasing = '♜') {
    this.id = id;
    this.position = { ...startPos };
    this.texturePatrol = texturePatrol;
    this.textureChasing = textureChasing;
    this.isChasing = false;
  }
  
  getTexture() {
    return this.isChasing ? this.textureChasing : this.texturePatrol;
  }
  
  calculateDistance(playerPos, board) {
    const dx = Math.min(
      Math.abs(this.position.x - playerPos.x),
      board.gridSize - Math.abs(this.position.x - playerPos.x)
    );
    const dy = Math.min(
      Math.abs(this.position.y - playerPos.y),
      board.gridSize - Math.abs(this.position.y - playerPos.y)
    );
    return dx + dy; // Manhattan distance
  }
  
  updateChaseState(playerPos, board, chaseDistance) {
    const distance = this.calculateDistance(playerPos, board);
    this.isChasing = distance <= chaseDistance;
  }
  
  moveTowards(playerPos, board) {
    const dx = Math.min(
      Math.abs(this.position.x - playerPos.x),
      board.gridSize - Math.abs(this.position.x - playerPos.x)
    );
    const dy = Math.min(
      Math.abs(this.position.y - playerPos.y),
      board.gridSize - Math.abs(this.position.y - playerPos.y)
    );
    
    if (dx > dy) {
      // Move horizontally towards player
      if ((playerPos.x > this.position.x && dx === Math.abs(playerPos.x - this.position.x)) ||
          (playerPos.x < this.position.x && dx !== Math.abs(playerPos.x - this.position.x))) {
        this.position.x = board.wrapCoordinate(this.position.x + 1);
      } else {
        this.position.x = board.wrapCoordinate(this.position.x - 1);
      }
    } else {
      // Move vertically towards player
      if ((playerPos.y > this.position.y && dy === Math.abs(playerPos.y - this.position.y)) ||
          (playerPos.y < this.position.y && dy !== Math.abs(playerPos.y - this.position.y))) {
        this.position.y = board.wrapCoordinate(this.position.y + 1);
      } else {
        this.position.y = board.wrapCoordinate(this.position.y - 1);
      }
    }
  }
  
  moveRandom(board) {
    const dir = Math.floor(Math.random() * 4);
    switch(dir) {
      case 0: this.position.y = board.wrapCoordinate(this.position.y - 1); break;
      case 1: this.position.y = board.wrapCoordinate(this.position.y + 1); break;
      case 2: this.position.x = board.wrapCoordinate(this.position.x - 1); break;
      case 3: this.position.x = board.wrapCoordinate(this.position.x + 1); break;
    }
  }
  
  isAtPosition(x, y) {
    return this.position.x === x && this.position.y === y;
  }
}
