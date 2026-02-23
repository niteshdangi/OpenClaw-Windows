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
> **Windows Companion to OpenClaw** provides system-level integrations for Windows users.

## ✨ Features

### Capabilities Matrix

| Feature | Description | Support |
| :--- | :--- | :--- |
| **Gateway Management** | Automatically installs or connects to existing Local (WSL/Native), Remote (SSH), or Direct WebSocket gateways. | ✅ |
| **Node Commands** | Supports `system.run`, `system.which`, `system.notify`, `screen.record`, `camera.snap`, and `exec_approvals`. | ✅ |
| **WSL2 Integration** | High-performance terminal and process management within the Linux subsystem. | ✅ |
| **Voice Wake** | Native Windows speech recognition to wake Molty hands-free. | ✅ |
| **Modern UI** | Built with Fluent UI & React, featuring Mica effects and always-on-top security prompts. | ✅ |

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

For detailed coding standards and agent policies, see [AGENTS.md](agents.md).

## 🤝 Contributing

Contributions are welcome!
**AI/Vibe-coded PRs are first-class citizens**.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
