# 🦞 OpenClaw — Windows Companion

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png" alt="OpenClaw" width="500">
    </picture>
</p>

<p align="center">
  <strong>The Windows desktop experience for Molty the Lobster.</strong>
</p>

---

> [!NOTE]
> **Unofficial Companion**: This is a community-maintained Windows client. It is not an official product of, nor is it affiliated with, the original OpenClaw authors.
>
> **OpenClaw Windows** is a desktop companion for the [OpenClaw](https://github.com/openclaw/openclaw) personal AI assistant. It provides system-level integrations for Windows users.

## ✨ Features

- **WSL2 Integration**: Deep integration with Windows Subsystem for Linux for high-performance terminal operations.
- **Voice Wake**: Native Windows speech recognition integration for hands-free interaction with Molty.
- **System Permissions**: Managed access to your file system and terminal, secured by the [agents.md](agents.md) specification.
- **IPC Abstraction**: Clean hook-based interaction between the React frontend and Rust backend.
- **Modern UI**: Built with Fluent UI and React to feel right at home on Windows 11.

## ⬇️ Download & Install

For most users, we recommend downloading the latest installer:

1. Go to the [Releases](https://github.com/nites/OpenClaw-Windows/releases) page.
2. Download the `.msi` or `.exe` installer for the latest version.
3. Run the installer and follow the on-screen instructions.

## 🛠 Local Development

If you want to build from source or contribute:

### Prerequisites

- **Node.js**: v22 or higher.
- **Rust**: Latest stable toolchain.
- **Tauri 2 Prerequisites**: Follow the [Tauri Setup Guide](https://v2.tauri.app/start/prerequisites/).

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/nites/OpenClaw-Windows.git
   cd OpenClaw-Windows
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

## 🏗 Architecture

The project follows a modern Tauri 2 architecture:

- **Frontend**: React 19, TypeScript, Fluent UI, and XState for robust state management.
- **Backend**: Rust services for hardware interaction, terminal management (PTY), and WSL communication.
- **Communication**: Abstracted IPC hooks in `src/hooks` to minimize coupling between UI and backend logic.

For detailed coding standards and agent policies, see [AGENTS.md](agents.md).

## 🤝 Contributing

Contributions are welcome! We follow the parent project's philosophy: **AI/Vibe-coded PRs are first-class citizens**.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Part of the [OpenClaw](https://openclaw.ai) ecosystem.*
