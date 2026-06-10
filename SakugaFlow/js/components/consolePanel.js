(function () {
  var ConsolePanel = {
    init: function(app) {
      this.app = app;
      this.active = false;
      this.bindEvents();
    },

    isActive: function() {
      return this.active;
    },

    bindEvents: function() {
      var self = this;

      var searchInput = document.getElementById('consoleSearch');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          window.setLogFilter('search', this.value);
        });
      }

      var clearBtn = document.getElementById('consoleClearBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          window.clearLog();
        });
      }

      var exportBtn = document.getElementById('consoleExportBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          window.exportLog();
        });
      }
    },

    renderLogContent: function() {
      var container = document.getElementById('consoleEntries');
      if (!container) return;

      var logs = getFilteredAndSortedLogs();

      if (logs.length === 0) {
        container.innerHTML =
          '<div class="console-empty">' +
          '  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '    <rect x="3" y="3" width="18" height="18" rx="2"/>' +
          '    <line x1="8" y1="8" x2="16" y2="8"/>' +
          '    <line x1="8" y1="12" x2="16" y2="12"/>' +
          '    <line x1="8" y1="16" x2="12" y2="16"/>' +
          '  </svg>' +
          '  <p>No log entries yet</p>' +
          '</div>';
        return;
      }

      var html = '';
      logs.forEach(function(entry) {
        var timeStr = entry.time.toISOString().replace('T', ' ').substring(11, 19);
        var levelIcon = '';
        switch (entry.level) {
          case 'error': levelIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'; break;
          case 'warn': levelIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'; break;
          case 'success': levelIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'; break;
          case 'debug': levelIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'; break;
          default: levelIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }

        html +=
          '<div class="console-entry console-' + entry.level + '">' +
          '  <div class="console-entry-header">' +
          '    <span class="console-entry-icon">' + levelIcon + '</span>' +
          '    <span class="console-entry-source">' + window.escapeHtmlLog(entry.source) + '</span>' +
          '    <span class="console-entry-time">' + timeStr + '</span>' +
          '  </div>' +
          '  <div class="console-entry-message">' + window.escapeHtmlLog(entry.message) + '</div>' +
          '</div>';
      });

      container.innerHTML = html;
      var wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
      if (wasAtBottom || container.dataset.firstRender !== "done") {
        container.scrollTop = container.scrollHeight;
        container.dataset.firstRender = "done";
      }
    }
  };

  window.ConsolePanel = ConsolePanel;
})();
