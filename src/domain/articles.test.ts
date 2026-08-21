import { describe, expect, it } from 'vitest';
import {
  acceptedFormsWithArticle,
  articlesFor,
  displayWithArticle,
  isGender,
  languageUsesGender,
} from './articles';

describe('language coverage', () => {
  it('knows the gendered languages it ships', () => {
    expect(languageUsesGender('es')).toBe(true);
    expect(languageUsesGender('de')).toBe(true);
    expect(languageUsesGender('fr')).toBe(true);
  });

  it('reports Vietnamese as ungendered', () => {
    expect(languageUsesGender('vi')).toBe(false);
  });

  it('rejects values that are not genders', () => {
    expect(isGender('m')).toBe(true);
    expect(isGender('mf')).toBe(true);
    expect(isGender('plural')).toBe(false);
    expect(isGender(undefined)).toBe(false);
  });
});

describe('article selection', () => {
  it('maps gender to the right article per language', () => {
    expect(articlesFor('es', 'm')).toEqual(['el']);
    expect(articlesFor('es', 'f')).toEqual(['la']);
    expect(articlesFor('de', 'n')).toEqual(['das']);
    expect(articlesFor('fr', 'f')).toEqual(['la']);
  });

  it('offers both when a word genuinely takes either', () => {
    expect(articlesFor('es', 'mf')).toEqual(['el', 'la']);
  });

  it('lets an explicit article override the gender rule', () => {
    // `agua` is feminine but takes `el` before a stressed /a/. Without the
    // override the seed pack itself would be wrong.
    expect(articlesFor('es', 'f', 'el')).toEqual(['el']);
  });

  it('returns nothing for a word with no gender', () => {
    expect(articlesFor('es', undefined)).toEqual([]);
    expect(articlesFor('vi', 'm')).toEqual([]);
  });
});

describe('display', () => {
  it('prefixes the article', () => {
    expect(displayWithArticle('es', 'libro', 'm')).toBe('el libro');
  });

  it('shows both options with a slash', () => {
    expect(displayWithArticle('es', 'mar', 'mf')).toBe('el/la mar');
  });

  it('honours the override', () => {
    expect(displayWithArticle('es', 'agua', 'f', 'el')).toBe('el agua');
  });

  it('leaves ungendered words alone', () => {
    expect(displayWithArticle('vi', 'nước')).toBe('nước');
    expect(displayWithArticle('es', 'comer')).toBe('comer');
  });
});

describe('accepted answers', () => {
  it('requires the article — that is the point of the feature', () => {
    expect(acceptedFormsWithArticle('es', 'libro', 'm')).toEqual(['el libro']);
  });

  it('accepts either form when the word takes either', () => {
    expect(acceptedFormsWithArticle('es', 'mar', 'mf')).toEqual(['el mar', 'la mar']);
  });

  it('accepts only the overridden article', () => {
    const forms = acceptedFormsWithArticle('es', 'agua', 'f', 'el');
    expect(forms).toEqual(['el agua']);
    expect(forms).not.toContain('la agua');
  });

  it('is unchanged for words without gender', () => {
    expect(acceptedFormsWithArticle('vi', 'bệnh viện')).toEqual(['bệnh viện']);
    expect(acceptedFormsWithArticle('es', 'salir')).toEqual(['salir']);
  });
});
