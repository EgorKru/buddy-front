import { parseVoiceToTask } from '../parseVoiceToTask';

describe('parseVoiceToTask', () => {
  it('parses reminder with tomorrow and time', () => {
    const result = parseVoiceToTask('Напомни завтра в 10 купить молоко');
    expect(result.kind).toBe('reminder');
    expect(result.title).toBe('Купить молоко');
    expect(result.datePart).toBe('Завтра');
    expect(result.timePart).toBe('10:00');
    expect(result.dueLabel).toContain('Завтра');
    expect(result.category).toBe('Личное');
    expect(result.pagerSteps.length).toBeGreaterThan(2);
  });

  it('parses task with weekday deadline', () => {
    const result = parseVoiceToTask('Подготовить презентацию к пятнице');
    expect(result.kind).toBe('task');
    expect(result.title).toBe('Подготовить презентацию');
    expect(result.datePart).toBe('Пятница');
    expect(result.category).toBe('Работа');
  });

  it('parses greeting and clock time', () => {
    const result = parseVoiceToTask('Привет Pager, созвон с командой в 15:30');
    expect(result.title).toBe('Созвон с командой');
    expect(result.timePart).toBe('15:30');
    expect(result.datePart).toBe('Сегодня');
    expect(result.integrations.some((i) => i.iconId === 'calendar')).toBe(true);
  });
});
