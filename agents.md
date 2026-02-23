# AI Agent Specification: OpenClaw-Windows

This document defines the roles, responsibilities, and coding standards for AI agents operating within the OpenClaw-Windows repository. It acts as a contract to ensure AI contributions remain predictable, safe, and aligned with the project's architecture.

## 1. Project Overview

OpenClaw-Windows is an enterprise-grade desktop application built with:
- **Backend**: Rust (Tauri 2)
- **Frontend**: React 19 + TypeScript
- **UI Framework**: Fluent UI (@fluentui/react-components)
- **State Management**: XState (@xstate/react)
- **IPC Communication**: Tauri `invoke` and `listen`
- **Architecture**: Modular service-based backend with a centralized `RuntimeManager`.

## 2. Architecture Rules

### Backend (Rust + Tauri)
- **Error Handling**: Use `OpenClawError` (defined in `src-tauri/src/error.rs`). All commands must return `crate::error::Result<T>`.
- **No Panics**: Avoid `unwrap()`, `expect()`, or `panic!` in production code. Use `anyhow` for internal logic only if converted to `OpenClawError`.
- **Concurrency**: Shared state must use `Arc<Mutex<_>>` or `Arc<RwLock<_>>`. Prefer asynchronous operations; do not block the tokio runtime with long-running synchronous work.
- **Service Pattern**: Business logic should reside in services under `src-tauri/src/services/`. State management should be handled by the `RuntimeManager`.

### Frontend (React + TypeScript)
- **Types First**: All components and hooks MUST be fully typed. Use `interface` for props and state.
- **IPC Abstraction**: Avoid direct `window.__TAURI__` usage. Use `@tauri-apps/api/core` for `invoke`.
- **Hook Pattern**: Wrap Tauri invokes inside custom hooks (e.g., `src/hooks/useVoiceWake.ts`) to manage loading, error, and state.
- **Styling**: Use Fluent UI styling tokens. Maintain consistency with the existing design system.

## 3. Agent Types

### Code Refactor Agent
- **Allowed**: Module reorganization, type safety improvements, performance optimizations.
- **Constraint**: Must not change IPC contract signatures without updating counterparts.

### Security Agent
- **Allowed**: Patching vulnerabilities, path validation, memory safety audits.
- **Constraint**: Must document every security-related change with rationale.

### Test Generation Agent
- **Allowed**: Unit tests for logic, integration tests for services.
- **Constraint**: Must follow existing test patterns and not reduce overall coverage.

## 4. Modification Boundaries

Agents are **RESTRICTED** from modifying the following without explicit human approval:
- Signing certificates and provisioning profiles.
- CI/CD workflows (`.github/workflows/`).
- Core gateway communication protocols and credential handling.
- Encryption/Decryption logic.

## 5. File Ownership Map

- `/src-tauri/src/services/`: Core business logic and background tasks.
- `/src-tauri/src/providers/`: Hardware/OS abstractions (WSL, Sound, etc.).
- `/src-tauri/src/gateway/`: Remote connection and discovery logic.
- `/src/hooks/`: Frontend-backend bridge (Tauri command wrappers).
- `/src/screens/`: High-level UI components and routing.
- `/src/types/`: Shared TypeScript interface definitions.

## 6. Security Policies
- **Path Validation**: All filesystem paths must be validated to prevent traversal attacks.
- **Permissions**: Minimize Tauri capability permissions in `tauri.conf.json`.
- **Data Sanitization**: Sanitize all user input before passing to shell commands or recursive file operations.

## 7. Output Format for Agents

All AI-generated contributions must include:
- **Summary**: High-level overview of changes.
- **Files Modified**: List of affected files.
- **Risk Level**: Low/Medium/High.
- **Security Impact**: Description of any security-related implications.
- **Backward Compatibility**: Any breaking changes or IPC contract updates.

## 8. Testing & Verification
- Agents must ensure `cargo check` and `npm run build` pass before finalizing changes.
- New logic should include corresponding unit tests in either Rust (module tests) or TypeScript (Vitest/Jest).
