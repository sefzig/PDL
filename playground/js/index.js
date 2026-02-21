(function () {
  const renderedEl = document.getElementById('rendered');
  const fixtureSelect = document.getElementById('fixtureSelect');
  const newFixtureBtn = document.getElementById('newFixture');
  const exportBtn = document.getElementById('exportBtn');
  const themeToggle = document.getElementById('themeToggle');
  const statusEl = document.getElementById('status');
  const autoRenderEl = document.getElementById('autoRender');
  const foldSyncEl = document.getElementById('foldSync');
  const renderNowBtn = document.getElementById('renderNow');

  const md = window.markdownit({ html: false, linkify: false, typographer: true });
  let fixtures = [];
  let editor = null;
  let currentFixture = null;
  let monacoInstance = null;
  let renderTimer = null;
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
      selectFixture(fixtures[0].name);
    }
  }

  function selectFixture(name) {
    const fixture = fixtures.find((f) => f.name === name);
    if (!fixture) return;
    console.log('[fixture]', name, 'template len', (fixture.template || '').length, 'data keys', Object.keys(fixture.data || {}).length);
    currentFixture = fixture;
    fixtureSelect.value = name;
    setEditorValue(fixture.template || '');
    scheduleRender();
  }

  function setEditorValue(text) {
    if (!editor) return;
    const model = editor.getModel();
    if (model.getValue() === text) return;
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null);
  }

  function scheduleRender() {
    if (!autoRenderEl.checked) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 200);
  }

  function render() {
    if (!currentFixture) return;
    const template = editor ? editor.getValue() : '';
    let html = '';
    let foldedAnchors = [];
    let markdown = '';
    let renderResult = null;
    try {
      renderResult = window.PDL.render(template, currentFixture.data || {}, { variables: currentFixture.variables || {} });
      markdown = renderResult.markdown || '';
      statusEl.textContent = `rendered (${markdown.length} chars)`;

      // Debug markers: show the first/last 200 chars in console to detect truncation
      console.log('[render] first 200:', markdown.slice(0, 200));
      console.log('[render] last 200:', markdown.slice(-200));

      html = md.render(markdown);
      foldedAnchors = collectHeadingAnchors(markdown);
    } catch (err) {
      console.error(err);
      html = `<pre style="color: var(--color-error-text);">${escapeHtml(err.message || err)}</pre>`;
      statusEl.textContent = 'error';
    }
    renderedEl.innerHTML = html;
    headingNodes = Array.from(renderedEl.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (renderResult) {
      buildHeadingMaps(template, markdown, editor);
    }
    enableHeadingFolding(foldedAnchors);
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
        scrollbar: { verticalScrollbarSize: 10 },
      });
      editor.getModel().onDidChangeContent(scheduleRender);
      editor.onDidScrollChange(() => {
        if (syncLock.fromRender) return;
        syncLock.fromEditor = true;
        syncRenderToEditor();
        syncLock.fromEditor = false;
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

    monaco.languages.registerDocumentSemanticTokensProvider('pdl', {
      getLegend: () => ({ tokenTypes: ['keyword', 'variable'], tokenModifiers: [] }),
      provideDocumentSemanticTokens: (model) => {
        const lines = model.getLinesContent();
        const data = [];
        lines.forEach((line, i) => {
          const regex = /\[([a-z-]+):/g;
          let m;
          while ((m = regex.exec(line))) {
            const start = m.index + 1;
            const len = m[1].length;
            data.push(i, start, len, 0, 0);
          }
        });
        return { data: new Uint32Array(data) };
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
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
    });
    autoRenderEl.addEventListener('change', () => autoRenderEl.checked && render());
    foldSyncEl.addEventListener('change', render);
    renderNowBtn.addEventListener('click', render);
    renderedEl.addEventListener('scroll', () => {
      if (syncLock.fromEditor || ignoreRenderScroll) return;
      syncLock.fromRender = true;
      syncEditorToRender();
      syncLock.fromRender = false;
    });
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
  // bootstrap
  wireUi();
  setupMonaco();
})();
