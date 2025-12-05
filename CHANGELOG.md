# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-05

### Added
- NPM package support - install globally with `npm install -g timmy-cli`
- CLI commands: `init`, `start`, `status`, `config`, `projects`
- Interactive setup wizard with `timmy init`
- XDG-compliant configuration in `~/.timmy/`
- Support for multiple projects with easy switching
- Verbose mode flag: `timmy start -v`

### Changed
- Configuration now stored in `~/.timmy/` instead of repo root
- Entry point supports both CLI and interactive modes
- Package renamed from `timmy-task-automation` to `timmy-cli`

### Migration
- Existing users: Copy `.env`, `workspace.json`, `projects.json` to `~/.timmy/`
- Data files: Copy `data/` directory to `~/.timmy/data/`

## [1.0.0] - 2025-11-15

### Added
- Initial release
- ClickUp task polling
- Claude Code integration
- Gemini analysis
- Codex code review
- GitHub PR creation
- Discord integration
- Multi-project support
