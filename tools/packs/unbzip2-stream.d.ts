/**
 * `unbzip2-stream` ships no types.
 *
 * Declared locally rather than pulling a `@types` package that does not exist.
 * The module's whole surface is a factory returning a Transform stream, which
 * is all this pipeline uses it for — decompressing Tatoeba's exports, the only
 * format Tatoeba publishes and one Node's zlib cannot read.
 */
declare module 'unbzip2-stream' {
  import type { Transform } from 'node:stream';
  export default function unbzip2Stream(): Transform;
}
