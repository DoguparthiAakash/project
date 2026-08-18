# v86 Execution Migration Plan

## Goal
Replace the WebContainer-first execution model with a Linux VM execution layer powered by v86.

## Architecture

1. Keep an abstract `ExecutionEnvironment` contract for all backend runtime implementations.
2. Default the runtime to a v86-based Linux VM.
3. Keep older runtime implementations in adapters behind this interface for compatibility.
4. Expose a command API that returns structured data instead of only raw typed terminal output.
5. Connect the terminal to the physical serial console of the Linux guest so the UI shows real shell activity.

## Decision
The browser implementation uses a host-side v86 emulator with a lightweight Linux disk image. This is the most direct browser-compatible path to a real x86 guest. It provides an actual shell, command execution, and process lifecycle without introducing a Node-only backend requirement.

## Phases
- Phase 1: audit and isolate current runtime code.
- Phase 2: introduce `ExecutionEnvironment` and v86 adapter.
- Phase 3: boot Linux and validate shell readiness.
- Phase 4: connect terminal I/O and command execution.
- Phase 5: wire project workspace sync and agent tools.
- Phase 6: add lifecycle, reset, and error handling.
- Phase 7: validate build/regression and document limitations.

## Risks and constraints
- Browser v86 is slower than native containers and will have memory limits.
- Real project synchronization is best-effort in browser-only mode and should be treated as a guest filesystem sync layer rather than a host-mounted volume.
- Network access is intentionally optional; package installation is gated by user/network policy.
- The VM is isolated from the host browser environment, but it is not a security boundary equivalent to a full cloud VM.
