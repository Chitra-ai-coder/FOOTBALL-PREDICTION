const BALL_SIZE = 28; // Must match your .ball CSS width/height

// Player names
const messiTeamNames = [
  "Messi", "A. Alba", "G. Piqué", "S. Busquets", "F. De Jong",
  "A. Griezmann", "A. Fati", "R. Puig", "M. Ter Stegen", "O. Dembele", "M. Pedri"
];

const ronaldoTeamNames = [
  "Ronaldo", "D. Silva", "P. Pogba", "L. Modric", "E. Hazard",
  "K. Benzema", "J. Cancelo", "B. Fernandes", "M. Courtois", "T. Kroos", "M. Valverde"
];

// Generate random position inside field (x: 40..860, y: 40..460)
function randomPosition() {
  return {
    x: 40 + Math.random() * 820,
    y: 40 + Math.random() * 420,
  };
}

// Setup players with initial random positions and team class
function setupPlayers(names, teamClass) {
  return names.map(name => {
    const pos = randomPosition();
    return { name, x: pos.x, y: pos.y, teamClass };
  });
}

const messiPlayers = setupPlayers(messiTeamNames, "messi");
const ronaldoPlayers = setupPlayers(ronaldoTeamNames, "ronaldo");

// Combined player list for convenience
let allPlayers = [...messiPlayers, ...ronaldoPlayers];

// Goals positions and size
const goalLeft = { name: "Goal_Left", x: 10, y: 250 };    // near left goalpost center
const goalRight = { name: "Goal_Right", x: 890, y: 250 }; // near right goalpost center

const field = document.getElementById("field");
const lineCanvas = document.getElementById("line-canvas");
const ctx = lineCanvas.getContext("2d");

const playerSelect = document.getElementById("player-select");
const findPathBtn = document.getElementById("find-path-btn");
const outputDiv = document.getElementById("output");

let selectedPlayerName = null;
let lastPath = null;

// Render players to field
function renderPlayers(players) {
  // Remove old players
  document.querySelectorAll(".player").forEach(el => el.remove());

  players.forEach(player => {
    const div = document.createElement("div");
    div.classList.add("player", player.teamClass);
    div.style.left = (player.x - 20) + "px";
    div.style.top = (player.y - 20) + "px";
    div.textContent = player.name.length > 8 ? player.name.slice(0, 6) + "…" : player.name;
    div.title = player.name;
    div.dataset.name = player.name;
    field.appendChild(div);
  });

  makePlayersDraggable();
}

// Render player lists as tables
function renderPlayerLists() {
  const messiListDiv = document.getElementById("messi-list");
  const ronaldoListDiv = document.getElementById("ronaldo-list");

  messiListDiv.innerHTML = `
    <table>
      <tr><th>Messi Team</th></tr>
      ${messiTeamNames.map(name => `<tr><td>${name}</td></tr>`).join("")}
    </table>
  `;
  ronaldoListDiv.innerHTML = `
    <table>
      <tr><th>Ronaldo Team</th></tr>
      ${ronaldoTeamNames.map(name => `<tr><td>${name}</td></tr>`).join("")}
    </table>
  `;
}

// Highlight selected player in table
function highlightSelectedPlayerInTable(name) {
  document.querySelectorAll('.player-list td').forEach(td => {
    if (td.textContent === name) {
      td.classList.add('selected-player');
    } else {
      td.classList.remove('selected-player');
    }
  });
}

// Populate select dropdown
function populateSelect(players) {
  playerSelect.innerHTML = "";
  players.forEach(p => {
    const option = document.createElement("option");
    option.value = p.name;
    option.textContent = `${p.name} (${p.teamClass})`;
    playerSelect.appendChild(option);
  });
}

// Make players draggable and selectable
let draggingPlayerDiv = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function makePlayersDraggable() {
  document.querySelectorAll(".player").forEach(div => {
    div.onmousedown = e => {
      draggingPlayerDiv = div;
      draggingPlayerDiv.classList.add("dragging");
      const rect = draggingPlayerDiv.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    };

    div.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll(".player.selected").forEach(el => el.classList.remove("selected"));
      div.classList.add("selected");
      selectedPlayerName = div.dataset.name;
      playerSelect.value = selectedPlayerName;
      outputDiv.textContent = "";
      lastPath = null;
      clearCanvas();
      document.getElementById("animated-ball").style.display = "none";
      highlightSelectedPlayerInTable(selectedPlayerName);
    };
  });
}

// Drag move handling
document.addEventListener("mousemove", e => {
  if (!draggingPlayerDiv) return;

  const fieldRect = field.getBoundingClientRect();
  let newX = e.clientX - fieldRect.left - dragOffsetX + 20;
  let newY = e.clientY - fieldRect.top - dragOffsetY + 20;

  // Clamp inside field bounds
  newX = Math.min(Math.max(newX, 20), field.clientWidth - 20);
  newY = Math.min(Math.max(newY, 20), field.clientHeight - 20);

  draggingPlayerDiv.style.left = (newX - 20) + "px";
  draggingPlayerDiv.style.top = (newY - 20) + "px";

  // Update player position in data
  const name = draggingPlayerDiv.dataset.name;
  const player = allPlayers.find(p => p.name === name);
  if (player) {
    player.x = newX;
    player.y = newY;
  }

  // Redraw path if dragging the selected player and path exists
  if (draggingPlayerDiv.classList.contains("selected") && lastPath) {
    clearCanvas();
    drawPath(lastPath);
    document.getElementById("animated-ball").style.display = "none";
  }
});

document.addEventListener("mouseup", e => {
  if (draggingPlayerDiv) {
    draggingPlayerDiv.classList.remove("dragging");
    draggingPlayerDiv = null;
  }
});

// Clear canvas helper
function clearCanvas() {
  ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
}

// Draw line helper
function drawLine(x1, y1, x2, y2, color = "yellow", width = 4) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Distance helper
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Build graph for all players of the selected team + goal
function buildGraph(players, goalNode, teamClass) {
  const teamPlayers = players.filter(p => p.teamClass === teamClass);
  const graph = {};
  teamPlayers.forEach(p => { graph[p.name] = []; });
  graph[goalNode.name] = [];
  for (let i = 0; i < teamPlayers.length; i++) {
    for (let j = 0; j < teamPlayers.length; j++) {
      if (i !== j) {
        const dist = distance(teamPlayers[i], teamPlayers[j]);
        if (dist < 400) {
          graph[teamPlayers[i].name].push({ to: teamPlayers[j].name, weight: dist });
        }
      }
    }
  }
  teamPlayers.forEach(p => {
    const distToGoal = distance(p, goalNode);
    if (distToGoal < 400) {
      graph[p.name].push({ to: goalNode.name, weight: distToGoal });
    }
  });
  return graph;
}

// Dijkstra shortest path algorithm
function dijkstra(graph, start, end) {
  const distances = {};
  const prev = {};
  const nodes = new Set(Object.keys(graph));
  for (const node in graph) {
    distances[node] = Infinity;
    prev[node] = null;
  }
  distances[start] = 0;
  while (nodes.size > 0) {
    let current = null;
    let minDist = Infinity;
    for (const node of nodes) {
      if (distances[node] < minDist) {
        minDist = distances[node];
        current = node;
      }
    }
    if (current === end || minDist === Infinity) break;
    nodes.delete(current);
    for (const neighbor of graph[current]) {
      const alt = distances[current] + neighbor.weight;
      if (alt < distances[neighbor.to]) {
        distances[neighbor.to] = alt;
        prev[neighbor.to] = current;
      }
    }
  }
  const path = [];
  let u = end;
  while (u) {
    path.unshift(u);
    u = prev[u];
    if (u === start) {
      path.unshift(start);
      break;
    }
  }
  if (path[0] !== start) return null;
  return path;
}

// Draw path lines on canvas
function drawPath(path) {
  if (!path || path.length < 2) return;
  for (let i = 0; i < path.length - 1; i++) {
    const fromName = path[i];
    const toName = path[i + 1];
    let fromNode, toNode;
    if (fromName === goalLeft.name) fromNode = goalLeft;
    else if (fromName === goalRight.name) fromNode = goalRight;
    else fromNode = allPlayers.find(p => p.name === fromName);
    if (toName === goalLeft.name) toNode = goalLeft;
    else if (toName === goalRight.name) toNode = goalRight;
    else toNode = allPlayers.find(p => p.name === toName);
    if (fromNode && toNode) {
      drawLine(fromNode.x, fromNode.y, toNode.x, toNode.y);
    }
  }
}

// Animate ball along path, perfectly centered
function animateBallAlongPath(path, speed = 3) {
  const ball = document.getElementById("animated-ball");
  if (!path || path.length < 2) return;
  const positions = path.map(name => {
    if (name === goalLeft.name) return { x: goalLeft.x, y: goalLeft.y };
    if (name === goalRight.name) return { x: goalRight.x, y: goalRight.y };
    const player = allPlayers.find(p => p.name === name);
    return player ? { x: player.x, y: player.y } : null;
  }).filter(Boolean);
  ball.style.display = "block";
  ball.style.left = (positions[0].x - BALL_SIZE / 2) + "px";
  ball.style.top = (positions[0].y - BALL_SIZE / 2) + "px";
  let step = 0;
  function moveToNext() {
    if (step >= positions.length - 1) {
      ball.style.left = (positions[positions.length - 1].x - BALL_SIZE / 2) + "px";
      ball.style.top = (positions[positions.length - 1].y - BALL_SIZE / 2) + "px";
      return;
    }
    const from = positions[step];
    const to = positions[step + 1];
    let progress = 0;
    const frames = Math.max(10, Math.floor(distance(from, to) / speed));
    function animateFrame() {
      progress++;
      const t = progress / frames;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      ball.style.left = (x - BALL_SIZE / 2) + "px";
      ball.style.top = (y - BALL_SIZE / 2) + "px";
      if (progress < frames) {
        requestAnimationFrame(animateFrame);
      } else {
        step++;
        moveToNext();
      }
    }
    animateFrame();
  }
  moveToNext();
}

// Initialize
function init() {
  renderPlayers(allPlayers);
  populateSelect(allPlayers);
  renderPlayerLists();

  // Select first player by default
  if (allPlayers.length > 0) {
    selectedPlayerName = allPlayers[0].name;
    playerSelect.value = selectedPlayerName;
    document.querySelectorAll(".player").forEach(div => {
      if (div.dataset.name === selectedPlayerName) div.classList.add("selected");
      else div.classList.remove("selected");
    });
    highlightSelectedPlayerInTable(selectedPlayerName);
  }
}

// Select player from dropdown change
playerSelect.onchange = () => {
  selectedPlayerName = playerSelect.value;
  document.querySelectorAll(".player").forEach(div => {
    if (div.dataset.name === selectedPlayerName) div.classList.add("selected");
    else div.classList.remove("selected");
  });
  outputDiv.textContent = "";
  lastPath = null;
  clearCanvas();
  document.getElementById("animated-ball").style.display = "none";
  highlightSelectedPlayerInTable(selectedPlayerName);
};

// Find path button click
findPathBtn.onclick = () => {
  if (!selectedPlayerName) {
    outputDiv.textContent = "Please select a player first.";
    return;
  }
  const startPlayer = allPlayers.find(p => p.name === selectedPlayerName);
  if (!startPlayer) {
    outputDiv.textContent = "Selected player not found.";
    return;
  }
  const opponentGoal = startPlayer.teamClass === "messi" ? goalRight : goalLeft;
  const graph = buildGraph(allPlayers, opponentGoal, startPlayer.teamClass);
  const path = dijkstra(graph, startPlayer.name, opponentGoal.name);
  if (!path) {
    outputDiv.textContent = "No path found to opponent's goal.";
    clearCanvas();
    lastPath = null;
    document.getElementById("animated-ball").style.display = "none";
    return;
  }
  lastPath = path;
  outputDiv.textContent = "Path: " + path.join(" → ");
  clearCanvas();
  drawPath(path);
  animateBallAlongPath(path);
};

// Click outside players clears selection
field.onclick = () => {
  selectedPlayerName = null;
  document.querySelectorAll(".player.selected").forEach(el => el.classList.remove("selected"));
  playerSelect.value = "";
  outputDiv.textContent = "";
  lastPath = null;
  clearCanvas();
  document.getElementById("animated-ball").style.display = "none";
  highlightSelectedPlayerInTable("");
};

// Run initialization
init();