(function () {
  const renderedEl = document.getElementById('rendered');
  const fixtureSelect = document.getElementById('fixtureSelect');
  const newFixtureBtn = document.getElementById('newFixture');
  const exportBtn = document.getElementById('exportBtn');
  const themeToggle = document.getElementById('themeToggle');
  const statusEl = document.getElementById('status');
  const foldSyncEl = document.getElementById('foldSync');
  const lowPowerEl = document.getElementById('lowPower');

  const THEME_KEY = 'aimsHub:theme'; // values: light | dark | system
  
  const md = window.markdownit({ html: false, linkify: false, typographer: true });
  let fixtures = [];
  let editor = null;
  let currentFixture = null;
  let monacoInstance = null;
  let renderTimer = null;
  let pendingRenderScroll = false;
  let pendingEditorScroll = false;
  let lowPower = false;
  let renderScrollTimer = null;
  let editorScrollTimer = null;
let isRendering = false;
  let headingNodes = [];
  const syncLock = { fromEditor: false, fromRender: false };
  let ignoreRenderScroll = false;
  let ignoreEditorScroll = false;
  let totalMdChars = 1;
  let totalTplChars = 1;
  let mapMdToTpl = [];
  let mapTplToMd = [];
  let anchorMd = [];
  let anchorTpl = [];
  
  async function loadFixtures() {
    const res = await fetch(`fixtures.json?_=${Date.now()}`);
    const json = await res.json();
    fixtures = json.fixtures || [];
    populateSelect();
  }

  function populateSelect() {
    fixtureSelect.innerHTML = '';
    fixtures.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.name;
      opt.textContent = f.name;
      fixtureSelect.appendChild(opt);
    });
    if (fixtures.length) {
      const target = getHashFixture() || fixtures[0].name;
      selectFixture(target);
    }
  }

  function selectFixture(name) {
    const fixture = fixtures.find((f) => f.name === name);
    if (!fixture) return;
    currentFixture = fixture;
    fixtureSelect.value = name;
    setEditorValue(fixture.template || '');
    scheduleRender();
    updateHash(name);
  }

  function setEditorValue(text) {
    if (!editor) return;
    const model = editor.getModel();
    if (model.getValue() === text) return;
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 400);
  }

  function render() {
    if (!currentFixture || isRendering) return;
    isRendering = true;
    const template = editor ? editor.getValue() : '';
    let html = '';
    let markdown = '';
    let renderResult = null;
    try {
      renderResult = window.PDL.render(template, currentFixture.data || {}, { variables: currentFixture.variables || {} });
      markdown = renderResult.markdown || '';
      statusEl.textContent = `rendered (${markdown.length} chars)`;

      html = md.render(markdown);
      foldedAnchors = collectHeadingAnchors(markdown);
    } catch (err) {
      console.error(err);
      html = `<pre style="color: var(--color-error-text);">${escapeHtml(err.message || err)}</pre>`;
      statusEl.textContent = 'error';
    } finally {
      isRendering = false;
    }
    renderedEl.innerHTML = html;
    headingNodes = Array.from(renderedEl.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (renderResult) {
      buildHeadingMaps(template, markdown, editor);
    }
    isRendering = false;
  }

  function collectHeadingAnchors(markdown) {
    const lines = markdown.split(/\n/);
    const anchors = [];
    lines.forEach((line, idx) => {
      const m = /^(#+)\s+(.*)/.exec(line);
      if (m) {
        const level = m[1].length;
        const text = m[2].trim();
        const id = slug(text);
        anchors.push({ id, level, line: idx });
      }
    });
    return anchors;
  }

  function enableHeadingFolding(anchors) {
    if (!foldSyncEl.checked) return;
    const headings = renderedEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((h) => {
      const id = slug(h.textContent || '');
      h.id = id;
      h.style.cursor = 'pointer';
      h.addEventListener('click', () => toggleFold(h));
    });
  }

  function toggleFold(headingEl) {
    const next = headingEl.nextElementSibling;
    if (!next) return;
    const collapsed = headingEl.dataset.folded === 'true';
    headingEl.dataset.folded = collapsed ? 'false' : 'true';
    let el = next;
    while (el && !/^H[1-6]$/.test(el.tagName)) {
      el.style.display = collapsed ? '' : 'none';
      el = el.nextElementSibling;
    }
    mirrorFoldInEditor(headingEl.textContent || '', collapsed);
  }

  function mirrorFoldInEditor(text, wasCollapsed) {
    if (!monacoInstance || !editor || !foldSyncEl.checked) return;
    const model = editor.getModel();
    const lines = model.getLinesContent();
    const targetIndex = lines.findIndex((ln) => ln.includes(text));
    if (targetIndex === -1) return;
    const range = new monacoInstance.Range(targetIndex + 1, 1, targetIndex + 1, lines[targetIndex].length + 1);
    const currentState = editor._modelData.viewModel._foldingModel;
    if (!currentState) return;
    const region = currentState.getRegionAtLine(targetIndex + 1);
    if (!region) return;
    const shouldCollapse = !wasCollapsed;
    const toToggle = [region];
    currentState.toggleCollapseState(toToggle, shouldCollapse);
  }

  function slug(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setupMonaco() {
    window.require(['vs/editor/editor.main'], () => {
      monacoInstance = window.monaco;
      defineMonacoThemes(monacoInstance);
      registerPDLLanguage(monacoInstance);
      const model = monacoInstance.editor.createModel('', 'pdl');
      editor = monacoInstance.editor.create(document.getElementById('editor'), {
        model,
        language: 'pdl',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'off',
        folding: true,
        glyphMargin: true,
        lineNumbersMinChars: 3,
        lineDecorationsWidth: 12,
        padding: { top: 8, bottom: 24 },
        scrollbar: { verticalScrollbarSize: 10 },
      });
      applyTheme(monacoInstance);
      editor.getModel().onDidChangeContent(scheduleRender);
      editor.onDidScrollChange(() => {
        if (syncLock.fromRender || pendingEditorScroll) return;
        pendingEditorScroll = true;
        requestAnimationFrame(() => {
          pendingEditorScroll = false;
          if (syncLock.fromRender) return;
          syncLock.fromEditor = true;
          syncRenderToEditor();
          syncLock.fromEditor = false;
        });
      });
      loadFixtures();
    });
  }

  function registerPDLLanguage(monaco) {
    monaco.languages.register({ id: 'pdl' });
    monaco.languages.setMonarchTokensProvider('pdl', {
      tokenizer: {
        root: [
          [/\[value:[^\]]+\]/, 'keyword'],
          [/\[if-elif:[^\]]+\]/, 'keyword'],
          [/\[if-else\]/, 'keyword'],
          [/\[if-end\]/, 'keyword'],
          [/\[if:[^\]]+\]/, 'keyword'],
          [/\[loop-end\]/, 'keyword'],
          [/\[loop:[^\]]+\]/, 'keyword'],
          [/\[set:[^\]]+\]/, 'keyword'],
          [/\[get:[^\]]+\]/, 'keyword'],
          [/\[condense\]/, 'keyword'],
          [/\[condense-end\]/, 'keyword'],
          [/\{[^}]+\}/, 'variable'],
          [/\/\/.*$/, 'comment'],
        ],
      },
    });

    const completions = [
      'value:', 'if:', 'if-elif:', 'if-else]', 'if-end]', 'loop:', 'loop-end]', 'set:', 'get:', 'condense]', 'condense-end]',
    ];

    monaco.languages.registerCompletionItemProvider('pdl', {
      provideCompletionItems: (model, position) => {
        const suggestions = completions.map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: label,
          range: undefined,
        }));
        return { suggestions };
      },
    });

    monaco.languages.registerHoverProvider('pdl', {
      provideHover: function (model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        const info = hoverInfo(word.word);
        if (!info) return null;
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: info }],
        };
      },
    });

    monaco.languages.registerDocumentFormattingEditProvider('pdl', {
      provideDocumentFormattingEdits: (model) => {
        const text = model.getValue();
        const formatted = text.replace(/\t/g, '  ');
        return [
          {
            range: model.getFullModelRange(),
            text: formatted,
          },
        ];
      },
    });
  }

  function hoverInfo(word) {
    const docs = {
      'value': '**[value:]** fetch a value from data by path with filters.',
      'if': '**[if:]** conditional start; close with [if-end].',
      'if-elif': '**[if-elif:]** conditional branch.',
      'if-else': '**[if-else]** conditional else.',
      'if-end': '**[if-end]** close conditional.',
      'loop': '**[loop:]** iterate over list; close with [loop-end].',
      'loop-end': '**[loop-end]** end loop.',
      'set': '**[set:]** assign variable.',
      'get': '**[get:]** retrieve variable.',
      'condense': '**[condense]** start condense block.',
      'condense-end': '**[condense-end]** end condense.',
    };
    return docs[word] || null;
  }

  function wireUi() {
    fixtureSelect.addEventListener('change', (e) => selectFixture(e.target.value));
    newFixtureBtn.addEventListener('click', () => {
      const hello = fixtures.find((f) => f.name.includes('hello-world')) || fixtures[0];
      if (hello) selectFixture(hello.name);
    });
    exportBtn.addEventListener('click', () => {
      const template = editor ? editor.getValue() : '';
      const blob = new Blob([template], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentFixture ? currentFixture.name : 'pdl-template'}.template.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
    themeToggle.addEventListener('click', () => {
      const currentPref = loadThemePreference();
      const nextPref = currentPref === 'dark' ? 'light' : currentPref === 'light' ? 'dark' : 'light';
      saveThemePreference(nextPref);
      applyDocumentTheme(nextPref);
    });
    foldSyncEl.addEventListener('change', render);
    lowPowerEl.addEventListener('change', () => {
      lowPower = lowPowerEl.checked;
      applyLowPower();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        render();
      }
    });
    window.addEventListener('hashchange', () => {
      const target = getHashFixture();
      if (target && target !== (currentFixture && currentFixture.name)) {
        selectFixture(target);
      }
    });
    renderedEl.addEventListener('scroll', () => {
      if (syncLock.fromEditor || ignoreRenderScroll || pendingRenderScroll) return;
      pendingRenderScroll = true;
      requestAnimationFrame(() => {
        pendingRenderScroll = false;
        if (syncLock.fromEditor || ignoreRenderScroll) return;
        syncLock.fromRender = true;
        syncEditorToRender();
        syncLock.fromRender = false;
      });
    }, { passive: true });
  }

  function defineMonacoThemes(monaco) {
    monaco.editor.defineTheme('pdl-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '006569', fontStyle: 'bold' },
        { token: 'variable', foreground: '5e6c84' },
        { token: 'comment', foreground: '888888' },
      ],
      colors: {
        'editor.background': '#f4f5f7',
        'editor.foreground': '#172b4d',
        'editorLineNumber.foreground': '#5e6c84',
        'editorLineNumber.activeForeground': '#172b4d',
        'editor.lineHighlightBackground': '#e9ebf0',
        'editor.selectionBackground': '#cce5e6',
        'editor.inactiveSelectionBackground': '#e1e7ec',
        'editorGutter.background': '#f4f5f7',
        'scrollbarSlider.background': '#00000026',
        'scrollbarSlider.hoverBackground': '#00000040',
        'scrollbarSlider.activeBackground': '#00000059',
      },
    });

    monaco.editor.defineTheme('pdl-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '6eedda', fontStyle: 'bold' },
        { token: 'variable', foreground: 'c1c7d0' },
        { token: 'comment', foreground: '888888' },
      ],
      colors: {
        'editor.background': '#1b1d21',
        'editor.foreground': '#f4f5f7',
        'editorLineNumber.foreground': '#c1c7d0',
        'editorLineNumber.activeForeground': '#f4f5f7',
        'editor.lineHighlightBackground': '#2c2f36',
        'editor.selectionBackground': '#2a4f56',
        'editor.inactiveSelectionBackground': '#23272d',
        'editorGutter.background': '#1b1d21',
        'scrollbarSlider.background': '#ffffff1f',
        'scrollbarSlider.hoverBackground': '#ffffff33',
        'scrollbarSlider.activeBackground': '#ffffff47',
      },
    });
  }

  function applyTheme(monaco) {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'pdl-dark' : 'pdl-light';
    monaco.editor.setTheme(theme);
    applyLowPower();
  }

  function applyLowPower() {
    if (!editor) return;
    if (lowPower) {
      editor.updateOptions({
        hover: { enabled: false },
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        folding: true,
        glyphMargin: true,
        lineNumbersMinChars: 3,
        lineDecorationsWidth: 12,
      });
    } else {
      editor.updateOptions({
        hover: { enabled: true },
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        parameterHints: { enabled: true },
        folding: true,
        glyphMargin: true,
        lineNumbersMinChars: 3,
        lineDecorationsWidth: 12,
      });
    }
  }


  function syncEditorToRender() {
    if (!editor) return;
    const srcCenter = renderedEl.scrollTop + renderedEl.clientHeight / 2;
    const dstCenter = mapPos(srcCenter, anchorMd, anchorTpl, renderedEl.scrollHeight, editor.getContentHeight());
    const viewH = editor.getLayoutInfo().height;
    const contentH = Math.max(1, editor.getContentHeight());
    const maxTop = Math.max(0, contentH - viewH);
    const newTop = clamp(dstCenter - viewH / 2, 0, maxTop);
    ignoreRenderScroll = true;
    editor.setScrollTop(newTop);
    setTimeout(() => (ignoreRenderScroll = false), 50);
  }

  function syncRenderToEditor() {
    if (!renderedEl) return;
    const srcCenter = editor.getScrollTop() + editor.getLayoutInfo().height / 2;
    const dstCenter = mapPos(srcCenter, anchorTpl, anchorMd, editor.getContentHeight(), renderedEl.scrollHeight);
    const viewH = renderedEl.clientHeight;
    const contentH = Math.max(1, renderedEl.scrollHeight);
    const max = Math.max(0, contentH - viewH);
    const newTop = clamp(dstCenter - viewH / 2, 0, max);
    ignoreEditorScroll = true;
    renderedEl.scrollTop = newTop;
    setTimeout(() => (ignoreEditorScroll = false), 50);
  }

  function buildHeadingMaps(templateText, markdownText, editorInstance) {
    const tplHeads = collectHeadingOffsets(templateText, editorInstance);
    const mdHeads = collectRenderedOffsets();
    totalTplChars = Math.max(1, templateText.length);
    totalMdChars = Math.max(1, markdownText.length);

    const count = Math.min(mdHeads.length, tplHeads.length);
    anchorMd = [{ top: 0 }, ...mdHeads.slice(0, count), { top: renderedEl.scrollHeight }];
    anchorTpl = [{ top: 0 }, ...tplHeads.slice(0, count), { top: editorInstance ? editorInstance.getContentHeight() : totalTplChars }];

    mapMdToTpl = anchorMd.map((a, i) => [a.pos || 0, anchorTpl[i]?.pos || 0]);
    mapTplToMd = anchorTpl.map((a, i) => [a.pos || 0, anchorMd[i]?.pos || 0]);
  }

  function collectHeadingOffsets(text, editorInstance) {
    const lines = text.split(/\n/);
    const tops = [];
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^(#+)\s+(.*)/);
      if (m && editorInstance) {
        tops.push({ top: editorInstance.getTopForLineNumber(i + 1), pos: offset });
      }
      offset += line.length + 1;
    }
    return tops;
  }

  function collectRenderedOffsets() {
    return headingNodes.map((h) => ({ top: h.offsetTop, pos: h.textContent.length }));
  }

  function mapPos(src, anchorsSrc, anchorsDst, srcTotalPx, dstTotalPx) {
    if (!anchorsSrc || anchorsSrc.length < 2 || !anchorsDst || anchorsDst.length < 2) {
      const r = src / Math.max(1, srcTotalPx);
      return r * dstTotalPx;
    }
    const srcTops = anchorsSrc.map((a) => a.top);
    const dstTops = anchorsDst.map((a) => a.top);
    if (src <= srcTops[0]) return dstTops[0];
    const last = srcTops.length - 1;
    if (src >= srcTops[last]) return dstTops[last];
    for (let i = 0; i < srcTops.length - 1; i++) {
      const s1 = srcTops[i], s2 = srcTops[i + 1];
      if (src >= s1 && src <= s2) {
        const t = (src - s1) / Math.max(1, s2 - s1);
        const d1 = dstTops[i], d2 = dstTops[i + 1];
        return d1 + t * (d2 - d1);
      }
    }
    const r = src / Math.max(1, srcTotalPx);
    return r * dstTotalPx;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }
  
  function loadThemePreference() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {}
    return 'light';
  }

  function currentSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyDocumentTheme(pref) {
    const theme = pref === 'system' ? currentSystemTheme() : pref;
    document.documentElement.setAttribute('data-theme', theme);
    currentTheme = theme;
    if (monacoInstance) applyTheme(monacoInstance);
  }

  function saveThemePreference(pref) {
    try { localStorage.setItem(THEME_KEY, pref); } catch {}
  }

  // bootstrap
  const pref = loadThemePreference();
  applyDocumentTheme(pref);
  wireUi();
  setupMonaco();
})();

  function updateHash(name) {
    if (!name) return;
    const newHash = `#${encodeURIComponent(name)}`;
    if (location.hash !== newHash) {
      history.replaceState(null, "", newHash);
    }
  }

  function getHashFixture() {
    const h = location.hash.replace(/^#/, "");
    if (!h) return null;
    try {
      return decodeURIComponent(h);
    } catch {
      return h;
    }
  }
