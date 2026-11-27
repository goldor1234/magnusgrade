# MarnusGrade — Telegram Mini App «Апгрейдер»

Telegram-бот с Web App (казино-апгрейдер): пользователь выбирает множитель, чем он выше — тем ниже шанс выигрыша. Бросок делается на сервере через `crypto.randomInt`, балансы хранятся в Supabase, всё это хостится на Vercel как serverless-функции.

## Стек

| Слой | Технология |
| --- | --- |
| Бот | grammY 1.30 |
| Web App | Vanilla JS + Telegram WebApp SDK, один `index.html` |
| Backend | Vercel Serverless Functions (Node 20, TypeScript) |
| База | Supabase (Postgres + RLS + RPC) |

---

## 1. Проверка структуры и работоспособности

### Что НЕ так в репозитории (ВАЖНО)

В исходном репозитории **все `.ts`-файлы лежат в корне**, но код рассчитан на структуру с папками `api/` и `lib/`:

* `api/upgrade.ts` импортирует `../lib/auth`, `../lib/db`, `../lib/config`
* `api/webhook.ts` и `api/setup.ts` импортируют `../lib/bot`
* `tsconfig.json` включает только `["api", "lib"]`
* `vercel.json` описывает функции `api/*.ts`

**В таком виде проект на Vercel не задеплоится** — сервер не найдёт ни `/api/me`, ни `/api/upgrade`, ни `/api/webhook`, потому что файлов в папке `api/` нет.

### Правильная структура (привести репозиторий к ней)

```
magnusgrade/
├── api/
│   ├── me.ts          # GET  /api/me       — баланс + конфиг
│   ├── upgrade.ts     # POST /api/upgrade  — бросок
│   ├── webhook.ts     # POST /api/webhook  — приём апдейтов от Telegram
│   └── setup.ts       # GET  /api/setup    — регистрация вебхука (один раз)
├── lib/
│   ├── bot.ts         # grammY Bot, команды /start, /profile, /history, /admin…
│   ├── db.ts          # Supabase-клиент + ensureUser/changeBalance
│   ├── auth.ts        # проверка подписи Telegram initData (HMAC-SHA256)
│   └── config.ts      # MULTIPLIERS, EDGE, ADMINS, chanceOf()
├── public/
│   ├── index.html     # Web App
│   ├── app.js
│   ├── marnusgrade-mark.png
│   └── marnusgrade-welcome.png  # картинка приветствия
├── schema.sql         # SQL для Supabase
├── package.json
├── tsconfig.json
└── vercel.json
```

Чтобы исправить: создай папки `api/` и `lib/`, перемести в `api/` четыре файла (`me.ts`, `upgrade.ts`, `webhook.ts`, `setup.ts`), в `lib/` — четыре (`bot.ts`, `db.ts`, `auth.ts`, `config.ts`), закоммить и запушь.

После приведения структуры к виду выше `npx tsc --noEmit` проходит без ошибок (проверено).

### Что ещё стоит знать по коду

* `bot.ts` использует `ctx.callbackQuery?.message?.photo` и `editMessageCaption` — для сообщений с обложкой меняется подпись, для текстовых — сам текст. Корректно.
* `auth.ts` проверяет подпись initData по алгоритму из документации Telegram и отбрасывает `auth_date` старше 24 часов.
* `upgrade.ts` бросок делается через `crypto.randomInt(0, 1_000_000)` — криптостойкий генератор, не `Math.random()`.
* `schema.sql` включает RLS и `revoke … from public, anon, authenticated`, доступ только через `service_role`. Это правильно для serverless-бэка.
* `play_upgrade` RPC делает списание + выплату + запись в историю атомарно, плюс кулдаун 1 секунду против спама.
* `vercel.json` — регион `fra1`, `maxDuration: 15` сек. Нормально для апдейтов Telegram.

---

## 2. Установка и запуск

### Шаг 0. Локально — исправить структуру и проверить сборку

```bash
git clone https://github.com/goldor1234/magnusgrade.git
cd magnusgrade

# поправить структуру (см. раздел 1)
mkdir -p api lib
git mv me.ts upgrade.ts webhook.ts setup.ts api/
git mv bot.ts db.ts auth.ts config.ts lib/

npm install
npx tsc --noEmit        # должно пройти без ошибок
```

### Шаг 1. Создать бота в Telegram

1. Открой `@BotFather` → `/newbot` → задай имя и username.
2. Скопируй **BOT_TOKEN**.
3. `/setdomain` → отправь домен, на котором будет жить Web App (его получишь на шаге 3 после деплоя на Vercel).
4. Узнай свой Telegram ID через `@userinfobot` — это понадобится для `ADMIN_IDS`.
5. Опционально: `@BotFather` → `/newapp` или через Bot → `Bot Settings` → `Menu Button` / `Web App` — задай URL Web App.

### Шаг 2. Подготовить Supabase

1. Зарегистрируйся на https://supabase.com и создай новый проект (регион — лучше `Frankfurt`, совпадает с `fra1` в `vercel.json`).
2. В проекте открой **SQL Editor** → **New query** → вставь всё содержимое `schema.sql` → **Run**.
3. Дождись создания таблиц `users`, `upgrades`, `admin_pending` и RPC-функций `play_upgrade`, `change_balance`, `user_stats`, `admin_stats`.
4. Открой **Project Settings → API** и скопируй:
   * **Project URL** → это `SUPABASE_URL`
   * **service_role** secret → это `SUPABASE_SERVICE_ROLE_KEY` (anon-ключ НЕ нужен и не должен использоваться — RLS закрывает чтение с anon).

### Шаг 3. Задеплоить на Vercel

#### Вариант А — через GitHub (рекомендуется)

1. Запушь исправленный репозиторий в свой GitHub.
2. На https://vercel.com → **Add New → Project** → импортируй репозиторий.
3. Vercel сам определит Node.js + TypeScript по `package.json` и `vercel.json`. Статический `public/index.html` и `public/marnusgrade-welcome.png` будут отдаваться как есть, а `.ts` из `api/` станут серверными функциями `/api/*`.
4. В **Settings → Environment Variables** добавь:

   | Key | Value |
   | --- | --- |
   | `BOT_TOKEN` | токен от BotFather |
   | `SUPABASE_URL` | `https://<project>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role из Supabase |
   | `WEBAPP_URL` | `https://<твой-домен>.vercel.app` (без слэша в конце) |
   | `WEBHOOK_SECRET` | любая длинная случайная строка (например `openssl rand -hex 32`) |
   | `ADMIN_IDS` | твой Telegram ID, через запятую если несколько |

5. **Deploy**. После завершения скопируй URL вида `https://magnusgrade-xxxx.vercel.app`.

#### Вариант Б — через Vercel CLI

```bash
npm i -g vercel
cd magnusgrade
vercel              # первый запуск, привязка к аккаунту
vercel env add BOT_TOKEN
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add WEBAPP_URL
vercel env add WEBHOOK_SECRET
vercel env add ADMIN_IDS
vercel --prod
```

### Шаг 4. Прописать домен в боте

В `@BotFather` → `/setdomain` → выбери бота → отправь домен из шага 3 (`https://magnusgrade-xxxx.vercel.app`).

### Шаг 5. Активировать вебхук (один раз после деплоя)

Открой в браузере:

```
https://<твой-домен>.vercel.app/api/setup?secret=ЗНАЧЕНИЕ_WEBHOOK_SECRET
```

Должен вернуться JSON вида:

```json
{"ok":true,"webhook":"https://<домен>/api/webhook","info":{...}}
```

Это注册рует у Telegram адрес `https://<домен>/api/webhook` с тем же `secret_token`, который проверяется в `webhook.ts`. Повторять нужно только если домен сменился.

### Шаг 6. Проверка

1. Открой бота в Telegram → `/start`. Должно прийти приветствие с картинкой `marnusgrade-welcome.png`, балансом 1000 💎 и кнопкой «Открыть апгрейдер».
2. Нажми кнопку — откроется Web App, в нём отобразится баланс и список множителей.
3. Поставь ставку, выбери множитель, нажми «Апгрейд». Стрелка крутится, баланс меняется.
4. В боте: `/profile` — статистика, `/history` — последние 10 игр.
5. Если твой ID есть в `ADMIN_IDS`: появится кнопка «🛠 Админ-панель» — список игроков, выдача/списание баланса, бан/разбан.

---

## 3. Переменные окружения — итоговая шпаргалка

| Переменная | Где взять | Назначение |
| --- | --- | --- |
| `BOT_TOKEN` | BotFather | токен бота |
| `SUPABASE_URL` | Supabase → Settings → API | URL проекта |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | секретный ключ (НЕ anon) |
| `WEBAPP_URL` | Vercel (после деплоя) | домен Web App без слэша |
| `WEBHOOK_SECRET` | придумать | защита `/api/webhook` + параметр `/api/setup` |
| `ADMIN_IDS` | `@userinfobot` | CSV ID админов |

---

## 4. Возможные проблемы

| Симптом | Причина | Решение |
| --- | --- | --- |
| На `/api/*` — 404 | Файлы лежат в корне, а не в `api/` | переместить в `api/` (раздел 1) |
| `Cannot find module '../lib/bot'` | Нет папки `lib/` | переместить `bot.ts`, `db.ts`, `auth.ts`, `config.ts` в `lib/` |
| `/start` отвечает, но кнопка Web App не открывает | Не задан домен в BotFather | `/setdomain` |
| Бот не реагирует на кнопки после деплоя | Не вызван `/api/setup` | открыть `/api/setup?secret=...` один раз |
| `unauthorized` в логах `/api/webhook` | `WEBHOOK_SECRET` в Vercel не совпадает с тем, что при регистрации | перезапустить `/api/setup` |
| Web App показывает «Открой приложение через бота» | initData невалидный или `BOT_TOKEN` другой | проверить `BOT_TOKEN` и что открываешь из бота |
| `insufficient funds` при первом запуске | у пользователя 0 (стартовый 1000 выдаётся только через `ensureUser`) | сначала `/start` в боте, потом открывать Web App |
| Supabase RPC `play_upgrade` ошибка прав | функция не создана или нет гранта | перезапустить `schema.sql` целиком |

---

## 5. Команды бота

**Игрок:**
* `/start` — приветствие + кнопка открытия Web App
* `/app` или `/upgrade` — кнопка открытия приложения
* `/profile` — баланс и статистика
* `/history` — последние 10 игр

**Админ (только если ID в `ADMIN_IDS`):**
* `/admin` — админ-панель
* `/user <id>` — карточка игрока
* `/stats` — общая статистика бота
* `/give <id> <сумма>` — выдать/списать (`-500` — забрать)
* `/ban <id>`, `/unban <id>` — блокировка
* Inline-кнопки в админке: быстрая выдача 100/1000/10000, своя сумма, бан/разбан, пагинация списка по 8 строкам.

---

## 6. Логи и дебаг

* **Vercel**: `Dashboard → проект → Logs`. В Functions увидишь запросы к `/api/*`, ошибки `bot error:` и `update failed`.
* **Supabase**: `Table Editor → users/upgrades` — глазами проверяй баланс; `SQL Editor → select * from upgrades order by id desc limit 20;`.
* **Telegram webhook**: `https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo` — увидишь текущий URL и последнюю ошибку.

---

## 7. Рекомендации по безопасности

* `SUPABASE_SERVICE_ROLE_KEY` — главный секрет базы. Не коммить, не свети в клиенте, не клади в `index.html`. В этом проекте он используется только в серверных функциях Vercel — корректно.
* `EDGE = 0.05` — комиссия 5% заложена в `chanceOf`. Меняй в `lib/config.ts` под свою математику.
* `MAX_BET = 1_000_000_000` — очень большой верхний предел. Если планируешь реальные ставки/выплаты — снизь.
* RLS включён, политик нет, всё ходит через `service_role`. Анонимный доступ закрыт — это правильно.
