// ----------------------
// Config
// ----------------------
const API_BASE = 'https://victors-descent-backend.onrender.com';

// ----------------------
// State
// ----------------------
const GRID_SIZE = 8;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

let grid = [];
let gameActive = false;
let inProgress = false;
let messageTimeoutId = null;

let currentUserId = localStorage.getItem('dungeon_user_id') || null;
let currentUsername = localStorage.getItem('dungeon_username') || null;

const hero = {
  lives: 3,
  allies: 0,
  party: 1,
  potions: 0,
  armour: 0,
  weapons: 0,
  revealedCount: 0
};

// ----------------------
// DOM
// ----------------------
const gameContainer = document.getElementById('game');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restart');

const messageDiv = document.getElementById('message');
const logDiv = document.getElementById('log');

const leaderboardBtn = document.getElementById('leaderboardBtn');
const leaderboardContainer = document.getElementById('leaderboardContainer');
const leaderboardHeader = document.getElementById('leaderboardHeader');
const leaderboardContent = document.getElementById('leaderboardContent');
const leaderboardBody = document.getElementById('leaderboardBody');

const partyCountEl = document.getElementById('partyCount');
const allyCountEl = document.getElementById('allyCount');
const potionsEl = document.getElementById('potions');
const armourEl = document.getElementById('armour');
const weaponsEl = document.getElementById('weapons');
const livesEl = document.getElementById('lives');
const roomsLeftEl = document.getElementById('roomsLeft');

const currentUserDisplay = document.getElementById('currentUserDisplay');
const changeUserBtn = document.getElementById('changeUserBtn');

// Login/welcome modal elements
const modal = document.getElementById('welcomeModal');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const loginError = document.getElementById('loginError');

// ----------------------
// Utilities
// ----------------------
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setMessage(txt) {
  if (messageTimeoutId) clearTimeout(messageTimeoutId);
  if (messageDiv) messageDiv.innerText = txt || '';
  messageTimeoutId = setTimeout(() => {
    if (messageDiv) messageDiv.innerText = '';
    messageTimeoutId = null;
  }, 3000);
}

function logEvent(text, type = 'info') {
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
  if (currentUserDisplay) {
    currentUserDisplay.innerHTML = `User: ${currentUsername || 'Not logged in'}`;
  }
}

function updateUI() {
  if (partyCountEl) partyCountEl.innerText = hero.party;
  if (allyCountEl) allyCountEl.innerText = hero.allies;
  if (potionsEl) potionsEl.innerText = hero.potions;
  if (armourEl) armourEl.innerText = hero.armour;
  if (weaponsEl) weaponsEl.innerText = hero.weapons;
  if (livesEl) livesEl.innerText = hero.lives;
  if (roomsLeftEl) roomsLeftEl.innerText = Math.max(0, TOTAL_CELLS - hero.revealedCount);
  updateUserDisplay();
}

// ----------------------
// API helpers
// ----------------------
async function api(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    
    const text = await res.text();
    let json;
    try { 
      json = text ? JSON.parse(text) : {}; 
    } catch { 
      json = {}; 
    }
    
    if (!res.ok) {
      const err = new Error(json?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

// POST /register { username }
async function registerUser(username) {
  const data = await api('/register', {
    method: 'POST',
    body: JSON.stringify({ username })
  });
  
  currentUsername = data.username || username;
  currentUserId = data.id || null;
  localStorage.setItem('dungeon_username', currentUsername);
  if (currentUserId) localStorage.setItem('dungeon_user_id', currentUserId);
  return data;
}

// GET /leaderboard => { leaderboard: [{ username, score }, ...] }
async function getLeaderboard() {
  const data = await api('/leaderboard');
  return Array.isArray(data.leaderboard) ? data.leaderboard : [];
}

// POST /update-leaderboard { username, score }
async function submitScore(username, score) {
  const payload = { username, score: Number(score) };
  return api('/update-leaderboard', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// ----------------------
// Game generation
// ----------------------
function generateRoomTypes() {
  const rooms = [];
  for (let i = 0; i < 20; i++) rooms.push({ category: 'safe', type: 'empty' });
  for (let i = 0; i < 10; i++) rooms.push({ category: 'safe', type: 'potion' });
  for (let i = 0; i < 10; i++) rooms.push({ category: 'safe', type: 'armour' });
  for (let i = 0; i < 10; i++) rooms.push({ category: 'safe', type: 'weapon' });
  for (let i = 0; i < 6; i++) rooms.push({ category: 'safe', type: 'teammate' });
  for (let i = 0; i < 4; i++) rooms.push({ category: 'danger', type: 'ogre' });
  for (let i = 0; i < 4; i++) rooms.push({ category: 'danger', type: 'goblin' });
  return shuffle(rooms);
}

function createGrid() {
  grid = [];
  if (gameContainer) gameContainer.innerHTML = '';

  const roomTypes = generateRoomTypes();

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cellEl = document.createElement('div');
    cellEl.classList.add('cell');
    if (gameContainer) gameContainer.appendChild(cellEl);

    const room = roomTypes[i];
    grid.push({
      element: cellEl,
      revealed: false,
      category: room.category,
      type: room.type
    });

    cellEl.addEventListener('click', () => onCellClick(i));
  }

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

  // Danger/combat
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

// ----------------------
// Results -> Leaderboard
// ----------------------
function computeScore({ victory, defeat, explored }) {
  const bonus = victory ? 50 : 0;
  return Math.max(0, Number(explored || 0) + bonus);
}

async function postResult({ victory, defeat, explored }) {
  try {
    if (!currentUsername) {
      message('Login to submit your score.', 'info');
      return;
    }
    const score = computeScore({ victory, defeat, explored });
    await submitScore(currentUsername, score);
    message(`Score submitted: ${score}`, 'info');
    fetchLeaderboard(); // refresh table after submit
  } catch (e) {
    console.error('Score submit error:', e);
    message('Could not submit score.', 'death');
  }
}

async function fetchLeaderboard() {
  try {
    const rows = await getLeaderboard();
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
    if (leaderboardBody) {
      leaderboardBody.innerHTML = `<tr><td colspan="2">Leaderboard error</td></tr>`;
    }
  }
}

// ----------------------
// Auth / Login UI
// ----------------------
function openLoginModal() {
  if (modal) modal.classList.remove('hidden');
  if (loginModal) loginModal.classList.remove('hidden');
  if (loginError) loginError.innerText = '';
}

function closeLoginModal() {
  if (modal) modal.classList.add('hidden');
  if (loginModal) loginModal.classList.add('hidden');
  if (usernameInput) usernameInput.value = '';
  if (loginError) loginError.innerText = '';
}

// ----------------------
// Events
// ----------------------
if (startBtn) {
  startBtn.addEventListener('click', () => {
    createGrid();
    logEvent('A new descent begins.', 'info');
  });
}

if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    createGrid();
    logEvent('Run reset.', 'info');
  });
}

if (changeUserBtn) {
  changeUserBtn.addEventListener('click', openLoginModal);
}

if (closeLoginModal) {
  closeLoginModal.addEventListener('click', closeLoginModal);
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (usernameInput?.value || '').trim();
    if (!username) {
      if (loginError) loginError.innerText = 'Username required';
      return;
    }
    try {
      await registerUser(username);
      updateUserDisplay();
      closeLoginModal();
      message(`Logged in as ${currentUsername}`, 'safe');
    } catch (err) {
      console.error('Register error:', err);
      if (loginError) loginError.innerText = 'Server error. Please try again.';
    }
  });
}

if (leaderboardHeader) {
  leaderboardHeader.addEventListener('click', () => {
    if (leaderboardContent) {
      leaderboardContent.classList.toggle('collapsed');
      if (!leaderboardContent.classList.contains('collapsed')) {
        fetchLeaderboard();
      }
    }
  });
}

if (leaderboardBtn) {
  leaderboardBtn.addEventListener('click', () => {
    if (leaderboardContent) {
      leaderboardContent.classList.toggle('collapsed');
      if (!leaderboardContent.classList.contains('collapsed')) {
        fetchLeaderboard();
      }
    }
  });
}

// ----------------------
// Initialization
// ----------------------
document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  
  // Show login modal if no user is logged in
  if (!currentUsername) {
    openLoginModal();
  }
  
  // Load leaderboard on startup
  fetchLeaderboard();
});

// Fallback initialization if DOMContentLoaded already fired
if (document.readyState === 'loading') {
  // DOMContentLoaded listener above will handle this
} else {
  // DOM already loaded
  updateUI();
  if (!currentUsername) {
    openLoginModal();
  }
  fetchLeaderboard();
}

