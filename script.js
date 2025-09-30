const API_BASE = 'https://victors-descent-backend.onrender.com';

const GRID_SIZE = 8;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

let grid = [];
let gameActive = false;
let inProgress = false;
let messageTimeoutId = null;

// Clear any existing user data on page load to force fresh login
let currentUserId = null;
let currentUsername = null;

const hero = {
  lives: 3,
  allies: 0,
  party: 1,
  potions: 0,
  armour: 0,
  weapons: 0,
  revealedCount: 0
};

// Utility functions
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setMessage(txt) {
  if (messageTimeoutId) clearTimeout(messageTimeoutId);
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerText = txt || '';
  messageTimeoutId = setTimeout(() => {
    if (messageDiv) messageDiv.innerText = '';
    messageTimeoutId = null;
  }, 3000);
}

function logEvent(text, type = 'info') {
  const logDiv = document.getElementById('log');
  if (!logDiv) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerText = text;
  logDiv.prepend(entry);
}

function message(txt, type = 'info') {
  if (!txt) return;
  setMessage(txt);
  logEvent(txt, type);
}

function updateUserDisplay() {
  const currentUserDisplay = document.getElementById('currentUserDisplay');
  if (currentUserDisplay) {
    currentUserDisplay.innerHTML = `User: ${currentUsername || 'Not logged in'}`;
  }
}

function updateUI() {
  const elements = {
    partyCount: document.getElementById('partyCount'),
    allyCount: document.getElementById('allyCount'),
    potions: document.getElementById('potions'),
    armour: document.getElementById('armour'),
    weapons: document.getElementById('weapons'),
    lives: document.getElementById('lives'),
    roomsLeft: document.getElementById('roomsLeft')
  };

  if (elements.partyCount) elements.partyCount.innerText = hero.party;
  if (elements.allyCount) elements.allyCount.innerText = hero.allies;
  if (elements.potions) elements.potions.innerText = hero.potions;
  if (elements.armour) elements.armour.innerText = hero.armour;
  if (elements.weapons) elements.weapons.innerText = hero.weapons;
  if (elements.lives) elements.lives.innerText = hero.lives;
  if (elements.roomsLeft) elements.roomsLeft.innerText = Math.max(0, TOTAL_CELLS - hero.revealedCount);
  
  updateUserDisplay();
}

// API functions
async function registerUser(username) {
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    currentUsername = data.username || username;
    currentUserId = data.id || null;
    localStorage.setItem('dungeon_username', currentUsername);
    if (currentUserId) localStorage.setItem('dungeon_user_id', currentUserId);
    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

async function getLeaderboard() {
  try {
    const response = await fetch(`${API_BASE}/leaderboard`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.leaderboard) ? data.leaderboard : [];
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return [];
  }
}

async function submitScore(username, score) {
  try {
    const response = await fetch(`${API_BASE}/update-leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score: Number(score) })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Score submit error:', error);
    throw error;
  }
}

// Game functions - HARDER DIFFICULTY
function generateRoomTypes() {
  const rooms = [];
  // Reduced safe rooms
  for (let i = 0; i < 16; i++) rooms.push({ category: 'safe', type: 'empty' });
  for (let i = 0; i < 8; i++) rooms.push({ category: 'safe', type: 'potion' });
  for (let i = 0; i < 8; i++) rooms.push({ category: 'safe', type: 'armour' });
  for (let i = 0; i < 8; i++) rooms.push({ category: 'safe', type: 'weapon' });
  for (let i = 0; i < 6; i++) rooms.push({ category: 'safe', type: 'teammate' });
  // Increased danger rooms
  for (let i = 0; i < 9; i++) rooms.push({ category: 'danger', type: 'ogre' });
  for (let i = 0; i < 9; i++) rooms.push({ category: 'danger', type: 'goblin' });
  return shuffle(rooms);
}

function createGrid() {
  grid = [];
  const gameContainer = document.getElementById('game');
  if (!gameContainer) return;
  
  gameContainer.innerHTML = '';
  const roomTypes = generateRoomTypes();

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cellEl = document.createElement('div');
    cellEl.classList.add('cell');
    gameContainer.appendChild(cellEl);

    const room = roomTypes[i];
    grid.push({
      element: cellEl,
      revealed: false,
      category: room.category,
      type: room.type
    });

    cellEl.addEventListener('click', () => onCellClick(i));
  }

  // Reset hero stats
  hero.lives = 3;
  hero.allies = 0;
  hero.party = 1;
  hero.potions = 0;
  hero.armour = 0;
  hero.weapons = 0;
  hero.revealedCount = 0;

  gameActive = true;
  inProgress = false;
  updateUI();
}

function onCellClick(index) {
  if (!gameActive || inProgress) return;

  const cell = grid[index];
  if (cell.revealed) return;

  inProgress = true;
  try {
    revealRoom(cell);
    updateUI();
    checkVictory();
  } finally {
    inProgress = false;
  }
}

function revealRoom(cell) {
  cell.revealed = true;
  hero.revealedCount++;
  const el = cell.element;
  el.classList.add('revealed');

  if (cell.category === 'safe') {
    el.classList.add(`item-${cell.type}`);
    switch (cell.type) {
      case 'potion':
        hero.potions++;
        message('Found potion!', 'safe');
        if (hero.potions >= 3) {
          hero.potions -= 3;
          hero.lives = Math.min(hero.lives + 1, 3);
          message('3 potions used! +1 heart!', 'safe');
        }
        break;
      case 'armour':
        hero.armour++;
        message('Found armour!', 'safe');
        break;
      case 'weapon':
        hero.weapons++;
        message('Found weapon!', 'safe');
        break;
      case 'teammate':
        hero.allies++;
        hero.party++;
        message('An ally joined!', 'safe');
        break;
      default:
        message('An empty room...', 'info');
        break;
    }
    return;
  }

  // Danger/combat - ORIGINAL DIFFICULTY
  switch (cell.type) {
    case 'ogre':
      el.classList.add('enemy-ogre');
      if (hero.armour >= 1 && hero.weapons >= 1) {
        hero.armour--;
        hero.weapons--;
        message('Ogre defeated! Lost 1 armour and 1 weapon.', 'battle');
      } else if (hero.allies >= 1) {
        hero.allies--;
        hero.party--;
        message('Ogre defeated! Lost 1 ally.', 'battle');
      } else {
        hero.lives--;
        message('Ogre defeated! Lost 1 life.', 'death');
      }
      break;

    case 'goblin':
      el.classList.add('enemy-goblin');
      if (hero.armour >= 2 && hero.weapons >= 2) {
        hero.armour -= 2;
        hero.weapons -= 2;
        message('Goblin defeated! Lost 2 armour and 2 weapons.', 'battle');
      } else if (hero.allies >= 2) {
        hero.allies -= 2;
        hero.party -= 2;
        message('Goblin defeated! Lost 2 allies.', 'battle');
      } else {
        hero.lives -= 2;
        message('Goblin defeated! Lost 2 lives.', 'death');
      }
      break;
  }

  if (hero.lives <= 0) {
    message('Victor was slain...', 'death');
    revealAll();
    hero.revealedCount = TOTAL_CELLS;
    updateUI();
    gameActive = false;
    postResult({ victory: 0, defeat: 1, explored: hero.revealedCount });
  }
}

function revealAll() {
  grid.forEach((c) => {
    if (!c.revealed) {
      c.revealed = true;
      c.element.classList.add(
        'revealed',
        c.category === 'safe' ? `item-${c.type}` : `enemy-${c.type}`
      );
    }
  });
}

function checkVictory() {
  if (gameActive && hero.revealedCount >= TOTAL_CELLS && hero.lives > 0) {
    gameActive = false;
    message('Dungeon fully explored! Victory!', 'safe');
    postResult({ victory: 1, defeat: 0, explored: hero.revealedCount });
  }
}

function computeScore({ victory, defeat, explored }) {
  const bonus = victory ? 50 : 0;
  return Math.max(0, Number(explored || 0) + bonus);
}

async function postResult({ victory, defeat, explored }) {
  try {
    if (!currentUsername) {
      message('Login to submit your score.', 'info');
      showLoginModal();
      return;
    }
    const score = computeScore({ victory, defeat, explored });
    await submitScore(currentUsername, score);
    message(`Score submitted: ${score}`, 'info');
    fetchLeaderboard();
  } catch (e) {
    console.error('Score submit error:', e);
    message('Could not submit score.', 'death');
  }
}

async function fetchLeaderboard() {
  try {
    const rows = await getLeaderboard();
    const leaderboardBody = document.getElementById('leaderboardBody');
    if (!leaderboardBody) return;
    
    leaderboardBody.innerHTML = '';

    if (!rows.length) {
      leaderboardBody.innerHTML = `<tr><td colspan="2">No data</td></tr>`;
      return;
    }

    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}. ${r.username}</td>
        <td>${r.score}</td>
      `;
      leaderboardBody.appendChild(tr);
    });
  } catch (e) {
    console.error('Leaderboard error:', e);
    const leaderboardBody = document.getElementById('leaderboardBody');
    if (leaderboardBody) {
      leaderboardBody.innerHTML = `<tr><td colspan="2">Error loading leaderboard</td></tr>`;
    }
  }
}

// Modal functions
function showLoginModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function hideLoginModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  const usernameInput = document.getElementById('usernameInput');
  const loginError = document.getElementById('loginError');
  if (usernameInput) usernameInput.value = '';
  if (loginError) loginError.textContent = '';
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing...');
  
  // Clear localStorage to force fresh login
  localStorage.removeItem('dungeon_username');
  localStorage.removeItem('dungeon_user_id');
  currentUsername = null;
  currentUserId = null;
  
  // Update UI first
  updateUI();
  
  // Always show login modal at startup
  showLoginModal();
  
  // Load leaderboard
  fetchLeaderboard();
  
  // Set up event listeners
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', function() {
      if (!currentUsername) {
        message('Please login first!', 'death');
        showLoginModal();
        return;
      }
      createGrid();
      logEvent('A new descent begins.', 'info');
    });
  }

  const restartBtn = document.getElementById('restartBtn');
  if (restartBtn) {
    restartBtn.addEventListener('click', function() {
      if (!currentUsername) {
        message('Please login first!', 'death');
        showLoginModal();
        return;
      }
      createGrid();
      logEvent('Run reset.', 'info');
    });
  }

  // Login form handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const usernameInput = document.getElementById('usernameInput');
      const loginError = document.getElementById('loginError');
      const username = usernameInput?.value?.trim();
      
      if (!username) {
        if (loginError) loginError.textContent = 'Please enter a username';
        return;
      }
      
      try {
        await registerUser(username);
        updateUserDisplay();
        hideLoginModal();
        message(`Logged in as ${currentUsername}`, 'safe');
      } catch (err) {
        console.error('Login error:', err);
        if (loginError) loginError.textContent = 'Login failed. Please try again.';
      }
    });
  }

  // Leaderboard button
  const leaderboardBtn = document.getElementById('leaderboardBtn');
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', function() {
      const leaderboard = document.getElementById('leaderboard');
      if (leaderboard) {
        const isHidden = leaderboard.style.display === 'none';
        leaderboard.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          fetchLeaderboard();
        }
      }
    });
  }

  // Change user button
  const changeUserBtn = document.getElementById('changeUserBtn');
  if (changeUserBtn) {
    changeUserBtn.addEventListener('click', function() {
      showLoginModal();
    });
  }

  console.log('Initialization complete');
});

