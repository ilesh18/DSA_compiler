const vscode = acquireVsCodeApi();
let trace = [], cursor = 0, lastAnalysis = null, playbackTimer = null, traceError = '';
let cppCases = [], cppCaseSequence = 0;
const $ = id => document.getElementById(id);
const savedState = vscode.getState();
if (savedState && Array.isArray(savedState.cppCases)) {
  cppCases = savedState.cppCases;
  cppCaseSequence = Number(savedState.cppCaseSequence || cppCases.length);
}
if (savedState) {
  if (typeof savedState.problem === 'string') $('problemInput').value = savedState.problem;
  if (typeof savedState.code === 'string') $('codeInput').value = savedState.code;
  if (['python','cpp','java'].includes(savedState.language)) $('language').value = savedState.language;
}
function saveWorkspace() {
  vscode.setState({
    problem:$('problemInput').value,
    code:$('codeInput').value,
    language:$('language').value,
    cppCases,
    cppCaseSequence
  });
}
$('problemInput').addEventListener('input', saveWorkspace);
$('codeInput').addEventListener('input', saveWorkspace);
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
  const targetMatch = text.match(/(?:target|find(?: whether)?|search(?:ing)? for)\s*(?:=|is)?\s*(-?\d+)/i);
  const constraints = (text.match(/(?:constraints?|[1≤<>=].{0,100})/ig) || []).slice(0,3);
  const example = (text.match(/(?:example|input|output).{0,180}/is) || ['No explicit example recognised. Add an “Example: Input … Output …” block.'])[0];
  return {primary, detected, arrays, target:targetMatch ? Number(targetMatch[1]) : null, constraints, example, starter:primary.starter};
}
function renderAnalysis(a) {
  const p = a.primary, tags = a.detected.length ? a.detected.map(x => '<span class="tag">'+x.label+'</span>').join('') : '<span class="tag">Needs manual classification</span>';
  const lesson = learningGuide(p.visual);
  $('problemResult').className = 'result';
  $('problemResult').innerHTML = '<div class="analysis-head"><b>Likely approach: '+p.label+'</b><span class="complexity">'+p.time+'</span></div><div class="tags">'+tags+'</div><p>'+p.why+'</p><h3>Plan it before coding</h3><ol>'+p.steps.map(x => '<li>'+x+'</li>').join('')+'</ol><div class="visual-card">'+visual(p.visual,a.arrays,a.target)+'</div><div class="study-grid"><div><small>Brute force</small><b>'+lesson.brute+'</b></div><div><small>Optimized idea</small><b>'+lesson.optimized+'</b></div><div><small>Common mistake</small><b>'+lesson.mistake+'</b></div></div><div class="info-grid"><div><b>Example extracted</b><pre>'+escapeHtml(a.example.trim())+'</pre></div><div><b>Constraints noticed</b><pre>'+escapeHtml(a.constraints.join('\n') || 'No constraints identified — paste them for better complexity advice.')+'</pre></div></div><div class="button-row"><button id="learnRelated" class="secondary">Explore '+escapeHtml(p.label)+'</button></div><p class="hint">Expected complexity: <b>'+p.time+'</b> time, <b>'+p.space+'</b> extra space. Load the starter, then alter its example and trace it line-by-line.</p>';
  $('learnRelated').onclick=()=>{document.querySelector('[data-tab="concepts"]').click();showConcept(conceptForPattern(p.visual));};
}
function conceptForPattern(pattern) { return {map:'hash',window:'sliding',binary:'binary',linked:'linked',tree:'tree',graph:'graph',dp:'dp',stack:'stack'}[pattern] || 'array'; }
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
function visual(kind, arrays, target) {
  const values = arrays[0] || '[2, 7, 11, 15]';
  if (kind==='map') return '<b>Complement lookup model</b><div class="flow"><span class="node">value 2</span><span class="arrow">→ store</span><span class="node">seen {2: 0}</span><span class="arrow">→ target − 7 = 2</span><span class="node">match!</span></div>';
  if (kind==='window') return '<b>Window expands and shrinks</b><div class="window"><span>a</span><span>b</span><span class="inside">c</span><span class="inside">a</span><span class="inside">b</span><span>c</span><small>left └──────────┘ right</small></div>';
  if (kind==='binary') {
    const parsedValues=valuesFromArray(values);
    const searchValues=parsedValues.length?parsedValues:[1,3,5,7,9];
    const needle=target===null?searchValues[Math.floor(searchValues.length/2)]:target;
    const steps=binarySteps(searchValues,needle);
    return '<b>Binary-search state · target '+escapeHtml(needle)+'</b><div class="binary">'+searchValues.map((value,index)=>'<span class="'+(index===steps[0].mid?'mid-cell':'')+'">'+escapeHtml(value)+'</span>').join('')+'</div><ol class="algo-steps">'+steps.map(step=>'<li>range ['+step.low+', '+step.high+'], mid '+step.mid+' → '+step.value+(step.value===needle?' ✓ found':step.value<needle?' · search right':' · search left')+'</li>').join('')+'</ol>';
  }
  if (kind==='linked') return '<b>Pointer links</b><div><span class="node">1</span><span class="arrow">→</span><span class="node">2</span><span class="arrow">→</span><span class="node">3</span><span class="arrow">→ ∅</span></div>';
  if (kind==='tree') return '<b>DFS structure</b><pre>      4\n    /   \\\n   2     7\n  / \\\n 1   3</pre>';
  if (kind==='graph') return '<b>Visit connected states once</b><div class="flow"><span class="node">A</span><span class="arrow">↔</span><span class="node">B</span><span class="arrow">↔</span><span class="node">C</span></div>';
  if (kind==='dp') return '<b>Build answers from smaller states</b><div class="dp"><span>dp[0]</span><span>dp[1]</span><span>dp[2]</span><span>dp[3]</span></div>';
  if (kind==='stack') return '<b>Last opened, first closed</b><div class="stackvis"><span>(</span><span>[</span><span>{</span></div>';
  return '<b>Input model</b><pre>'+escapeHtml(values)+'</pre>';
}
function valuesFromArray(text) { try { return JSON.parse(text.replace(/'/g,'"')).filter(value=>typeof value==='number'); } catch { return []; } }
function binarySteps(values,target) { let low=0,high=values.length-1,steps=[]; while(low<=high && steps.length<20){const mid=Math.floor((low+high)/2),value=values[mid];steps.push({low,high,mid,value});if(value===target)break;if(value<target)low=mid+1;else high=mid-1;}return steps; }
$('language').onchange = () => {
  const info = {python:'Python runs locally and shows each executed line with variables.',cpp:'C++ is compiled with MinGW. After a successful build, view the function, loop, and condition map below.',java:'Java is compiled with javac. After a successful build, view the function, loop, and condition map below.'};
  $('languageHelp').textContent = info[$('language').value];
  saveWorkspace();
};
$('language').onchange();
$('runTrace').onclick = () => { $('traceResult').className='result'; $('traceResult').textContent='Compiling and analysing locally…'; vscode.postMessage({type:'runCode',code:$('codeInput').value,language:$('language').value}); };
window.addEventListener('message', event => {
  if(event.data.type!=='traceResult') return;
  const result=event.data.result, language=event.data.language;
  if(!result.ok && !(result.steps && result.steps.length)){$('traceResult').innerHTML='<b>Build / run stopped</b><pre>'+escapeHtml(result.error || 'Unknown error')+'</pre>';return;}
  trace=result.steps; cursor=0; traceError=result.ok?'':(result.error || 'Execution stopped.');
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
    ? 'nums = ['+nums+'], target = '+target
    : '// Paste LeetCode-style input here.\n// Example: nums1 = [1,3], nums2 = [2]';
  const expected = isTwoSum ? (outputMatch ? outputMatch[1].replace(/\s/g,'') : '[0,1]') : '';
  if (!cppCases.length) cppCases = [{id:++cppCaseSequence,name:isTwoSum?'Example 1':'Test 1',body,expected}];
  const imported = isTwoSum && numsMatch ? 'The first case was imported from the Problem tab.' : 'Edit the starter case or add your own.';
  const caseCards = cppCases.map((test,index) => '<div class="case-card"><div class="case-title"><b>'+escapeHtml(test.name)+'</b><div><button class="mini run-one" data-case="'+test.id+'">Run</button><button class="mini delete-case" data-case="'+test.id+'">×</button></div></div><label>Harness body</label><textarea class="case-body" data-case="'+test.id+'" spellcheck="false">'+escapeHtml(test.body)+'</textarea><label>Expected output <span class="hint">(optional)</span></label><input class="case-expected" data-case="'+test.id+'" value="'+escapeHtml(test.expected)+'" placeholder="Example: [0,1]"><div id="caseResult-'+test.id+'" class="test-result">Not run.</div></div>').join('');
  return '<div class="test-lab"><div class="analysis-head"><b>Test Case Lab</b><span class="complexity">'+cppCases.length+' case'+(cppCases.length===1?'':'s')+'</span></div><p class="hint">'+imported+' Paste LeetCode input such as <code>nums1 = [1,3], nums2 = [2]</code>; the extension creates the C++ declarations, method call, and output harness.</p><div id="caseList">'+caseCards+'</div><div class="button-row"><button id="addCppCase" class="secondary">+ Add test case</button><button id="runAllCppTests">Run all tests</button></div><div id="testSummary" class="test-summary">Add edge cases: empty input, one item, duplicate values, and the largest allowed input.</div></div>';
}
function makeCppTestHarness(code, input) {
  const text = input.trim();
  if (!text || text.startsWith('//')) return {ok:false,error:'Paste a test input, for example: nums1 = [1,3], nums2 = [2].'};
  if (/;|\bcout\b|\breturn\b/.test(text)) return {ok:true,body:text};
  const methodMatches = [...code.matchAll(/(?:^|[;\n])\s*(?:public:\s*)?([\w:<>,\s&*]+?)\s+(\w+)\s*\(([^)]*)\)\s*\{/gm)];
  const method = methodMatches.find(match => !['if','for','while','switch'].includes(match[2]));
  if (!method) return {ok:false,error:'Could not find a Solution method. Keep the method signature inside class Solution.'};
  const declared = [], names = [];
  for (const match of text.matchAll(/(\w+)\s*=\s*\[([^\]]*)\]/g)) {
    const name=match[1], values=match[2].trim();
    if (!/^[-\d\s,]*$/.test(values)) return {ok:false,error:'This automatic builder currently supports integer arrays. Use the advanced C++ harness format for other inputs.'};
    declared.push('vector<int> '+name+' = {'+values+'};'); names.push(name);
  }
  for (const match of text.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) {
    declared.push('string '+match[1]+' = "'+match[2].replace(/"/g,'\\"')+'";'); names.push(match[1]);
  }
  for (const match of text.matchAll(/(\w+)\s*=\s*(-?\d+(?:\.\d+)?)(?!\s*[\],])/g)) {
    if (names.includes(match[1])) continue;
    declared.push((match[2].includes('.')?'double ':'int ')+match[1]+' = '+match[2]+';'); names.push(match[1]);
  }
  if (!declared.length) return {ok:false,error:'Use LeetCode input like nums = [2,7], target = 9, or write an advanced C++ harness with cout.'};
  const parameters = method[3].split(',').map(part => (part.match(/(\w+)\s*$/)||[])[1]).filter(Boolean);
  const args = parameters.length && parameters.every(name=>names.includes(name)) ? parameters : names;
  const call='solution.'+method[2]+'('+args.join(', ')+')';
  const printer=/vector\s*</.test(method[1])
    ? 'auto answer = '+call+';\ncout << \"[\";\nfor (size_t i = 0; i < answer.size(); ++i) { if (i) cout << \",\"; cout << answer[i]; }\ncout << \"]\" << endl;'
    : 'auto answer = '+call+';\ncout << answer << endl;';
  return {ok:true,body:declared.join('\n')+'\n'+printer};
}
function syncCppCases() {
  document.querySelectorAll('.case-body').forEach(el => { const test=cppCases.find(x=>x.id===+el.dataset.case); if(test) test.body=el.value; });
  document.querySelectorAll('.case-expected').forEach(el => { const test=cppCases.find(x=>x.id===+el.dataset.case); if(test) test.expected=el.value; });
  saveWorkspace();
}
function bindCppTests() {
  const runCase = id => { syncCppCases(); const test=cppCases.find(x=>x.id===id); const target=$('caseResult-'+id); target.className='test-result'; target.textContent='Building a test harness…'; const harness=makeCppTestHarness($('codeInput').value,test.body); if(!harness.ok){target.className='test-result fail';target.textContent=harness.error;return;} vscode.postMessage({type:'runCppTest',caseId:id,code:$('codeInput').value,testBody:harness.body}); };
  document.querySelectorAll('.run-one').forEach(button=>button.onclick=()=>runCase(+button.dataset.case));
  document.querySelectorAll('.delete-case').forEach(button=>button.onclick=()=>{syncCppCases();cppCases=cppCases.filter(x=>x.id!==+button.dataset.case);renderStructure('cpp',$('codeInput').value,{notice:'Compiled successfully.',output:[]});});
  $('addCppCase').onclick=()=>{syncCppCases();cppCases.push({id:++cppCaseSequence,name:'Test '+(cppCases.length+1),body:'nums1 = [1,3], nums2 = [2]',expected:''});renderStructure('cpp',$('codeInput').value,{notice:'Compiled successfully.',output:[]});};
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
  el.innerHTML='<b>'+(pass?'✓ Test passed':'✗ Test failed')+'</b><div>Actual: <code>'+escapeHtml(actual || '(no output)')+'</code>'+(expected?' · Expected: <code>'+escapeHtml(expected)+'</code>':'')+'</div>'+cppCaseVisualization(test, actual);
  test.status=pass?'pass':'fail'; updateTestSummary();
});
function cppCaseVisualization(test, actual) {
  const arrayMatch = test.body.match(/(?:vector\s*<\s*int\s*>\s+\w+\s*=\s*\{([^}]*)\}|(\w+)\s*=\s*\[([^\]]*)\])/);
  const targetMatch = test.body.match(/(?:target\s*=\s*(-?\d+)|\.\s*\w+\s*\(\s*\w+\s*,\s*(-?\d+)\s*\))/);
  if (!arrayMatch) return '<p class="hint">Add an integer vector to the harness to see an input visualization.</p>';
  const values = (arrayMatch[1] || arrayMatch[3]).split(',').map(x=>x.trim()).filter(Boolean);
  const target = targetMatch ? (targetMatch[1] || targetMatch[2]) : null;
  const cells = values.map((value,index)=>'<div class="test-cell"><small>'+index+'</small><b>'+escapeHtml(value)+'</b></div>').join('');
  let explanation = 'The harness supplies this array to your Solution method.';
  if (target !== null) {
    const pair = findTargetPair(values, Number(target));
    explanation = pair ? 'Target '+target+': values at indices '+pair[0]+' and '+pair[1]+' add up to it.' : 'Target '+target+': the visual checks each value against its needed complement.';
  }
  return '<div class="case-visual"><b>Test-case visualization</b><div class="test-array">'+cells+'</div><p>'+escapeHtml(explanation)+'</p><p class="hint">Output from this exact test: <code>'+escapeHtml(actual || '(none)')+'</code></p></div>';
}
function findTargetPair(values, target) {
  const seen = new Map();
  for (let i=0;i<values.length;i++) {
    const value=Number(values[i]), need=target-value;
    if (seen.has(need)) return [seen.get(need),i];
    seen.set(value,i);
  }
  return null;
}
function updateTestSummary() {
  const summary=$('testSummary'); if(!summary) return;
  const done=cppCases.filter(x=>x.status),passed=cppCases.filter(x=>x.status==='pass');
  if(done.length) summary.textContent='Test summary: '+passed.length+' / '+done.length+' passed. Cases with no expected output only verify that the code runs.';
}
function renderTrace(output) {
  const el=$('traceResult');
  if(!trace.length){el.innerHTML='<b>No executable line events.</b>';return;}
  const step=trace[cursor], dots=trace.map((s,i)=>'<button class="step '+(i===cursor?'current':'')+'" data-i="'+i+'">L'+s.line+'</button>').join('');
  const source=$('codeInput').value.split('\n').map((line,index)=>'<div class="source-line '+(index+1===step.line?'active':'')+'"><span>'+(index+1)+'</span><code>'+escapeHtml(line||' ')+'</code></div>').join('');
  const runtime=window.VisualEngine ? window.VisualEngine.render(step) : '<pre>'+escapeHtml(JSON.stringify(step.variables,null,2))+'</pre>';
  const status=traceError?'<div class="trace-error">'+escapeHtml(traceError)+'</div>':'';
  el.innerHTML='<div class="trace-head"><b>Step '+(cursor+1)+' of '+trace.length+'</b><span>'+escapeHtml(step.event||'line')+' · '+escapeHtml(step.function||'<module>')+'</span></div>'+status+'<div class="timeline">'+dots+'</div><div class="controls"><button id="playTrace">▶ Play</button><button id="pauseTrace" class="secondary">Pause</button><button id="prev">← Back</button><button id="next">Next →</button><button id="restartTrace" class="secondary">Restart</button><label class="speed-label">Speed <select id="traceSpeed"><option value="900">Slow</option><option value="450" selected>Normal</option><option value="160">Fast</option></select></label></div><div class="trace-layout"><div><b>Source</b><div class="source-view">'+source+'</div></div><div>'+runtime+'</div></div><b>Output</b><pre>'+escapeHtml((step.output.length?step.output:output).join('\n')||'—')+'</pre>';
  document.querySelectorAll('[data-i]').forEach(button=>button.onclick=()=>{stopPlayback();cursor=+button.dataset.i;renderTrace(output);});
  $('prev').onclick=()=>{stopPlayback();cursor=Math.max(0,cursor-1);renderTrace(output);};
  $('next').onclick=()=>{stopPlayback();cursor=Math.min(trace.length-1,cursor+1);renderTrace(output);};
  $('restartTrace').onclick=()=>{stopPlayback();cursor=0;renderTrace(output);};
  $('playTrace').onclick=()=>playTrace(output);
  $('pauseTrace').onclick=stopPlayback;
}
function stopPlayback(){if(playbackTimer){clearTimeout(playbackTimer);playbackTimer=null;}}
function playTrace(output){
  stopPlayback();
  const advance=()=>{
    if(cursor>=trace.length-1){stopPlayback();return;}
    cursor+=1; renderTrace(output);
    const speed=Number($('traceSpeed').value||450);
    playbackTimer=setTimeout(advance,speed);
  };
  const speed=Number($('traceSpeed').value||450);
  playbackTimer=setTimeout(advance,speed);
}
const conceptLibrary = {
  array:['Array','Contiguous ordered values for fast indexing.','Store values by index; resize by copying when needed.','O(1) access · O(n) insert/delete','Using an index outside bounds.','Buffers, lookup tables, dynamic lists.'],
  linked:['Linked list','Nodes connect through references, so insertion can be local.','Follow next links; keep head and pointer updates safe.','O(n) access · O(1) insert at known node','Losing next before rewiring.','Playlists, free lists.'],
  stack:['Stack','Last-in, first-out storage.','Push to the top and pop the most recent item.','O(1) push/pop','Popping an empty stack.','Undo, parsing, call stacks.'],
  queue:['Queue','First-in, first-out processing.','Enqueue at the back and dequeue from the front.','O(1) enqueue/dequeue','Using an array front removal inefficiently.','Scheduling, BFS, messaging.'],
  hash:['Hash table','Maps keys to buckets for fast expected lookup.','Hash a key, resolve collisions, then store or retrieve.','Expected O(1) lookup','Assuming iteration order or ignoring collisions.','Caches, frequency counts, sets.'],
  tree:['Binary tree','Hierarchical nodes with at most two children.','Traverse with DFS or BFS from a root.','O(n) traversal','Forgetting null-child base cases.','Expression trees, folders.'],
  bst:['Binary search tree','A tree ordered left < node < right.','Compare a value and move to the matching subtree.','O(h) search','Expecting O(log n) from an unbalanced tree.','Ordered maps and sets.'],
  heap:['Heap','A partial-order tree for quickly finding min or max.','Insert then bubble up; remove root then bubble down.','O(log n) update · O(1) peek','Treating it as a fully sorted array.','Priority queues, schedulers.'],
  graph:['Graph','Vertices joined by edges model relationships.','Choose BFS for layers/shortest unweighted paths or DFS for exploration.','O(V + E)','Not tracking visited vertices.','Maps, dependencies, networks.'],
  trie:['Trie','A prefix tree stores strings character by character.','Walk one edge per character; mark completed words.','O(L) lookup','Using too much memory for sparse alphabets.','Autocomplete, dictionaries.'],
  binary:['Binary search','Searches a sorted monotonic space by halving it.','Compare middle; keep only the possible half.','O(log n) time · O(1) space','Incorrect low/high update.','Lookup in sorted data, answer search.'],
  linear:['Linear search','Checks entries one by one.','Stop as soon as the target is found.','O(n) time · O(1) space','Using it when sorted input permits binary search.','Small or unsorted lists.'],
  bubble:['Bubble sort','Repeatedly swaps neighboring inverted values.','Sweep, swap, and stop when a sweep makes no swaps.','O(n²) time · O(1) space','Using it for large data.','Teaching swaps.'],
  selection:['Selection sort','Selects the smallest remaining item each pass.','Find minimum then swap into the next position.','O(n²) time · O(1) space','Expecting stable order.','Tiny lists, teaching.'],
  insertion:['Insertion sort','Builds a sorted prefix one value at a time.','Shift larger prefix elements then insert current value.','O(n²) worst · O(1) space','Forgetting to shift before overwrite.','Nearly sorted small data.'],
  merge:['Merge sort','Divide-and-conquer sorting with stable merges.','Split halves, sort recursively, merge ordered results.','O(n log n) time · O(n) space','Ignoring extra merge memory.','Stable large-data sorting.'],
  quick:['Quick sort','Partition around a pivot then sort partitions.','Move smaller values left and larger values right.','Average O(n log n)','Bad pivot choice on ordered data.','In-memory general sorting.'],
  bfs:['Breadth-first search','Explores graph layers using a queue.','Visit neighbors in queue order.','O(V + E)','Marking visited after dequeue.','Shortest unweighted paths.'],
  dfs:['Depth-first search','Explores a path deeply before backtracking.','Use recursion or an explicit stack.','O(V + E)','Recursing forever through cycles.','Connectivity, ordering, components.'],
  recursion:['Recursion','A function solves a smaller version of itself.','Define a base case and reduce the input each call.','Depends on recurrence','Missing a base case.','Trees, divide-and-conquer.'],
  dp:['Dynamic programming','Stores overlapping subproblem answers.','Define state, recurrence, base cases, and evaluation order.','Depends on state count','Caching the wrong state.','Optimization and counting problems.'],
  greedy:['Greedy algorithm','Makes a locally best choice backed by proof.','Choose, preserve the invariant, and continue.','Usually O(n log n)','Using greedy without proving it is safe.','Intervals, scheduling, MSTs.'],
  backtracking:['Backtracking','Searches choices and undoes a choice when needed.','Choose, recurse, unchoose, and prune invalid branches.','Often exponential','Failing to undo mutable state.','Permutations, constraint solving.'],
  sliding:['Sliding window','Maintains a moving contiguous range without recomputing it.','Expand the right edge; shrink the left edge only when the window is invalid.','O(n) time · O(k) space','Moving the left edge before recording a valid answer.','Substring and subarray problems.'],
  twopointers:['Two pointers','Uses two positions to scan data from one or both ends.','Move the pointer that can eliminate impossible answers.','Usually O(n) time · O(1) space','Moving both pointers without a reason.','Sorted pair sums, palindrome checks.'],
  prefix:['Prefix sum','Precomputes cumulative totals for quick range queries.','Store sum up to each index; subtract two prefixes for a range.','O(n) build · O(1) query','Off-by-one errors at range boundaries.','Range sums, subarray counts.'],
  monotonic:['Monotonic stack','Keeps values ordered to expose the next greater or smaller item.','Pop invalid candidates; the remaining top is the nearest answer.','O(n) time · O(n) space','Pushing before resolving popped values.','Next greater element, histogram area.'],
  unionfind:['Union-Find','Tracks connected components while edges are added.','Find representatives; union sets with rank and path compression.','Near O(1) amortized','Forgetting path compression.','Connectivity, cycle detection, Kruskal MST.'],
  topo:['Topological sort','Orders directed acyclic graph dependencies.','Use indegrees with BFS or DFS postorder.','O(V + E)','Trying to order a graph with a cycle.','Build systems, course schedules.'],
  dijkstra:['Dijkstra','Finds shortest paths with non-negative weighted edges.','Always expand the unvisited node with smallest tentative distance.','O((V + E) log V)','Using it with negative edge weights.','Routing, weighted maps.'],
  bellman:['Bellman-Ford','Finds shortest paths and detects negative cycles.','Relax every edge V−1 times; one extra pass exposes a cycle.','O(VE)','Using it when Dijkstra is sufficient.','Graphs with negative weights.'],
  floyd:['Floyd-Warshall','Finds all-pairs shortest paths.','Try every vertex as the final allowed intermediate.','O(V³) time · O(V²) space','Using it on large sparse graphs.','Small dense route networks.'],
  kadane:['Kadane’s algorithm','Finds the maximum-sum contiguous subarray.','Keep the best ending here; restart when the running sum hurts.','O(n) time · O(1) space','Resetting before comparing to the answer.','Maximum subarray problems.'],
  interval:['Intervals','Reasons about overlapping ranges.','Sort by start or end, then merge, select, or compare neighbors.','O(n log n) time','Forgetting touching intervals may overlap by definition.','Calendars, scheduling, merging ranges.'],
  bit:['Bit manipulation','Uses binary representation for compact state operations.','Mask, shift, XOR, and test individual bits.','Usually O(1) per operation','Confusing XOR with OR.','Subsets, flags, parity.'],
  divide:['Divide and conquer','Splits a problem into smaller independent parts.','Divide, solve recursively, then combine results.','Often O(n log n)','Ignoring the combine cost.','Merge sort, closest pair.'],
  kmp:['KMP string matching','Finds pattern occurrences without restarting comparisons.','Build an LPS prefix table and reuse matched prefix length.','O(n + m) time','Building the prefix table incorrectly.','Text search, DNA matching.'],
  matrix:['Matrix traversal','Visits 2D cells with directional or layer invariants.','Track bounds or use row/column deltas with visited checks.','O(rows × cols)','Swapping row and column bounds.','Grids, image processing.'],
  reservoir:['Reservoir sampling','Selects a uniform sample from a stream of unknown length.','Replace the stored item with probability 1/i at item i.','O(n) time · O(1) space','Using a fixed probability for each item.','Streaming data.']
};
function showConcept(key) {
  const item=conceptLibrary[key] || conceptLibrary.array;
  $('conceptResult').innerHTML='<div class="analysis-head"><b>'+item[0]+'</b><span class="complexity">'+item[3]+'</span></div><p>'+item[1]+'</p><div class="study-grid"><div><small>How it works</small><b>'+item[2]+'</b></div><div><small>Common mistake</small><b>'+item[4]+'</b></div><div><small>Applications</small><b>'+item[5]+'</b></div></div><div class="visual-card"><b>Mini model</b><pre>'+escapeHtml(conceptModel(key))+'</pre></div><p class="hint">Try writing a small example in Trace and inspect each state change.</p>';
}
function conceptModel(key) {
  const models={array:'index:  0   1   2\nvalue: [4] [7] [9]',linked:'head → [4|•] → [7|•] → [9|∅]',stack:'top\n[ 9 ]\n[ 7 ]\n[ 4 ]',queue:'front → [4] [7] [9] ← back',tree:'    4\n   / \\\n  2   7',graph:'A — B — C\n    |   |\n    D — E',binary:'low  [ 1  3  5  7  9 ] high\n             ^ mid',dp:'dp[0] → dp[1] → dp[2] → dp[3]',trie:'root → c → a → t ✓',heap:'    1\n   / \\\n  3   5'};
  return models[key] || 'input → choose operation → update state → result';
}
function renderConceptList(query='') {
  const term=query.trim().toLowerCase();
  const items=Object.entries(conceptLibrary).filter(([key,value]) => !term || key.includes(term) || value[0].toLowerCase().includes(term) || value[1].toLowerCase().includes(term));
  $('conceptList').innerHTML=items.length ? items.map(([key,value]) => '<button data-concept="'+key+'">'+escapeHtml(value[0])+'</button>').join('') : '<p class="hint">No concept found. Try a related term such as graph, window, shortest path, or sort.</p>';
  document.querySelectorAll('[data-concept]').forEach(button=>button.onclick=()=>showConcept(button.dataset.concept));
}
$('conceptSearch').addEventListener('input', event=>renderConceptList(event.target.value));
renderConceptList();
function escapeHtml(x) { return String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
