# Security Policy

## Supported Versions

Currently, only the latest release of OpenClaw Windows is supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of this project seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Do not open a public issue.** Instead, please follow these steps:

1. [Open a GitHub Security Advisory](https://github.com/niteshdangi/OpenClaw-Windows/security/advisories/new) in this repository.
2. Include a detailed description of the vulnerability, steps to reproduce, and the potential impact.
3. Allow us reasonable time to investigate and resolve the issue before making any information public.

## Security Features in OpenClaw Windows

This application includes several features designed to keep your system safe while interacting with AI agents:

- **Execution Approvals**: All "dangerous" commands (like file system writes or system configuration changes) require manual approval via an always-on-top prompt.
- **Environment Sanitization**: Sensitive environment variables are stripped before commands are executed.
- **Command Timeouts**: Commands are executed with strict timeouts to prevent resource exhaustion or hanging processes.
- **Local Gateway Option**: Supports running a local gateway within WSL or natively, minimizing network exposure.

---

*Thank you for helping keep OpenClaw Windows safe for everyone.*
