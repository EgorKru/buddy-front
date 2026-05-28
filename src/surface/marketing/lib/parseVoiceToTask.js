function weekdayLabel(raw) {
  const r = raw.toLowerCase();
  if (r.startsWith('понедельник') || r === 'пн') return 'Понедельник';
  if (r.startsWith('вторник') || r === 'вт') return 'Вторник';
  if (r.startsWith('сред') || r === 'ср') return 'Среда';
  if (r.startsWith('четверг') || r === 'чт') return 'Четверг';
  if (r.startsWith('пятниц') || r === 'пт') return 'Пятница';
  if (r.startsWith('суббот') || r === 'сб') return 'Суббота';
  if (r.startsWith('воскресень') || r === 'вс') return 'Воскресенье';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatTime(hours, minutes = 0) {
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

function extractDatePart(text) {
  if (/послезавтра/i.test(text)) return 'Послезавтра';
  if (/завтра/i.test(text)) return 'Завтра';
  if (/сегодня/i.test(text)) return 'Сегодня';

  const weekdayMatch = text.match(
    /к\s+(понедельник[а-яё]*|пн|вторник[а-яё]*|вт|сред[а-яё]*|ср|четверг[а-яё]*|чт|пятниц[а-яё]*|пт|суббот[а-яё]*|сб|воскресень[а-яё]*|вс)/i
  );
  if (weekdayMatch) return weekdayLabel(weekdayMatch[1]);

  return null;
}

function extractTimePart(text) {
  const clockMatch =
    text.match(/в\s+(\d{1,2})\s*[:.]\s*(\d{2})/i) ||
    text.match(/(\d{1,2})\s*[:.]\s*(\d{2})/) ||
    text.match(/в\s+(\d{1,2})(?:\s*(?:час|часа|часов))?/i);

  if (!clockMatch) return null;

  const hours = Number(clockMatch[1]);
  const minutes = clockMatch[2] ? Number(clockMatch[2]) : 0;
  if (hours < 0 || hours > 23) return null;

  return formatTime(hours, minutes);
}

function extractDueLabel(datePart, timePart) {
  const parts = [datePart, timePart].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function extractTitle(text) {
  let title = text
    .replace(/^[\s«»"']+|[\s«»"']+$/g, '')
    .replace(/^привет,?\s*pager,?\s*/i, '')
    .replace(/^pager,?\s*/i, '')
    .replace(/^напомни\s+(?:мне\s+)?(?:про\s+|о\s+)?/i, '')
    .replace(/^создай\s+задачу\s*/i, '')
    .replace(/^добавь\s+(?:задачу\s+)?/i, '')
    .replace(/(?:^|\s)(завтра|послезавтра|сегодня)(?=\s|$|[,.])/gi, ' ')
    .replace(
      /(?:^|\s)к\s+(понедельник[а-яё]*|пн|вторник[а-яё]*|вт|сред[а-яё]*|ср|четверг[а-яё]*|чт|пятниц[а-яё]*|пт|суббот[а-яё]*|сб|воскресень[а-яё]*|вс)(?=\s|$|[,.])/gi,
      ' '
    )
    .replace(
      /(?:^|\s)в\s+\d{1,2}(?:\s*[:.]\s*\d{2})?(?:\s*(?:час|часа|часов))?(?=\s|$|[,.])/gi,
      ' '
    )
    .replace(/(?:^|\s)\d{1,2}\s*[:.]\s*\d{2}(?=\s|$|[,.])/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!title) return 'Новая задача';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function inferCategory(text) {
  if (/молоко|ресторан|магазин|купить|дом|семь/i.test(text)) return 'Личное';
  if (/презентац|api|документ|коман|созвон|встреч|sprint|проект/i.test(text)) return 'Работа';
  return 'Задачи';
}

function inferPriority(kind, text) {
  if (kind === 'reminder') return 'Средний';
  if (/срочно|важно|как можно/i.test(text)) return 'Высокий';
  return 'Обычный';
}

function buildPagerSteps({ kind, datePart, timePart, category }) {
  const steps = ['Распознал голос и выделил смысл фразы'];

  if (datePart || timePart) {
    steps.push('Определил дату и время из речи');
  }

  if (kind === 'reminder') {
    steps.push('Создал напоминание с уведомлением');
  } else {
    steps.push('Добавил задачу в ваш список дел');
  }

  if (category === 'Работа') {
    steps.push('Привязал к рабочему контексту');
  }

  steps.push('Предложил добавить событие в календарь');

  return steps;
}

function buildIntegrations({ datePart, timePart, kind }) {
  const items = [{ iconId: 'tasks', label: 'В списке задач Pager' }];

  if (datePart || timePart) {
    items.push({ iconId: 'calendar', label: 'Слот в календаре' });
    items.push({
      iconId: 'bell',
      label: kind === 'reminder' ? 'Пуш за 15 мин до' : 'Напоминание в день события',
    });
  }

  items.push({ iconId: 'message', label: 'Можно обсудить в чате' });

  return items;
}

/**
 * Игрушечный парсер для лендинга: текст → карточка задачи.
 * @param {string} transcript
 */
export function parseVoiceToTask(transcript) {
  const text = (transcript || '').trim();
  if (!text) {
    return {
      title: 'Новая задача',
      dueLabel: null,
      datePart: null,
      timePart: null,
      kind: 'task',
      category: 'Задачи',
      priority: 'Обычный',
      transcript: '',
      pagerSteps: [],
      integrations: [],
    };
  }

  const kind = /напомни/i.test(text) ? 'reminder' : 'task';
  const datePart = extractDatePart(text);
  const timePart = extractTimePart(text);
  const category = inferCategory(text);
  const priority = inferPriority(kind, text);
  const parsed = {
    title: extractTitle(text),
    dueLabel: extractDueLabel(datePart, timePart),
    datePart: datePart || (timePart ? 'Сегодня' : null),
    timePart,
    kind,
    category,
    priority,
    transcript: text,
    pagerSteps: buildPagerSteps({ kind, datePart, timePart, category }),
    integrations: buildIntegrations({ datePart, timePart, kind }),
  };

  return parsed;
}
