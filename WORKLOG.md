# Бункер P2P — Рабочий лог и карта проекта

> **Инструкция для агента:** перед началом работы прочитай этот файл вместо перечитывания всех файлов проекта. После завершения своего шага обязательно обнови раздел «Текущий статус» и добавь запись в «Лог действий».
> Для экономии контекста и предотвращения таймаутов делай по **одному чёткому этапу за ход** и держи большие наборы данных в отдельных модулях.

## Репозиторий и стек
- **Путь:** `C:\Users\Пользователь\.gemini\antigravity\scratch\bunker-p2p`
- **Git remote:** `origin` -> `https://github.com/Zeadek/bunker.git` (ветка `main`). Автоматический `git push` / `git pull` без явного запроса пользователя не выполнять.
- **Проверка типов и тестов:**
  - `.\node_modules\.bin\tsc.cmd --noEmit`
  - `npm test` / `vitest`

## Карта ключевых файлов (`src/`)
- `src/game/types.ts` — типы характеристик (`TraitCategory`), `BonusTrait`, `removed`, `TraitAbilityKind` (14 видов), `SpecialCardType` (22 вида, `isAdult`), `GameSettings` (`enableAdultContent`, `enabledTraits`, `customFields`, `specialCardsPerPlayer`), `Player`, `PublicPlayer`, `GamePack`.
- `src/game/specials.ts` — шаблоны 22 спецкарт (`SPECIAL_CARD_TEMPLATES`, включая 18+ карты).
- `src/game/packs_extra.ts` — дополнительные обычные карточки (чёрный/абсурдный юмор) для `classic` и `fantasy`.
- `src/game/packs_adult.ts` — 18+ карточки (`isAdult: true`) для `classic` и `fantasy`.
- `src/game/data.ts` — базовые паки, подключение `packs_extra.ts` и `packs_adult.ts`, `mergePacks(packIds, enableAdultContent)`.
- `src/game/abilities.ts` — распознавание способностей профессий/предметов/хобби/фактов и их бейджи (`getAbilityShortBadge`).
- `src/game/engine.ts` — игровая логика, генерация игроков/бункера, обработка способностей и спецкарт, формирование `PublicPlayer` / `getPlayerView`.
- `src/game/engine.test.ts` — юнит-тесты движка.
- `src/components/LobbyScreen.tsx` и игровой UI — интерфейс лобби, настроек пака и игрового стола.

## Текущий статус этапов
- [x] **Шаг 0:** Типы (`types.ts`) и шаблоны спецкарт (`specials.ts`).
- [x] **Шаг 1:** Модульные паки (`packs_extra.ts`, `packs_adult.ts`) и `mergePacks` в `data.ts`.
- [x] **Шаг 2:** Обновить `abilities.ts` (все 14 `TraitAbilityKind` + ключевые слова) и `engine.ts` (новые поля `GameSettings`/`Player`/`PublicPlayer`, 22 спецкарты, 14 способностей, `enableAdultContent`, `enabledTraits`/`customFields`/`bonusTraits`/`removed`).
- [x] **Шаг 3:** Обновить UI (`LobbyScreen.tsx`, игровой экран) под 18+ настройку, выбор полей/кастомных полей, `bonusTraits`, `removed` и новые способности/спецкарты.
- [x] **Шаг 4:** Обновить `engine.test.ts`, прогнать `tsc --noEmit`, тесты и сборку.
- [x] **Шаг 5:** UI/UX-полировка (5 правок) + скрытое голосование (`voteDetails` только в `round_result`).
- [x] **Шаг 6:** Добавить «Разбор выживания» (`evaluateBunkerSurvival`) в финал, тесты на скрытое голосование и разбор выживания, прогнать `tsc --noEmit`, `vitest run`, `npm run build` и сделать `git push origin main`.
- [x] **Шаг A:** Добавить `adultIntensity` (`mixed` / `high` / `only`), фильтр «Все карты» / «Только 18+» и бейджи 18+ в Инспекторе паков, а также свежие 18+ карты в `packs_adult.ts` и `specials.ts`.
- [x] **Шаг B:** Переработать систему Бункера (`bunkerData.ts`, `BunkerInfo` с `title`/`location`/`layoutNote`/`rooms`/`stats`, связь с `repair_bunker`/`sabotage_bunker`/картами бункера и `evaluateBunkerSurvival`, новый UI Бункера в `GameScreen.tsx`).
- [x] **Шаг C:** Исправить прыжок чата на ПК (`scrollTop`), создать `src/game/scoring.ts` (`CardTag`, `scoreTraitCard`, `scorePlayer`), добавить AI-ботов (`isBot`, `addBotPlayer`, `removeBotPlayer`, `runBotTurn`, кнопки в `LobbyScreen.tsx`, автоход в `App.tsx`, бейдж «🤖 БОТ» в `GameScreen.tsx`) и тесты.
- [x] **Шаг C.2:** Исправить правила раундов/ничьей/скипа (макс. 1 кик/раунд, ничья -> скип раунда, игра до `alive <= capacity`), улучшить логику ботов и `scorePlayer`, добавить редких ботов-отсылок (`★`) и 3 спецкарты (`expand_bunker`, `shrink_bunker`, `revive_exiled`).
- [x] **Шаг C.3:** Разделить `biology` и `physiology` («Физиология») в `types.ts`, паках (`data.ts`, `packs_extra.ts`, `packs_adult.ts`), `scoring.ts` и UI; добавить гарантию фертильности в `startGame` и тесты.

## Лог действий
- **2026-11-27 12:24:** Обновлён `src/game/types.ts`, создан `src/game/specials.ts` (новые типы способностей, 22 спецкарты, поддержка `BonusTrait`, `removed`, `enableAdultContent`, `customFields`).
- **2026-11-27 13:05:** Созданы `src/game/packs_extra.ts` и `src/game/packs_adult.ts`, обновлён `src/game/data.ts` (`mergePacks` с `enableAdultContent`). По `tsc --noEmit` остались ожидаемые ошибки в `abilities.ts` и `engine.ts` до выполнения Шага 2.
- **2026-11-27 13:13:** Выполнен Шаг 2: обновлены `src/game/abilities.ts` (все 14 `TraitAbilityKind` и бейджи) и `src/game/engine.ts` (инициализация новых полей настроек/игроков, `enableAdultContent`, `enabledTraits`/`customFields`, 22 спецкарты, 14 способностей, `revealBonusTrait`, `PublicPlayer` с `revealedBonusTraits`/`removedCategories`/`silenced`). `.\node_modules\.bin\tsc.cmd --noEmit` прошёл с кодом 0 без ошибок.
- **2026-11-27 13:18:** Выполнен Шаг 3: обновлены `src/App.tsx` (`REVEAL_BONUS_TRAIT`, `targetCategory`), `src/components/LobbyScreen.tsx` (18+ переключатель, `specialCardsPerPlayer`, `enabledTraits`, `customFields`), `src/components/GameScreen.tsx` (`bonusTraits`/`revealedBonusTraits`, `removed`/`removedCategories`, `silenced`, модалки для 14 способностей и 22 спецкарт). `.\node_modules\.bin\tsc.cmd --noEmit` прошёл с кодом 0 без ошибок.
- **2026-11-27 13:23:** Выполнен Шаг 4: добавлены тесты в `src/game/engine.test.ts` (18+ фильтрация, `enabledTraits`/`customFields`/`bonusTraits`/`revealBonusTrait`, `erase_field`/`steal_pocket`/`calm_phobia`/`remove_trait`, `bribe_bunker`/`silenced`/`sabotage_bunker`/`clone_trait`), исправлен приоритет `'вор-тень'` -> `steal_pocket` в `abilities.ts`. `tsc --noEmit` (0 ошибок), `vitest run` (9/9 тестов) и `npm run build` (`vite build`) прошли успешно.
- **2026-11-27 14:07:** Выполнен Шаг 5: исправлены 5 UI/UX-шероховатостей (финал `game_over` без «Скрыто», блокировка способностей невскрытых карт, заглушка «Нет доступных целей», скрытие отключённых/удалённых и управление `bonusTraits` в Мастер-панели, вкладка «Спецкарты» в инспекторе, `Escape` и `aria-label`) + добавлено скрытое голосование (`VoteDetail` / `voteDetails` в `RoundResult`, бейдж `✓ Голос отдан` в `voting`, расшифровка голосов в `round_result`). `tsc --noEmit` прошёл с кодом 0.
- **2026-11-27 14:10:** Выполнен Шаг 6: добавлен «Разбор выживания» (`SurvivalEvaluation` в `types.ts`, `evaluateBunkerSurvival` в `engine.ts` и финальный блок в `GameScreen.tsx`), добавлены тесты на скрытое голосование и разбор выживания в `engine.test.ts`. `tsc --noEmit` (0 ошибок), `vitest run` (11/11 тестов) и `npm run build` (`vite build` за 7.01s) прошли успешно.
- **2026-11-28 01:03:** Выполнен Шаг A: добавлена настройка `adultIntensity` (`mixed` / `high` / `only`) в `types.ts`, `data.ts`, `engine.ts` и `LobbyScreen.tsx`; в Инспекторе паков добавлен фильтр «Все карты» / «🔞 Только 18+» и бейджи `18+` на карточках `adult`-блока; добавлены новые 18+ карты в `packs_adult.ts` и 3 новые 18+ спецкарты в `specials.ts` (`truth_or_dare`, `dark_deal`, `organ_harvest`). `tsc --noEmit` (0 ошибок) и `vitest run` (11/11 тестов) прошли успешно.
- **2026-11-28 01:17:** Выполнен Шаг B: переработана система Бункера — создан `src/game/bunkerData.ts`, расширен `BunkerInfo` (`title`, `location`, `layoutNote`, `rooms`, `stats`), в `engine.ts` реализована генерация отсеков и 4 шкал, влияние вскрытия карт/ремонта/саботажа на бункер и учёт состояния отсеков/шкал в `evaluateBunkerSurvival`; обновлён блок Бункера в `GameScreen.tsx`; добавлен тест в `engine.test.ts`. `tsc --noEmit` (0 ошибок) и `vitest run` (12/12 тестов) прошли успешно.
- **2026-11-28 01:38:** Выполнен Шаг C: исправлен прыжок чата на ПК (`chatScrollRef.current.scrollTop = scrollHeight` в `GameScreen.tsx`), создан `src/game/scoring.ts` (`CardTag`, `scoreTraitCard`, `scorePlayer`), добавлены AI-боты (`isBot`, `addBotPlayer`, `removeBotPlayer`, `runBotTurn` в `engine.ts`, кнопки в `LobbyScreen.tsx`, автоход в `App.tsx`, бейдж «🤖 БОТ» в `GameScreen.tsx`) и тесты в `engine.test.ts`. `tsc --noEmit` (0 ошибок) и `vitest run` (14/14 тестов) прошли успешно.
- **2026-11-28 02:02:** Выполнен Шаг C.2: `computeKicksSchedule` (макс. 1 изгнание в раунд), ничья и победа «Скипнуть раунд» скипают раунд без случайных вылетов, игра идёт пока `alive > capacity` (+ защитный лимит); в `scoring.ts` добавлен бонус за полезные способности; в `runBotTurn` — вероятностное голосование с индивидуальным разбросом и шансом на скип; добавлены редкие боты-отсылки (`★`, 5% шанс) и 3 спецкарты (`expand_bunker`, `shrink_bunker`, `revive_exiled`). `tsc --noEmit` (0 ошибок) и `vitest run` (16/16 тестов) прошли успешно.
- **2026-11-28 02:19:** Выполнен Шаг C.3: добавлена отдельная категория `physiology` («Физиология») в `types.ts`, паки (`data.ts`, `packs_extra.ts`, `packs_adult.ts`), `scoring.ts` и UI; добавлена гарантия фертильности при старте игры (`startGame` в `engine.ts`) и тест в `engine.test.ts`. `tsc --noEmit` (0 ошибок), `vitest run` (17/17 тестов) и `npm run build` (`vite build` за 7.95s) прошли успешно.

## Заметки на доработку (фидбек пользователя)
- **Бункер (переделать позже):** сейчас блок бункера визуально перегружен, а реальной глубины механик нет — отсеки предсказуемы (почти всегда 2 работают, 1 сломан, 1 заблокирован) и бесполезны, угрозы скучные, решаются 1 кнопкой и при большом количестве игроков легко перекрываются. Нужно упростить подачу и сделать настоящие интерактивные механики с выбором/риском.
- **18+ карточки (позже):** подсушить длинные 18+ профессии и заменить душноватые хобби (например, «Флирт с детектором лжи и допрос случайных знакомых») на более короткие и смешные.
