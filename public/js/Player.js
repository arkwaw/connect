class Player {
  constructor(playerNum, startPos, texture = '♞') {
    this.playerNum = playerNum;
    this.position = { ...startPos };
    this.texture = texture;
    this.timeRemaining = null;
    this.collectedPassphrases = [];
  }
  
  moveTo(x, y, board) {
    this.position.x = board.wrapCoordinate(x);
    this.position.y = board.wrapCoordinate(y);
  }
  
  move(dx, dy, board) {
    this.moveTo(this.position.x + dx, this.position.y + dy, board);
  }
  
  processKeyPress(key, board) {
    switch(key) {
      case 'ArrowUp':
        this.move(0, -1, board);
        return true;
      case 'ArrowDown':
        this.move(0, 1, board);
        return true;
      case 'ArrowLeft':
        this.move(-1, 0, board);
        return true;
      case 'ArrowRight':
        this.move(1, 0, board);
        return true;
      default:
        return false;
    }
  }
  
  hasCollectedFrom(playerNum) {
    return this.collectedPassphrases.includes(playerNum);
  }
  
  collectPassphrase(playerNum) {
    if (!this.hasCollectedFrom(playerNum)) {
      this.collectedPassphrases.push(playerNum);
    }
  }
  
  applyTimePenalty(seconds) {
    this.timeRemaining = Math.max(0, this.timeRemaining - seconds);
  }
}
