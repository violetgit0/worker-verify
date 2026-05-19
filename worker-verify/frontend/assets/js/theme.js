/* ─── Sage Energy Theme Manager ──────────────────────────────────────────────
   Handles dark/light mode toggle + settings panel.
   Injected into every page via <script> tag.
───────────────────────────────────────────────────────────────────────────── */
(function () {
  const STORAGE_KEY = 'sage-theme';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    _syncSwitch(theme);
    _syncPreviews(theme);
  }

  // Apply saved theme immediately (before render) to prevent flash
  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', function () {
    _injectToggleBtn();
    _injectSettingsPanel();
    applyTheme(getTheme());
  });

  /* ── Floating toggle button ─────────────────────────────────────────────── */
  function _injectToggleBtn() {
    if (document.getElementById('themeToggleBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'themeToggleBtn';
    btn.title = 'Toggle dark / light mode';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.textContent = getTheme() === 'dark' ? '☀️' : '🌙';
    btn.onclick = function () { applyTheme(getTheme() === 'dark' ? 'light' : 'dark'); };
    document.body.appendChild(btn);
  }

  /* ── Settings panel ─────────────────────────────────────────────────────── */
  function _injectSettingsPanel() {
    if (document.getElementById('settingsPanel')) return;

    // Gear trigger
    const gear = document.createElement('button');
    gear.id = 'themePanelTrigger';
    gear.title = 'Theme settings';
    gear.setAttribute('aria-label', 'Open theme settings');
    gear.textContent = '⚙️';
    gear.onclick = _openPanel;
    document.body.appendChild(gear);

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'settingsPanelOverlay';
    overlay.onclick = _closePanel;
    document.body.appendChild(overlay);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.innerHTML = `
      <div class="theme-panel-header">
        <div>
          <div class="theme-panel-title">⚡ Theme Settings</div>
          <div class="theme-panel-sub">Customize your experience</div>
        </div>
        <button class="theme-panel-close" id="themePanelClose" aria-label="Close settings">✕</button>
      </div>
      <div class="theme-panel-body">
        <div style="margin-bottom:20px;">
          <div class="theme-section-label">Appearance</div>
          <div class="theme-toggle-row">
            <div>
              <div class="theme-toggle-label">Dark Mode</div>
              <div class="theme-toggle-desc">Easier on the eyes at night</div>
            </div>
            <button class="theme-switch" id="darkModeSwitch" aria-label="Toggle dark mode" onclick="sageThemeToggle()">
              <div class="theme-switch-thumb"></div>
            </button>
          </div>
        </div>

        <div style="margin-bottom:24px;">
          <div class="theme-section-label">Theme Preview</div>
          <div class="theme-preview-grid">
            <div class="theme-preview-card theme-preview-light" id="previewLight" onclick="sageSetTheme('light')" role="button" tabindex="0" aria-label="Select light theme">
              <div class="theme-preview-inner">
                <div class="theme-preview-mock">
                  <div class="theme-preview-bar1"></div>
                  <div class="theme-preview-bar2"></div>
                </div>
              </div>
              <div class="theme-preview-label">Light</div>
            </div>
            <div class="theme-preview-card theme-preview-dark" id="previewDark" onclick="sageSetTheme('dark')" role="button" tabindex="0" aria-label="Select dark theme">
              <div class="theme-preview-inner">
                <div class="theme-preview-mock">
                  <div class="theme-preview-bar1"></div>
                  <div class="theme-preview-bar2"></div>
                </div>
              </div>
              <div class="theme-preview-label">Dark</div>
            </div>
          </div>
        </div>

        <div class="theme-panel-brand">
          <div class="theme-panel-brand-name">⚡ Sage Energy — WorkerSave</div>
          <div class="theme-panel-brand-sub">Worker Verification System v2.0</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('themePanelClose').onclick = _closePanel;

    // Keyboard support for preview cards
    panel.querySelectorAll('.theme-preview-card').forEach(function (card) {
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });
  }

  function _openPanel() {
    const panel   = document.getElementById('settingsPanel');
    const overlay = document.getElementById('settingsPanelOverlay');
    _syncSwitch(getTheme());
    _syncPreviews(getTheme());
    if (panel)   panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.addEventListener('keydown', _escClose);
  }

  function _closePanel() {
    const panel   = document.getElementById('settingsPanel');
    const overlay = document.getElementById('settingsPanelOverlay');
    if (panel)   panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.removeEventListener('keydown', _escClose);
  }

  function _escClose(e) { if (e.key === 'Escape') _closePanel(); }

  function _syncSwitch(theme) {
    const sw = document.getElementById('darkModeSwitch');
    if (!sw) return;
    if (theme === 'dark') sw.classList.add('on');
    else sw.classList.remove('on');
  }

  function _syncPreviews(theme) {
    const lp = document.getElementById('previewLight');
    const dp = document.getElementById('previewDark');
    if (lp) lp.classList.toggle('selected', theme === 'light');
    if (dp) dp.classList.toggle('selected', theme === 'dark');
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  window.sageThemeToggle = function () {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  };
  window.sageSetTheme = function (theme) {
    applyTheme(theme);
  };
})();
