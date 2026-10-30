# Intentionally untranslated catalog values

Phase 8 permits values to remain unchanged when they are brands, technical identifiers,
user-provided examples, or words that are naturally spelled the same in the target language.

- `Monthloom` is a brand name in every locale.
- Currency codes, email addresses such as `alex@example.com`, and stored enum/technical identifiers
  are not translated.
- ICU arguments, rich-text tag names, and punctuation-only templates remain identical by design.
- Short labels and loanwords that are naturally identical to English (for example `Email`, `Menu`,
  `Pizza`, `Film`, `Bus`, and `Villa` in applicable locales) are intentional translations, not
  placeholders.

Any future same-as-English prose that does not fit one of these categories must be translated or
added here with a reason during review.
