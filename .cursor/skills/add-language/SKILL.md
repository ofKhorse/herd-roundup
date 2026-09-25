---
name: add-language
description: >-
  Add a formatter, linter, CI job, EditorConfig section, and Cursor rule when
  introducing a language. Use when adding a language, toolchain, Prettier,
  ESLint, formatter, linter, or CI for a new file type.
---

# Add a language

Do this in the same pull request that introduces the language.

1. Add the formatter and linter as project dependencies. Put the command names in `package.json` or that language's standard manifest.
2. Add a GitHub Actions job that runs those commands on pull requests.
3. Add an EditorConfig section when the language needs an indent or charset that differs from the root.
4. Add `.cursor/rules/<language>.mdc`. Set `alwaysApply` to false, set `globs` to that language's files, and name the commands in the rule.
5. Keep secrets out of the workflow. CI only checks files in the repository.

HTML, CSS, and JavaScript use Prettier. The format job is `.github/workflows/format.yml`.
