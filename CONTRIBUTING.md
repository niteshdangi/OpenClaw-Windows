# Contributing to OpenClaw Windows

Welcome! 🦞 We're excited to have you contribute to the Windows companion for Molty.

## AI/Vibe-Coded PRs Welcome! 🤖

Just like the parent project, we believe AI is a powerful tool for building great software. If your PR was built with the help of AI (Codex, Claude, etc.):

- **Mark it!** Include a note in the PR title or description.
- **Test it!** Please specify the degree of testing (untested / lightly tested / fully tested).
- **Own it!** Confirm you understand what the code does.

## How to Contribute

1. **Check the roadmap**: Look for issues labeled "good first issue" or "help wanted".
2. **Setup your environment**: Follow the guide in [README.md](README.md).
3. **Follow the specs**: All contributions must adhere to the standards in [AGENTS.md](agents.md).
4. **IPC Abstraction**: Ensure new backend features are exposed via clean hooks in the frontend, rather than direct `invoke` calls within components.
5. **Open a PR**: Describe your changes clearly and link any relevant issues.

## Development Loop

- Backend (Rust): `src-tauri`
- Frontend (React): `src`
- Run dev: `npm run tauri dev`
- Lint: `npm run lint`

## Code of Conduct

Please be respectful and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

*Need help? Join the [OpenClaw Discord](https://discord.gg/clawd).*
