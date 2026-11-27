(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {
    route: localStorage.getItem("marnusgrade-age-ok") === "1" ? "home" : "welcome",
    tab: "home", filter: "Все", search: "", balance: 12450, withdrawable: 10450,
    bonus: 2000, adminId: null, live: false, ready: false, banned: false,
    method: "CryptoBot", amount: 1000, bonusOn: true, mult: 2, bet: 1000, withdrawType: "Реквизиты",
    betType: "Чётное", toastTimer: 0, busy: false, profileName: "Игрок",
  };
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const games = [
    { title: "Апгрейд", art: "×2", desc: "Повысь свою ставку", route: "upgrade", category: "Оригинальные" },
    { title: "Crash", art: "↗", desc: "Успей забрать", route: "crash", category: "Оригинальные" },
    { title: "Mines", art: "×5", desc: "Найди свой множитель", route: "mines", category: "Оригинальные" },
    { title: "Рулетка", art: "36", desc: "Один спин — один шанс", route: "roulette", category: "Оригинальные" },
  ];
  const icons = {
    home: '<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
    games: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/></svg>',
    bonuses: '<svg viewBox="0 0 24 24"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5C10 6 12 7 12 7Zm0 0h4.5A2.5 2.5 0 1 0 14 4.5C14 6 12 7 12 7Z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><path d="M4 6.5h15a2 2 0 0 1 2 2V20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14v4"/><path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z"/><path d="M17 14.5h.01"/></svg>',
    profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>',
  };
  const nav = [
    ["home", "Главная"], ["games", "Игры"], ["bonuses", "Бонусы"],
    ["wallet", "Кошелёк"], ["profile", "Профиль"],
  ];
  const fmt = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("ru-RU");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
  const money = (n) => `${fmt(n)} ₽`;
  const head = (title, sub, help = false) =>
    `<header class="page-head"><h1 class="page-title">${title}</h1><p class="page-subtitle">${sub}</p>${help ? '<button class="text-link" data-action="help" aria-label="Справка">?</button>' : ""}</header>`;
  const section = (title, action = "", route = "") =>
    `<div class="section-heading"><h2>${title}</h2>${action ? `<button data-route="${route}">${action}</button>` : ""}</div>`;
  const gameCard = (game, tall = false) =>
    `<button class="game-card ${game.title === "Апгрейд" ? "light" : ""}" data-route="${game.route}" style="${tall ? "" : ""}">
      <span class="game-art">${game.art}</span><span class="game-name">${game.title}</span><span class="game-desc">${game.desc}</span>
    </button>`;
  const roundDial = (chance = 45, label = "шанс успеха") => {
    const c = 2 * Math.PI * 83;
    const center = label === "MarnusGrade"
      ? '<img class="dial-logo" src="./marnusgrade-mark.png" alt="MarnusGrade">'
      : `<strong>${chance}%</strong><small>${label}</small>`;
    return `<div class="round-center"><div class="dial" aria-label="${chance}%">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle class="dial-track" cx="110" cy="110" r="83"/>
        <circle class="dial-glow" cx="110" cy="110" r="63"/>
        <circle class="dial-arc" cx="110" cy="110" r="83" stroke-dasharray="${chance / 100 * c} ${c}"/>
        <circle cx="110" cy="110" r="105" fill="none" stroke="#555" stroke-width="1" stroke-dasharray="1 6"/>
      </svg><div class="dial-center">${center}</div>
    </div></div>`;
  };
  const betInput = (initial = state.bet) => `<div class="input-box"><input data-input="bet" type="number" inputmode="numeric" min="1" value="${initial}" aria-label="Сумма ставки"><div class="quick-inline">
    <button data-action="bet-half">½</button><button data-action="bet-double">×2</button><button data-action="bet-max">MAX</button>
  </div></div>`;
  const betTools = () => `<label class="section-label">Сумма ставки</label>${betInput()}`;
  const toast = (message) => {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  };
  const navigate = (route) => {
    state.route = route;
    if (nav.some(([key]) => key === route)) state.tab = route;
    else if (["upgrade", "crash", "mines", "roulette"].includes(route)) state.tab = "games";
    else if (["deposit", "withdraw", "history"].includes(route)) state.tab = "wallet";
    else if (["friends"].includes(route)) state.tab = "bonuses";
    else if (["security", "support"].includes(route)) state.tab = "profile";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const renderNav = () => {
    $("#bottomNav").innerHTML = nav.map(([id, label]) =>
      `<button class="nav-item ${state.tab === id ? "active" : ""}" data-route="${id}" aria-current="${state.tab === id ? "page" : "false"}">
        <span class="nav-icon">${icons[id]}</span><small>${label}</small>
      </button>`).join("");
  };
  const originalGames = () => `<div class="game-grid">${games.map((g) => gameCard(g)).join("")}</div>`;

  function home() {
    return `${head("Игра начинается здесь", "Твой ход. Твои правила.")}
      <button class="hero" data-route="deposit" style="width:100%;text-align:left">
        <span class="hero-eyebrow">Бонус к депозиту</span><h2>Больше игры.<br>Больше моментов.</h2>
        <span class="chip-light">Бонус +100%</span><img class="hero-mark" src="./marnusgrade-mark.png" alt="">
      </button>
      ${section("Оригинальные игры", "Все →", "games")}${originalGames()}
      <div class="recent-win"><span class="arrow">↗</span><div class="name">alex••• · Апгрейд<small>только что</small></div><strong>+2 400 ₽</strong></div>
      <p class="minor-note">18+ · Играйте ответственно</p>`;
  }
  function gamesPage() {
    return `<div class="games-page">${head("Все игры", "Найди свой ритм")}
      <label class="search-box"><span aria-hidden="true">⌕</span><input id="gameSearch" type="search" placeholder="Название игры" value="${esc(state.search)}"></label>
      <div class="pills">${["Все", "Оригинальные", "Слоты"].map((x) => `<button class="pill ${state.filter === x ? "selected" : ""}" data-filter="${x}">${x}</button>`).join("")}</div>
      <p class="overline">MARNUSGRADE ORIGINALS</p>
      <div class="game-grid" id="filteredGames">${games.map((g) => gameCard(g, true)).join("")}</div>
      <div class="feature-card"><strong>Проверяемая честность</strong><p>Каждый раунд можно проверить в истории</p></div>
    </div>`;
  }
  function upgrade() {
    const c = Math.min(95, 100 / state.mult * .9);
    return `${head("Апгрейд", "Больше множитель — ярче момент", true)}
      ${roundDial(Math.round(c))}<div class="multiplier-row">${[1.5, 2, 5, 10].map((n) =>
        `<button class="pill ${state.mult === n ? "selected" : ""}" data-mult="${n}">×${n}</button>`).join("")}</div>
      ${betTools()}<div class="summary-row"><span>Возможный выигрыш</span><strong>${money(state.bet * state.mult)}</strong></div>
      <button class="primary-btn" data-action="upgrade" ${state.busy ? "disabled" : ""}>${state.busy ? "Проверяем…" : "Апгрейд　→"}</button>
      <p class="minor-note">Раунд #840 291 · Проверить честность</p>
      <div class="feature-card" style="margin-top:20px">Последние　 ×2.14　 ×1.03　 ×4.80　 ×1.72</div>`;
  }
  function crash() {
    return `${head("Crash", "Забери выигрыш до остановки", true)}
      <div class="pills">${["1.24×", "3.06×", "1.02×", "8.41×", "2.18×"].map((x, i) => `<button class="pill ${i === 3 ? "selected" : ""}">${x}</button>`).join("")}</div>
      <div class="chart-card"><span class="chart-label">В полёте</span><strong>2.34×</strong>
        <svg viewBox="0 0 320 120" preserveAspectRatio="none" aria-label="График множителя">
          <path d="M0 103H320M0 68H320M0 32H320" stroke="#333" fill="none"/>
          <path d="M3 105 C65 105 110 100 145 87 S195 60 230 42 S280 18 310 0" stroke="#eee" stroke-width="3" fill="none"/>
          <circle cx="310" cy="0" r="5" fill="#eee"/>
        </svg><div class="summary-row"><small>0 с</small><small>12 с</small></div>
      </div>${betTools()}<div class="summary-row"><span>Автовывод</span><strong>×3.00 · включён</strong></div>
      <button class="primary-btn" data-action="demo-game">Забрать ${money(state.bet * 2.34)}</button>
      <p class="minor-note">Ваша ставка в текущем раунде · ${money(state.bet)}</p>
      <div class="summary-row" style="margin-top:34px"><span>В игре</span><strong>128 игроков · 84 200 ₽</strong></div>`;
  }
  function mines() {
    const safe = new Set([6, 12, 18]);
    return `${head("Mines", "Открывай клетки. Не зацепи мину.", true)}
      <div class="pills"><button class="pill selected">3 мины</button><button class="pill">Следующий ×1.74</button><span style="margin:auto 0 auto auto;color:var(--muted);font-size:12px">3 / 22</span></div>
      <div class="mines-grid">${Array.from({ length: 25 }, (_, i) => `<button class="mine-cell ${safe.has(i) ? "safe" : ""}" data-action="mine" aria-label="Клетка ${i + 1}">${safe.has(i) ? "◆" : "·"}</button>`).join("")}</div>
      <div class="metric-card"><div><small>Множитель</small><strong style="font-size:16px">×1.52</strong></div><strong>${money(760)}</strong></div>
      <div class="form-block">${betTools()}</div><button class="primary-btn" style="margin-top:20px" data-action="demo-game">Забрать 760 ₽</button>
      <p class="minor-note">Открыто 3 безопасные клетки · раунд #240 681</p>`;
  }
  function roulette() {
    return `${head("Рулетка", "Европейская · одно зеро", true)}
      <p class="roulette-label">До начала раунда</p><p class="timer">00:08</p>
      <div class="roulette-strip"><span>24</span><span>16</span><span>0</span><span>32</span><span>15</span></div>
      <p class="center-note">Последние:　24　7　0　19　32　15　4</p>
      <div class="form-block"><label class="section-label">Ваш прогноз</label>
        <div class="options-3">${["Чётное", "Нечётное", "Ноль"].map((x, i) => `<button class="option-card ${state.betType === x ? "selected" : ""}" data-bet-type="${x}"><strong>${x}</strong><small>×${i === 2 ? "36" : "2"}</small></button>`).join("")}</div>
      </div><div class="form-block">${betTools()}</div>
      <div class="summary-row"><span>При выигрыше</span><strong>${money(state.bet * 2)}</strong></div>
      <button class="primary-btn" data-action="demo-game">Поставить ${money(state.bet)}</button>
      <p class="minor-note">Ставка на ${state.betType.toLowerCase()} · раунд #510 238</p>`;
  }
  function wallet() {
    const list = [
      ["↗", "Выигрыш · Апгрейд", "Сегодня, 14:32 · завершено", "+2 000 ₽"],
      ["↓", "Пополнение", "Сегодня, 14:10 · CryptoBot", "+5 000 ₽"],
      ["↗", "Вывод по реквизитам", "Вчера, 18:42 · завершено", "−3 000 ₽"],
    ];
    return `${head("Кошелёк", "Все средства под контролем")}
      <div class="light-card"><small>Общий баланс</small><strong class="big-number">${money(state.balance)}</strong><hr>
        <div class="split"><div><small>Доступно к выводу</small><strong>${money(state.withdrawable)}</strong></div><div><small>Бонусный счёт</small><strong>${money(state.bonus)}</strong></div></div>
      </div><div class="wallet-actions"><button class="primary-btn" data-route="deposit">＋ Пополнить</button><button class="secondary-btn" data-route="withdraw">↗ Вывести</button></div>
      ${section("Последние операции", "Все →", "history")}
      ${list.map((x) => `<div class="list-card"><span class="list-icon">${x[0]}</span><div class="list-copy"><strong>${x[1]}</strong><small>${x[2]}</small></div><strong class="list-amount">${x[3]}</strong></div>`).join("")}
      <p class="minor-note">Платёжные данные защищены шифрованием</p>`;
  }
  function deposit() {
    const methods = [
      ["CryptoBot", "TON · USDT"], ["xRocket", "TON · USDT"], ["Реквизиты", "Перевод администратору"],
    ];
    return `${head("Пополнение", "Выберите удобный способ оплаты")}
      <div class="options-3 deposit-options">${methods.map(([name, sub]) => `<button class="option-card ${state.method === name ? "selected" : ""}" data-method="${name}"><strong>${name}</strong><small>${sub}</small></button>`).join("")}</div>
      <div class="form-block"><label class="section-label" for="depositAmount">Сумма пополнения</label>
        <div class="input-box"><input id="depositAmount" data-input="deposit" type="number" inputmode="numeric" min="500" max="100000" value="${state.amount}"></div>
        <p class="form-help">От 500 до 100 000 ₽ за операцию</p>
        <div class="amount-presets">${[500, 1000, 5000, 10000].map((n) => `<button class="pill ${state.amount === n ? "selected" : ""}" data-amount="${n}">${money(n)}</button>`).join("")}</div>
      </div>
      <button class="check-card" data-action="bonus-toggle" style="width:100%;text-align:left">
        <strong>${state.bonusOn === false ? "＋100% к депозиту" : "✓　＋100% к депозиту"}</strong><small>Бонус 1 000 ₽ · вейджер ×30</small>
      </button>
      <div class="summary-row"><span>Пополнение</span><strong>${money(state.amount)}</strong></div>
      <div class="summary-row"><span>Комиссия</span><strong>0 ₽</strong></div>
      <div class="summary-row"><span>Будет зачислено с бонусом</span><strong>${money(state.bonusOn === false ? state.amount : state.amount * 2)}</strong></div>
      <button class="primary-btn" style="margin-top:14px" data-action="deposit-continue">Продолжить · ${money(state.amount)}</button>
      <p class="minor-note">Перед оплатой вы увидите реквизиты и сумму перевода.</p>`;
  }
  function withdraw() {
    return `${head("Вывод", `Доступно к выводу ${money(state.withdrawable)}`)}
      <div class="tabs">${["Реквизиты", "Криптокошелёк"].map((x) => `<button class="pill ${state.withdrawType === x ? "selected" : ""}" data-withdraw-type="${x}">${x}</button>`).join("")}</div>
      <div class="form-block"><label class="section-label" for="recipient">${state.withdrawType === "Реквизиты" ? "Куда получить" : "Адрес кошелька"}</label>
        <input class="code-input" id="recipient" placeholder="${state.withdrawType === "Реквизиты" ? "Уточните реквизиты у администратора" : "TON / USDT адрес"}">
        <p class="form-help">Не отправляйте данные карты в открытый чат</p>
      </div>
      <div class="form-block"><label class="section-label" for="withdrawAmount">Сумма вывода</label><div class="input-box"><input id="withdrawAmount" type="number" value="5000" inputmode="numeric"></div><p class="form-help">Минимум 500 ₽ · максимум ${money(state.withdrawable)}</p></div>
      <div class="check-card"><strong>✓　Аккаунт подтверждён</strong><small>Личность и платёжные данные проверены</small></div>
      <div class="summary-row"><span>Комиссия</span><strong>0 ₽</strong></div><div class="summary-row"><span>К получению</span><strong>${money(5000)}</strong></div>
      <div class="summary-row"><span>Обычно занимает</span><strong>5–15 минут</strong></div>
      <button class="primary-btn" style="margin-top:15px" data-action="withdraw-request">Запросить вывод</button>
      <p class="minor-note">Запрос будет обработан после подключения платёжного сервиса. Бонусные средства недоступны к выводу.</p>`;
  }
  function history() {
    const entries = [
      ["↗", "Апгрейд · выигрыш", "14:32 · раунд #840 290", "+2 000 ₽", "Игра"],
      ["−", "Апгрейд · ставка", "14:32 · раунд #840 290", "−1 000 ₽", "Игра"],
      ["↓", "Пополнение · CryptoBot", "14:10 · ожидает настройки", "+5 000 ₽", "Ввод"],
      ["↗", "Вывод · по реквизитам", "Вчера, 18:42 · завершено", "−3 000 ₽", "Вывод"],
      ["↗", "Mines · выигрыш", "Вчера, 17:18 · раунд #240 502", "+760 ₽", "Игра"],
    ];
    const filters = ["Все", "Ввод", "Вывод", "Игра"];
    return `${head("История операций", "Пополнения, выигрыши и выводы")}
      <div class="pills">${filters.map((x) => `<button class="pill ${state.historyFilter === x || (!state.historyFilter && x === "Все") ? "selected" : ""}" data-history-filter="${x}">${x}</button>`).join("")}</div>
      <p class="category-title">Сегодня, 27 ноября</p>
      <div id="historyList">${entries.filter((e) => !state.historyFilter || state.historyFilter === "Все" || state.historyFilter === e[4]).map((x) =>
        `<div class="list-card"><span class="list-icon">${x[0]}</span><div class="list-copy"><strong>${x[1]}</strong><small>${x[2]}</small></div><strong class="list-amount">${x[3]}</strong></div>`).join("")}</div>
      <button class="secondary-btn" style="margin-top:20px">Показать ещё</button>`;
  }
  function bonuses() {
    return `${head("Бонусы", "Больше возможностей для твоей игры")}
      <div class="hero hero-week"><span class="hero-eyebrow">Предложение недели</span><h2>＋100%</h2><strong>На депозит до 10 000 ₽</strong><p class="hero-caption">Вейджер ×30 · действует 7 дней</p></div>
      ${section("Ваш активный бонус")}
      <div class="progress-card"><small>Бонусный баланс</small><strong>${money(state.bonus)}</strong><div class="summary-row"><span>Отыгрыш</span><span>18 000 / 60 000 ₽</span></div><div class="progress"><span></span></div></div>
      <input class="code-input" placeholder="Введите промокод" id="promo"><button class="text-link" style="float:right;margin-top:-36px;margin-right:13px" data-action="promo">→</button>
      <button class="primary-btn" style="margin-top:22px" data-route="deposit">Пополнить с бонусом</button>
      <button class="wide-card" style="width:100%;margin-top:14px" data-route="friends"><span>Друзья в MarnusGrade<small class="sub">Приглашай друзей и получай бонус</small></span><span class="arrow">→</span></button>
      <p class="minor-note">Правила бонусной программы　↗</p>`;
  }
  function friends() {
    return `${head("Друзья в MarnusGrade", "Играть интереснее вместе")}
      <div class="hero hero-friends"><span class="hero-eyebrow">Приглашай друзей</span><h2>5%</h2><strong>От комиссии сервиса</strong><p class="hero-caption">За активность приглашённых друзей</p></div>
      <div class="game-grid" style="margin-top:17px"><div class="feature-card"><strong style="font-size:25px">12</strong><p>Друзей</p></div><div class="feature-card"><strong style="font-size:25px">1 240 ₽</strong><p>Начислено</p></div></div>
      <div class="form-block"><label class="section-label">Ваша ссылка</label><div class="wide-card" style="cursor:default"><span class="title">Ссылка выдаётся Telegram-ботом</span><button class="text-link" data-action="copy-link">↗</button></div></div>
      <button class="primary-btn" style="margin-top:20px" data-action="invite">Пригласить друга</button>
      <div class="wide-card"><span>Как это работает<small class="sub">Ссылка → регистрация → начисления</small></span><span class="arrow">→</span></div>
      <p class="minor-note">Условия реферальной программы　↗</p>`;
  }
  function profile() {
    const name = state.profileName ? `@${esc(state.profileName)}` : "@Игрок";
    const rows = [
      ["Кошелёк", `${money(state.balance)} · баланс аккаунта`, "wallet"],
      ["История игр", "Раунды, ставки и проверка честности", "history"],
      ["Лимиты и безопасность", "Личные ограничения и защита", "security"],
      ["Язык приложения", "Русский", "language"],
      ["Поддержка", "Поможем разобраться с любым вопросом", "support"],
    ];
    return `${head("Профиль", "Твой аккаунт в одном месте")}
      <div class="profile-card"><strong>${name}</strong><small>ID ${state.userId || "2048"} · Telegram ${state.live ? "подключён" : "демо-режим"}</small><div class="verified">✓　Личность подтверждена</div></div>
      ${rows.map(([title, sub, route]) => `<button class="wide-card" style="width:100%" data-route="${route}"><span>${title}<small class="sub">${sub}</small></span><span class="arrow">→</span></button>`).join("")}
      <p class="center-note" style="margin-top:27px">Правила　·　Конфиденциальность<br><br>MarnusGrade　/　18+　/　v1.0</p>`;
  }
  function security() {
    return `${head("Безопасность", "Проверка аккаунта и личные лимиты")}
      <div class="check-card"><strong>✓　Личность подтверждена</strong><small>Проверка пройдена · вывод доступен</small></div>
      ${section("Контроль игры")}
      <div class="progress-card"><small>Лимит пополнений в месяц</small><strong>15 000 / 30 000 ₽</strong><div class="progress"><span style="width:50%"></span></div><small style="display:block;margin-top:12px">До 1 декабря · Изменить →</small></div>
      ${[["Напоминание о времени", "Каждые 30 минут · включено"], ["Перерыв в игре", "Приостановить доступ на 24 часа или дольше"], ["Самоисключение", "Закрыть доступ к игре на выбранный срок"]].map(([a,b]) => `<button class="wide-card" style="width:100%"><span>${a}<small class="sub">${b}</small></span><span class="arrow">→</span></button>`).join("")}
      <p class="center-note" style="margin-top:30px">Игра — развлечение, а не способ заработка.<br>Не играйте на деньги, которые не можете потерять.</p>`;
  }
  function support() {
    return `${head("Поддержка", "Я рядом, если нужна помощь")}
      <div class="hero" style="min-height:124px"><h2 style="margin:0;font-size:24px">Разберёмся вместе</h2><p class="hero-caption" style="font-size:12px">Поддержка в Telegram · круглосуточно</p><p class="hero-caption">Обычно отвечаем в течение 5 минут</p></div>
      <button class="primary-btn" style="margin-top:20px" data-action="contact-admin">Написать в поддержку　↗</button>
      ${section("Частые вопросы")}
      <details class="faq" open><summary><strong>Сколько идёт вывод?</strong></summary><p>Время зависит от выбранного способа. Текущий статус заявки всегда доступен в истории операций.</p></details>
      <details class="faq"><summary><strong>Не пришло пополнение</strong></summary><p>Сохраните чек и напишите администратору в Telegram, указав ID аккаунта и сумму.</p></details>
      <details class="faq"><summary><strong>Как проверить честность игры?</strong></summary><p>Данные раунда и результаты доступны в истории операций.</p></details>
      <p class="minor-note">При обращении укажите ваш ID: ${state.userId || "2048"}</p>`;
  }
  function welcome() {
    return `<section class="welcome">
      <div class="welcome-top"><div class="brand"><img class="brand-mark" src="./marnusgrade-mark.png" alt=""><span class="brand-name">MarnusGrade</span></div><span class="age-chip">18+</span></div>
      <h1>Всё решает<br>твой ход.</h1><p class="lead">Чистая игра. Ничего лишнего.</p>
      ${roundDial(45, "MarnusGrade")}
      <div class="game-types">UPGRADE　/　CRASH　/　MINES　/　ROULETTE</div>
      <button class="primary-btn" data-action="age-confirm">Мне есть 18 — продолжить</button>
      <p class="minor-note">Нажимая кнопку, вы подтверждаете совершеннолетие<br>и принимаете правила и политику конфиденциальности.</p>
      <p class="minor-note">Играйте ответственно. Установите личные лимиты.</p>
      <div class="welcome-footer">MARNUSGRADE　/　TELEGRAM MINI APP</div>
    </section>`;
  }
  function render() {
    const welcomeMode = state.route === "welcome";
    document.body.classList.toggle("welcome-mode", welcomeMode);
    $("#brandRow").style.display = welcomeMode ? "none" : "flex";
    $("#bottomNav").style.display = welcomeMode ? "none" : "grid";
    $("#demoBadge").style.display = !state.live && !welcomeMode ? "block" : "none";
    $("#headerBalance").textContent = money(state.balance);
    const pages = {
      home, games: gamesPage, upgrade, crash, mines, roulette, wallet, deposit, withdraw,
      history, bonuses, friends, profile, security, support,
    };
    $("#screen").innerHTML = welcomeMode ? welcome() : (pages[state.route] || home)();
    renderNav();
  }
  function updateBet(value) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) state.bet = Math.floor(n);
    if (["upgrade", "crash", "mines", "roulette"].includes(state.route)) render();
  }
  async function playUpgrade() {
    if (!state.live || !state.ready) {
      toast("Демо-просмотр: реальные ставки и результаты отключены.");
      return;
    }
    if (state.busy) return;
    const bet = Math.floor(Number(state.bet) || 0);
    if (bet < 1 || bet > state.balance) {
      toast("Проверьте сумму ставки и баланс.");
      return;
    }
    state.busy = true;
    render();
    try {
      const response = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Init-Data": tg.initData },
        body: JSON.stringify({ bet, mult: state.mult }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить раунд.");
      state.balance = Number(data.balance) || state.balance;
      toast(data.win ? `Выигрыш: +${money(data.payout)}` : `Ставка потеряна: −${money(bet)}`);
    } catch (err) {
      toast(err.message || "Не удалось выполнить запрос.");
    } finally {
      state.busy = false;
      render();
    }
  }
  function contactAdmin() {
    if (!state.adminId) {
      toast("Чат администратора не настроен. Укажите ADMIN_IDS на сервере.");
      return;
    }
    const deepLink = `tg://user?id=${encodeURIComponent(state.adminId)}`;
    try {
      if (tg && typeof tg.openLink === "function") tg.openLink(deepLink);
      else window.location.href = deepLink;
    } catch (_) {
      toast(`Откройте Telegram и найдите администратора: ${state.adminId}`);
    }
  }
  function continueDeposit() {
    if (state.amount < 500 || state.amount > 100000) {
      toast("Сумма пополнения должна быть от 500 до 100 000 ₽.");
      return;
    }
    if (!state.live || !state.ready) {
      toast("Демо-просмотр: платёж не создан и баланс не изменится.");
      return;
    }
    if (state.method === "Реквизиты") {
      contactAdmin();
      return;
    }
    toast(`${state.method}: подключите API и webhook для создания счёта.`);
  }
  async function initialize() {
    if (!tg) {
      render();
      return;
    }
    try { tg.ready(); tg.expand(); } catch (_) {}
    $("#mockTgbar").style.display = "none";
    if (!tg.initData) {
      state.route = "welcome";
      render();
      return;
    }
    state.live = true;
    try {
      const response = await fetch("/api/me", { headers: { "X-Init-Data": tg.initData } });
      if (!response.ok) throw new Error("Не удалось загрузить аккаунт.");
      const user = await response.json();
      state.balance = Number(user.balance) || 0;
      state.withdrawable = state.balance;
      state.bonus = 0;
      state.banned = Boolean(user.banned);
      state.adminId = user.admin_id || null;
      state.userId = user.user_id || null;
      state.profileName = tg.initDataUnsafe && tg.initDataUnsafe.user
        ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || "Игрок") : "Игрок";
      state.ready = true;
      if (state.route === "welcome" && localStorage.getItem("marnusgrade-age-ok") === "1") state.route = "home";
    } catch (error) {
      state.live = false;
      state.ready = false;
      toast(error.message || "Не удалось подключить аккаунт.");
    }
    render();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, [data-route]");
    if (!target) return;
    if (target.dataset.route) { navigate(target.dataset.route); return; }
    if (target.dataset.filter) {
      state.filter = target.dataset.filter;
      $$(".pills .pill").forEach((b) => b.classList.toggle("selected", b === target));
      $$("#filteredGames .game-card").forEach((card) => {
        card.style.display = state.filter === "Слоты" ? "none" : "";
      });
      let notice = $("#slotsNotice");
      if (state.filter === "Слоты" && !notice) {
        notice = document.createElement("div");
        notice.id = "slotsNotice";
        notice.className = "feature-card";
        notice.textContent = "Слоты скоро появятся";
        $("#filteredGames").after(notice);
      } else if (state.filter !== "Слоты" && notice) {
        notice.remove();
      }
      return;
    }
    if (target.dataset.mult) {
      state.mult = Number(target.dataset.mult);
      render();
      return;
    }
    if (target.dataset.method) {
      state.method = target.dataset.method;
      render();
      return;
    }
    if (target.dataset.amount) {
      state.amount = Number(target.dataset.amount);
      render();
      return;
    }
    if (target.dataset.withdrawType) {
      state.withdrawType = target.dataset.withdrawType;
      render();
      return;
    }
    if (target.dataset.betType) {
      state.betType = target.dataset.betType;
      render();
      return;
    }
    if (target.dataset.historyFilter) {
      state.historyFilter = target.dataset.historyFilter;
      render();
      return;
    }
    switch (target.dataset.action) {
      case "age-confirm":
        localStorage.setItem("marnusgrade-age-ok", "1");
        state.route = "home";
        render();
        break;
      case "upgrade": playUpgrade(); break;
      case "deposit-continue": continueDeposit(); break;
      case "contact-admin": contactAdmin(); break;
      case "withdraw-request":
        if (!state.live) toast("Демо-просмотр: заявка на вывод не создана.");
        else if (state.withdrawType === "Реквизиты") contactAdmin();
        else toast("Криптовывод не подключён: настройте проверенный платёжный процесс.");
        break;
      case "demo-game":
      case "mine":
        toast("Демо-просмотр: игровой раунд не запускается.");
        break;
      case "bonus-toggle":
        state.bonusOn = state.bonusOn === false;
        render();
        break;
      case "promo": toast("Промокоды пока не подключены."); break;
      case "invite": toast("Ссылка-приглашение пока не настроена."); break;
      case "copy-link": toast("Ссылка приглашения пока не настроена."); break;
      case "help": toast("Все игровые результаты проверяются сервером."); break;
      case "bet-half":
        state.bet = Math.max(1, Math.floor(state.bet / 2));
        render();
        break;
      case "bet-double":
        state.bet = Math.min(state.balance || state.bet * 2, state.bet * 2);
        render();
        break;
      case "bet-max":
        state.bet = state.balance || state.bet;
        render();
        break;
      default: break;
    }
  });
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.id === "gameSearch") {
      state.search = target.value;
      $$(".game-card", $("#filteredGames")).forEach((card) => {
        card.style.display = card.textContent.toLowerCase().includes(state.search.toLowerCase()) ? "" : "none";
      });
    } else if (target.dataset.input === "deposit") {
      const n = Math.max(0, Math.floor(Number(target.value) || 0));
      state.amount = n;
      // Keep the field stable while updating the totals and selected preset.
      const page = $("#screen");
      const rows = $$(".summary-row", page);
      if (rows.length >= 3) {
        rows[0].lastElementChild.textContent = money(n);
        rows[2].lastElementChild.textContent = money(state.bonusOn === false ? n : n * 2);
      }
      const button = $('[data-action="deposit-continue"]', page);
      if (button) button.textContent = `Продолжить · ${money(n)}`;
      $$(".amount-presets .pill", page).forEach((b) => b.classList.toggle("selected", Number(b.dataset.amount) === n));
    } else if (target.dataset.input === "bet") {
      const n = Math.floor(Number(target.value) || 0);
      state.bet = n;
      const summary = $(".summary-row strong");
      if (summary && ["upgrade", "roulette"].includes(state.route)) {
        summary.textContent = money(n * (state.route === "upgrade" ? state.mult : 2));
      }
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "withdrawAmount") {
      const row = event.target.closest("main").querySelectorAll(".summary-row")[1];
      if (row) row.lastElementChild.textContent = money(event.target.value);
    }
  });
  render();
  initialize();
})();