-- MagnusGrade: схема базы. Выполнить целиком в Supabase -> SQL Editor.

create table if not exists users (
  user_id    bigint primary key,
  username   text,
  balance    bigint not null default 1000 check (balance >= 0),  -- стартовый баланс 1000
  banned     boolean not null default false,
  last_play  timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists upgrades (
  id         bigserial primary key,
  user_id    bigint not null references users(user_id),
  bet        bigint not null,
  multiplier numeric not null,
  chance     numeric not null,
  win        boolean not null,
  payout     bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists upgrades_user_idx on upgrades (user_id, id desc);

-- ожидание ввода суммы в админке
create table if not exists admin_pending (
  admin_id   bigint primary key,
  target     bigint not null,
  page       int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS включён, политик нет: с публичным ключом данные недоступны, сервер ходит через service_role
alter table users enable row level security;
alter table upgrades enable row level security;
alter table admin_pending enable row level security;

-- Атомарная игра: списание ставки, выплата, запись в историю, кулдаун 1 сек
create or replace function play_upgrade(p_user bigint, p_bet bigint, p_mult numeric, p_chance numeric, p_win boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bal bigint; v_pay bigint := 0;
begin
  update users set balance = balance - p_bet, last_play = now()
   where user_id = p_user and not banned and balance >= p_bet
     and (last_play is null or last_play < now() - interval '1 second')
   returning balance into v_bal;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      case when exists (select 1 from users where user_id = p_user and not banned and balance >= p_bet)
           then 'cooldown' else 'funds' end);
  end if;
  if p_win then
    v_pay := floor(p_bet * p_mult)::bigint;
    update users set balance = balance + v_pay where user_id = p_user returning balance into v_bal;
  end if;
  insert into upgrades (user_id, bet, multiplier, chance, win, payout)
  values (p_user, p_bet, p_mult, p_chance, p_win, v_pay);
  return jsonb_build_object('ok', true, 'balance', v_bal, 'payout', v_pay);
end $$;

create or replace function change_balance(p_user bigint, p_amount bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  update users set balance = greatest(balance + p_amount, 0) where user_id = p_user returning balance into v;
  return v;  -- null, если игрока нет
end $$;

create or replace function user_stats(p_user bigint)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('games', count(*),
    'wins', coalesce(sum(case when win then 1 else 0 end), 0),
    'bets', coalesce(sum(bet), 0), 'payouts', coalesce(sum(payout), 0))
  from upgrades where user_id = p_user $$;

create or replace function admin_stats()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('users', count(*), 'banned', count(*) filter (where banned),
    'total', coalesce(sum(balance), 0),
    'games', (select count(*) from upgrades),
    'bets', (select coalesce(sum(bet), 0) from upgrades),
    'payouts', (select coalesce(sum(payout), 0) from upgrades))
  from users $$;

revoke all on function play_upgrade(bigint, bigint, numeric, numeric, boolean),
  change_balance(bigint, bigint), user_stats(bigint), admin_stats() from public, anon, authenticated;
grant execute on function play_upgrade(bigint, bigint, numeric, numeric, boolean),
  change_balance(bigint, bigint), user_stats(bigint), admin_stats() to service_role;
