# KukkiDo — Детальный план фронтенда Mini App

## Философия дизайна

**Эстетика:** Элитное, минималистичное спортивное приложение. Вдохновление — Rolex, меню дорогого ресторана, премиальные финансовые приложения. Два цвета: оттенки чёрного/серого + золото. Никакого визуального шума.

**Цветовая палитра:**

```css
/* Фоны */
--bg-primary: #FAFAF9;          /* тёплый off-white, основной фон */
--bg-card: #FFFFFF;              /* карточки */
--bg-card-shadow: 0 1px 3px rgba(0,0,0,0.06);
--bg-divider: #E7E5E4;          /* разделители, рамки */

/* Текст */
--text-heading: #0C0A09;        /* заголовки, почти чёрный */
--text-primary: #1C1917;        /* основной текст */
--text-secondary: #78716C;      /* вторичный, подписи */
--text-disabled: #A8A29E;       /* disabled, неактивный */

/* Акцент — золото (единственный цвет) */
--gold-primary: #A16207;        /* кнопки, активные элементы, ссылки */
--gold-dark: #854D0E;           /* hover состояние */
--gold-light: #FEF3C7;          /* фон бейджей, подсветка */

/* Медали */
--medal-gold: #A16207;
--medal-silver: #78716C;
--medal-bronze: #92400E;

/* Статусы (без ярких цветов — через типографику и оттенки) */
--status-active: #A16207;       /* золотой текст */
--status-pending: #78716C;      /* серый текст */
--status-completed: #A8A29E;    /* приглушённый */
--status-urgent: #0C0A09;       /* чёрный bold */
```

**Типографика:**
- Заголовки: `DM Serif Display` (элегантная антиква)
- Тело: `DM Sans` (чистый, идеальная пара к Serif)
- Числа/рейтинг: `DM Mono` (моноширинный, технический вид)

**Принципы:**
- Mobile-first (320–420px — основной экран Telegram Mini App)
- Максимум 2 цвета: серый/чёрный + золото
- Много воздуха, щедрые отступы (padding: 20px)
- Тонкие линии (1px) вместо теней где возможно
- Skeleton loading вместо спиннеров
- НЕТ конфетти, НЕТ bouncing, НЕТ цветных иконок — элитно = сдержанно
- НЕТ эмодзи в интерфейсе — только типографика и тонкие линейные иконки

---

## Глобальные элементы

### Нижняя навигация (Tab Bar)

- Фиксирована внизу, высота 60px + safe area
- Фон: #FFFFFF, тонкая линия сверху (1px #E7E5E4)
- Активная вкладка: --gold-primary (иконка + текст)
- Неактивные: --text-disabled
- Анимация: scale 0.95→1.0 при нажатии
- Haptic feedback через Telegram WebApp API
- 4 вкладки: Tournaments · Training · Rating · Profile

### Заголовки страниц

- DM Serif Display, 28px, --text-heading
- Не фиксированные (скроллятся с контентом)
- Padding-top: 16px

### Toast уведомления

- Slide-down сверху, белый фон
- Золотая полоса слева (4px --gold-primary)
- Чёрный текст, DM Sans 14px
- Автоскрытие через 3 секунды

### Empty States

- Только текст, по центру экрана
- DM Sans, --text-secondary, 15px
- Опционально: текстовая ссылка --gold-primary как CTA
- БЕЗ иллюстраций — чисто и элегантно

### Bottom Sheets

- Белый фон, border-radius: 16px 16px 0 0
- Handle сверху: 4px × 40px, #E7E5E4, border-radius: 2px
- Backdrop: rgba(0,0,0,0.3)
- Slide-up анимация 250ms

---

## Вкладка 1: Турниры

### Список турниров

Заголовок: "Tournaments" (DM Serif Display, 28px)

Фильтры (один эмодзи при нажатии которого будут открываться другие города России):
- Активный фильтр: --gold-primary фон, белый текст, border-radius: 20px
- Неактивный: прозрачный, 1px solid #E7E5E4, --text-secondary

Карточки турниров:
- Белый фон, border-radius: 12px, 1px solid #E7E5E4
- Padding: 20px
- Название: DM Sans, 16px, semibold, --text-primary
- Город + страна: 13px, --text-secondary
- Даты: 13px, --text-secondary
- Importance (точки): --gold-primary, маленькие (12px)
- Entries count: DM Mono, 13px, --text-secondary
- Обратный отсчёт до дедлайна: --text-secondary справа ("32 days left")
- Closing soon (< 7 дней): --text-heading, bold
- Completed: вся карточка opacity 0.5
- Gap между карточками: 12px
- При нажатии: bg → #FAFAF9 (едва заметно)

### Детальная страница турнира

Навигация: тонкая стрелка ← (без текста "Back")

Заголовок: DM Serif Display, 24px, может быть 2 строки

Описание: DM Sans, 14px, --text-secondary

Информационный блок (label-value пары):
- Labels: 11px, uppercase, letter-spacing: 1.5px, --text-disabled
- Values: 15px, --text-primary
- Разделены тонкими горизонтальными линиями

Категории: текст 13px, без pills (просто перечисление через запятую или в 2 колонки)

Весовые: маленькие pills с тонкой рамкой (1px #E7E5E4), 12px

Entries: минималистичный список, пунктирные разделители
- Имя: DM Sans, 15px, --text-primary
- Параметры: 13px, --text-secondary
- Статус (pending/approved): 12px, italic, --text-disabled или --gold-primary

Кнопка "Enter athletes" (для тренера):
- Единственный filled элемент: --gold-primary фон, белый текст
- border-radius: 8px, padding: 14px
- Полная ширина

Ссылка "Mark as interested" (для спортсмена):
- Текстовая, --gold-primary, без фона
- По центру, под основной кнопкой

### Bottom Sheet: Заявка на турнир

Заголовок: "Select athletes" (DM Serif Display, 20px)

Список спортсменов:
- Кастомные radio-кнопки: тонкий круг 20px
- Невыбранный: 1px --text-disabled
- Выбранный: --gold-primary заливка
- Имя + параметры в строку

Кнопка подтверждения:
- "Confirm · N athletes"
- --gold-primary фон, белый текст
- Disabled (серый) если 0 выбрано

### Результаты турнира (после завершения)

Переключатель вкладок [Details] [Results]:
- Активная: подчёркивание 2px --gold-primary
- Неактивная: --text-secondary

Результаты по категориям:
- Категория: 11px, uppercase, --text-disabled, letter-spacing
- Номера мест: DM Mono, цвет медали (gold/silver/bronze)
- Имена: DM Sans, --text-primary
- Города: --text-secondary, выровнены вправо

---

## Вкладка 2: Дневник тренировок

### Главный экран

Заголовок: "Training Log" (DM Serif Display, 28px)

Календарь:
- Навигация: ◄ February 2026 ► (DM Sans, 16px, semibold)
- Дни недели: 11px, uppercase, --text-disabled
- Числа: DM Sans, 14px, --text-primary
- Сегодня: число в золотом круге (--gold-primary фон, белый текст, 28px круг)
- Точки тренировок: 4px круг --gold-primary, под числом
- Свайп для смены месяца
- Стрелки: --text-disabled

Summary блок:
- Label: "SUMMARY" — 11px, uppercase, letter-spacing, --text-disabled
- Три метрики в ряд: sessions / hours / avg intensity
- Числа: DM Mono, 28px, --text-heading
- Подписи: 11px, uppercase, --text-disabled

Weight trend:
- Label: "WEIGHT" — 11px, uppercase
- Тонкая линия-график --gold-primary (3 последние точки с подписями)
- Изменение: DM Mono, --text-secondary ("−0.7 kg this month")

Recent sessions (список):
- Без карточек — строки с пунктирными разделителями
- Тип: DM Sans, 15px, semibold, --text-primary
- Дата + длительность + интенсивность: 13px, --text-secondary
- Заметки: 13px, --text-secondary, italic
- Вес справа: DM Mono, 15px, --text-primary
- Комментарий тренера: italic, --gold-primary, "— Coach Kim"
- Интенсивность НЕ цветными точками, а текстом (Light / Medium / High)

FAB кнопка "+ Добавить":
- Круг 48px, --gold-primary фон, белый "+"
- Позиция: fixed, right: 20px, bottom: 80px (над tab bar)
- Тень: 0 2px 8px rgba(0,0,0,0.15)

### Добавление тренировки (Bottom Sheet)

Заголовок: "New session" (DM Serif Display, 20px)

Поля:
- Labels: 11px, uppercase, letter-spacing, --text-disabled
- Pills для выбора (дата, тип, длительность, интенсивность):
  - Выбранный: --gold-primary фон, белый текст
  - Невыбранный: прозрачный, 1px --text-disabled
- Weight input: underline стиль (только нижняя линия)
  - При фокусе: underline → --gold-primary
  - Placeholder: последний записанный вес
- Notes: expandable textarea, underline стиль

Типы тренировок (только текст, без эмодзи):
- Sparring / Technique / Physical / Poomsae / Cardio / Other

Кнопка Save: --gold-primary, полная ширина

### Вид тренера

Dropdown сверху: "Viewing: Alikhanov Damir ▼"
- DM Sans, --gold-primary
- При нажатии: список спортсменов
- Выбор спортсмена → загрузка его дневника

---

## Вкладка 3: Рейтинг

### Главный экран

Заголовок: "Rating" (DM Serif Display, 28px)

Фильтры (3 ряда chips):
- Страна: [All] [KG] [KZ] [UZ] [RU]
- Весовая: [All] [-54] [-58] [-63] [-68] [-74] [-80] [-87] [+87]
- Пол: [All] [M] [F]
- Стиль chips: как на странице турниров

Подиум (топ-3):
- Минималистичные прямоугольники-постаменты разной высоты
- 1 место: центр, самый высокий, --gold-primary рамка вокруг аватара
- 2 место: слева, --medal-silver рамка
- 3 место: справа, --medal-bronze рамка
- Номера мест: DM Mono, 48px (1), 36px (2, 3)
- Аватары: инициалы в кругах (60px для 1-го, 48px для 2-3)
- Имена: DM Sans, 14px, --text-primary
- Города: 12px, --text-secondary
- Очки: DM Mono, 16px, --text-heading
- Анимация при загрузке: постаменты растут снизу (300ms, ease-out, задержка 100ms каждый)

Список ниже подиума:
- Разделитель: тонкая линия
- Номер: DM Mono, 16px, --text-disabled, фиксированная ширина 32px
- Имя: DM Sans, 15px, --text-primary
- Город + весовая: 13px, --text-secondary
- Очки: DM Mono, 16px, --text-heading, справа
- Тонкие разделители между строками

"Your rank" бейдж:
- Плавающий, 12px над tab bar, по центру
- Фон: --gold-light
- Текст: --gold-primary, DM Mono, 13px
- "Your rank: #47"
- Нажатие → скролл к своей позиции
- Скрыт для тренеров без атлетического профиля

### Профиль из рейтинга

При нажатии на спортсмена — открывается его публичный профиль:
- Аватар, ФИО, дан, весовая, город
- Статистика: рейтинг / турниры / медали
- История турниров (последние 10)
- Кнопка ← назад

---

## Вкладка 4: Профиль

### Профиль спортсмена

Иконка настроек: ⚙ тонкая линейная, --text-disabled, справа вверху

Аватар: 96px круг, 1px рамка --gold-primary

Имя: DM Serif Display, 22px, --text-heading
Параметры: DM Sans, 14px, --text-secondary ("2 Dan · -68kg")

Статистика (3 колонки, разделённые вертикальной линией 1px):
- Числа: DM Mono, 24px, --text-heading
- Подписи: 10px, uppercase, letter-spacing: 1.5px, --text-disabled
- Rating (#47) / Tourneys / Medals

Information (label-value пары):
- Section label: "INFORMATION" — 11px, uppercase, --text-disabled
- Field label: 11px, --text-disabled
- Field value: 15px, --text-primary
- Coach: --gold-primary, кликабельно → профиль тренера

Tournament History (раскрывающаяся секция):
- По умолчанию свёрнута
- "TOURNAMENT HISTORY ▼"
- При раскрытии: место (DM Mono, цвет медали) + название + дата

Кнопка "Edit profile":
- Outlined: 1px --gold-primary, --gold-primary текст
- border-radius: 8px
- Полная ширина

### Профиль тренера

Аналогичная структура, но:

Статистика: 2 колонки — Athletes (15) / Active entries (3)

Секция "ATHLETES":
- Список спортсменов (пунктирные разделители)
- Имя: DM Sans, 15px, --text-primary
- Параметры + рейтинг: 13px, --text-secondary
- Рейтинг #1: --gold-primary
- "+ Add athlete" — текстовая ссылка, --gold-primary

Секция "ACTIVE ENTRIES":
- Название турнира: 15px, --text-primary
- "3 athletes · pending" — 13px, --text-secondary
- "Edit →" — --gold-primary ссылка

### Редактирование профиля

Навигация: ← Edit

Аватар с иконкой камеры (нажатие → смена фото)

Input стиль: только нижняя линия (underline)
- Обычное состояние: 1px --bg-divider
- Фокус: --gold-primary
- Изменённое поле: --gold-primary underline

Labels: 11px, uppercase, --text-disabled

Weight Category: pills (как в регистрации)

Belt: dropdown с underline

Кнопка Save: --gold-primary, полная ширина, disabled пока нет изменений

### Настройки

Секции разделены тонкими линиями:

LANGUAGE:
- Radio buttons (●/○), выбранный --gold-primary

NOTIFICATIONS:
- Toggle switches, активный --gold-primary, неактивный --text-disabled

ACCOUNT:
- Текстовые ссылки с → справа
- Request coach role / Export data / About / Support

Delete account: --text-disabled (не красный)

Версия: DM Mono, 11px, --text-disabled, по центру внизу

---

## Анимации

### Переходы
- Между вкладками: crossfade 150ms
- Вглубь (список → деталь): slide from right 200ms ease-out
- Bottom sheets: slide up 250ms spring

### Загрузка
- Skeleton: пульсация #E7E5E4 → #F5F5F4
- Без спиннеров

### Интеракции
- Нажатие кнопки: opacity 0.8, 100ms
- Radio/checkbox: заливка --gold-primary, 150ms
- Toggle: smooth slide, 200ms
- Toast: slide-down 200ms, auto-hide 3s

### Подиум
- Постаменты: grow from bottom 300ms ease-out (3→2→1, delay 100ms)
- Имена/очки: fade in после постаментов

---

## Telegram WebApp

```javascript
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#FAFAF9');
  tg.setBackgroundColor('#FAFAF9');
}

// Back Button на вложенных страницах
tg.BackButton.show();
tg.BackButton.onClick(() => navigate(-1));

// Main Button для действий
tg.MainButton.setText('Confirm · 3 athletes');
tg.MainButton.show();
tg.MainButton.onClick(handleSubmit);

// Haptic
tg.HapticFeedback.impactOccurred('light');   // tab switch
tg.HapticFeedback.impactOccurred('medium');  // button press
tg.HapticFeedback.notificationOccurred('success'); // save
```

---

## Адаптивность

### Mobile (320–420px) — основной
- padding: 20px
- safe-area-inset-bottom для iPhone

### Desktop browser (> 420px)
- max-width: 420px, центрирован
- Тонкая тень по бокам контейнера
- Баннер: "Open in Telegram for full experience" (--gold-light фон)

### Тёмная тема (автоматически от Telegram)
```css
--bg-primary: #0C0A09;
--bg-card: #1C1917;
--bg-divider: #292524;
--text-heading: #FAFAF9;
--text-primary: #E7E5E4;
--text-secondary: #78716C;
--text-disabled: #57534E;
--gold-primary: #D4A857;
--gold-light: #292524;
```
