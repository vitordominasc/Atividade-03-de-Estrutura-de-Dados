(function () {
  "use strict";

  // ====================== Fila FIFO encadeada ======================
  /**
   * Fila implementada como lista encadeada simples com ponteiros para
   * o início (head) e o fim (tail). Operações:
   *   - enqueue(value): O(1)  — insere no fim
   *   - dequeue():      O(1)  — remove do início
   *   - peek():         O(1)  — espia o primeiro
   *   - removeById(id): O(n)  — remoção pontual (pacote no meio da fila)
   *   - toArray():      O(n)  — usado apenas na renderização
   */
  function LinkedQueue() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }
  LinkedQueue.prototype.enqueue = function (value) {
    const node = { value, next: null };
    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
    this.length++;
  };
  LinkedQueue.prototype.dequeue = function () {
    if (!this.head) return null;
    const node = this.head;
    this.head = node.next;
    if (!this.head) this.tail = null;
    this.length--;
    return node.value;
  };
  LinkedQueue.prototype.peek = function () {
    return this.head ? this.head.value : null;
  };
  LinkedQueue.prototype.removeById = function (id) {
    let prev = null;
    let curr = this.head;
    while (curr) {
      if (curr.value.id === id) {
        if (prev) prev.next = curr.next;
        else this.head = curr.next;
        if (curr === this.tail) this.tail = prev;
        this.length--;
        return curr.value;
      }
      prev = curr;
      curr = curr.next;
    }
    return null;
  };
  LinkedQueue.prototype.toArray = function () {
    const out = [];
    let curr = this.head;
    while (curr) {
      out.push(curr.value);
      curr = curr.next;
    }
    return out;
  };
  LinkedQueue.prototype.fromArray = function (arr) {
    this.head = this.tail = null;
    this.length = 0;
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) this.enqueue(arr[i]);
  };

  // ====================== Estado e persistência ======================
  const STORAGE_KEY = "transportadora.state.v1";

  const state = {
    /** @type {LinkedQueue} */
    queue: new LinkedQueue(),
    /** @type {Array<Delivery>} */
    history: [],
  };
  let pendingRecipient = null; // dados gerados antes de adicionar à fila

  loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state.queue.fromArray(parsed.queue);
      state.history = Array.isArray(parsed.history) ? parsed.history : [];
    } catch (err) {
      console.warn("Falha ao carregar estado:", err);
    }
  }

  function saveState() {
    try {
      const snapshot = {
        queue: state.queue.toArray(),
        history: state.history,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("Falha ao salvar estado:", err);
    }
  }

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ====================== Elementos ======================
  const els = {
    // Generator
    btnGenerate: document.getElementById("btn-generate"),
    btnRegenerate: document.getElementById("btn-regenerate"),
    btnCancel: document.getElementById("btn-cancel"),
    formPackage: document.getElementById("form-package"),
    inputName: document.getElementById("input-name"),
    inputAddress: document.getElementById("input-address"),
    generatorEmpty: document.getElementById("generator-empty"),
    generatorLoading: document.getElementById("generator-loading"),
    generatorPreview: document.getElementById("generator-preview"),

    // Queue
    queueList: document.getElementById("queue-list"),
    queueEmpty: document.getElementById("queue-empty"),
    queueCount: document.getElementById("queue-count"),

    // History
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty"),
    statTotal: document.getElementById("stat-total"),
    statAvg: document.getElementById("stat-avg"),
    btnClearHistory: document.getElementById("btn-clear-history"),

    // Toast
    toast: document.getElementById("toast"),
    toastTitle: document.getElementById("toast-title"),
    toastText: document.getElementById("toast-text"),
  };

  // ====================== API pública (randomuser.me) ======================
  async function fetchRandomRecipient() {
    const res = await fetch("https://randomuser.me/api/?nat=br&inc=name,location");
    if (!res.ok) throw new Error("Resposta inesperada da API");
    const data = await res.json();
    const u = data.results && data.results[0];
    if (!u) throw new Error("Sem resultado");

    const name = `${u.name.first} ${u.name.last}`;
    const loc = u.location;
    const street =
      typeof loc.street === "object"
        ? `${loc.street.name}, ${loc.street.number}`
        : String(loc.street || "");
    const address = `${street} — ${loc.city}, ${loc.state} — CEP ${loc.postcode}`;

    return { name, address };
  }

  // ====================== Handlers do gerador ======================
  function showGeneratorState(which) {
    els.generatorEmpty.classList.toggle("hidden", which !== "empty");
    els.generatorLoading.classList.toggle("hidden", which !== "loading");
    els.generatorPreview.classList.toggle("hidden", which !== "preview");
  }

  async function generateRecipient() {
    showGeneratorState("loading");
    try {
      const recipient = await fetchRandomRecipient();
      pendingRecipient = recipient;
      els.inputName.value = recipient.name;
      els.inputAddress.value = recipient.address;
      showGeneratorState("preview");
      els.inputName.focus();
      els.inputName.select();
    } catch (err) {
      console.error(err);
      showGeneratorState("empty");
      showToast(
        "Falha ao gerar destinatário",
        "Não foi possível buscar dados. Tente novamente.",
        "error"
      );
    }
  }

  function cancelGenerator() {
    pendingRecipient = null;
    els.formPackage.reset();
    showGeneratorState("empty");
  }

  function handleAddPackage(event) {
    event.preventDefault();
    const name = els.inputName.value.trim();
    const address = els.inputAddress.value.trim();
    if (!name || !address) return;

    /** @type {Package} */
    const pkg = {
      id: uid(),
      name,
      address,
      createdAt: Date.now(),
    };

    state.queue.enqueue(pkg);
    saveState();
    render();
    cancelGenerator();
    showToast("Pacote adicionado", `${name} entrou na fila.`, "info");
  }

  // ====================== Handlers da fila ======================
  function deliverNext() {
    const pkg = state.queue.dequeue();
    if (!pkg) return;
    /** @type {Delivery} */
    const delivery = {
      ...pkg,
      deliveredAt: Date.now(),
    };
    state.history.unshift(delivery);
    saveState();
    render();
    showToast(
      "Pacote entregue",
      `Entregue para ${delivery.name} em ${delivery.address}`,
      "success"
    );
  }

  function removeFromQueue(id) {
    const removed = state.queue.removeById(id);
    if (!removed) return;
    saveState();
    render();
  }

  function clearHistory() {
    if (state.history.length === 0) return;
    const ok = confirm("Deseja limpar todo o histórico de entregas?");
    if (!ok) return;
    state.history = [];
    saveState();
    render();
  }

  // ====================== Renderização ======================
  function render() {
    renderQueue();
    renderHistory();
  }

  function renderQueue() {
    const len = state.queue.length;
    els.queueCount.textContent = `${len} ${len === 1 ? "pendente" : "pendentes"}`;

    if (len === 0) {
      els.queueList.classList.add("hidden");
      els.queueEmpty.classList.remove("hidden");
      els.queueList.innerHTML = "";
      return;
    }

    els.queueEmpty.classList.add("hidden");
    els.queueList.classList.remove("hidden");

    const items = state.queue.toArray();
    els.queueList.innerHTML = items
      .map((pkg, i) => renderQueueItem(pkg, i))
      .join("");

    // Bind: deliver button (só no primeiro)
    const deliverBtn = els.queueList.querySelector("[data-action='deliver']");
    if (deliverBtn) {
      deliverBtn.addEventListener("click", deliverNext);
    }

    // Bind: remove buttons
    els.queueList.querySelectorAll("[data-action='remove']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (id) removeFromQueue(id);
      });
    });
  }

  function renderQueueItem(pkg, index) {
    const isNext = index === 0;
    const tag = isNext ? "Próximo a entregar" : `Posição #${index + 1}`;
    const created = new Date(pkg.createdAt);
    const timeStr = formatTime(created);
    const waited = formatRelativeMinutes(Date.now() - pkg.createdAt);

    const action = isNext
      ? `<button class="btn-deliver" data-action="deliver">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
             <polyline points="20 6 9 17 4 12"/>
           </svg>
           Entregar
         </button>`
      : `<button class="btn-remove" data-action="remove" data-id="${escapeHtml(pkg.id)}">Remover</button>`;

    return `
      <li class="queue-item ${isNext ? "is-next" : ""}">
        <div class="queue-position">${index + 1}</div>
        <div class="queue-info">
          <span class="queue-tag">${tag}</span>
          <div class="queue-name">${escapeHtml(pkg.name)}</div>
          <div class="queue-address">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${escapeHtml(pkg.address)}</span>
          </div>
          <div class="queue-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Adicionado às ${timeStr} · esperando há ${waited}</span>
          </div>
        </div>
        <div class="queue-actions">${action}</div>
      </li>
    `;
  }

  function renderHistory() {
    const h = state.history;
    els.statTotal.textContent = String(h.length);
    els.statAvg.textContent = h.length > 0 ? averageWait(h) : "—";

    if (h.length === 0) {
      els.historyList.classList.add("hidden");
      els.historyEmpty.classList.remove("hidden");
      els.btnClearHistory.classList.add("hidden");
      els.historyList.innerHTML = "";
      return;
    }

    els.historyEmpty.classList.add("hidden");
    els.historyList.classList.remove("hidden");
    els.btnClearHistory.classList.remove("hidden");

    els.historyList.innerHTML = h.map(renderHistoryItem).join("");
  }

  function renderHistoryItem(d) {
    const deliveredAt = new Date(d.deliveredAt);
    const timeStr = formatTime(deliveredAt);
    const dateStr = formatDate(deliveredAt);
    const waited = formatRelativeMinutes(d.deliveredAt - d.createdAt);
    return `
      <li class="history-item">
        <div class="history-top">
          <span class="history-name">${escapeHtml(d.name)}</span>
          <span class="history-check" title="Entregue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        </div>
        <div class="history-address">${escapeHtml(d.address)}</div>
        <div class="history-meta">
          <span>Entregue em ${dateStr} ${timeStr}</span>
          <span>·</span>
          <span>esperou ${waited} na fila</span>
        </div>
      </li>
    `;
  }

  // ====================== Utilitários ======================
  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function formatTime(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function formatDate(d) {
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  }

  function formatRelativeMinutes(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const remMin = min % 60;
    return remMin === 0 ? `${h}h` : `${h}h ${remMin}min`;
  }

  function averageWait(history) {
    const total = history.reduce(
      (acc, d) => acc + (d.deliveredAt - d.createdAt),
      0
    );
    return formatRelativeMinutes(total / history.length);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  let toastTimer = null;
  function showToast(title, text, kind) {
    els.toastTitle.textContent = title;
    els.toastText.textContent = text;
    els.toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.add("hidden");
    }, kind === "error" ? 3500 : 2600);
  }

  // ====================== Tick: atualiza tempos da fila a cada 30s ======================
  setInterval(() => {
    if (state.queue.length > 0) renderQueue();
  }, 30000);

  // ====================== Bind events ======================
  els.btnGenerate.addEventListener("click", generateRecipient);
  els.btnRegenerate.addEventListener("click", generateRecipient);
  els.btnCancel.addEventListener("click", cancelGenerator);
  els.formPackage.addEventListener("submit", handleAddPackage);
  els.btnClearHistory.addEventListener("click", clearHistory);

  // ====================== Init ======================
  render();
})();
