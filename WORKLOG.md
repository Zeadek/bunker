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

## Лог действий
- **2026-11-27 12:24:** Обновлён `src/game/types.ts`, создан `src/game/specials.ts` (новые типы способностей, 22 спецкарты, поддержка `BonusTrait`, `removed`, `enableAdultContent`, `customFields`).
- **2026-11-27 13:05:** Созданы `src/game/packs_extra.ts` и `src/game/packs_adult.ts`, обновлён `src/game/data.ts` (`mergePacks` с `enableAdultContent`). По `tsc --noEmit` остались ожидаемые ошибки в `abilities.ts` и `engine.ts` до выполнения Шага 2.
- **2026-11-27 13:13:** Выполнен Шаг 2: обновлены `src/game/abilities.ts` (все 14 `TraitAbilityKind` и бейджи) и `src/game/engine.ts` (инициализация новых полей настроек/игроков, `enableAdultContent`, `enabledTraits`/`customFields`, 22 спецкарты, 14 способностей, `revealBonusTrait`, `PublicPlayer` с `revealedBonusTraits`/`removedCategories`/`silenced`). `.\node_modules\.bin\tsc.cmd --noEmit` прошёл с кодом 0 без ошибок.
- **2026-11-27 13:18:** Выполнен Шаг 3: обновлены `src/App.tsx` (`REVEAL_BONUS_TRAIT`, `targetCategory`), `src/components/LobbyScreen.tsx` (18+ переключатель, `specialCardsPerPlayer`, `enabledTraits`, `customFields`), `src/components/GameScreen.tsx` (`bonusTraits`/`revealedBonusTraits`, `removed`/`removedCategories`, `silenced`, модалки для 14 способностей и 22 спецкарт). `.\node_modules\.bin\tsc.cmd --noEmit` прошёл с кодом 0 без ошибок.
- **2026-11-27 13:23:** Выполнен Шаг 4: добавлены тесты в `src/game/engine.test.ts` (18+ фильтрация, `enabledTraits`/`customFields`/`bonusTraits`/`revealBonusTrait`, `erase_field`/`steal_pocket`/`calm_phobia`/`remove_trait`, `bribe_bunker`/`silenced`/`sabotage_bunker`/`clone_trait`), исправлен приоритет `'вор-тень'` -> `steal_pocket` в `abilities.ts`. `tsc --noEmit` (0 ошибок), `vitest run` (9/9 тестов) и `npm run build` (`vite build`) прошли успешно.
