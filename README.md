# Code Lens Learning

A local-first VS Code extension for understanding LeetCode-style problems and code execution visually.

## Current features

- Problem Lab for deterministic DSA-pattern guidance.
- Python line-by-line execution tracing with variable snapshots.
- Explicit Python, C++, and Java language selection.
- C++ and Java local compilation.
- Source-structure visualization for C++ and Java.
- A C++ Test Case Lab that creates a temporary local harness and reports pass/fail; Two Sum examples import from the Problem tab.

## Run locally

1. Install Node.js, Python, and MinGW-w64 for C++ support.
2. Run npm install and npm run compile.
3. Open this folder in VS Code and press F5.
4. In the Extension Development Host, open the **Code Learning** activity-bar icon.

## Important boundary

Run only code you trust. The extension invokes local language runtimes and compilers on your machine.
