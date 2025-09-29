const GRID_SIZE = 8;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
let grid = [];
let gameActive = false;
let inProgress = false;
let messageTimeoutId = null;
let currentUserId = localStorage.getItem("dungeon_user_id") || null;
let currentUsername = localStorage.getItem("dungeon_username") || null;

const hero = {
  lives: 3,
  allies: 0,
  party: 1,
  potions: 0,
  armour: 0,
  weapons: 0,
  revealedCount: 0
};

const gameContainer = document.getElementById("game");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restart");
const modal = document.getElementById("welcomeModal");
const messageDiv = document.getElementById("message");
const logDiv = document.getElementById("log");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const leaderboardContainer = document.getElementById("leaderboardContainer");
const leaderboardHeader = document.getElementById("leaderboardHeader");
const leaderboardContent = document.getElementById("leaderboardContent");
const leaderboardBody = document.getElementById("leaderboardBody");
const partyCountEl = document.getElementById("partyCount");
const allyCountEl = document.getElementById("allyCount");
const potionsEl = document.getElementById("potions");
const armourEl = document.getElementById("armour");
const weaponsEl = document.getElementById("weapons");
const livesEl = document.getElementById("lives");
const roomsLeftEl = document.getElementById("roomsLeft");
const currentUserDisplay = document.getElementById("currentUserDisplay");
const changeUserBtn = document.getElementById("changeUserBtn");
const loginModal = document.getElementById("loginModal");
const closeLoginModal = document.getElementById("closeLoginModal");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const loginError = document.getElementById("loginError");

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function generateRoomTypes() {
  // Adjust counts for balance
  // Fewer ogres, more armour/weapons
  const rooms = [];
  // 20 empty
  for (let i = 0; i < 20; i++) rooms.push({ category: "safe", type: "empty" });
  // 10 potion
  for (let i = 0; i < 10; i++) rooms.push({ category: "safe", type: "potion" });
  // 10 armour
  for (let i = 0; i < 10; i++) rooms.push({ category: "safe", type: "armour" });
  // 10 weapon
  for (let i = 0; i < 10; i++) rooms.push({ category: "safe", type: "weapon" });
  // 6 teammate
  for (let i = 0; i < 6; i++) rooms.push({ category: "safe", type: "teammate" });
  // 4 ogre
  for (let i = 0; i < 4; i++) rooms.push({ category: "danger", type: "ogre" });
  // 4 goblin
  for (let i = 0; i < 4; i++) rooms.push({ category: "danger", type: "goblin" });
  // Shuffle for random placement
  return shuffle(rooms);
}

function setMessage(txt) {
  if (messageTimeoutId) clearTimeout(messageTimeoutId);
  messageDiv.innerText = txt;
  messageTimeoutId = setTimeout(() => {
    if (messageTimeoutId) {
      messageDiv.innerText = "";
      messageTimeoutId = null;
    }
  }, 3000);
}

function logEvent(text, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.innerText = text;
  logDiv.prepend(entry);
}

function message(txt, type = "info") {
  if (!txt) return;
  setMessage(txt);
  logEvent(txt, type);
}

function updateUI() {
  partyCountEl.innerText = hero.party;
  allyCountEl.innerText = hero.allies;
  potionsEl.innerText = hero.potions;
  armourEl.innerText = hero.armour;
  weaponsEl.innerText = hero.weapons;
  livesEl.innerText = hero.lives;
  roomsLeftEl.innerText = Math.max(0, TOTAL_CELLS - hero.revealedCount);
  updateUserDisplay();
}

function updateUserDisplay() {
  if (currentUserDisplay) {
    currentUserDisplay.innerHTML = `User: <strong>${currentUsername || '<em>Not logged in</em>'}</strong>`;
  }
}

function createGrid() {
  grid = [];
  gameContainer.innerHTML = "";
  const roomTypes = generateRoomTypes();
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cellEl = document.createElement("div");
    cellEl.classList.add("cell");
    gameContainer.appendChild(cellEl);
    const room = roomTypes[i];
    grid.push({
      element: cellEl,
      revealed: false,
      category: room.category,
      type: room.type
    });
    cellEl.addEventListener("click", () => onCellClick(i));
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
  el.classList.add("revealed");
  if (cell.category === "safe") {
    el.classList.add(`item-${cell.type}`);
    switch (cell.type) {
      case "potion":
        hero.potions++;
        message("Found potion!", "safe");
        if (hero.potions >= 3) {
          hero.potions -= 3;
          hero.lives = Math.min(hero.lives + 1, 3);
          message("3 potions used! +1 heart!", "safe");
        }
        break;
      case "armour":
        hero.armour++;
        message("Found armour!", "safe");
        break;
      case "weapon":
        hero.weapons++;
        message("Found weapon!", "safe");
        break;
      case "teammate":
        hero.allies++;
        hero.party++;
        message("An ally joined!", "safe");
        break;
      case "empty":
        message("An empty room...", "info");
        break;
    }
    return;
  }
  // Danger/combat
  switch (cell.type) {
    case "ogre":
      el.classList.add("enemy-ogre");
      if (hero.armour >= 1 && hero.weapons >= 1) {
        hero.armour--;
        hero.weapons--;
        message("Ogre defeated! Lost 1 armour and 1 weapon.", "battle");
      } else if (hero.allies >= 1) {
        hero.allies--;
        hero.party--;
        message("Ogre defeated! Lost 1 ally.", "battle");
      } else {
        hero.lives--;
        message("Ogre defeated! Lost 1 life.", "death");
      }
      break;
    case "goblin":
      el.classList.add("enemy-goblin");
      if (hero.armour >= 2 && hero.weapons >= 2) {
        hero.armour -= 2;
        hero.weapons -= 2;
        message("Goblin defeated! Lost 2 armour and 2 weapons.", "battle");
      } else if (hero.allies >= 2) {
        hero.allies -= 2;
        hero.party -= 2;
        message("Goblin defeated! Lost 2 allies.", "battle");
      } else {
        hero.lives -= 2;
        message("Goblin defeated! Lost 2 lives.", "death");
      }
      break;
  }
  if (hero.lives <= 0) {
    message("Victor was slain...", "death");
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
        "revealed",
        c.category === "safe" ? `item-${c.type}` : `enemy-${c.type}`
      );
    }
  });
}

function checkVictory() {
  if (gameActive && hero.revealedCount >= TOTAL_CELLS && hero.lives > 0) {
    gameActive = false;
    message("Dungeon fully explored! Victory!", "safe");
    postResult({ victory: 1, defeat: 0, explored: hero.revealedCount });
  }
}

function postResult({ victory, defeat, explored }) {
  fetch('http://localhost:3000/update-leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: currentUserId || 1,
      victory,
      defeat,
      explored
    })
  }).catch(() => {});
}

if (startBtn) startBtn.addEventListener("click", () => {
  createGrid();
  if (modal) modal.classList.add("hidden");
  logEvent("A new descent begins.", "info");
});
if (restartBtn) restartBtn.addEventListener("click", () => {
  createGrid();
  logEvent("Run reset.", "info");
});

leaderboardHeader.addEventListener("click", () => {
  leaderboardContent.classList.toggle("collapsed");
  if (!leaderboardContent.classList.contains("collapsed")) {
    fetchLeaderboard();
  }
});
leaderboardBtn.addEventListener("click", () => {
  leaderboardContent.classList.toggle("collapsed");
  if (!leaderboardContent.classList.contains("collapsed")) {
    fetchLeaderboard();
  }
});

function fetchLeaderboard() {
  fetch('http://localhost:3000/leaderboard')
    .then(response => response.json())
    .then(rows => {
      leaderboardBody.innerHTML = "";
      if (!rows || !rows.length) {
        leaderboardBody.innerHTML = `<tr><td colspan='4'>No data</td></tr>`;
        return;
      }
      rows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${row.username || ''}</td><td>${row.victories || row.win || 0}</td><td>${row.defeats || row.loss || 0}</td><td>${row.explored_rooms || row.explored || 0}</td>`;
        leaderboardBody.appendChild(tr);
      });
    })
    .catch(err => {
      leaderboardBody.innerHTML = `<tr><td colspan='4'>Leaderboard error</td></tr>`;
    });
}
leaderboardContent.classList.add("collapsed");

function showLoginModal() {
  loginModal.classList.add("show");
  loginError.textContent = "";
  usernameInput.value = "";
  usernameInput.focus();
}
function hideLoginModal() {
  loginModal.classList.remove("show");
}
closeLoginModal.onclick = hideLoginModal;
changeUserBtn.onclick = showLoginModal;

loginForm.onsubmit = function(e) {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) {
    loginError.textContent = "Please enter a username.";
    return;
  }
  fetch('http://localhost:3000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.id) {
        currentUserId = String(data.id);
        currentUsername = username;
        localStorage.setItem('dungeon_user_id', currentUserId);
        localStorage.setItem('dungeon_username', currentUsername);
        updateUserDisplay();
        hideLoginModal();
        createGrid();
      } else {
        loginError.textContent = "Registration/Login failed.";
      }
    })
    .catch(() => {
      loginError.textContent = "Server error.";
    });
};

if (!currentUserId || !currentUsername) {
  showLoginModal();
}
updateUserDisplay();

