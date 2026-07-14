// Games functionality
let currentGame = null;
let gameState = {};

// Wait for DOM to be fully loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('Games.js loaded');
  initializeGames();
});

function initializeGames() {
  const gameCards = document.querySelectorAll('.game-card');
  const backToGamesBtn = document.getElementById('back-to-games');
  
  console.log('Found game cards:', gameCards.length);
  
  gameCards.forEach(card => {
    const playBtn = card.querySelector('.btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameName = card.getAttribute('data-game');
        console.log('Loading game:', gameName);
        loadGame(gameName);
      });
    }
  });
  
  if (backToGamesBtn) {
    backToGamesBtn.addEventListener('click', () => {
      const gameArena = document.getElementById('game-arena');
      const gamesContainer = document.querySelector('.games-container');
      gameArena.classList.add('hidden');
      gamesContainer.classList.remove('hidden');
      currentGame = null;
    });
  }
}

function loadGame(gameName) {
  const gamesContainer = document.querySelector('.games-container');
  const gameArena = document.getElementById('game-arena');
  const gameContent = document.getElementById('game-content');
  const gameTitle = document.getElementById('current-game-title');
  
  console.log('Loading game:', gameName);
  
  if (!gamesContainer || !gameArena || !gameContent || !gameTitle) {
    console.error('Game elements not found');
    return;
  }
  
  gamesContainer.classList.add('hidden');
  gameArena.classList.remove('hidden');
  
  currentGame = gameName;
  
  // Set game title
  const gameTitles = {
    'tictactoe': 'Tic Tac Toe',
    'chess': 'Chess',
    'ludo': 'Ludo',
    'connect4': 'Connect Four',
    'checkers': 'Checkers',
    'snakeladder': 'Snake & Ladders',
    'dotsboxes': 'Dots & Boxes',
    'rps': 'Rock Paper Scissors',
    'memory': 'Memory Match',
    'trivia': 'Trivia Quiz',
    'wordchain': 'Word Chain',
    'drawing': 'Draw & Guess'
  };
  
  gameTitle.textContent = gameTitles[gameName] || 'Game';
  
  // Load game content
  switch(gameName) {
    case 'tictactoe':
      loadTicTacToe(gameContent);
      break;
    case 'connect4':
      loadConnectFour(gameContent);
      break;
    case 'rps':
      loadRockPaperScissors(gameContent);
      break;
    case 'memory':
      loadMemoryMatch(gameContent);
      break;
    case 'trivia':
      loadTrivia(gameContent);
      break;
    case 'drawing':
      loadDrawing(gameContent);
      break;
    case 'chess':
      loadChess(gameContent);
      break;
    case 'ludo':
      loadLudo(gameContent);
      break;
    case 'checkers':
      loadCheckers(gameContent);
      break;
    case 'snakeladder':
      loadSnakeLadder(gameContent);
      break;
    case 'dotsboxes':
      loadDotsBoxes(gameContent);
      break;
    case 'wordchain':
      loadWordChain(gameContent);
      break;
    default:
      gameContent.innerHTML = '<p style="color: #9ca3af;">Game coming soon!</p>';
  }
}

// ===== TIC TAC TOE =====
function loadTicTacToe(container) {
  gameState.tictactoe = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    gameOver: false
  };
  
  container.innerHTML = `
    <div class="game-status">Player X's Turn</div>
    <div class="game-info">Play against a friend!</div>
    <div class="tictactoe-board" id="tictactoe-board"></div>
    <button class="btn-reset" onclick="resetTicTacToe()">Reset Game</button>
  `;
  
  const board = document.getElementById('tictactoe-board');
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'tictactoe-cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => handleTicTacToeMove(i));
    board.appendChild(cell);
  }
}

function handleTicTacToeMove(index) {
  if (gameState.tictactoe.gameOver || gameState.tictactoe.board[index]) return;
  
  gameState.tictactoe.board[index] = gameState.tictactoe.currentPlayer;
  
  const cells = document.querySelectorAll('.tictactoe-cell');
  cells[index].textContent = gameState.tictactoe.currentPlayer;
  cells[index].classList.add('filled');
  
  if (checkTicTacToeWinner()) {
    document.querySelector('.game-status').textContent = `Player ${gameState.tictactoe.currentPlayer} Wins! 🎉`;
    gameState.tictactoe.gameOver = true;
    return;
  }
  
  if (gameState.tictactoe.board.every(cell => cell !== null)) {
    document.querySelector('.game-status').textContent = "It's a Draw! 🤝";
    gameState.tictactoe.gameOver = true;
    return;
  }
  
  gameState.tictactoe.currentPlayer = gameState.tictactoe.currentPlayer === 'X' ? 'O' : 'X';
  document.querySelector('.game-status').textContent = `Player ${gameState.tictactoe.currentPlayer}'s Turn`;
}

function checkTicTacToeWinner() {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ];
  
  return winPatterns.some(pattern => {
    const [a, b, c] = pattern;
    return gameState.tictactoe.board[a] &&
           gameState.tictactoe.board[a] === gameState.tictactoe.board[b] &&
           gameState.tictactoe.board[a] === gameState.tictactoe.board[c];
  });
}

function resetTicTacToe() {
  loadTicTacToe(document.getElementById('game-content'));
}

// ===== CONNECT FOUR =====
function loadConnectFour(container) {
  gameState.connect4 = {
    board: Array(6).fill(null).map(() => Array(7).fill(null)),
    currentPlayer: 'red',
    gameOver: false
  };
  
  container.innerHTML = `
    <div class="game-status">Red Player's Turn</div>
    <div class="game-info">Connect 4 in a row to win!</div>
    <div class="connect4-board" id="connect4-board"></div>
    <button class="btn-reset" onclick="resetConnectFour()">Reset Game</button>
  `;
  
  const board = document.getElementById('connect4-board');
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = document.createElement('div');
      cell.className = 'connect4-cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.addEventListener('click', () => handleConnect4Move(col));
      board.appendChild(cell);
    }
  }
}

function handleConnect4Move(col) {
  if (gameState.connect4.gameOver) return;
  
  // Find the lowest empty row in this column
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (!gameState.connect4.board[r][col]) {
      row = r;
      break;
    }
  }
  
  if (row === -1) return; // Column is full
  
  gameState.connect4.board[row][col] = gameState.connect4.currentPlayer;
  
  const cells = document.querySelectorAll('.connect4-cell');
  const cellIndex = row * 7 + col;
  cells[cellIndex].classList.add(gameState.connect4.currentPlayer);
  cells[cellIndex].classList.add('filled');
  
  if (checkConnect4Winner(row, col)) {
    const playerName = gameState.connect4.currentPlayer === 'red' ? 'Red' : 'Yellow';
    document.querySelector('.game-status').textContent = `${playerName} Player Wins! 🎉`;
    gameState.connect4.gameOver = true;
    return;
  }
  
  if (gameState.connect4.board.every(row => row.every(cell => cell !== null))) {
    document.querySelector('.game-status').textContent = "It's a Draw! 🤝";
    gameState.connect4.gameOver = true;
    return;
  }
  
  gameState.connect4.currentPlayer = gameState.connect4.currentPlayer === 'red' ? 'yellow' : 'red';
  const playerName = gameState.connect4.currentPlayer === 'red' ? 'Red' : 'Yellow';
  document.querySelector('.game-status').textContent = `${playerName} Player's Turn`;
}

function checkConnect4Winner(row, col) {
  const player = gameState.connect4.board[row][col];
  const directions = [
    [[0, 1], [0, -1]], // Horizontal
    [[1, 0], [-1, 0]], // Vertical
    [[1, 1], [-1, -1]], // Diagonal \
    [[1, -1], [-1, 1]]  // Diagonal /
  ];
  
  return directions.some(([dir1, dir2]) => {
    let count = 1;
    
    // Check in first direction
    let [dr, dc] = dir1;
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < 6 && c >= 0 && c < 7 && gameState.connect4.board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    
    // Check in opposite direction
    [dr, dc] = dir2;
    r = row + dr;
    c = col + dc;
    while (r >= 0 && r < 6 && c >= 0 && c < 7 && gameState.connect4.board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    
    return count >= 4;
  });
}

function resetConnectFour() {
  loadConnectFour(document.getElementById('game-content'));
}

// ===== ROCK PAPER SCISSORS =====
function loadRockPaperScissors(container) {
  gameState.rps = {
    playerChoice: null,
    computerChoice: null,
    score: { player: 0, computer: 0 }
  };
  
  container.innerHTML = `
    <div class="game-status">Choose Your Move!</div>
    <div class="game-info">Best of unlimited rounds</div>
    <div class="rps-choices">
      <div class="rps-choice" onclick="playRPS('rock')">✊</div>
      <div class="rps-choice" onclick="playRPS('paper')">✋</div>
      <div class="rps-choice" onclick="playRPS('scissors')">✌️</div>
    </div>
    <div class="rps-result" id="rps-result" style="display: none;">
      <h3 id="rps-winner"></h3>
      <p id="rps-details"></p>
    </div>
    <div class="trivia-score">
      You: <span id="player-score">0</span> | Computer: <span id="computer-score">0</span>
    </div>
  `;
}

function playRPS(playerChoice) {
  const choices = ['rock', 'paper', 'scissors'];
  const computerChoice = choices[Math.floor(Math.random() * 3)];
  
  gameState.rps.playerChoice = playerChoice;
  gameState.rps.computerChoice = computerChoice;
  
  const emojis = { rock: '✊', paper: '✋', scissors: '✌️' };
  
  let result = '';
  if (playerChoice === computerChoice) {
    result = "It's a Tie!";
  } else if (
    (playerChoice === 'rock' && computerChoice === 'scissors') ||
    (playerChoice === 'paper' && computerChoice === 'rock') ||
    (playerChoice === 'scissors' && computerChoice === 'paper')
  ) {
    result = 'You Win!';
    gameState.rps.score.player++;
  } else {
    result = 'Computer Wins!';
    gameState.rps.score.computer++;
  }
  
  document.getElementById('rps-result').style.display = 'block';
  document.getElementById('rps-winner').textContent = result;
  document.getElementById('rps-details').textContent = 
    `You chose ${emojis[playerChoice]} | Computer chose ${emojis[computerChoice]}`;
  
  document.getElementById('player-score').textContent = gameState.rps.score.player;
  document.getElementById('computer-score').textContent = gameState.rps.score.computer;
}

// ===== MEMORY MATCH =====
function loadMemoryMatch(container) {
  const emojis = ['🎮', '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎹'];
  const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  
  gameState.memory = {
    cards: cards,
    flipped: [],
    matched: [],
    moves: 0
  };
  
  container.innerHTML = `
    <div class="game-status">Find all matching pairs!</div>
    <div class="game-info">Moves: <span id="memory-moves">0</span></div>
    <div class="memory-board" id="memory-board"></div>
    <button class="btn-reset" onclick="resetMemory()">Reset Game</button>
  `;
  
  const board = document.getElementById('memory-board');
  cards.forEach((emoji, index) => {
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.dataset.index = index;
    card.innerHTML = `<div class="memory-card-back">?</div>`;
    card.addEventListener('click', () => handleMemoryClick(index));
    board.appendChild(card);
  });
}

function handleMemoryClick(index) {
  if (gameState.memory.flipped.length >= 2 || 
      gameState.memory.flipped.includes(index) ||
      gameState.memory.matched.includes(index)) return;
  
  const cards = document.querySelectorAll('.memory-card');
  const card = cards[index];
  card.classList.add('flipped');
  card.innerHTML = gameState.memory.cards[index];
  gameState.memory.flipped.push(index);
  
  if (gameState.memory.flipped.length === 2) {
    gameState.memory.moves++;
    document.getElementById('memory-moves').textContent = gameState.memory.moves;
    
    const [first, second] = gameState.memory.flipped;
    if (gameState.memory.cards[first] === gameState.memory.cards[second]) {
      // Match found
      gameState.memory.matched.push(first, second);
      setTimeout(() => {
        cards[first].classList.add('matched');
        cards[second].classList.add('matched');
        gameState.memory.flipped = [];
        
        if (gameState.memory.matched.length === gameState.memory.cards.length) {
          document.querySelector('.game-status').textContent = 
            `You Won in ${gameState.memory.moves} moves! 🎉`;
        }
      }, 500);
    } else {
      // No match
      setTimeout(() => {
        cards[first].classList.remove('flipped');
        cards[first].innerHTML = '<div class="memory-card-back">?</div>';
        cards[second].classList.remove('flipped');
        cards[second].innerHTML = '<div class="memory-card-back">?</div>';
        gameState.memory.flipped = [];
      }, 1000);
    }
  }
}

function resetMemory() {
  loadMemoryMatch(document.getElementById('game-content'));
}

// ===== TRIVIA QUIZ =====
function loadTrivia(container) {
  const questions = [
    {
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      correct: 2
    },
    {
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correct: 1
    },
    {
      question: "Who painted the Mona Lisa?",
      options: ["Van Gogh", "Picasso", "Da Vinci", "Rembrandt"],
      correct: 2
    },
    {
      question: "What is the largest ocean on Earth?",
      options: ["Atlantic", "Indian", "Arctic", "Pacific"],
      correct: 3
    },
    {
      question: "In which year did World War II end?",
      options: ["1943", "1944", "1945", "1946"],
      correct: 2
    }
  ];
  
  gameState.trivia = {
    questions: questions,
    currentQuestion: 0,
    score: 0,
    answered: false
  };
  
  displayTriviaQuestion(container);
}

function displayTriviaQuestion(container) {
  const q = gameState.trivia.questions[gameState.trivia.currentQuestion];
  
  container.innerHTML = `
    <div class="trivia-question">
      <div class="game-info">Question ${gameState.trivia.currentQuestion + 1} of ${gameState.trivia.questions.length}</div>
      <h3>${q.question}</h3>
      <div class="trivia-options" id="trivia-options"></div>
    </div>
    <div class="trivia-score">Score: ${gameState.trivia.score} / ${gameState.trivia.questions.length}</div>
  `;
  
  const optionsContainer = document.getElementById('trivia-options');
  q.options.forEach((option, index) => {
    const btn = document.createElement('div');
    btn.className = 'trivia-option';
    btn.textContent = option;
    btn.addEventListener('click', () => handleTriviaAnswer(index));
    optionsContainer.appendChild(btn);
  });
}

function handleTriviaAnswer(selected) {
  if (gameState.trivia.answered) return;
  
  gameState.trivia.answered = true;
  const q = gameState.trivia.questions[gameState.trivia.currentQuestion];
  const options = document.querySelectorAll('.trivia-option');
  
  if (selected === q.correct) {
    options[selected].classList.add('correct');
    gameState.trivia.score++;
  } else {
    options[selected].classList.add('wrong');
    options[q.correct].classList.add('correct');
  }
  
  setTimeout(() => {
    gameState.trivia.currentQuestion++;
    gameState.trivia.answered = false;
    
    if (gameState.trivia.currentQuestion < gameState.trivia.questions.length) {
      displayTriviaQuestion(document.getElementById('game-content'));
    } else {
      document.getElementById('game-content').innerHTML = `
        <div class="game-status">Quiz Complete! 🎉</div>
        <div class="trivia-score" style="font-size: 1.5rem; margin-top: 2rem;">
          Final Score: ${gameState.trivia.score} / ${gameState.trivia.questions.length}
        </div>
        <button class="btn-reset" onclick="loadTrivia(document.getElementById('game-content'))">Play Again</button>
      `;
    }
  }, 2000);
}

// ===== DRAWING GAME =====
function loadDrawing(container) {
  container.innerHTML = `
    <div class="game-status">Draw Something!</div>
    <div class="game-info">Use your mouse or touch to draw</div>
    <div class="drawing-canvas-container">
      <canvas id="drawing-canvas" width="600" height="400"></canvas>
    </div>
    <div class="drawing-controls">
      <div class="color-picker">
        <div class="color-btn active" style="background: #000;" onclick="setDrawColor('#000')"></div>
        <div class="color-btn" style="background: #ef4444;" onclick="setDrawColor('#ef4444')"></div>
        <div class="color-btn" style="background: #3b82f6;" onclick="setDrawColor('#3b82f6')"></div>
        <div class="color-btn" style="background: #10b981;" onclick="setDrawColor('#10b981')"></div>
        <div class="color-btn" style="background: #f59e0b;" onclick="setDrawColor('#f59e0b')"></div>
        <div class="color-btn" style="background: #a855f7;" onclick="setDrawColor('#a855f7')"></div>
      </div>
      <button class="btn-clear" onclick="clearCanvas()">Clear Canvas</button>
    </div>
  `;
  
  initDrawing();
}

function initDrawing() {
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let currentColor = '#000';
  
  gameState.drawing = { ctx, currentColor };
  
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // Touch events
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startDrawing(e.touches[0]);
  });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    draw(e.touches[0]);
  });
  canvas.addEventListener('touchend', stopDrawing);
  
  function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  
  function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  
  function stopDrawing() {
    isDrawing = false;
  }
}

function setDrawColor(color) {
  gameState.drawing.currentColor = color;
  document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
}

function clearCanvas() {
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ===== PLACEHOLDER GAMES =====
function loadChess(container) {
  container.innerHTML = `
    <div class="game-status">Chess</div>
    <div class="game-info" style="text-align: center; padding: 3rem;">
      <p style="font-size: 3rem; margin-bottom: 1rem;">♟️</p>
      <p style="color: #9ca3af; font-size: 1.125rem;">Full chess game coming soon!</p>
      <p style="color: #6b7280; margin-top: 1rem;">This will include a complete chess board with all rules and multiplayer support.</p>
    </div>
  `;
}

function loadLudo(container) {
  container.innerHTML = `
    <div class="game-status">Ludo</div>
    <div class="game-info" style="text-align: center; padding: 3rem;">
      <p style="font-size: 3rem; margin-bottom: 1rem;">🎲</p>
      <p style="color: #9ca3af; font-size: 1.125rem;">Ludo game coming soon!</p>
      <p style="color: #6b7280; margin-top: 1rem;">Roll the dice and race to the finish with up to 4 players.</p>
    </div>
  `;
}

function loadCheckers(container) {
  container.innerHTML = `
    <div class="game-status">Checkers</div>
    <div class="game-info" style="text-align: center; padding: 3rem;">
      <p style="font-size: 3rem; margin-bottom: 1rem;">⚫⚪</p>
      <p style="color: #9ca3af; font-size: 1.125rem;">Checkers game coming soon!</p>
      <p style="color: #6b7280; margin-top: 1rem;">Classic checkers with jump mechanics and king pieces.</p>
    </div>
  `;
}

function loadSnakeLadder(container) {
  container.innerHTML = `
    <div class="game-status">Snake & Ladders</div>
    <div class="game-info" style="text-align: center; padding: 3rem;">
      <p style="font-size: 3rem; margin-bottom: 1rem;">🐍🪜</p>
      <p style="color: #9ca3af; font-size: 1.125rem;">Snake & Ladders coming soon!</p>
      <p style="color: #6b7280; margin-top: 1rem;">Climb ladders and avoid snakes in this classic board game.</p>
    </div>
  `;
}

function loadDotsBoxes(container) {
  container.innerHTML = `
    <div class="game-status">Dots & Boxes</div>
    <div class="game-info" style="text-align: center; padding: 3rem;">
      <p style="font-size: 3rem; margin-bottom: 1rem;">📦</p>
      <p style="color: #9ca3af; font-size: 1.125rem;">Dots & Boxes coming soon!</p>
      <p style="color: #6b7280; margin-top: 1rem;">Connect dots to create boxes and score points.</p>
    </div>
  `;
}

function loadWordChain(container) {
  container.innerHTML = `
    <div class="game-status">Word Chain</div>
    <div class="game-info" style="text-align: center; padding: 3rem;">
      <p style="font-size: 3rem; margin-bottom: 1rem;">🔤</p>
      <p style="color: #9ca3af; font-size: 1.125rem;">Word Chain coming soon!</p>
      <p style="color: #6b7280; margin-top: 1rem;">Build chains of words where each word starts with the last letter of the previous word.</p>
    </div>
  `;
}

console.log('Games.js fully loaded');