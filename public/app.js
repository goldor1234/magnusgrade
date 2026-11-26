(() => {
  let tg = null;
  const $ = (id) => document.getElementById(id);
  const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const circumference = 2 * Math.PI * 83;
  const state = { balance: 0, multipliers: [], edge: 0.05, minBet: 1, mult: 2, busy: false, banned: false, rotation: 0 };
  const betInput = $("bet");
  const playButton = $("play");
  const status = $("status");
  const result = $("lastResult");
  const amount = (value) => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("ru-RU");
  const chanceFor = (mult) => Math.min(0.95, (1 / Number(mult)) * (1 - state.edge));

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "status" + (kind ? " " + kind : "");
  }

  function addOpenBotLink(message, kind) {
    setStatus(message, kind || "");
    const link = document.createElement("a");
    link.href = "https://t.me/magnusgrade_bot";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Открыть бота";
    status.append(document.createElement("br"), link);
  }

  async function waitForTelegram() {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (window.Telegram && window.Telegram.WebApp) return window.Telegram.WebApp;
      await pause(120);
    }
    return null;
  }

  function renderDial() {
    const chance = chanceFor(state.mult);
    $("chanceArc").setAttribute("stroke-dasharray", `${chance * circumference} ${circumference}`);
    $("chanceValue").textContent = `${(chance * 100).toFixed(1)}%`;
    $("multLabel").textContent = `Множитель ×${state.mult}`;
  }

  function setControlsEnabled(enabled) {
    const disabled = !enabled || state.busy || state.banned;
    betInput.disabled = disabled;
    playButton.disabled = disabled;
    document.querySelectorAll("[data-bet]").forEach((button) => { button.disabled = disabled; });
    document.querySelectorAll(".multiplier").forEach((button) => { button.disabled = disabled; });
  }

  function renderMultipliers() {
    const root = $("multipliers");
    root.replaceChildren();
    state.multipliers.forEach((value) => {
      const mult = Number(value);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "multiplier";
      button.setAttribute("aria-pressed", String(mult === state.mult));
      const title = document.createElement("strong");
      title.textContent = `×${mult}`;
      const sub = document.createElement("small");
      sub.textContent = `${(chanceFor(mult) * 100).toFixed(1)}% шанс`;
      button.append(title, sub);
      button.addEventListener("click", () => {
        if (state.busy || state.banned) return;
        state.mult = mult;
        renderMultipliers();
        renderDial();
        result.textContent = "";
        result.className = "last-result";
      });
      root.appendChild(button);
    });
  }

  function renderBalance() {
    $("balance").textContent = `${amount(state.balance)} 💎`;
    betInput.max = String(state.balance);
  }

  async function request(path, body) {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: {
        "X-Init-Data": tg && tg.initData ? tg.initData : "",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Ошибка сервера (${response.status})`);
    return data;
  }

  function formatError(error) {
    if (error && error.message === "Failed to fetch") return "Не удалось связаться с сервером. Попробуй ещё раз.";
    return error && error.message ? error.message : "Не удалось выполнить запрос.";
  }

  function spin(win, chance) {
    const pointer = $("needle");
    const position = win ? Math.random() * chance : chance + Math.random() * (1 - chance);
    const target = position * 360;
    const delta = 360 * 5 + ((target - (state.rotation % 360)) + 360) % 360;
    state.rotation += delta;
    pointer.style.transform = `rotate(${state.rotation}deg)`;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return new Promise((resolve) => window.setTimeout(resolve, reduced ? 30 : 2600));
  }

  document.querySelectorAll("[data-bet]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.bet;
      const current = Math.max(state.minBet, Math.floor(Number(betInput.value) || state.minBet));
      let next = current;
      if (mode === "half") next = Math.floor(current / 2);
      if (mode === "double") next = current * 2;
      if (mode === "max") next = state.balance;
      next = Math.max(state.minBet, Math.min(state.balance, next));
      betInput.value = String(next || state.minBet);
    });
  });

  playButton.addEventListener("click", async () => {
    if (state.busy || state.banned) return;
    const bet = Math.floor(Number(betInput.value));
    if (!Number.isFinite(bet) || bet < state.minBet) {
      setStatus(`Минимальная ставка — ${amount(state.minBet)} 💎`, "error");
      return;
    }
    if (bet > state.balance) {
      setStatus("Ставка больше текущего баланса", "error");
      return;
    }

    state.busy = true;
    setControlsEnabled(true);
    result.textContent = "";
    result.className = "last-result";
    setStatus("Проверяем ставку…", "");
    try {
      const game = await request("/api/upgrade", { bet, mult: state.mult });
      await spin(Boolean(game.win), Number(game.chance));
      state.balance = Number(game.balance);
      renderBalance();
      if (game.win) {
        result.textContent = `Выигрыш: +${amount(game.payout)} 💎`;
        result.className = "last-result win";
        setStatus("Успешный апгрейд", "success");
        try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred("success"); } catch (_) {}
      } else {
        result.textContent = `Ставка потеряна: −${amount(bet)} 💎`;
        result.className = "last-result loss";
        setStatus("В этот раз не повезло", "error");
        try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred("error"); } catch (_) {}
      }
      betInput.value = String(Math.min(Math.max(state.minBet, bet), state.balance || state.minBet));
    } catch (error) {
      setStatus(formatError(error), "error");
    } finally {
      state.busy = false;
      setControlsEnabled(true);
    }
  });

  async function init() {
    tg = await waitForTelegram();
    if (!tg) {
      addOpenBotLink("Telegram SDK не загрузился. Проверь соединение и открой приложение через бота.", "error");
      return;
    }
    try { tg.ready(); tg.expand(); } catch (_) {}
    if (!tg.initData) {
      addOpenBotLink("Открой приложение через Telegram, чтобы загрузить профиль.");
      return;
    }
    try {
      const profile = await request("/api/me");
      state.balance = Number(profile.balance) || 0;
      state.multipliers = Array.isArray(profile.multipliers) ? profile.multipliers.map(Number) : [];
      state.edge = Number.isFinite(Number(profile.edge)) ? Number(profile.edge) : 0.05;
      state.minBet = Math.max(1, Number(profile.min_bet) || 1);
      state.banned = Boolean(profile.banned);
      if (!state.multipliers.includes(state.mult)) state.mult = state.multipliers[0] || 2;
      betInput.min = String(state.minBet);
      betInput.value = String(state.minBet);
      renderBalance();
      renderMultipliers();
      renderDial();
      setControlsEnabled(true);
      setStatus(state.banned ? "Аккаунт заблокирован" : "Выбери ставку и множитель", state.banned ? "error" : "");
    } catch (error) {
      setStatus(formatError(error), "error");
    }
  }

  renderDial();
  init();
})();
