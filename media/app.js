const vscode = acquireVsCodeApi();
let trace = [], cursor = 0, lastAnalysis = null;
let cppCases = [], cppCaseSequence = 0;
const $ = id => document.getElementById(id);
const savedState = vscode.getState();
if (savedState && Array.isArray(savedState.cppCases)) {
  cppCases = savedState.cppCases;
  cppCaseSequence = Number(savedState.cppCaseSequence || cppCases.length);
}
const patterns = [
  {label:'Hash map / complement lookup',match:/two sum|add up to|pair.*sum|target.*sum/i,why:'You need to find a partner value efficiently.',steps:['Walk through the array once.','For each value x, calculate target − x.','If that complement is already stored, return both indices.','Otherwise store x and its index.'],time:'O(n)',space:'O(n)',starter:'def two_sum(nums, target):\n    seen = {}\n    for i, value in enumerate(nums):\n        complement = target - value\n        if complement in seen:\n            return [seen[complement], i]\n        seen[value] = i\n    return []',visual:'map'},
  {label:'Sliding window',match:/substring|subarray|contiguous|longest.*without|window/i,why:'The answer is a contiguous range, so reuse information while moving two pointers.',steps:['Keep left and right boundaries.','Expand right to include a new value.','While the window is invalid, move left.','Record the best valid window.'],time:'O(n)',space:'O(k)',starter:'def longest_unique(s):\n    last_seen = {}\n    left = best = 0\n    for right, char in enumerate(s):\n        if char in last_seen and last_seen[char] >= left:\n            left = last_seen[char] + 1\n        last_seen[char] = right\n        best = max(best, right - left + 1)\n    return best',visual:'window'},
  {label:'Binary search',match:/sorted|binary search|rotated.*array|search.*array/i,why:'A sorted or monotonic search space lets you discard half on each comparison.',steps:['Set low and high boundaries.','Check the middle value.','Discard the half that cannot contain the answer.','Stop when boundaries cross or the target is found.'],time:'O(log n)',space:'O(1)',starter:'def search(nums, target):\n    low, high = 0, len(nums) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if nums[mid] == target: return mid\n        if nums[mid] < target: low = mid + 1\n        else: high = mid - 1\n    return -1',visual:'binary'},
  {label:'Linked list pointers',match:/linked list|listnode|next pointer|reverse list/i,why:'Nodes are connected by references, so pointer rewiring is the core operation.',steps:['Draw current, previous, and next pointers.','Save next before changing a link.','Reverse or advance one link at a time.','Return the new head pointer.'],time:'O(n)',space:'O(1)',starter:'def reverse_list(head):\n    previous = None\n    current = head\n    while current:\n        following = current.next\n        current.next = previous\n        previous = current\n        current = following\n    return previous',visual:'linked'},
  {label:'Tree traversal',match:/binary tree|bst|tree node|lowest common ancestor/i,why:'The input is hierarchical; recursive DFS or iterative traversal visits one subtree at a time.',steps:['Define the base case for an empty node.','Visit the current node.','Recurse or push the left and right children.','Combine child answers on the way back up.'],time:'O(n)',space:'O(h)',starter:'def max_depth(node):\n    if not node:\n        return 0\n    return 1 + max(max_depth(node.left), max_depth(node.right))',visual:'tree'},
  {label:'Graph / grid traversal',match:/graph|island|maze|grid|connected|course schedule|adjacent/i,why:'States are connected by edges. Track visited states to avoid repeating work.',steps:['Choose BFS for shortest unweighted paths; DFS for exploration.','Start from each unvisited source.','Mark a state visited when adding it.','Explore valid neighbors.'],time:'O(V + E)',space:'O(V)',starter:'from collections import deque\n\ndef bfs(graph, start):\n    queue, seen = deque([start]), {start}\n    while queue:\n        node = queue.popleft()\n        for neighbor in graph[node]:\n            if neighbor not in seen:\n                seen.add(neighbor)\n                queue.append(neighbor)',visual:'graph'},
  {label:'Dynamic programming',match:/maximum.*profit|minimum.*cost|ways to|optimal|dynamic programming|robber|coin change/i,why:'The problem has overlapping subproblems; store an answer instead of recomputing it.',steps:['State what one table entry means.','Write the recurrence from smaller states.','Set base cases.','Fill in an order where dependencies already exist.'],time:'Usually O(n) or O(n²)',space:'Depends on state',starter:'def climb_stairs(n):\n    if n <= 2: return n\n    previous, current = 1, 2\n    for _ in range(3, n + 1):\n        previous, current = current, previous + current\n    return current',visual:'dp'},
  {label:'Stack matching',match:/parentheses|bracket|valid.*string|stack/i,why:'The most recently opened item must be resolved first.',steps:['Push opening symbols.','On a closing symbol, check the top.','Reject mismatches immediately.','The stack must be empty at the end.'],time:'O(n)',space:'O(n)',starter:'def is_valid(s):\n    pairs = {\")\":\"(\", \"]\":\"[\", \"}\":\"{\"}\n    stack = []\n    for char in s:\n        if char in pairs:\n            if not stack or stack.pop() != pairs[char]: return False\n        else:\n            stack.append(char)\n    return not stack',visual:'stack'}
];
document.querySelectorAll('.tab').forEach(button => button.onclick = () => { document.querySelectorAll('.tab,.pane').forEach(x => x.classList.remove('active')); button.classList.add('active'); $(button.dataset.tab).classList.add('active'); });
$('visualize').onclick = () => { lastAnalysis = analyse($('problemInput').value); renderAnalysis(lastAnalysis); };
$('loadStarter').onclick = () => { if (!lastAnalysis) lastAnalysis = analyse($('problemInput').value); $('codeInput').value = lastAnalysis.starter; document.querySelector('[data-tab="trace"]').click(); };
function analyse(text) {
  const detected = patterns.filter(p => p.match.test(text));
  const primary = detected[0] || {label:'General problem decomposition',why:'No single canonical pattern was detected. Break the problem into input, output, examples, and constraints before selecting a data structure.',steps:['Restate the input and expected output.','Work through one example by hand.','Use constraints to reject slow approaches.','Choose a data structure that makes the repeated operation cheap.'],time:'Derive from constraints',space:'Derive from structure',starter:'# Write a small example first.\n# Then trace it with the panel below.\ndef solve(data):\n    pass',visual:'generic'};
  const arrays = [...text.matchAll(/\[[^\]]{1,120}\]/g)].map(m => m[0]).slice(0,2);
  const constraints = (text.match(/(?:constraints?|[1≤<>=].{0,100})/ig) || []).slice(0,3);
  const example = (text.match(/(?:example|input|output).{0,180}/is) || ['No explicit example recognised. Add an “Example: Input … Output …” block.'])[0];
  return {primary, detected, arrays, constraints, example, starter:primary.starter};
}
function renderAnalysis(a) {
  const p = a.primary, tags = a.detected.length ? a.detected.map(x => '<span class="tag">'+x.label+'</span>').join('') : '<span class="tag">Needs manual classification</span>';
  const lesson = learningGuide(p.visual);
  $('problemResult').className = 'result';
  $('problemResult').innerHTML = '<div class="analysis-head"><b>Likely approach: '+p.label+'</b><span class="complexity">'+p.time+'</span></div><div class="tags">'+tags+'</div><p>'+p.why+'</p><h3>Plan it before coding</h3><ol>'+p.steps.map(x => '<li>'+x+'</li>').join('')+'</ol><div class="visual-card">'+visual(p.visual,a.arrays)+'</div><div class="study-grid"><div><small>Brute force</small><b>'+lesson.brute+'</b></div><div><small>Optimized idea</small><b>'+lesson.optimized+'</b></div><div><small>Common mistake</small><b>'+lesson.mistake+'</b></div></div><div class="info-grid"><div><b>Example extracted</b><pre>'+escapeHtml(a.example.trim())+'</pre></div><div><b>Constraints noticed</b><pre>'+escapeHtml(a.constraints.join('\n') || 'No constraints identified — paste them for better complexity advice.')+'</pre></div></div><p class="hint">Expected complexity: <b>'+p.time+'</b> time, <b>'+p.space+'</b> extra space. Load the starter, then alter its example and trace it line-by-line.</p>';
}
function learningGuide(kind) {
  const guides = {
    map:{brute:'Check every pair: O(n²).',optimized:'Store earlier values and ask whether the complement exists.',mistake:'Saving before checking can match an element with itself.'},
    window:{brute:'Try every substring/subarray: O(n²).',optimized:'Move each boundary forward at most n times.',mistake:'Forgetting to shrink until the window becomes valid.'},
    binary:{brute:'Scan each value: O(n).',optimized:'Use sorted order to discard half on each comparison.',mistake:'Mixing up inclusive high and exclusive high boundaries.'},
    linked:{brute:'Copy values into an array first.',optimized:'Rewire references while preserving the next node.',mistake:'Overwriting next before saving it.'},
    tree:{brute:'Repeatedly recompute subtree information.',optimized:'Return useful information from each DFS call.',mistake:'Missing the empty-node base case.'},
    graph:{brute:'Revisit connected states repeatedly.',optimized:'Mark visited when you enqueue or recurse.',mistake:'Marking visited too late creates duplicate work.'},
    dp:{brute:'Recurse into the same state repeatedly.',optimized:'Cache each state or build bottom-up.',mistake:'Using a recurrence before defining its base cases.'},
    stack:{brute:'Search backward for every closing token.',optimized:'Keep only unmatched openings in a stack.',mistake:'Not checking whether the stack is empty first.'}
  };
  return guides[kind] || {brute:'Try small cases manually.',optimized:'Choose a structure that makes the repeated operation cheap.',mistake:'Coding before you can state the invariant.'};
}
function visual(kind, arrays) {
  const values = arrays[0] || '[2, 7, 11, 15]';
  if (kind==='map') return '<b>Complement lookup model</b><div class="flow"><span class="node">value 2</span><span class="arrow">→ store</span><span class="node">seen {2: 0}</span><span class="arrow">→ target − 7 = 2</span><span class="node">match!</span></div>';
  if (kind==='window') return '<b>Window expands and shrinks</b><div class="window"><span>a</span><span>b</span><span class="inside">c</span><span class="inside">a</span><span class="inside">b</span><span>c</span><small>left └──────────┘ right</small></div>';
  if (kind==='binary') return '<b>Discard half of a sorted range</b><div class="binary"><span>low</span><span> 1 </span><span> 3 </span><strong> 5 mid </strong><span> 7 </span><span> 9 </span><span>high</span></div>';
  if (kind==='linked') return '<b>Pointer links</b><div><span class="node">1</span><span class="arrow">→</span><span class="node">2</span><span class="arrow">→</span><span class="node">3</span><span class="arrow">→ ∅</span></div>';
  if (kind==='tree') return '<b>DFS structure</b><pre>      4\n    /   \\\n   2     7\n  / \\\n 1   3</pre>';
  if (kind==='graph') return '<b>Visit connected states once</b><div class="flow"><span class="node">A</span><span class="arrow">↔</span><span class="node">B</span><span class="arrow">↔</span><span class="node">C</span></div>';
  if (kind==='dp') return '<b>Build answers from smaller states</b><div class="dp"><span>dp[0]</span><span>dp[1]</span><span>dp[2]</span><span>dp[3]</span></div>';
  if (kind==='stack') return '<b>Last opened, first closed</b><div class="stackvis"><span>(</span><span>[</span><span>{</span></div>';
  return '<b>Input model</b><pre>'+escapeHtml(values)+'</pre>';
}
$('language').onchange = () => {
  const info = {python:'Python runs locally and shows each executed line with variables.',cpp:'C++ is compiled with MinGW. After a successful build, view the function, loop, and condition map below.',java:'Java is compiled with javac. After a successful build, view the function, loop, and condition map below.'};
  $('languageHelp').textContent = info[$('language').value];
};
$('runTrace').onclick = () => { $('traceResult').className='result'; $('traceResult').textContent='Compiling and analysing locally…'; vscode.postMessage({type:'runCode',code:$('codeInput').value,language:$('language').value}); };
window.addEventListener('message', event => {
  if(event.data.type!=='traceResult') return;
  const result=event.data.result, language=event.data.language;
  if(!result.ok){$('traceResult').innerHTML='<b>Build / run stopped</b><pre>'+escapeHtml(result.error || 'Unknown error')+'</pre>';return;}
  trace=result.steps; cursor=0;
  if(!trace.length){renderStructure(language,$('codeInput').value,result);return;}
  renderTrace(result.output);
});
function renderStructure(language, code, result) {
  const functionPattern = language === 'cpp' ? /(?:[\w:<>]+\s+)+(\w+)\s*\([^;{}]*\)\s*\{/g : /(?:public\s+|private\s+|static\s+)*(?:[\w<>\[\]]+\s+)+(\w+)\s*\([^;{}]*\)\s*\{/g;
  const functions = [...code.matchAll(functionPattern)].map(m => m[1]).filter(name => !['if','for','while','switch'].includes(name));
  const loops = (code.match(/\b(for|while|do)\b/g) || []).map(x => x === 'do' ? 'do / while' : x);
  const conditions = (code.match(/\b(if|else\s+if|switch)\b/g) || []).length;
  const classes = [...code.matchAll(/\bclass\s+(\w+)/g)].map(m => m[1]);
  const cards = [
    ['Language', language === 'cpp' ? 'C++' : 'Java'],
    ['Class', classes.join(', ') || 'No class declared'],
    ['Functions', functions.join(', ') || 'No methods recognised'],
    ['Loops', loops.join(', ') || 'No loops'],
    ['Conditions', conditions ? String(conditions) : 'No branches']
  ].map(item => '<div class="structure-card"><small>'+escapeHtml(item[0])+'</small><b>'+escapeHtml(item[1])+'</b></div>').join('');
  const flow = functions.length ? functions.map((name,index) => '<span class="flow-node">'+escapeHtml(name)+'</span>'+(index<functions.length-1?'<span class="flow-arrow">→</span>':'')).join('') : '<span class="flow-node">Solution</span>';
  const testLab = language === 'cpp' ? cppTestLab(code) : '';
  $('traceResult').innerHTML='<b>'+escapeHtml(result.notice || 'Compiled successfully.')+'</b><div class="structure-grid">'+cards+'</div><div class="code-flow"><b>Code flow map</b><div class="flow-line">'+flow+'</div><p class="hint">This is a source-structure visualization. Add a main method to execute a LeetCode Solution class locally.</p></div>'+testLab+'<b>Program output</b><pre>'+escapeHtml(result.output.join('\n') || 'No output yet.')+'</pre>';
  if (language === 'cpp') bindCppTests();
}
function cppTestLab(code) {
  const isTwoSum = /\btwoSum\s*\(/.test(code);
  const problem = $('problemInput').value;
  const numsMatch = problem.match(/nums\s*=\s*\[([^\]]+)\]/i);
  const targetMatch = problem.match(/target\s*=\s*(-?\d+)/i);
  const outputMatch = problem.match(/output\s*:\s*(\[[^\]]+\])/i);
  const nums = numsMatch ? numsMatch[1].trim() : '2, 7, 11, 15';
  const target = targetMatch ? targetMatch[1] : '9';
  const body = isTwoSum
    ? 'vector<int> nums = {'+nums+'};\nvector<int> answer = solution.twoSum(nums, '+target+');\ncout << \"[\" << answer[0] << \",\" << answer[1] << \"]\" << endl;'
    : '// Write a call to a Solution method, then print its result.\n// Example: cout << solution.methodName(arguments) << endl;';
  const expected = isTwoSum ? (outputMatch ? outputMatch[1].replace(/\s/g,'') : '[0,1]') : '';
  if (!cppCases.length) cppCases = [{id:++cppCaseSequence,name:isTwoSum?'Example 1':'Test 1',body,expected}];
  const imported = isTwoSum && numsMatch ? 'The first case was imported from the Problem tab.' : 'Edit the starter case or add your own.';
  const caseCards = cppCases.map((test,index) => '<div class="case-card"><div class="case-title"><b>'+escapeHtml(test.name)+'</b><div><button class="mini run-one" data-case="'+test.id+'">Run</button><button class="mini delete-case" data-case="'+test.id+'">×</button></div></div><label>Harness body</label><textarea class="case-body" data-case="'+test.id+'" spellcheck="false">'+escapeHtml(test.body)+'</textarea><label>Expected output <span class="hint">(optional)</span></label><input class="case-expected" data-case="'+test.id+'" value="'+escapeHtml(test.expected)+'" placeholder="Example: [0,1]"><div id="caseResult-'+test.id+'" class="test-result">Not run.</div></div>').join('');
  return '<div class="test-lab"><div class="analysis-head"><b>Test Case Lab</b><span class="complexity">'+cppCases.length+' case'+(cppCases.length===1?'':'s')+'</span></div><p class="hint">'+imported+' Each harness is temporary and starts with <code>Solution solution;</code>.</p><div id="caseList">'+caseCards+'</div><div class="button-row"><button id="addCppCase" class="secondary">+ Add test case</button><button id="runAllCppTests">Run all tests</button></div><div id="testSummary" class="test-summary">Add edge cases: empty input, one item, duplicate values, and the largest allowed input.</div></div>';
}
function syncCppCases() {
  document.querySelectorAll('.case-body').forEach(el => { const test=cppCases.find(x=>x.id===+el.dataset.case); if(test) test.body=el.value; });
  document.querySelectorAll('.case-expected').forEach(el => { const test=cppCases.find(x=>x.id===+el.dataset.case); if(test) test.expected=el.value; });
  vscode.setState({cppCases,cppCaseSequence});
}
function bindCppTests() {
  const runCase = id => { syncCppCases(); const test=cppCases.find(x=>x.id===id); const target=$('caseResult-'+id); target.className='test-result'; target.textContent='Compiling test harness…'; vscode.postMessage({type:'runCppTest',caseId:id,code:$('codeInput').value,testBody:test.body}); };
  document.querySelectorAll('.run-one').forEach(button=>button.onclick=()=>runCase(+button.dataset.case));
  document.querySelectorAll('.delete-case').forEach(button=>button.onclick=()=>{syncCppCases();cppCases=cppCases.filter(x=>x.id!==+button.dataset.case);renderStructure('cpp',$('codeInput').value,{notice:'Compiled successfully.',output:[]});});
  $('addCppCase').onclick=()=>{syncCppCases();cppCases.push({id:++cppCaseSequence,name:'Test '+cppCases.length+1,body:'// Call a Solution method and print its result.',expected:''});renderStructure('cpp',$('codeInput').value,{notice:'Compiled successfully.',output:[]});};
  $('runAllCppTests').onclick=()=>{syncCppCases();cppCases.forEach(test=>runCase(test.id));};
}
window.addEventListener('message', event => {
  if (event.data.type !== 'testResult') return;
  const result = event.data.result, id = +event.data.caseId, el = $('caseResult-'+id), test=cppCases.find(x=>x.id===id);
  if (!el || !test) return;
  if (!result.ok) { el.className='test-result fail'; el.innerHTML='<b>Test could not run</b><pre>'+escapeHtml(result.error || 'Unknown error')+'</pre>'; updateTestSummary(); return; }
  const actual = result.output.join('\n').trim(), expected = test.expected.trim();
  const pass = !expected || actual.replace(/\s/g,'') === expected.replace(/\s/g,'');
  el.className='test-result '+(pass?'pass':'fail');
  el.innerHTML='<b>'+(pass?'✓ Test passed':'✗ Test failed')+'</b><div>Actual: <code>'+escapeHtml(actual || '(no output)')+'</code>'+(expected?' · Expected: <code>'+escapeHtml(expected)+'</code>':'')+'</div>';
  test.status=pass?'pass':'fail'; updateTestSummary();
});
function updateTestSummary() {
  const summary=$('testSummary'); if(!summary) return;
  const done=cppCases.filter(x=>x.status),passed=cppCases.filter(x=>x.status==='pass');
  if(done.length) summary.textContent='Test summary: '+passed.length+' / '+done.length+' passed. Cases with no expected output only verify that the code runs.';
}
function renderTrace(output) { const el=$('traceResult'); if(!trace.length){el.innerHTML='<b>No executable line events.</b>';return;} const step=trace[cursor],dots=trace.map((s,i)=>'<button class="step '+(i===cursor?'current':'')+'" data-i="'+i+'">L'+s.line+'</button>').join(''); el.innerHTML='<b>Step '+(cursor+1)+' of '+trace.length+'</b> · line <b>'+step.line+'</b><div class="timeline">'+dots+'</div><div class="controls"><button id="prev">← Back</button><button id="next">Next →</button></div><b>Variables</b><pre>'+escapeHtml(JSON.stringify(step.variables,null,2))+'</pre><b>Output</b><pre>'+escapeHtml((step.output.length?step.output:output).join('\n')||'—')+'</pre>';document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{cursor=+b.dataset.i;renderTrace(output)});$('prev').onclick=()=>{cursor=Math.max(0,cursor-1);renderTrace(output)};$('next').onclick=()=>{cursor=Math.min(trace.length-1,cursor+1);renderTrace(output)};}
document.querySelectorAll('[data-concept]').forEach(b=>b.onclick=()=>{const content={array:'<b>Array</b><p>An ordered, contiguous collection. Indexing <code>arr[i]</code> is O(1).</p>',linked:'<b>Linked list</b><p>Each node stores a value and a reference to its next node.</p>',stack:'<b>Recursion & call stack</b><p>Every recursive call gets its own frame. Base cases stop new frames; return values unwind them.</p>'};$('conceptResult').innerHTML=content[b.dataset.concept];});
function escapeHtml(x) { return String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
