/**
 * S8 — the sequence tag.
 *
 * Words in an ordered paradigm — numbers, weekdays, months — are learned as a
 * series, not as isolated vocabulary. Nobody wants 1, 20, 100000, 7, 14 jumbled
 * into a quiz, so deck quick-create excludes them by default.
 *
 * Named explicitly per language rather than detected. These are small closed
 * sets, and detection from the source would be less reliable than a list —
 * kaikki's own numeral tagging does not carry the position, which is the part a
 * future counting feature actually needs.
 */

import type { SequenceTag } from '../../src/dictionary/pack-format';
import { normalizeTerm } from './registry';

type Paradigm = Readonly<Record<string, readonly string[]>>;

const PARADIGMS: Readonly<Record<string, Paradigm>> = Object.freeze({
  es: Object.freeze({
    number: Object.freeze([
      'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
      'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
      'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'treinta', 'cuarenta',
      'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'mil',
    ]),
    weekday: Object.freeze([
      'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
    ]),
    month: Object.freeze([
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
      'septiembre', 'octubre', 'noviembre', 'diciembre',
    ]),
  }),
  vi: Object.freeze({
    number: Object.freeze([
      'không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín',
      'mười', 'trăm', 'nghìn', 'triệu',
    ]),
    weekday: Object.freeze([
      'chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy',
    ]),
  }),
});

/**
 * The sequence position of a term, if it belongs to a paradigm.
 *
 * Ordinals start at 0 where the series does — `cero` is genuinely the zeroth
 * number — so the position is the value, not merely an index.
 */
export function sequenceFor(language: string, term: string): SequenceTag | undefined {
  const paradigms = PARADIGMS[language];
  if (!paradigms) return undefined;

  const needle = normalizeTerm(term);
  for (const [group, members] of Object.entries(paradigms)) {
    const ordinal = members.findIndex((m) => normalizeTerm(m) === needle);
    if (ordinal >= 0) return { group, ordinal };
  }
  return undefined;
}
