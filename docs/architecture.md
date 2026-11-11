# Architecture

## Existing product

The extension uses TypeScript and the VS Code Extension API. src/extension.ts is the trusted extension-host boundary: it owns process execution and communicates with one sidebar webview. The webview is dependency-free HTML, CSS, and JavaScript in media/. Python tracing runs in media/python-tracer.py; C++ and Java are compiled in short-lived temporary folders.

## Upgrade design

The implementation keeps this split and adds three explicit layers:

1. **Problem model** – the webview parses local problem signals into a pattern, example input, constraints, and a conceptual visualization.
2. **Trace model** – Python produces runtime events with line, function, stack, variable snapshots, changes, collections, output, and errors. It never asks an AI model to invent state.
3. **Visualization engine** – media/visual-engine.js turns a trace snapshot into reusable array, variable, pointer, stack, queue, tree, and graph panels. Renderers receive data, not prose.

## Safety boundary

Python runs in a separate short-lived process with a wall-clock timeout and a trace-event cap. This prevents accidental infinite learning snippets from hanging the extension, but it is not a security sandbox. Users must only run code they trust until OS/container isolation is added.

## Current limitations

Python has actual runtime tracing. C++ and Java currently compile/run or render structure; they do not claim to provide fabricated execution traces. Future adapters should emit the same trace-event contract.
