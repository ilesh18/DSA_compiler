(function () {
  const escape = value => String(value).replace(/[&<>]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
  const isPrimitive = value => value === null || ['string','number','boolean'].includes(typeof value);

  function variables(snapshot) {
    const entries = Object.entries(snapshot.variables || {});
    if (!entries.length) return '<p class="hint">No local variables at this point.</p>';
    return '<div class="viz-grid">' + entries.filter(([, value]) => isPrimitive(value)).map(([name, value]) =>
      '<div class="viz-variable"><small>' + escape(name) + '</small><b>' + escape(JSON.stringify(value)) + '</b></div>').join('') + '</div>';
  }

  function arrays(snapshot) {
    const entries = Object.entries(snapshot.variables || {}).filter(([, value]) => Array.isArray(value));
    if (!entries.length) return '';
    return entries.map(([name, values]) => '<div class="viz-section"><b>Array · ' + escape(name) + '</b><div class="viz-array">' +
      values.map((value, index) => '<div class="viz-cell"><small>' + index + '</small><b>' + escape(JSON.stringify(value)) + '</b></div>').join('') +
      '</div></div>').join('');
  }

  function objects(snapshot) {
    const entries = Object.entries(snapshot.variables || {}).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
    if (!entries.length) return '';
    return entries.map(([name, value]) => {
      const keys = Object.keys(value);
      const pointer = keys.includes('next') ? '<span class="viz-arrow">→</span><span class="viz-node">next: ' + escape(JSON.stringify(value.next)) + '</span>' : '';
      const children = keys.includes('left') || keys.includes('right') ? '<div class="viz-tree">left: ' + escape(JSON.stringify(value.left)) + ' · right: ' + escape(JSON.stringify(value.right)) + '</div>' : '';
      return '<div class="viz-section"><b>Object · ' + escape(name) + '</b><div class="viz-object"><span class="viz-node">' + escape(JSON.stringify(value)) + '</span>' + pointer + '</div>' + children + '</div>';
    }).join('');
  }

  function changes(snapshot) {
    const list = snapshot.changes || [];
    return list.length ? '<div class="viz-changes"><b>Changed now</b><ul>' + list.map(change => '<li><code>' + escape(change.name) + '</code>: ' + escape(JSON.stringify(change.before)) + ' → ' + escape(JSON.stringify(change.after)) + '</li>').join('') + '</ul></div>' : '';
  }

  window.VisualEngine = {
    render(snapshot) {
      return '<section class="runtime-viz"><div class="viz-heading"><b>Runtime state</b><span>' + escape(snapshot.function || '<module>') + '</span></div>' +
        changes(snapshot) + '<div class="viz-section"><b>Variables</b>' + variables(snapshot) + '</div>' + arrays(snapshot) + objects(snapshot) + '</section>';
    }
  };
}());
