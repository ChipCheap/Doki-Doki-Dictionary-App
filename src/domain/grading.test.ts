import { describe, expect, it } from 'vitest';
import { grade, resolveRequeue } from './grading';
import { LADDER, MASTERED_LEVEL } from './ladder';

const TODAY = 20_000;

describe('grade — promotion', () => {
  it('raises the level and reschedules on a correct answer', () => {
    const r = grade({ level: 3, dueDay: TODAY }, 'correct', TODAY);
    expect(r.level).toBe(4);
    expect(r.dueDay).toBe(TODAY + LADDER[4]!);
    expect(r.requeue).toBe(false);
  });

  it('treats mark-correct identically to correct', () => {
    const a = grade({ level: 3, dueDay: TODAY }, 'correct', TODAY);
    const b = grade({ level: 3, dueDay: TODAY }, 'markCorrect', TODAY);
    expect(b).toEqual(a);
  });

  it('caps at mastery and never beyond', () => {
    const r = grade({ level: MASTERED_LEVEL, dueDay: TODAY }, 'correct', TODAY);
    expect(r.level).toBe(MASTERED_LEVEL);
    expect(r.dueDay).toBe(TODAY + 100);
  });

  it('promotes a brand-new word to level 1, due tomorrow', () => {
    const r = grade({ level: 0, dueDay: TODAY }, 'correct', TODAY);
    expect(r.level).toBe(1);
    expect(r.dueDay).toBe(TODAY + 1);
  });
});

describe('grade — redo', () => {
  it('changes nothing at all and re-queues', () => {
    const r = grade({ level: 4, dueDay: TODAY - 3 }, 'redo', TODAY);
    expect(r.level).toBe(4);
    expect(r.requeue).toBe(true);
  });

  it('leaves the due day untouched, so the card returns next session', () => {
    // The consequence the framework calls out: a deck cannot reach "Caught up"
    // while any redone word is outstanding.
    const r = grade({ level: 4, dueDay: TODAY - 3 }, 'redo', TODAY);
    expect(r.dueDay).toBe(TODAY - 3);
    expect(r.dueDay).toBeLessThanOrEqual(TODAY);
  });
});

describe('grade — demotion', () => {
  it('drops one level and reschedules when nothing is pressed', () => {
    const r = grade({ level: 5, dueDay: TODAY }, 'none', TODAY);
    expect(r.level).toBe(4);
    expect(r.dueDay).toBe(TODAY + LADDER[4]!);
    expect(r.requeue).toBe(true);
  });

  it('floors at level 1 rather than falling to 0', () => {
    const r = grade({ level: 1, dueDay: TODAY }, 'none', TODAY);
    expect(r.level).toBe(1);
  });

  it('drops a mastered word to 8, so mastery is re-verified not granted', () => {
    const r = grade({ level: MASTERED_LEVEL, dueDay: TODAY }, 'none', TODAY);
    expect(r.level).toBe(8);
  });

  it('leaves a level-0 word at 0 and still due — never promotes a failure', () => {
    // The floor of 1 was written for demotions from higher levels. Applied to a
    // new word it would move it UP, scheduling a word the user just failed.
    const r = grade({ level: 0, dueDay: TODAY }, 'none', TODAY);
    expect(r.level).toBe(0);
    expect(r.dueDay).toBe(TODAY);
    expect(r.requeue).toBe(true);
  });
});

describe('resolveRequeue', () => {
  it('clears on a correct answer', () => {
    expect(resolveRequeue('correct').clears).toBe(true);
  });

  it('clears on mark-correct — the exit for a word that will not come', () => {
    expect(resolveRequeue('markCorrect').clears).toBe(true);
  });

  it('re-queues again when still wrong, without bound', () => {
    expect(resolveRequeue('wrong').clears).toBe(false);
  });
});

describe('the grading table as a whole', () => {
  it('moves the level exactly once, at first sight', () => {
    // Whatever happens afterwards, only the first-sight grade moved anything.
    const first = grade({ level: 3, dueDay: TODAY }, 'none', TODAY);
    expect(first.level).toBe(2);

    // Re-query appearances report only whether the card leaves the queue.
    expect(Object.keys(resolveRequeue('wrong'))).toEqual(['clears']);
  });
});
