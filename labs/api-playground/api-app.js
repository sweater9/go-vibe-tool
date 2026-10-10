import {
  HTTP_METHODS,
  MOCK_ENDPOINTS,
  PRESET_REQUESTS,
  validateJson,
  formatJson,
  minifyJson,
  formatJsonValidationStatus,
  handleMockRequest
} from './api-mock-engine.js';

class ApiPlaygroundApp {
  constructor() {
    this.STORAGE_KEY = 'it_api_playground_history';
    this.history = this.loadHistory();
    this.currentPresetId = 'req_get_users';

    this.initDOMElements();
    this.bindEvents();
    this.loadPreset('req_get_users');
    this.renderHistory();
  }

  initDOMElements() {
    this.methodSelect = document.getElementById('methodSelect');
    this.urlInput = document.getElementById('urlInput');
    this.headersTextarea = document.getElementById('headersTextarea');
    this.bodyTextarea = document.getElementById('bodyTextarea');
    this.latencySelect = document.getElementById('latencySelect');
    this.statusOverrideSelect = document.getElementById('statusOverrideSelect');

    this.jsonValidationStatus = document.getElementById('jsonValidationStatus');
    this.sendBtn = document.getElementById('btnSendRequest');

    this.responseBadge = document.getElementById('responseStatusBadge');
    this.responseMetrics = document.getElementById('responseMetrics');
    this.responseBodyPre = document.getElementById('responseBodyPre');
    this.responseHeadersPre = document.getElementById('responseHeadersPre');

    this.historyContainer = document.getElementById('historyContainer');
    this.presetsContainer = document.getElementById('presetsContainer');
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history.slice(0, 25)));
    } catch (_) {}
  }

  bindEvents() {
    // Send Request
    this.sendBtn?.addEventListener('click', () => this.sendRequest());

    // Live body JSON validation
    this.bodyTextarea?.addEventListener('input', () => this.checkBodyJson());

    // Format & Minify buttons
    document.getElementById('btnFormatJson')?.addEventListener('click', () => {
      try {
        const val = this.bodyTextarea.value;
        if (!val.trim()) return;
        this.bodyTextarea.value = formatJson(val, 2);
        this.checkBodyJson();
        this.showToast('JSON formatted');
      } catch (e) {
        this.showToast('Format error: ' + e.message, true);
      }
    });

    document.getElementById('btnMinifyJson')?.addEventListener('click', () => {
      try {
        const val = this.bodyTextarea.value;
        if (!val.trim()) return;
        this.bodyTextarea.value = minifyJson(val);
        this.checkBodyJson();
        this.showToast('JSON minified');
      } catch (e) {
        this.showToast('Minify error: ' + e.message, true);
      }
    });

    document.getElementById('btnClearBody')?.addEventListener('click', () => {
      this.bodyTextarea.value = '';
      this.checkBodyJson();
      this.showToast('Body cleared');
    });

    // Copy Response
    document.getElementById('btnCopyResponse')?.addEventListener('click', () => {
      const text = this.responseBodyPre.textContent;
      if (text) {
        navigator.clipboard.writeText(text).then(() => this.showToast('Response copied to clipboard'));
      }
    });

    // Clear History
    document.getElementById('btnClearHistory')?.addEventListener('click', () => {
      if (confirm('Clear all request history?')) {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
        this.showToast('History cleared');
      }
    });

    // Export & Import
    document.getElementById('btnExportRequests')?.addEventListener('click', () => this.exportHistory());
    document.getElementById('btnImportRequests')?.addEventListener('click', () => this.importHistory());

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-tab');
        const parent = e.currentTarget.closest('.tabs-parent');
        if (!parent) return;
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        e.currentTarget.classList.add('active');
        parent.querySelector(`.tab-content[data-tab-content="${target}"]`)?.classList.remove('hidden');
      });
    });

    // Method change updates body availability
    this.methodSelect?.addEventListener('change', () => {
      const m = this.methodSelect.value;
      if (['GET', 'HEAD'].includes(m)) {
        document.getElementById('bodyHint')?.classList.remove('hidden');
      } else {
        document.getElementById('bodyHint')?.classList.add('hidden');
      }
    });

    this.renderPresets();
  }

  renderPresets() {
    if (!this.presetsContainer) return;
    this.presetsContainer.innerHTML = PRESET_REQUESTS.map(req => `
      <button type="button" class="btn alt small preset-btn" data-req-id="${req.id}" style="width:100%; text-align:left; justify-content:flex-start; margin-bottom:6px;">
        <span style="font-weight:800; color:var(--brand); min-width:44px;">${req.method}</span>
        <span>${req.name}</span>
      </button>
    `).join('');

    this.presetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-req-id');
        this.loadPreset(id);
      });
    });
  }

  loadPreset(id) {
    const preset = PRESET_REQUESTS.find(r => r.id === id);
    if (!preset) return;
    this.methodSelect.value = preset.method;
    this.urlInput.value = preset.url;
    this.headersTextarea.value = JSON.stringify(preset.headers || {}, null, 2);
    this.bodyTextarea.value = preset.body || '';
    this.checkBodyJson();
    this.showToast(`Loaded "${preset.name}"`);
  }

  checkBodyJson() {
    const val = this.bodyTextarea.value;
    if (!this.jsonValidationStatus) return true;
    const check = validateJson(val);
    const status = formatJsonValidationStatus(check);

    this.jsonValidationStatus.replaceChildren();
    const span = document.createElement('span');
    span.style.cssText = `color:${status.color}; font-weight:700; font-size:12px;`;
    span.textContent = status.text;
    this.jsonValidationStatus.appendChild(span);

    return check.valid;
  }

  sendRequest() {
    const method = this.methodSelect.value;
    const url = this.urlInput.value.trim() || '/api/v1/health';
    let headers = {};
    try {
      if (this.headersTextarea.value.trim()) {
        headers = JSON.parse(this.headersTextarea.value);
      }
    } catch (_) {
      headers = { 'Content-Type': 'application/json' };
    }

    const body = this.bodyTextarea.value;
    const latency = parseInt(this.latencySelect.value, 10) || 0;
    const statusOverride = this.statusOverrideSelect.value;

    const requestData = {
      id: 'req_' + Date.now(),
      method,
      url,
      headers,
      body,
      statusOverride,
      timestamp: new Date().toLocaleTimeString()
    };

    // UI Loading state
    this.sendBtn.disabled = true;
    this.sendBtn.textContent = 'Sending...';

    const startTime = performance.now();

    setTimeout(() => {
      const response = handleMockRequest(requestData);
      const elapsed = Math.round(performance.now() - startTime);

      this.sendBtn.disabled = false;
      this.sendBtn.textContent = 'Send Request';

      this.displayResponse(response, elapsed);

      // Add to history
      this.history.unshift({
        ...requestData,
        responseStatus: response.status,
        elapsed
      });
      this.saveHistory();
      this.renderHistory();
      this.showToast(`${method} ${url} -> ${response.status} ${response.statusText}`);
    }, latency);
  }

  displayResponse(res, elapsed) {
    // Status Badge
    let badgeClass = 's2xx';
    if (res.status >= 400 && res.status < 500) badgeClass = 's4xx';
    else if (res.status >= 500) badgeClass = 's5xx';

    this.responseBadge.className = `status-badge ${badgeClass}`;
    this.responseBadge.textContent = `${res.status} ${res.statusText}`;

    // Metrics
    const sizeBytes = res.data ? JSON.stringify(res.data).length : 0;
    const sizeText = sizeBytes > 1024 ? `${(sizeBytes / 1024).toFixed(1)} KB` : `${sizeBytes} B`;
    this.responseMetrics.textContent = `${elapsed} ms • ${sizeText}`;

    // Body
    if (res.data !== null && res.data !== undefined) {
      this.responseBodyPre.textContent = typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : String(res.data);
    } else {
      this.responseBodyPre.textContent = '(No Content)';
    }

    // Headers
    this.responseHeadersPre.textContent = JSON.stringify(res.headers, null, 2);
  }

  renderHistory() {
    if (!this.historyContainer) return;
    if (this.history.length === 0) {
      this.historyContainer.innerHTML = '<div style="color:var(--muted); font-size:12px; text-align:center; padding:16px;">No recent requests.</div>';
      return;
    }

    this.historyContainer.innerHTML = this.history.map((h, i) => `
      <div class="history-item" data-idx="${i}" style="padding:8px 10px; border-bottom:1px solid var(--line); cursor:pointer; font-size:12px; display:flex; justify-content:space-between; align-items:center; border-radius:8px; transition:background .15s;">
        <div>
          <strong style="color:var(--brand);">${h.method}</strong>
          <span style="font-family:monospace; margin-left:4px;">${this.escapeHtml(h.url)}</span>
        </div>
        <div style="font-size:11px; color:var(--muted);">
          <span>${h.responseStatus}</span>
        </div>
      </div>
    `).join('');

    this.historyContainer.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        const item = this.history[idx];
        if (item) {
          this.methodSelect.value = item.method;
          this.urlInput.value = item.url;
          this.headersTextarea.value = JSON.stringify(item.headers || {}, null, 2);
          this.bodyTextarea.value = item.body || '';
          this.checkBodyJson();
          this.showToast(`Restored request from history`);
        }
      });
      el.addEventListener('mouseenter', () => { el.style.background = 'var(--soft)'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
    });
  }

  exportHistory() {
    const data = JSON.stringify(this.history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intellitools-api-requests-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Requests exported to JSON');
  }

  importHistory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 500000) {
        alert('File size exceeds maximum allowed 500 KB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (Array.isArray(parsed)) {
            this.history = parsed.slice(0, 25);
            this.saveHistory();
            this.renderHistory();
            this.showToast('Imported requests successfully');
          } else {
            alert('Invalid file format: must be an array of requests.');
          }
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  showToast(msg, isError = false) {
    let toast = document.getElementById('apiToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'apiToast';
      toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:100; padding:12px 20px; border-radius:12px; color:#fff; font-weight:700; font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.2); transition:opacity .3s;';
      document.body.appendChild(toast);
    }
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.apiPlaygroundApp = new ApiPlaygroundApp();
});
