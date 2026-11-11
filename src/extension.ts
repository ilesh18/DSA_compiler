import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

type TraceResult = { ok: boolean; steps: unknown[]; output: string[]; error?: string; notice?: string };

export function activate(context: vscode.ExtensionContext) {
  const provider = new LearningViewProvider(context.extensionUri);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('codeLensLearning.explorer', provider, {
    webviewOptions: { retainContextWhenHidden: true }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('codeLensLearning.openVisualizer', () => vscode.commands.executeCommand('workbench.view.extension.codeLensLearning')));
}

class LearningViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}
  resolveWebviewView(view: vscode.WebviewView) {
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    webview.html = this.html(webview);
    webview.onDidReceiveMessage(async message => {
      if (message.type === 'runCode') {
        const code = String(message.code || '');
        const language = message.language === 'java' || message.language === 'cpp' ? message.language : 'python';
        const result = language === 'java' ? await this.runJava(code) : language === 'cpp' ? await this.runCpp(code) : await this.tracePython(code);
        webview.postMessage({ type: 'traceResult', result, language });
      }
      if (message.type === 'runCppTest') {
        const result = await this.runCppTest(String(message.code || ''), String(message.testBody || ''));
        webview.postMessage({ type: 'testResult', result, caseId: String(message.caseId || '') });
      }
    });
  }
  private tracePython(code: string): Promise<TraceResult> {
    const script = vscode.Uri.joinPath(this.extensionUri, 'media', 'python-tracer.py').fsPath;
    return new Promise(resolve => {
      const proc = childProcess.spawn('python', [script], { windowsHide: true });
      let stdout = '', stderr = '';
      proc.stdout.on('data', chunk => stdout += chunk.toString());
      proc.stderr.on('data', chunk => stderr += chunk.toString());
      proc.on('error', error => resolve({ ok: false, steps: [], output: [], error: 'Python could not start: ' + error.message }));
      proc.on('close', () => { try { resolve(JSON.parse(stdout)); } catch { resolve({ ok: false, steps: [], output: [], error: stderr || 'Python did not return a readable trace. Install Python and try again.' }); } });
      proc.stdin.end(code);
    });
  }
  private async runJava(code: string): Promise<TraceResult> {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'code-lens-java-'));
    try {
      await fs.writeFile(path.join(folder, 'Solution.java'), code, 'utf8');
      const compilation = await this.exec('javac', ['Solution.java'], folder);
      if (compilation.code !== 0) return { ok: false, steps: [], output: [], error: compilation.stderr || compilation.stdout };
      if (!/\bstatic\s+void\s+main\s*\(/.test(code)) {
        return { ok: true, steps: [], output: [], notice: 'Java compiled successfully. LeetCode classes do not have a main method, so there is nothing to execute yet. Add a local main method that calls your Solution method to test it.' };
      }
      const execution = await this.exec('java', ['Solution'], folder);
      return execution.code === 0
        ? { ok: true, steps: [], output: execution.stdout.trim() ? execution.stdout.trim().split(/\r?\n/) : [], notice: 'Java executed successfully. Step-by-step Java tracing is the next adapter to add.' }
        : { ok: false, steps: [], output: [], error: execution.stderr || execution.stdout };
    } catch (error) {
      return { ok: false, steps: [], output: [], error: 'Java could not start. Install a JDK (not only a JRE) and ensure javac is on PATH. ' + String(error) };
    } finally {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  private async runCpp(code: string): Promise<TraceResult> {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'code-lens-cpp-'));
    try {
      const source = '#include <bits/stdc++.h>\nusing namespace std;\n\n' + code;
      await fs.writeFile(path.join(folder, 'Solution.cpp'), source, 'utf8');
      const hasMain = /\bint\s+main\s*\(/.test(code);
      const compilation = await this.exec('g++', hasMain ? ['-std=c++17', 'Solution.cpp', '-o', 'Solution.exe'] : ['-std=c++17', '-c', 'Solution.cpp', '-o', 'Solution.o'], folder);
      if (compilation.code !== 0) return { ok: false, steps: [], output: [], error: compilation.stderr || compilation.stdout };
      if (!hasMain) {
        return { ok: true, steps: [], output: [], notice: 'C++ compiled successfully. A LeetCode Solution class has no main function, so it cannot run outside LeetCode until you add a local test harness.' };
      }
      const execution = await this.exec('.\\Solution.exe', [], folder);
      return execution.code === 0
        ? { ok: true, steps: [], output: execution.stdout.trim() ? execution.stdout.trim().split(/\r?\n/) : [], notice: 'C++ executed successfully. Step-by-step C++ tracing is a future adapter.' }
        : { ok: false, steps: [], output: [], error: execution.stderr || execution.stdout };
    } catch (error) {
      return { ok: false, steps: [], output: [], error: 'C++ could not start. Install MinGW-w64 and ensure g++ is on PATH. ' + String(error) };
    } finally {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  private async runCppTest(code: string, testBody: string): Promise<TraceResult> {
    if (/\bint\s+main\s*\(/.test(code)) {
      return { ok: false, steps: [], output: [], error: 'Remove the existing main() before using the Test Case Lab. It adds a temporary main() for this test.' };
    }
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'code-lens-cpp-test-'));
    try {
      const source = '#include <bits/stdc++.h>\nusing namespace std;\n\n' + code + '\n\nint main() {\n    Solution solution;\n' + testBody + '\n    return 0;\n}\n';
      await fs.writeFile(path.join(folder, 'Solution.cpp'), source, 'utf8');
      const compilation = await this.exec('g++', ['-std=c++17', 'Solution.cpp', '-o', 'Solution.exe'], folder);
      if (compilation.code !== 0) return { ok: false, steps: [], output: [], error: compilation.stderr || compilation.stdout };
      const execution = await this.exec('.\\Solution.exe', [], folder);
      return execution.code === 0
        ? { ok: true, steps: [], output: execution.stdout.trim() ? execution.stdout.trim().split(/\r?\n/) : [] }
        : { ok: false, steps: [], output: [], error: execution.stderr || execution.stdout };
    } catch (error) {
      return { ok: false, steps: [], output: [], error: 'C++ test could not start. ' + String(error) };
    } finally {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  private exec(command: string, args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise(resolve => {
      const proc = childProcess.spawn(command, args, { cwd, windowsHide: true });
      let stdout = '', stderr = '';
      proc.stdout.on('data', chunk => stdout += chunk.toString());
      proc.stderr.on('data', chunk => stderr += chunk.toString());
      proc.on('error', error => resolve({ code: -1, stdout, stderr: error.message }));
      proc.on('close', code => resolve({ code, stdout, stderr }));
    });
  }
  private html(webview: vscode.Webview) {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'app.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'style.css'));
    const nonce = String(Date.now());
    return [
      '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">',
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src ' + webview.cspSource + '; script-src \'nonce-' + nonce + '\'">',
      '<link rel="stylesheet" href="' + style + '"></head><body><main>',
      '<header><div class="logo">&lt;/&gt;</div><div><h1>Learning Studio</h1><p>Understand code by seeing it run.</p></div></header>',
      '<nav><button class="tab active" data-tab="problem">Problem</button><button class="tab" data-tab="trace">Trace</button><button class="tab" data-tab="concepts">Concepts</button></nav>',
      '<section id="problem" class="pane active"><h2>LeetCode Problem Lab</h2><p class="hint">Paste a full problem statement, constraints, and examples. The local analyser recognises common DSA patterns and gives you a learning path.</p><textarea id="problemInput">Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nExample 1: Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n\nConstraints: You may assume that each input would have exactly one solution.</textarea><div class="button-row"><button id="visualize">Analyse problem</button><button id="loadStarter" class="secondary">Load Python starter</button></div><div id="problemResult" class="result empty">Paste any LeetCode-style problem, then analyse its patterns, inputs, and approach.</div></section>',
      '<section id="trace" class="pane"><h2>Code Execution Visualizer</h2><p class="hint">Select the language you wrote in—nothing is auto-guessed.</p><label class="language-label" for="language">I am writing</label><select id="language"><option value="python">Python — compile and step through execution</option><option value="cpp">C++ — compile and visualize code structure</option><option value="java">Java — compile and visualize code structure</option></select><p id="languageHelp" class="hint">Python runs with a line-by-line variable timeline.</p><textarea id="codeInput" spellcheck="false">arr = [10, 20, 30]\nfor i in range(len(arr)):\n    print(arr[i])</textarea><button id="runTrace">Compile, run &amp; visualize</button><div id="traceResult" class="result empty">Choose the language, paste your solution, then compile and visualize it.</div></section>',
      '<section id="concepts" class="pane"><h2>Concept Explorer</h2><div class="concepts"><button data-concept="array">Arrays</button><button data-concept="linked">Linked lists</button><button data-concept="stack">Recursion &amp; stack</button></div><div id="conceptResult" class="result">Pick a concept to explore its model.</div></section>',
      '</main><script nonce="' + nonce + '" src="' + script + '"></script></body></html>'
    ].join('');
  }
}
export function deactivate() {}
