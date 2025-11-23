class InputHandler {
  constructor() {
    this.keysPressed = new Set();
    this.onShowFullMap = null;
    this.onRevealPassword = null;
    this.onMove = null;
    this.gameActive = false;
  }
  
  setGameActive(active) {
    this.gameActive = active;
  }
  
  handleKeyDown(e) {
    if (!this.gameActive) return;
    
    // Q key to show full map
    if (e.key === 'q' || e.key === 'Q') {
      if (this.onShowFullMap) {
        this.onShowFullMap();
      }
      e.preventDefault();
      return;
    }
    
    // Space key to reveal password
    if (e.key === ' ') {
      if (this.onRevealPassword) {
        this.onRevealPassword();
      }
      e.preventDefault();
      return;
    }
    
    // Handle arrow key movement immediately
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (this.onMove) {
        this.onMove(e.key);
      }
      e.preventDefault();
    }
  }
  
  handleKeyUp(e) {
    // No longer needed but kept for compatibility
  }
  
  attach() {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', this.boundHandleKeyDown);
    window.addEventListener('keyup', this.boundHandleKeyUp);
  }
  
  detach() {
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    window.removeEventListener('keyup', this.boundHandleKeyUp);
  }
}
