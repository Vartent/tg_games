# Флотилия (Oil Fleet)

Merge-idle про нефтедобычу в океане. Telegram Mini App. Полная спека — [docs/SPEC.md](docs/SPEC.md).

## Структура

```
src/types.ts      — типы игрового состояния (готово)
src/constants.ts  — все числа экономики, единый источник правды (готово)
src/engine.ts     — игровая логика, чистые функции (СТАБЫ — реализовать по TDD)
tests/            — красные тесты, фиксируют спеку
```

## TDD-процесс

```bash
npm install
npm test          # сейчас всё красное — это техзадание
npx tsc --noEmit  # типы должны проходить всегда
```

Порядок имплементации (от фундамента к надстройкам, каждый шаг = зелёный файл тестов):

1. `tests/economy.test.ts` — формулы добычи, капов, цен, глубины.
2. `tests/grid.test.ts` — покупка вышек, слотов, начальное состояние.
3. `tests/merge.test.ts` — правила слияния.
4. `tests/production.test.ts` — tick: добыча, экипажи, остановка на капе.
5. `tests/spill.test.ts` — появление и чистка разливов, замедление соседей.
6. `tests/tanker.test.ts` — погрузка, рейс, выручка, апгрейды.
7. `tests/helicopter.test.ts` — пул рабочих, назначение.
8. `tests/offline.test.ts` — оффлайн-прогресс (опирается на 4–7).
9. `tests/streak.test.ts` — дейли-стрик.
10. `tests/persistence.test.ts` — сериализация.

После зелёных тестов: UI на PixiJS по SPEC.md §1–2, интеграция Telegram SDK (initData, CloudStorage, бот-пуши через backend), rewarded ads (Adsgram).

## Правила для engine

- Чистые функции: `(state, ...) => state`, без мутаций входного состояния.
- Никаких `Date.now()` / `Math.random()` внутри — время `now: number` (ms) и `rng: () => number` приходят параметрами.
- Ошибки игровых правил — `throw new EngineError(code)`, коды в тестах.

## Definition of done (MVP)

- [ ] Все тесты зелёные, `tsc --noEmit` чистый.
- [ ] UI: сетка, drag-merge, меню вышки, танкер, пятна, вертолёт — по SPEC §1–3.
- [ ] Telegram: запуск как Mini App, сохранение в CloudStorage, 4 бот-пуша.
- [ ] Adsgram: 2 rewarded-плейсмента.
- [ ] Лидерборд по контактам.
- [ ] Прогон на iOS/Android Telegram, 60 fps на среднем устройстве.
