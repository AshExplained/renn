# Contributing to ACE

Thanks for your interest in contributing to ACE! Here's how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Create a branch from `dev`: `git checkout -b your-feature dev`
5. Make your changes
6. Run checks: `npm run check`
7. Commit and push to your fork
8. Open a PR targeting the `dev` branch

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/ace-agentic-code-experience.git
cd ace-agentic-code-experience
npm install
```

This installs dev dependencies and sets up Husky pre-commit hooks automatically.

## Project Structure

ACE is ~90% markdown and ~10% JavaScript.

| Directory | Contents |
|-----------|----------|
| `commands/` | Slash commands (`ace.*.md`) |
| `agents/` | Specialized agents (`ace-*.md`) |
| `ace/workflows/` | Reusable workflow definitions |
| `ace/references/` | Reference documentation |
| `ace/templates/` | File templates |
| `bin/` | Installer script |
| `hooks/` | Git hook source files |
| `scripts/` | Dev tooling (validator, build) |

## Pre-Commit Checks

Every commit runs automatically:
- **ESLint** on JavaScript files
- **Prettier** on JavaScript and JSON files
- **Gitleaks** for secret detection
- **Markdown validator** on commands, agents, workflows, references, and templates

Run all checks manually: `npm run check`

## Conventions

- **Commands** use YAML frontmatter + semantic XML sections. See `AGENTS.md` for the full spec.
- **Agents** use YAML frontmatter with `<role>` and `<execution_flow>` sections.
- **Workflows** have no frontmatter — pure markdown with semantic XML.
- **Commits** follow conventional format: `feat(scope): description`, `fix(scope): description`
- **Branches** target `dev`, never `main` directly.

## Opening a PR

- Target the `dev` branch
- Keep PRs focused — one feature or fix per PR
- Run `npm run check` before pushing
- Describe what changed and why in the PR description

## Reporting Issues

Use [GitHub Issues](https://github.com/AshExplained/ace-agentic-code-experience/issues) for bug reports and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
