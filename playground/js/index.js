(function () {
  const renderedEl = document.getElementById('rendered');
  const fixtureSelect = document.getElementById('fixtureSelect');
  const exportBtn = document.getElementById('exportBtn');
  const customResetBtn = document.getElementById('customReset');
  const themeToggle = document.getElementById('themeToggle');
  const statusEl = document.getElementById('status');
  const foldSyncEl = document.getElementById('foldSync');
  const lowPowerEl = document.getElementById('lowPower');
  const showDataBtn = document.getElementById('showData');
  const showVarsBtn = document.getElementById('showVars');
  const dataModal = document.getElementById('dataModal');
  const dataModalSelect = document.getElementById('dataModalSelect');
  const dataModalClose = document.getElementById('dataModalClose');
  const dataModalSave = document.getElementById('dataModalSave');
  const dataModalDownload = document.getElementById('dataModalDownload');
  const dataModalCopy = document.getElementById('dataModalCopy');
  const dataModalStatus = document.getElementById('dataModalStatus');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');
  const exportModal = document.getElementById('exportModal');
  const exportModalBody = document.getElementById('exportModalBody');
  const exportModalStatus = document.getElementById('exportModalStatus');
  const exportModalSave = document.getElementById('exportModalSave');
  const exportModalClose = document.getElementById('exportModalClose');
  const exportSelectAll = document.getElementById('exportSelectAll');
  const exportSelectAllRow = document.getElementById('exportSelectAllRow');

  const COLORS = {
    light: {
      bright: '#0a6f75', // petrol
      mid: '#34c4c4',    // tinted turquoise
      dark: '#08e0e0',   // slightly lighter neon for control chars
    },
    dark: {
      bright: '#04d9d9', // neon turquoise
      mid: '#34c4c4',    // tinted turquoise
      dark: '#0f7f89',   // softened petrol
    },
  };

  const THEME_KEY = 'aimsHub:theme'; // values: light | dark | system
  const LOW_KEY = 'aimsHub:lowPower';
  const CUSTOM_KEY = 'aimsHub:customFixture';
  const CUSTOM_NAME = 'Custom';
  const CUSTOM_LABEL = 'Custom';
  
  const md = window.markdownit({ html: false, linkify: false, typographer: true });
  let fixtures = [];
  let customFixture = { name: CUSTOM_NAME, template: '', data: {}, variables: {} };
  let customStored = false;
  let suppressCustomPersist = false;
  let editor = null;
  let currentFixture = null;
  let monacoInstance = null;
  let renderTimer = null;
  let pendingRenderScroll = false;
  let pendingEditorScroll = false;
  let customSaveTimer = null;
  let lowPower = false;
  let renderScrollTimer = null;
  let editorScrollTimer = null;
  let directiveDecorations = [];
  let modalEditor = null;
  let modalModels = { data: null, variables: null };
  let modalMode = 'data';
  let modalInitial = { data: '', variables: '' };
  let modalDirty = { data: false, variables: false };
  let modalValid = { data: true, variables: true };
  let exportSelections = [];
  let exportTimeout = null;
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

  async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    const hadDefine = typeof window.define === 'function' && window.define.amd;
    const defineBackup = window.define;
    try {
      if (hadDefine) window.define = undefined; // Force UMD to set window.JSZip
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
      });
    } finally {
      if (hadDefine) window.define = defineBackup;
    }
    return window.JSZip;
  }
  
  async function loadFixtures() {
    loadCustomFromStorage();
    const local = await fetchManifest('fixtures-local.json');
    const bundled = await fetchManifest('fixtures.json');
    fixtures = mergeFixtures(local, bundled);
    populateSelect();
  }

  async function fetchManifest(name) {
    try {
      const res = await fetch(`${name}?_=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Avoid console errors; informational only when local is absent.
      console.info?.(`Playground: ${name} unavailable, falling back`, err);
      return null;
    }
  }

  function mergeFixtures(localManifest, bundledManifest) {
    const map = new Map();
    const bundled = bundledManifest && Array.isArray(bundledManifest.fixtures) ? bundledManifest.fixtures : [];
    bundled.forEach((f) => map.set(f.name, { ...f, isLocal: false, localOnly: false }));

    const local = localManifest && Array.isArray(localManifest.fixtures) ? localManifest.fixtures : [];
    local.forEach((f) => {
      if (map.has(f.name)) {
        // Local overrides bundled but is still public; no local badge.
        map.set(f.name, { ...map.get(f.name), ...f, isLocal: false, localOnly: false });
      } else {
        // Exists only locally; mark as local-only.
        map.set(f.name, { ...f, isLocal: true, localOnly: true });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Playground-only default highlight markers to visualize directive outputs
  window.PDL.HL_BEFORE = '`';
  window.PDL.HL_AFTER = '`';

  function loadCustomFromStorage() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      customFixture = {
        name: CUSTOM_NAME,
        template: parsed.template || '',
        data: parsed.data || {},
        variables: parsed.variables || {},
      };
      customStored = true;
    } catch {
      customStored = false;
      customFixture = { name: CUSTOM_NAME, template: '', data: {}, variables: {} };
    }
  }

  function persistCustom() {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify({
        template: customFixture.template || '',
        data: customFixture.data || {},
        variables: customFixture.variables || {},
      }));
      customStored = true;
      updateCustomResetVisibility();
    } catch {}
  }

  function schedulePersistCustom() {
    clearTimeout(customSaveTimer);
    customSaveTimer = setTimeout(() => {
      persistCustom();
      customSaveTimer = null;
    }, 400);
  }

  function populateSelect(skipSelect) {
    fixtureSelect.innerHTML = '';

    // Custom first
    const customOpt = document.createElement('option');
    customOpt.value = CUSTOM_NAME;
    customOpt.textContent = CUSTOM_LABEL;
    fixtureSelect.appendChild(customOpt);

    // Then fixtures
    fixtures.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.name;
      opt.textContent = formatFixtureLabel(f);
      fixtureSelect.appendChild(opt);
    });

    if (!skipSelect) {
      const hashTarget = getHashFixture();
      if (hashTarget) {
        selectFixture(hashTarget);
      } else if (customStored) {
        selectFixture(CUSTOM_NAME);
      } else {
        const hello = fixtures.find((f) => f.name === '00_hello-world');
        if (hello) {
          selectFixture(hello.name);
        } else if (fixtures.length) {
          selectFixture(fixtures[0].name);
        }
      }
    }
  }


  function selectFixture(name) {
    let fixture = null;
    if (name === CUSTOM_NAME) {
      fixture = customFixture;
    } else {
      fixture = fixtures.find((f) => f.name === name);
    }
    if (!fixture) return;
    currentFixture = fixture;
    fixtureSelect.value = fixture.name === CUSTOM_NAME ? CUSTOM_NAME : fixture.name;
    setEditorValue(fixture.template || '');
    scheduleRender();
    updateHash(name);
    updateCustomResetVisibility();
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
      renderResult = window.PDL.render(template, currentFixture.data || {}, {
        variables: currentFixture.variables || {},
        hlBefore: window.PDL.HL_BEFORE,
        hlAfter: window.PDL.HL_AFTER,
      });
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

  function fixtureSlug(name) {
    return (name || '')
      .replace(/^\d+_?/, '')   // drop numeric prefix
      .replace(/_/g, '-')      // underscores to hyphen
      .toLowerCase();
  }

  function hashForFixture(name) {
    return fixtureSlug(name);
  }

  function findFixtureByHash(hash) {
    if (!hash) return null;
    const cleaned = hash.replace(/^#/, '').toLowerCase();
    if (!cleaned) return null;
    if (cleaned === fixtureSlug(CUSTOM_NAME)) return CUSTOM_NAME;
    const match = fixtures.find((f) => fixtureSlug(f.name) === cleaned);
    return match ? match.name : null;
  }

  function formatFixtureLabel(fixture) {
    const name = fixture && fixture.name ? fixture.name : '';
    const base = (name || '')
      .replace(/^\d+_?/, '')          // drop numeric prefix + optional underscore
      .split('.')[0];                  // drop everything after the first dot (extensions)
    const spaced = base.replace(/[-_]+/g, ' ').trim();
    const pretty = spaced.replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
    return fixture && fixture.localOnly ? `${pretty} (local)` : pretty;
  }

  function updateCustomResetVisibility() {
    if (!customResetBtn) return;
    const visible = currentFixture && currentFixture.name === CUSTOM_NAME && customStored;
    customResetBtn.style.display = visible ? 'inline' : 'none';
  }

  function resetCustom() {
    customFixture = { name: CUSTOM_NAME, template: '', data: {}, variables: {} };
    customStored = false;
    try { localStorage.removeItem(CUSTOM_KEY); } catch {}
    suppressCustomPersist = true;
    setEditorValue('');
    if (modalModels.data) modalModels.data.setValue('{}');
    if (modalModels.variables) modalModels.variables.setValue('{}');
    scheduleRender();
    updateCustomResetVisibility();
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
        fontSize: 12.6,
        wordWrap: 'off',
        folding: true,
        glyphMargin: true,
        lineNumbersMinChars: 3,
        lineDecorationsWidth: 12,
        padding: { top: 8, bottom: 24 },
        scrollbar: { verticalScrollbarSize: 10 },
        scrollBeyondLastLine: false,
        scrollBeyondLastColumn: 0,
      });
      applyTheme(monacoInstance);
      editor.getModel().onDidChangeContent(() => {
        scheduleRender();
        scheduleDirectiveDecorations();
        if (currentFixture && currentFixture.name === CUSTOM_NAME) {
          if (suppressCustomPersist) {
            suppressCustomPersist = false;
          } else {
            customFixture.template = editor.getValue();
            schedulePersistCustom();
          }
        }
      });
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
          [/^\s*#+.*$/, 'heading'],
          [/^\s*_.*_\s*$/, 'line.italic'],
          [/^\s*[-*]\s+/, 'list.marker'],
          [/\{/, { token: 'variable.brace', next: 'varcontent' }],
          [/\[(?=\s*(?:value|if-elif|if-else|if-end|if|loop-end|loop|set|get|condense|condense-end))/, { token: 'directive.bracket', next: 'directive' }],
          [/^\s*\/\/[ \t]*[-=]+[ \t]*$/, 'comment.shy'],
          [/^\s*\/\/.*$/, 'comment'],
          [/[ \t]\/\/[ \t]*[-=]+[ \t]*$/, 'comment.shy'],
          [/[ \t]\/\/.*$/, 'comment'],
        ],
        directive: [
          [/\{/, { token: 'variable.brace', next: 'varcontent' }],
          [/\]/, { token: 'directive.bracket', next: '@pop' }],
          [/\[(?=\s*(?:value|if-elif|if-else|if-end|if|loop-end|loop|set|get|condense|condense-end))/, { token: 'directive.bracket', next: 'directive' }], // nested directives
          [/\[/, { token: 'directive.bracket', next: 'selector' }], // selector brackets
          [/\s+/, 'white'],
          [/(<=|>=|!=|\^=|\$=|\*=|=|<|>|&|\|)/, 'directive.op'],
          [/(if|loop|condense)(-)(end)(?=:|\s|\])/, ['directive.keyword', 'directive.op', 'directive.path']],
          [/(if)(-)(else)(?=:|\s|\])/, ['directive.keyword', 'directive.op', 'directive.path']],
          [/(if)(-)(elif)(?=:|\s|\])/, ['directive.keyword', 'directive.op', 'directive.path']],
          [/(value|if-elif|if-else|if-end|if|loop-end|loop|set|get|condense|condense-end)(?=:|\s|\])/, 'directive.keyword'],
          [/::?/, 'directive.op'],
          [/\:/, 'directive.op'],
          [/\./, 'directive.op'],
          [/([A-Za-z_][\w-]*)(=)(?![!<>=^$*])/, ['directive.optionKey', 'directive.op']],
          [/"/, { token: 'directive.op', next: 'dq' }],
          [/'/, { token: 'directive.op', next: 'sq' }],
          [/[A-Za-z_][\w-]*/, 'directive.path'],
          [/\d+/, 'directive.value'],
          [/./, 'directive.value'],
        ],
        selector: [
          [/\{/, { token: 'variable.brace', next: 'varcontent' }],
          [/\]/, { token: 'directive.bracket', next: '@pop' }],
          [/\[/, { token: 'directive.bracket', next: 'selector' }],
          [/(<=|>=|!=|\^=|\$=|\*=|=|<|>|&|\|)/, 'directive.op'],
          [/([A-Za-z_][\w-]*)(=)(?![!<>=^$*])/, ['selector.optionKey', 'directive.op']],
          [/::?/, 'directive.op'],
          [/:/, 'directive.op'],
          [/"/, { token: 'directive.op', next: 'dq' }],
          [/'/, { token: 'directive.op', next: 'sq' }],
          [/\./, 'directive.op'],
          [/[A-Za-z_][\w-]*/, 'directive.path'],
          [/[^{}\[\]&|<>=!^$*]+/, 'directive.value'],
        ],
        varcontent: [
          [/\}/, { token: 'variable.brace', next: '@pop' }],
          [/[^}]+/, 'variable.inner'],
        ],
        dq: [
          [/(<=|>=|!=|\^=|\$=|\*=|=|<|>|&|\|)/, 'directive.op'],
          [/[\[\]\.:]/, 'directive.op'],
          [/\{/, { token: 'variable.brace', next: 'varcontent' }],
          [/\{/, { token: 'variable.brace', next: 'varcontent' }],
          [/[^"\\{\\[]+/, 'directive.value'],
          [/\\./, 'directive.value'],
          [/"/, { token: 'directive.op', next: '@pop' }],
        ],
        sq: [
          [/(<=|>=|!=|\^=|\$=|\*=|=|<|>|&|\|)/, 'directive.op'],
          [/[\[\]\.:]/, 'directive.op'],
          [/\{/, { token: 'variable.brace', next: 'varcontent' }],
          [/\{/, { token: 'variable.brace', next: 'varcontent' }],
          [/[^'\\{\\[]+/, 'directive.value'],
          [/\\./, 'directive.value'],
          [/'/, { token: 'directive.op', next: '@pop' }],
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
    if (fixtureSelect) {
      fixtureSelect.addEventListener('change', (e) => selectFixture(e.target.value));
    }
    if (customResetBtn) {
      customResetBtn.addEventListener('click', resetCustom);
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        openExportModal();
      });
    }
    if (exportModalClose) {
      exportModalClose.addEventListener('click', closeExportModal);
    }
    if (exportModal) {
      const backdrop = exportModal.querySelector('.pg-modal-backdrop');
      if (backdrop) backdrop.addEventListener('click', closeExportModal);
    }
    if (exportModalSave) {
      exportModalSave.addEventListener('click', () => {
        handleExportSave();
      });
    }
    if (exportSelectAll) {
      exportSelectAll.addEventListener('change', () => {
        const checked = exportSelectAll.checked;
        exportSelections = exportSelections.map((i) => ({ ...i, selected: checked }));
        renderExportModal();
      });
    }
    if (dataModal) {
      const dataBackdrop = dataModal.querySelector('.pg-modal-backdrop');
      if (dataBackdrop) dataBackdrop.addEventListener('click', closeDataModal);
    }
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const currentPref = loadThemePreference();
        const nextPref = currentPref === 'dark' ? 'light' : currentPref === 'light' ? 'dark' : 'light';
        saveThemePreference(nextPref);
        applyDocumentTheme(nextPref);
        updateThemeIcon(nextPref === 'system' ? currentSystemTheme() : nextPref);
      });
      // initialize icon on load
      const pref = loadThemePreference();
      updateThemeIcon(pref === 'system' ? currentSystemTheme() : pref);
    }
    if (showDataBtn) showDataBtn.addEventListener('click', () => openDataModal('data'));
    if (showVarsBtn) showVarsBtn.addEventListener('click', () => openDataModal('variables'));
    if (dataModalSelect) dataModalSelect.addEventListener('change', (e) => setModalModel(e.target.value === 'variables' ? 'variables' : 'data'));
    if (dataModalClose) dataModalClose.addEventListener('click', closeDataModal);
    if (dataModalSave) dataModalSave.addEventListener('click', saveModal);
    if (dataModalDownload) dataModalDownload.addEventListener('click', downloadModal);
    if (dataModalCopy) dataModalCopy.addEventListener('click', copyModal);
    if (foldSyncEl) foldSyncEl.addEventListener('change', render);
    if (lowPowerEl) {
      lowPowerEl.checked = lowPower;
      lowPowerEl.addEventListener('change', () => {
        lowPower = lowPowerEl.checked;
        saveLowPower(lowPower);
        applyLowPower();
      });
    }
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
    const brightLight = COLORS.light.bright;
    const midLight = COLORS.light.mid;
    const darkLight = COLORS.light.dark;
    const brightDark = COLORS.dark.bright;
    const midDark = COLORS.dark.mid;
    const darkDark = COLORS.dark.dark;

    monaco.editor.defineTheme('pdl-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'directive.keyword', foreground: brightLight, fontStyle: 'bold' },
        { token: 'directive.bracket', foreground: darkLight },
        { token: 'directive.op', foreground: darkLight },
        { token: 'directive.value', foreground: midLight },
        { token: 'directive.path', foreground: midLight },
        { token: 'directive.optionKey', foreground: brightLight },
        { token: 'selector.optionKey', foreground: midLight },
        { token: 'variable.inner', foreground: brightLight, fontStyle: 'underline' },
        { token: 'variable.brace', foreground: brightLight, fontStyle: '' },
        { token: 'comment', foreground: '888888' },
        { token: 'comment.shy', foreground: '#cccccc' },
        { token: 'heading', fontStyle: 'bold' },
        { token: 'list.marker', foreground: '888888' },
        { token: 'line.italic', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#f4f5f7',
        'editor.foreground': '#172b4d',
        'editorLineNumber.foreground': '#cccccc',
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
        { token: 'directive.keyword', foreground: brightDark, fontStyle: 'bold' },
        { token: 'directive.bracket', foreground: darkDark },
        { token: 'directive.op', foreground: darkDark },
        { token: 'directive.value', foreground: midDark },
        { token: 'directive.path', foreground: midDark },
        { token: 'directive.optionKey', foreground: brightDark },
        { token: 'selector.optionKey', foreground: midDark },
        { token: 'variable.inner', foreground: brightDark, fontStyle: 'underline' },
        { token: 'variable.brace', foreground: brightDark, fontStyle: '' },
        { token: 'comment', foreground: '888888' },
        { token: 'comment.shy', foreground: '#555555' },
        { token: 'heading', fontStyle: 'bold' },
        { token: 'list.marker', foreground: '888888' },
        { token: 'line.italic', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#1b1d21',
        'editor.foreground': '#f4f5f7',
        'editorLineNumber.foreground': '#555555',
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
    if (modalEditor) monaco.editor.setTheme(theme);
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

  function ensureModalEditors() {
    if (!monacoInstance || modalEditor) {
      return;
    }
    const emptyData = monacoInstance.editor.createModel('{}', 'json');
    const emptyVars = monacoInstance.editor.createModel('{}', 'json');
    modalModels = { data: emptyData, variables: emptyVars };
    modalEditor = monacoInstance.editor.create(document.getElementById('dataModalEditor'), {
      model: emptyData,
      language: 'json',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 11.7,
      wordWrap: 'off',
      folding: true,
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 10,
      padding: { top: 8, bottom: 12 },
      scrollbar: { verticalScrollbarSize: 10 },
      scrollBeyondLastLine: false,
      scrollBeyondLastColumn: 0,
    });

    Object.values(modalModels).forEach((model) => {
      model.onDidChangeContent(() => {
        handleModalChange();
      });
    });
  }

  function openDataModal(mode) {
    if (!monacoInstance || !currentFixture) return;
    ensureModalEditors();
    modalMode = mode === 'variables' ? 'variables' : 'data';
    modalInitial = {
      data: JSON.stringify(currentFixture.data || {}, null, 2),
      variables: JSON.stringify(currentFixture.variables || {}, null, 2),
    };
    modalDirty = { data: false, variables: false };
    modalValid = { data: true, variables: true };

    modalModels.data.setValue(modalInitial.data);
    modalModels.variables.setValue(modalInitial.variables);
    setModalModel(modalMode);

    dataModalSelect.value = modalMode;
    dataModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setModalStatus('');
    updateModalButtons();
  }

  function openExportModal() {
    if (!currentFixture) return;
    exportSelections = buildExportList();
    renderExportModal();
    exportModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    updateExportSaveState();
  }

  function closeExportModal() {
    exportModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearTimeout(exportTimeout);
  }

  function buildExportList() {
    const items = [];
    const name = currentFixture.name || 'fixture';
    const prefix = name;
    const template = editor ? editor.getValue() : '';
    const files = [
      { key: 'template', filename: `${prefix}.template.md`, content: template, type: 'text/markdown' },
      { key: 'data', filename: `${prefix}.data.json`, content: JSON.stringify(currentFixture.data || {}, null, 2), type: 'application/json' },
      { key: 'variables', filename: `${prefix}.variables.json`, content: JSON.stringify(currentFixture.variables || {}, null, 2), type: 'application/json' },
      { key: 'expected', filename: `${prefix}.result.md`, content: currentFixture.expected || '', type: 'text/markdown' },
    ];

    const changedKeys = changedSinceBaseline(prefix, files);

    files.forEach((file) => {
      items.push({ ...file, selected: changedKeys.has(file.key) });
    });
    return items;
  }

  function changedSinceBaseline(prefix, files) {
    const key = `pdl:baseline:${prefix}`;
    let baseline = null;
    try { baseline = JSON.parse(localStorage.getItem(key) || 'null'); } catch { baseline = null; }
    const changed = new Set();
    files.forEach((file) => {
      const prev = baseline && baseline[file.key];
      if (!prev) { changed.add(file.key); return; }
      if (prev !== file.content) changed.add(file.key);
    });
    return changed;
  }

  function updateBaseline(prefix, files) {
    const data = {};
    files.forEach((f) => { data[f.key] = f.content; });
    try { localStorage.setItem(`pdl:baseline:${prefix}`, JSON.stringify(data)); } catch {}
  }

  function renderExportModal() {
    exportModalBody.innerHTML = '';
    updateSelectAllState();

    const list = document.createElement('div');
    list.className = 'export-list';
    exportSelections.forEach((item, idx) => {
      const row = document.createElement('label');
      row.className = 'export-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.selected;
      cb.addEventListener('change', () => {
        exportSelections[idx].selected = cb.checked;
        renderExportModal();
      });

      const label = document.createElement('div');
      label.className = 'export-item-label';
      const title = document.createElement('div');
      title.className = 'export-filename';
      title.textContent = item.filename;
      const meta = document.createElement('div');
      meta.className = 'export-meta';
      meta.textContent = exportMetaText(item.key);
      label.appendChild(title);
      label.appendChild(meta);

      row.appendChild(cb);
      row.appendChild(label);
      list.appendChild(row);
    });
    exportModalBody.appendChild(list);
    updateExportSaveState();
  }

  function updateExportSaveState() {
    const anySelected = exportSelections.some((i) => i.selected);
    exportModalSave.disabled = !anySelected;
    exportModalStatus.textContent = anySelected ? '' : 'Select at least one file';
  }

  function exportMetaText(key) {
    switch (key) {
      case 'template': return 'The unrendered PDL template';
      case 'expected': return 'The rendered PDL template';
      case 'data': return 'The JSON data to render';
      case 'variables': return 'The global variables to provide';
      default: return key;
    }
  }

  function updateSelectAllState() {
    if (!exportSelectAll || !exportSelectAllRow) return;
    const all = exportSelections.every((i) => i.selected);
    const some = exportSelections.some((i) => i.selected);
    exportSelectAll.checked = all;
    exportSelectAll.indeterminate = !all && some;
    const labelSpan = exportSelectAllRow.querySelector('span');
    if (labelSpan) {
      labelSpan.textContent = all ? 'Unselect all' : 'Select all';
    }
  }

  async function handleExportSave() {
    const selected = exportSelections.filter((i) => i.selected);
    if (!selected.length) return;
    const prefix = currentFixture ? currentFixture.name : 'fixture';
    clearTimeout(exportTimeout);
    const allSelected = selected.length === exportSelections.length;
    try {
      if (allSelected) {
        await downloadZip(prefix, selected);
        exportModalStatus.textContent = 'Zip download started';
        exportTimeout = setTimeout(closeExportModal, 3000);
      } else {
        selected.forEach(downloadSingle);
        exportModalStatus.textContent = 'Downloads started';
      }
    } catch (err) {
      console.error(err);
      exportModalStatus.textContent = 'Download failed — please retry';
    }
    updateBaseline(prefix, selected);
    clearTimeout(exportTimeout);
  }

  function downloadSingle(item) {
    const blob = new Blob([item.content], { type: item.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadZip(prefix, items) {
    const JSZipLib = await ensureJSZip();
    if (!JSZipLib) throw new Error('JSZip not available');
    const zip = new JSZipLib();
    items.forEach((item) => zip.file(item.filename, item.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}.pdl.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function closeDataModal() {
    dataModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function setModalModel(mode) {
    modalMode = mode;
    modalEditor.setModel(modalModels[mode]);
    setModalStatus('');
    updateModalButtons();
  }

  function currentModalValue() {
    const model = modalModels[modalMode];
    return model ? model.getValue() : '';
  }

  function handleModalChange() {
    const val = currentModalValue();
    const initial = modalInitial[modalMode];
    modalDirty[modalMode] = val !== initial;

    try {
      JSON.parse(val);
      modalValid[modalMode] = true;
      setModalStatus(modalDirty[modalMode] ? 'Unsaved changes' : '');
    } catch (err) {
      modalValid[modalMode] = false;
      setModalStatus('Invalid JSON');
    }
    updateModalButtons();
  }

  function updateModalButtons() {
    const changed = modalDirty[modalMode];
    const valid = modalValid[modalMode];
    const enabled = changed && valid;
    dataModalSave.disabled = !enabled;
    dataModalDownload.disabled = !enabled;
    dataModalCopy.disabled = !enabled;
  }

  function saveModal() {
    if (!modalDirty[modalMode] || !modalValid[modalMode]) return;
    try {
      const parsed = JSON.parse(currentModalValue());
      if (modalMode === 'data') {
        currentFixture.data = parsed;
      } else {
        currentFixture.variables = parsed;
      }
      if (currentFixture && currentFixture.name === CUSTOM_NAME) {
        persistCustom();
      }
      modalInitial[modalMode] = JSON.stringify(parsed, null, 2);
      modalDirty[modalMode] = false;
      setModalStatus('Saved');
      scheduleRender();
      updateModalButtons();
    } catch (err) {
      setModalStatus('Invalid JSON');
    }
  }

  function downloadModal() {
    if (dataModalDownload.disabled) return;
    const text = currentModalValue();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = modalMode === 'data' ? 'data' : 'variables';
    a.download = `${currentFixture ? currentFixture.name : 'fixture'}.${suffix}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyModal() {
    if (dataModalCopy.disabled) return;
    try {
      await navigator.clipboard.writeText(currentModalValue());
      setModalStatus('Copied to clipboard');
    } catch (err) {
      setModalStatus('Copy failed');
    }
  }

  function setModalStatus(text) {
    if (dataModalStatus) dataModalStatus.textContent = text || '';
  }

  function scheduleDirectiveDecorations() {
    clearTimeout(renderScrollTimer);
    renderScrollTimer = setTimeout(applyDirectiveDecorations, 120);
  }

  function applyDirectiveDecorations() {
    if (!editor || !monacoInstance) return;
    const model = editor.getModel();
    if (!model) return;
    const matches = model.findMatches('\\[[^\]\n]+\]', false, true, false, null, true);
    const decorations = matches.map((m) => ({
      range: m.range,
      options: {
        inlineClassName: 'pdl-directive',
      },
    }));
    directiveDecorations = editor.deltaDecorations(directiveDecorations, decorations);
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
  

  function loadLowPower() {
    try {
      const v = localStorage.getItem(LOW_KEY);
      if (v === 'false') return false;
      return true;
    } catch { return true; }
  }

  function saveLowPower(v) {
    try { localStorage.setItem(LOW_KEY, v ? 'true' : 'false'); } catch {}
  }
  function loadThemePreference() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {}
    return 'system';
  }

  function currentSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyDocumentTheme(pref) {
    const theme = pref === 'system' ? currentSystemTheme() : pref;
    document.documentElement.setAttribute('data-theme', theme);
    currentTheme = theme;
    if (monacoInstance) applyTheme(monacoInstance);
    updateThemeIcon(theme);
  }

  function saveThemePreference(pref) {
    try { localStorage.setItem(THEME_KEY, pref); } catch {}
  }

  function updateHash(name) {
    if (!name) return;
    const newHash = `#${encodeURIComponent(hashForFixture(name))}`;
    // Force hash update immediately on selection (even if only casing/format differs).
    location.hash = newHash;
  }

  function updateThemeIcon(theme) {
    if (!themeIconSun || !themeIconMoon) return;
    const isDark = theme === 'dark';
    // In dark mode show sun; in light mode show moon.
    themeIconSun.classList.toggle('is-active', isDark);
    themeIconMoon.classList.toggle('is-active', !isDark);
  }

  function getHashFixture() {
    const raw = location.hash || '';
    const decoded = (() => {
      try { return decodeURIComponent(raw); } catch { return raw; }
    })();
    return findFixtureByHash(decoded);
  }

  function injectDirectiveStyles() {
    if (document.getElementById('pdl-directive-style')) return;
    const style = document.createElement('style');
    style.id = 'pdl-directive-style';
    style.textContent = `
      [data-theme="light"] .pdl-directive { border-left: 2px solid ${COLORS.light.bright}; background: ${COLORS.light.mid}1f; padding-left: 3px; }
      [data-theme="dark"] .pdl-directive  { border-left: 2px solid ${COLORS.dark.bright}; background: ${COLORS.dark.mid}26; padding-left: 3px; }
    `;
    document.head.appendChild(style);
  }

  // bootstrap
  const pref = loadThemePreference();
  applyDocumentTheme(pref);
  lowPower = loadLowPower();
  if (lowPowerEl) lowPowerEl.checked = lowPower;
  wireUi();
  setupMonaco();
  injectDirectiveStyles();
})();
