# Font files go here

Drop `.woff2` files in this folder using exactly these names. Nothing else needs
changing — `src/ui/fonts.ts` already declares them and applies the base path.

```
noto-sans-400.woff2      noto-sans-500.woff2
inter-400.woff2          inter-500.woff2
roboto-400.woff2         roboto-500.woff2
open-sans-400.woff2      open-sans-500.woff2
source-sans-3-400.woff2  source-sans-3-500.woff2
```

Only 400 and 500 are used; `base.css` never asks for another weight.

## Where to get them

**https://gwfh.mranftl.com/fonts** — pick the family, then:

1. Tick the charsets **latin**, **latin-ext**, and **vietnamese**.
   The Vietnamese subset is the whole reason this list is curated; without it
   `ế ộ ữ ẳ` fall back mid-word to whatever the system has.
2. Download and keep the `.woff2` files only. Ignore `.woff`, `.ttf`, `.eot` —
   every browser that can run this app supports woff2.
3. Rename to the names above.

All five families are **SIL Open Font License**: free to self-host and
redistribute, with no attribution required in the interface.

## Verifying

The settings screen previews `ế ộ ữ ẳ` beside the font picker. Switch between
families there — if a face is missing its file, the sample will not change
appearance, because the browser silently falls back.
