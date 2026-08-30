# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a fresh project with no established source tree. As code is added, keep the layout predictable:

- `src/` for application or library source code.
- `tests/` for automated tests that mirror `src/` modules.
- `assets/` for static files such as images, fixtures, sample data, or design resources.
- `docs/` for longer project notes, architecture decisions, and user-facing documentation.

Prefer small, focused modules. If a feature spans multiple files, group them under a named directory such as `src/parser/` or `src/ui/`.

## Build, Test, and Development Commands

No build system or package manager is configured yet. When one is introduced, document the canonical commands here and keep them working from the repository root.

Examples to add when relevant:

- `npm install` / `npm run dev` / `npm test` for Node-based projects.
- `python -m pytest` for Python test suites.
- `make build` or `make test` if a `Makefile` becomes the project entry point.

Avoid adding duplicate command paths unless they serve different workflows.

## Coding Style & Naming Conventions

Follow the conventions of the language and framework chosen for the project. Use consistent indentation across each language: 2 spaces for JavaScript, TypeScript, JSON, YAML, and Markdown; 4 spaces for Python.

Use descriptive names. Prefer `snake_case` for Python files and functions, `camelCase` for JavaScript variables and functions, and `PascalCase` for classes and components. Keep filenames lowercase unless framework conventions require otherwise.

Add formatters or linters early, then run them before committing.

## Testing Guidelines

Place tests under `tests/` or beside source files only if the chosen framework strongly favors colocated tests. Name tests after the behavior being verified, for example `test_config_loading.py` or `parser.spec.ts`.

Every non-trivial feature should include at least one automated test. Bug fixes should include a regression test when practical.

## Commit & Pull Request Guidelines

There is no existing commit history, so use clear, imperative commit messages such as `Add parser tests` or `Document setup commands`. Keep commits focused on one logical change.

Pull requests should include a short summary, test results, and any relevant screenshots or logs for user-visible behavior. Link related issues when available and call out follow-up work explicitly.

## Security & Configuration Tips

Do not commit secrets, local credentials, or generated dependency caches. Use ignored environment files such as `.env.local` for private configuration, and provide safe examples in `.env.example` when configuration is required.
