/**
 * The packs bundled with this build.
 *
 * v1 ships packs with the app rather than downloading them, so this is a static
 * list. Each entry names both layers: the core pack (per target language) and
 * the meaning layer (per base language).
 */

export interface CatalogEntry {
  language: string;
  languageName: string;
  baseLanguage: string;
  corePath: string;
  meaningPath: string;
  /** Set while the content is a fixture rather than sourced data. */
  provisional?: boolean;
}

const base = import.meta.env.BASE_URL;

export const CATALOG: readonly CatalogEntry[] = Object.freeze([
  {
    language: 'es',
    languageName: 'Spanish',
    baseLanguage: 'en',
    corePath: `${base}packs/es-core.seed.json`,
    meaningPath: `${base}packs/es-meaning-en.seed.json`,
    provisional: true,
  },
  {
    language: 'vi',
    languageName: 'Vietnamese',
    baseLanguage: 'en',
    corePath: `${base}packs/vi-core.seed.json`,
    meaningPath: `${base}packs/vi-meaning-en.seed.json`,
    provisional: true,
  },
]);

export function catalogEntry(language: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.language === language);
}
