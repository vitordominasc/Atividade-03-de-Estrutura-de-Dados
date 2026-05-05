/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */
const BOSS_ID = 150; // Mewtwo
const POKEAPI = "https://pokeapi.co/api/v2/pokemon/";
const MAX_QUEUE = 8;
const REFILL_THRESHOLD = 3;
const BATTLE_DISPLAY_TIME = 2800; // ms

const TRAINER_NAMES = [
  "Ash", "Misty", "Brock", "Gary", "Giovanni", "Erika",
  "Sabrina", "Koga", "Surge", "Blaine", "Lorelei",
  "Bruno", "Agatha", "Lance", "Red", "Blue"
];

const TYPE_COLORS = {
  fire: "#F08030", water: "#6890F0", grass: "#78C850",
  electric: "#F8D030", psychic: "#F85888", normal: "#A8A878",
  fighting: "#C03028", flying: "#A890F0", poison: "#A040A0",
  ground: "#E0C068", rock: "#B8A038", bug: "#A8B820",
  ghost: "#705898", ice: "#98D8D8", dragon: "#7038F8",
  dark: "#705848", steel: "#B8B8D0", fairy: "#EE99AC"
};

/* ============================================================
   ESTADO
   ============================================================ */
let boss = null;
let queue = [];
let bossKills = 0;
let isBattling = false;

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getSprite(pokemon) {
  const official = pokemon.sprites?.other?.["official-artwork"]?.front_default;
  return official || pokemon.sprites?.front_default || "";
}

function getStatTotal(pokemon) {
  return pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
}

function getTypes(pokemon) {
  return pokemon.types.map(t => t.type.name);
}

function renderTypeBadges(types) {
  return types.map(t => {
    const color = TYPE_COLORS[t] || "#888";
    return `<span class="type-badge" style="background:${color}">${t.toUpperCase()}</span>`;
  }).join("");
}

/* ============================================================
   FETCH POKEMON
   ============================================================ */
async function fetchPokemon(id) {
  const res = await fetch(`${POKEAPI}${id}`);
  if (!res.ok) throw new Error(`Erro ao buscar Pokemon #${id}`);
  return res.json();
}

/* ============================================================
   RENDERIZAR FILA
   ============================================================ */
function renderQueue() {
  const list = document.getElementById("challenger-list");
  const countEl = document.getElementById("queue-count");

  countEl.textContent = `${queue.length}/${MAX_QUEUE}`;

  list.innerHTML = "";
  queue.forEach((challenger, i) => {
    const li = document.createElement("li");
    li.className = "challenger-card";
    li.setAttribute("data-testid", `card-challenger-${i}`);
    li.innerHTML = `
      <span class="challenger-position pixel-font">${i + 1}</span>
      <img class="challenger-sprite" src="${challenger.sprite}" alt="${challenger.pokemonName}" />
      <div class="challenger-info">
        <div class="challenger-trainer">${challenger.trainerName}</div>
        <div class="challenger-pokemon">${capitalize(challenger.pokemonName)}</div>
        <div class="type-badges">${renderTypeBadges(challenger.types)}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

/* ============================================================
   GERAR DESAFIANTE
   ============================================================ */
async function generateChallenger() {
  const id = randomInt(1, 151);
  const pokemon = await fetchPokemon(id);
  return {
    trainerName: randomItem(TRAINER_NAMES),
    pokemonName: pokemon.name,
    sprite: getSprite(pokemon),
    types: getTypes(pokemon),
    statTotal: getStatTotal(pokemon)
  };
}

async function addChallengers(count) {
  const promises = Array.from({ length: count }, () => generateChallenger());
  const results = await Promise.all(promises);
  queue.push(...results);
  renderQueue();
}

/* ============================================================
   RENDERIZAR BOSS
   ============================================================ */
function renderBoss() {
  document.getElementById("boss-loading").classList.add("hidden");
  const content = document.getElementById("boss-content");
  content.classList.remove("hidden");

  document.getElementById("boss-sprite").src = getSprite(boss);
  document.getElementById("boss-name").textContent = capitalize(boss.name);
  document.getElementById("boss-types").innerHTML = renderTypeBadges(getTypes(boss));
  document.getElementById("boss-bst").textContent = `BST: ${getStatTotal(boss)}`;
  document.getElementById("boss-kills").textContent = bossKills;
}

function updateBossKills() {
  document.getElementById("boss-kills").textContent = bossKills;
}

/* ============================================================
   BATALHA
   ============================================================ */
function showBattleActive(challenger) {
  document.getElementById("battle-idle").classList.add("hidden");
  document.getElementById("battle-result").classList.add("hidden");

  const active = document.getElementById("battle-active");
  active.classList.remove("hidden");

  // Desafiante
  document.getElementById("battle-challenger-sprite").src = challenger.sprite;
  document.getElementById("battle-challenger-pokemon").textContent = capitalize(challenger.pokemonName);
  document.getElementById("battle-challenger-trainer").textContent = `Treinador: ${challenger.trainerName}`;
  document.getElementById("battle-challenger-types").innerHTML = renderTypeBadges(challenger.types);
  document.getElementById("battle-challenger-bst").textContent = `BST: ${challenger.statTotal}`;

  // Chefe
  document.getElementById("battle-boss-sprite").src = getSprite(boss);
  document.getElementById("battle-boss-name").textContent = capitalize(boss.name);
  document.getElementById("battle-boss-types").innerHTML = renderTypeBadges(getTypes(boss));
  document.getElementById("battle-boss-bst").textContent = `BST: ${getStatTotal(boss)}`;
}

function showBattleResult(victory) {
  const resultEl = document.getElementById("battle-result");
  const resultText = document.getElementById("result-text");

  resultEl.classList.remove("hidden");
  resultEl.classList.add("shake");
  setTimeout(() => resultEl.classList.remove("shake"), 600);

  if (victory) {
    resultText.textContent = "VITORIA!";
    resultText.className = "pixel-font result-text result-vitoria";
  } else {
    resultText.textContent = "DERROTA!";
    resultText.className = "pixel-font result-text result-derrota";
    bossKills++;
    updateBossKills();
  }
}

function resetBattlePanel() {
  document.getElementById("battle-active").classList.add("hidden");
  document.getElementById("battle-result").classList.add("hidden");
  document.getElementById("battle-idle").classList.remove("hidden");
}

async function startBattle() {
  if (isBattling || queue.length === 0) return;

  isBattling = true;
  updateBattleButton();

  const challenger = queue.shift();
  renderQueue();

  // Mostrar batalha
  showBattleActive(challenger);

  // Calcular resultado depois de 1.2s (suspense)
  await sleep(1200);

  const bossStatTotal = getStatTotal(boss);
  const winChance = challenger.statTotal / (challenger.statTotal + bossStatTotal);
  const victory = Math.random() < winChance;

  showBattleResult(victory);

  // Repor fila se necessário (em segundo plano)
  if (queue.length < REFILL_THRESHOLD) {
    addChallengers(2);
  }

  // Limpar após exibição
  await sleep(BATTLE_DISPLAY_TIME);
  resetBattlePanel();

  isBattling = false;
  updateBattleButton();
}

function updateBattleButton() {
  const btn = document.getElementById("battle-btn");
  if (isBattling) {
    btn.disabled = true;
    btn.textContent = "BATALHA...";
    return;
  }
  if (queue.length === 0) {
    btn.disabled = true;
    btn.textContent = "FILA VAZIA!";
    return;
  }
  btn.disabled = false;
  btn.textContent = "BATALHAR";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ============================================================
   INICIALIZAR
   ============================================================ */
async function init() {
  const btn = document.getElementById("battle-btn");
  btn.disabled = true;

  // Carregar boss e desafiantes em paralelo
  const [bossData] = await Promise.all([
    fetchPokemon(BOSS_ID),
    addChallengers(6)
  ]);

  boss = bossData;
  renderBoss();
  updateBattleButton();

  btn.addEventListener("click", startBattle);
}

init();
