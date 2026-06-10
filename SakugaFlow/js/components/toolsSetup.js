(function () {
  var _step = 'welcome';
  var _toolsFolder = '';
  var _pythonFolder = '';
  var _pythonCmd = '';
  var _pythonOk = false;
  var _pythonChecked = false;
  var _pipPackages = {};
  var _pipChecked = false;
  var _installRunning = false;
  var _installProc = null;
  var _installLines = [];
  var _installLogMax = 200;

  var _requiredPipPackages = ['opencv-python', 'numpy', 'Pillow'];

  var _toolInfo = {
    python: { name: 'Python 3', group: 'python', url: 'https://www.python.org/downloads/', desc: 'Required for auto-install and optional upscale scripts.' },
    ffmpeg: { name: 'FFmpeg', group: 'exe', candidates: ['ffmpeg.exe', 'ffmpeg\\ffmpeg.exe', 'ffmpeg\\bin\\ffmpeg.exe'], url: 'https://ffmpeg.org/download.html', desc: 'Video/audio processing, frame extraction, encoding.' },
    ffprobe: { name: 'FFprobe', group: 'exe', candidates: ['ffprobe.exe', 'ffmpeg\\ffprobe.exe', 'ffmpeg\\bin\\ffprobe.exe'], url: 'https://ffmpeg.org/download.html', desc: 'Video metadata reader. Comes with FFmpeg.' },
    realesrgan: { name: 'Real-ESRGAN', group: 'exe', candidates: ['realesrgan-ncnn-vulkan.exe'], url: 'https://github.com/xinntao/Real-ESRGAN/releases', desc: 'AI upscaling engine (anime video model).' }
  };

  function _resolveDefaultFolder() {
    var appdata = "";
    try { appdata = process.env.APPDATA || ""; } catch (e) {}
    if (!appdata && window.FileSystem && window.FileSystem.os && window.FileSystem.path) {
      appdata = window.FileSystem.path.join(window.FileSystem.os.homedir(), "AppData", "Roaming");
    }
    var base = appdata ? window.FileSystem.path.join(appdata, "com.moongetsu.extensions", "SakugaFlow") : "";
    return {
      backend: base ? window.FileSystem.path.join(base, "backend") : "C:\\SakugaflowTools",
      python: base || ""
    };
  }

  function showToolsSetup() {
    var gate = document.getElementById('tools-setup-gate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'tools-setup-gate';
      gate.className = 'setup-gate';
      document.body.appendChild(gate);
    }

    gate.style.display = 'flex';
    _step = 'welcome';
    _pythonChecked = false;
    _pipChecked = false;
    _installRunning = false;
    _installLines = [];
    var defaults = _resolveDefaultFolder();
    _toolsFolder = (window.App && window.App.sakugaflowToolsFolder) || defaults.backend;
    _pythonFolder = (window.App && window.App.sakugaflowPythonEnvFolder) || defaults.python;
    renderSetupStep();
  }

  function hideToolsSetup() {
    var gate = document.getElementById('tools-setup-gate');
    if (gate) gate.style.display = 'none';
  }

  function renderSetupStep() {
    var gate = document.getElementById('tools-setup-gate');
    if (!gate) return;

    var steps = ['welcome', 'check', 'autoinstall', 'complete'];
    var stepIdx = steps.indexOf(_step);
    var total = 3;
    var pct = (stepIdx / total) * 100;

    var html = renderStepIndicator(pct);

    switch (_step) {
      case 'welcome': html += renderWelcomeStep(); break;
      case 'check': html += renderCheckStep(); break;
      case 'autoinstall': html += renderAutoInstallStep(); break;
      case 'complete': html += renderCompleteStep(); break;
    }

    gate.innerHTML = html;

    if (_step === 'autoinstall' && !_installRunning) {
      setTimeout(function () { startAutoInstall(); }, 300);
    }
  }

  function renderStepIndicator(progress) {
    var stepClasses = ['', '', ''];
    var idx = ['welcome', 'check', 'autoinstall', 'complete'].indexOf(_step);
    for (var i = 0; i < 3; i++) {
      if (i < idx) stepClasses[i] = 'done';
      else if (i === idx) stepClasses[i] = 'active';
    }

    var stepsHtml = '';
    for (var i = 0; i < 3; i++) {
      stepsHtml += '<div class="setup-step ' + stepClasses[i] + '">' +
        (stepClasses[i] === 'done'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
          : (i + 1)) +
        '</div>';
    }

    return '<div class="setup-container">' +
      '<div class="setup-step-bar">' +
        '<div class="setup-step-progress" style="width:' + progress + '%"></div>' +
        '<div class="setup-steps">' + stepsHtml + '</div>' +
      '</div>' +
      '<div class="setup-step-labels">' +
        '<span>Welcome</span><span>Check</span><span>Install</span>' +
      '</div>';
  }

  function renderWelcomeStep() {
    return '<div class="setup-card welcome">' +
      '<div class="setup-icon pulse">' +
        '<img src="SakugaFlow-Logo-Only.png" alt="SakugaFlow Logo" style="width:60px;height:60px;border-radius:50%;" />' +
      '</div>' +
      '<h1>Upscale Tools Setup</h1>' +
      '<p class="setup-desc">The AI upscaling feature needs a few tools. This wizard detects what\'s installed and can auto-install everything via Python.</p>' +
      '<div class="setup-info-box">' +
        '<p><strong>What you need:</strong></p>' +
        '<ul>' +
          '<li><strong>Python 3</strong> — runs the auto-installer and upscale scripts</li>' +
          '<li><strong>FFmpeg</strong> — frame extraction &amp; video encoding</li>' +
          '<li><strong>Real-ESRGAN</strong> — AI-powered anime upscaling</li>' +
        '</ul>' +
        '<p style="margin-top:6px;">Backend: <code>' + _toolsFolder + '</code></p>' +
        '<p>Python env: <code>' + _pythonFolder + '</code></p>' +
      '</div>' +
      '<div class="setup-nav">' +
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<button class="btn btn-ghost" onclick="skipToolsSetup()">Skip for now</button>' +
          '<button class="btn btn-ghost" onclick="disableUpscaleFeature()" style="font-size:11px;opacity:0.7;">I won\'t use AI upscaling</button>' +
        '</div>' +
        '<button class="btn btn-primary btn-lg" onclick="goToSetupStep(\'check\')">' +
          'Check Tools' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</button>' +
      '</div>' +
    '</div></div>';
  }

  function renderCheckStep() {
    var results = scanFileTools();

    var rows = '';
    rows += renderToolRow(results.python, 'python');
    rows += renderToolRow(results.ffmpeg, 'ffmpeg');
    rows += renderToolRow(results.ffprobe, 'ffprobe');
    rows += renderToolRow(results.realesrgan, 'realesrgan');

    var allCoreFound = results.ffmpeg.found && results.ffprobe.found && results.realesrgan.found;
    var pythonFoundNow = _pythonOk; 

    var actions = '<div class="setup-nav">' +
      '<button class="btn btn-ghost" onclick="goToSetupStep(\'welcome\')">Back</button>' +
      '<div style="display:flex;gap:8px;">' +
        '<button class="btn btn-secondary" onclick="scanToolsAndRefresh()">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
          ' Scan Again' +
        '</button>';

    if (allCoreFound) {
      actions += '<button class="btn btn-primary" onclick="finishToolsSetup()">Finish Setup</button>';
    } else if (results.python.found) {
      actions += '<button class="btn btn-primary btn-lg" onclick="goToSetupStep(\'autoinstall\')">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' +
        ' Auto-Install All' +
      '</button>';
    } else {
      actions += '<a href="https://www.python.org/downloads/" target="_blank" class="btn btn-primary btn-lg">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
        ' Download Python' +
      '</a>';
    }

    actions += '</div></div>';

    var html = '<div class="setup-card">' +
      '<h2>Tool Detection</h2>' +
      '<p class="setup-desc">Scanning <code>' + _toolsFolder + '</code> and system PATH.</p>' +
      '<div class="ts-tool-list" id="ts-tool-list">' + rows + '</div>' +
      '<div id="ts-pip-info" class="ts-pip-info"></div>' +
      actions +
    '</div></div>';

    if (!_pythonChecked) {
      setTimeout(function () { checkPythonAsync(); }, 100);
    }

    return html;
  }

  function renderToolRow(status, key) {
    var tool = _toolInfo[key];
    var icon, statusClass, statusText;

    if (status.found) {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
      statusClass = 'found';
      statusText = status.path ? 'Found — ' + status.path : 'Found on PATH';
    } else if (status.checking) {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>';
      statusClass = 'checking';
      statusText = 'Checking...';
    } else {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      statusClass = 'missing';
      statusText = 'Not found';
    }

    return '<div class="ts-tool-row ' + statusClass + '" id="ts-row-' + key + '">' +
      '<div class="ts-tool-icon">' + icon + '</div>' +
      '<div class="ts-tool-info">' +
        '<div class="ts-tool-name">' + tool.name + '</div>' +
        '<div class="ts-tool-desc">' + tool.desc + '</div>' +
        '<div class="ts-tool-status" id="ts-status-' + key + '">' + statusText + '</div>' +
      '</div>' +
    '</div>';
  }

  function updateToolRow(key, found, path) {
    var row = document.getElementById('ts-row-' + key);
    var status = document.getElementById('ts-status-' + key);
    if (!row || !status) return;
    var icon = found
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    var iconEl = row.querySelector('.ts-tool-icon');
    if (iconEl) iconEl.innerHTML = icon;
    row.className = 'ts-tool-row ' + (found ? 'found' : 'missing');
    status.textContent = found ? (path ? 'Found — ' + path : 'Found on PATH') : 'Not found';

    if (key === 'python' && found) {
      _pythonOk = true;
      _pythonChecked = true;
    }
  }

  function scanFileTools() {
    var results = {};
    results.python = { found: _pythonOk, path: _pythonCmd, checking: !_pythonChecked };

    for (var key in _toolInfo) {
      if (_toolInfo[key].group !== 'exe') continue;
      var tool = _toolInfo[key];
      var found = false;
      var toolPath = '';
      if (window.FileSystem && window.FileSystem.fs) {
        for (var i = 0; i < tool.candidates.length; i++) {
          var candidate = window.FileSystem.path.join(_toolsFolder, tool.candidates[i]);
          try {
            if (window.FileSystem.fs.existsSync(candidate)) { toolPath = candidate; found = true; break; }
          } catch (e) {}
        }

        if (key === 'realesrgan' && found) {
          var modelNames = ["realesr-animevideov3-x2.param", "realesr-animevideov3-x4.param", "realesr-animevideov3.param"];
          var modelFound = false;
          for (var mi = 0; mi < modelNames.length; mi++) {
            var modelPath = window.FileSystem.path.join(_toolsFolder, "models", modelNames[mi]);
            try {
              if (window.FileSystem.fs.existsSync(modelPath)) { modelFound = true; break; }
            } catch (e) {}
          }
          if (!modelFound) {
            for (var mj = 0; mj < modelNames.length; mj++) {
              try {
                if (window.FileSystem.fs.existsSync(window.FileSystem.path.join(_toolsFolder, modelNames[mj]))) { modelFound = true; break; }
              } catch (e) {}
            }
          }
        }
      }
      results[key] = { found: found, path: toolPath };
    }
    return results;
  }

  function checkPythonAsync() {
    var commands = ['python', 'python3'];
    function tryCmd(idx) {
      if (idx >= commands.length) {
        _pythonOk = false; _pythonCmd = ''; _pythonChecked = true;
        renderSetupStep();
        return;
      }
      try {
        var proc = window.FileSystem.childProcess.spawn(commands[idx], ['--version']);
        var output = '';
        proc.stdout.on('data', function (d) { output += d.toString(); });
        proc.stderr.on('data', function (d) { output += d.toString(); });
        proc.on('close', function (code) {
          if (code === 0) {
            _pythonOk = true; _pythonCmd = commands[idx]; _pythonChecked = true;
            checkPipPackagesAsync(commands[idx]);
            renderSetupStep();
          } else { tryCmd(idx + 1); }
        });
        proc.on('error', function () { tryCmd(idx + 1); });
      } catch (e) { tryCmd(idx + 1); }
    }
    tryCmd(0);
  }

  function checkPipPackagesAsync(pythonCmd) {
    _pipPackages = {};
    try {
      var proc = window.FileSystem.childProcess.spawn(pythonCmd, ['-m', 'pip', 'list', '--format=freeze']);
      var output = '';
      proc.stdout.on('data', function (d) { output += d.toString(); });
      proc.on('close', function () {
        var lines = output.split('\n');
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;
          var eq = line.indexOf('==');
          if (eq > 0) _pipPackages[line.substring(0, eq).toLowerCase()] = line.substring(eq + 2);
        }
        _pipChecked = true;
        renderPipStatus();
      });
      proc.on('error', function () { _pipChecked = true; renderPipStatus(); });
    } catch (e) { _pipChecked = true; renderPipStatus(); }
  }

  function renderPipStatus() {
    if (!_pythonOk) return;
    var pipInfo = document.getElementById('ts-pip-info');
    if (!pipInfo) return;
    var missing = [];
    for (var i = 0; i < _requiredPipPackages.length; i++) {
      if (!_pipPackages[_requiredPipPackages[i].toLowerCase()]) missing.push(_requiredPipPackages[i]);
    }
    if (missing.length === 0 && Object.keys(_pipPackages).length > 0) {
      pipInfo.innerHTML = '<div class="ts-pip-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> All pip packages installed (' + _requiredPipPackages.length + ').</div>';
    } else if (missing.length > 0) {
      pipInfo.innerHTML = '<div class="ts-pip-missing"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Missing: <code>' + missing.join(', ') + '</code></div>';
    }
  }

  

  function renderAutoInstallStep() {
    return '<div class="setup-card" style="max-width:480px;">' +
      '<h2>Auto-Installing Tools</h2>' +
      '<p class="setup-desc">Python is downloading and setting up FFmpeg and Real-ESRGAN. This may take a few minutes.</p>' +
      '<div class="ts-install-progress-wrap">' +
        '<div class="ts-install-progress-bar"><div id="ts-install-progress-fill" class="ts-install-progress-fill" style="width:0%"></div></div>' +
        '<div id="ts-install-progress-label" class="ts-install-progress-label">Starting...</div>' +
      '</div>' +
      '<div id="ts-install-log" class="ts-install-log"><div class="ts-install-log-line dim">Waiting for Python...</div></div>' +
      '<div class="setup-nav">' +
        '<button class="btn btn-ghost" onclick="cancelAutoInstall()" id="ts-install-cancel-btn">Cancel</button>' +
        '<button class="btn btn-primary" onclick="goToSetupStep(\'check\')" id="ts-install-done-btn" style="display:none;">Back to Check</button>' +
      '</div>' +
    '</div></div>';
  }

  function addInstallLog(msg, cls) {
    if (cls === 'progress' && _installLines.length > 0 && _installLines[_installLines.length - 1].cls === 'progress') {
      _installLines[_installLines.length - 1].text = msg;
    } else {
      _installLines.push({ text: msg, cls: cls || '' });
      if (_installLines.length > _installLogMax) _installLines.shift();
    }
    var logEl = document.getElementById('ts-install-log');
    if (!logEl) return;
    logEl.innerHTML = _installLines.slice(-40).map(function (l) {
      return '<div class="ts-install-log-line ' + l.cls + '">' + escapeHtml(l.text) + '</div>';
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  function updateInstallProgress(pct, label) {
    var fill = document.getElementById('ts-install-progress-fill');
    var lbl = document.getElementById('ts-install-progress-label');
    if (fill) fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (lbl && label) lbl.textContent = label;
  }

  function startAutoInstall() {
    if (_installRunning) return;
    _installRunning = true;
    _installLines = [];

    var cancelBtn = document.getElementById('ts-install-cancel-btn');
    var doneBtn = document.getElementById('ts-install-done-btn');
    if (cancelBtn) cancelBtn.style.display = '';
    if (doneBtn) doneBtn.style.display = 'none';

    addInstallLog('Starting installer...', '');
    updateInstallProgress(0, 'Preparing...');

    var setupPy = getSetupPyContent();

    try {
      window.FileSystem.createFolder(_toolsFolder);
      var scriptPath = window.FileSystem.path.join(_toolsFolder, 'setup.py');
      window.FileSystem.fs.writeFileSync(scriptPath, setupPy, 'utf8');
      addInstallLog('Installer script written to ' + _toolsFolder, 'dim');
    } catch (e) {
      addInstallLog('Error writing setup script: ' + e.message, 'error');
      finishAutoInstall(false);
      return;
    }

    var pythonCmd = _pythonCmd || 'python';
    addInstallLog('Running: ' + pythonCmd + ' setup.py', 'dim');
    updateInstallProgress(2, 'Launching Python...');

    try {
      _installProc = window.FileSystem.childProcess.spawn(pythonCmd, ['setup.py'], {
        cwd: _toolsFolder,
        windowsHide: true
      });
      var proc = _installProc;

      var buf = '';
      proc.stdout.on('data', function (d) {
        buf += d.toString();
        var lines = buf.split('\n');
        buf = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          handleSetupLine(lines[i]);
        }
      });

      proc.stderr.on('data', function (d) {
        var text = d.toString().trim();
        if (text) addInstallLog('[stderr] ' + text, 'dim');
      });

      proc.on('close', function (code) {
        if (buf.trim()) {
          var remaining = buf.split('\n');
          for (var i = 0; i < remaining.length; i++) {
            if (remaining[i].trim()) handleSetupLine(remaining[i]);
          }
        }
        addInstallLog('Process exited with code ' + code, code === 0 ? 'success' : 'error');
        finishAutoInstall(code === 0);
      });

      proc.on('error', function (e) {
        addInstallLog('Failed to spawn Python: ' + e.message, 'error');
        finishAutoInstall(false);
      });

    } catch (e) {
      addInstallLog('Error: ' + e.message, 'error');
      finishAutoInstall(false);
    }
  }

  function handleSetupLine(line) {
    line = line.trim();
    if (!line) return;

    try {
      var data = JSON.parse(line);
      
      
      var level = 'info';
      if (data.type === 'error' || data.type === 'fatal') level = 'error';
      else if (data.type === 'warn') level = 'warn';
      else if (data.type === 'progress' || data.type === 'pip') level = 'debug';
      else if (data.type === 'success') level = 'success';
      dbg(level, 'ToolsSetup', data.msg || line);

      switch (data.type) {
        case 'info':
        case 'pip':
          addInstallLog(data.msg, 'dim');
          break;
        case 'progress':
          addInstallLog(data.msg, 'progress');
          if (typeof data.pct === 'number') {
            var stepOffset = ((data.step || 0) - 1) * 33;
            updateInstallProgress(stepOffset + data.pct * 0.33, data.msg);
          }
          break;
        case 'section':
          addInstallLog('--- ' + data.msg + ' ---', 'section');
          if (data.step && data.total) {
            updateInstallProgress(((data.step - 1) / data.total) * 100, data.msg);
          }
          break;
        case 'done':
          addInstallLog('OK  ' + data.msg, 'success');
          break;
        case 'success':
          addInstallLog(data.msg, 'success');
          updateInstallProgress(100, data.msg);
          break;
        case 'error':
        case 'fatal':
          addInstallLog('ERR ' + data.msg, 'error');
          break;
        case 'warn':
          addInstallLog('WRN ' + data.msg, 'warn');
          break;
        case 'summary':
          addInstallLog('', '');
          addInstallLog('Installation complete.', 'success');
          break;
        default:
          addInstallLog(data.msg || line, 'dim');
      }
    } catch (e) {
      addInstallLog(line, 'dim');
      dbg('info', 'ToolsSetup', line);
    }
  }

  function finishAutoInstall(success) {
    _installProc = null;
    _installRunning = false;
    updateInstallProgress(success ? 100 : 0, success ? 'Done' : 'Failed');

    var cancelBtn = document.getElementById('ts-install-cancel-btn');
    var doneBtn = document.getElementById('ts-install-done-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (doneBtn) {
      doneBtn.style.display = '';
      if (success) {
        doneBtn.textContent = 'Next';
        doneBtn.onclick = function () {
          window.StorageManager.setItem('sakugaflow_tools_setup_complete', '1');
          goToSetupStep('complete');
        };
      } else {
        doneBtn.textContent = 'Back to Check';
        doneBtn.onclick = function () {
          goToSetupStep('check');
        };
      }
    }

    if (window.App && window.App.upscalePanel) {
      window.App.upscalePanel.updateUpscaleToolsPanel();
    }
  }

  function cancelAutoInstall() {
    addInstallLog('Installation cancelled by user.', 'warn');
    if (_installProc) {
      try {
        _installProc.kill();
      } catch (e) {
        addInstallLog('Could not kill installer process: ' + e.message, 'error');
      }
      _installProc = null;
    }
    _installRunning = false;
    updateInstallProgress(0, 'Cancelled');
    var cancelBtn = document.getElementById('ts-install-cancel-btn');
    var doneBtn = document.getElementById('ts-install-done-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (doneBtn) doneBtn.style.display = '';
  }

  function renderCompleteStep() {
    return '<div class="setup-card complete">' +
      '<div class="setup-icon success pulse">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</div>' +
      '<h2>Setup Complete</h2>' +
      '<p class="setup-desc">All upscale tools are installed and ready. You can now upscale clips with AI.</p>' +
      '<button class="btn btn-primary btn-lg" style="width:100%;" onclick="finishToolsSetup()">Start Using SakugaFlow</button>' +
    '</div></div>';
  }

  function scanTools() {
    var results = scanFileTools();
    if (_pythonOk) { results.python = { found: true, path: _pythonCmd }; }
    else if (_pythonChecked) { results.python = { found: false, path: '' }; }
    return results;
  }

  function goToSetupStep(step) {
    if (step === 'check') {
      _pythonChecked = false;
      _pipChecked = false;
    }
    _step = step;
    renderSetupStep();
  }

  function scanToolsAndRefresh() {
    var gate = document.getElementById('tools-setup-gate');
    if (!gate || !gate.style || gate.style.display === 'none') return;
    if (window.App && window.App.upscalePanel) {
      window.App.upscalePanel.updateUpscaleToolsPanel();
    }
    renderSetupStep();
  }

  function skipToolsSetup() {
    window.StorageManager.setItem('sakugaflow_tools_setup_skipped', '1');
    hideToolsSetup();
  }

  function disableUpscaleFeature() {
    window.StorageManager.setItem('sakugaflow_tools_setup_complete', '1');
    window.StorageManager.setItem('sakugaflow_tools_setup_skipped', '0');
    window.StorageManager.setItem('sakugaflow_upscale_disabled', '1');
    hideToolsSetup();
    var upscaleBtn = document.getElementById('upscaleTabBtn');
    if (upscaleBtn) upscaleBtn.style.display = 'none';
  }

  function finishToolsSetup() {
    window.StorageManager.setItem('sakugaflow_tools_setup_complete', '1');
    window.StorageManager.setItem('sakugaflow_tools_setup_skipped', '0');
    hideToolsSetup();
    if (window.App && window.App.upscalePanel) {
      window.App.upscalePanel.updateUpscaleToolsPanel();
    }
  }

  function openToolsFolder() {
    try {
      if (!window.FileSystem.fs.existsSync(_toolsFolder)) {
        window.FileSystem.fs.mkdirSync(_toolsFolder, { recursive: true });
      }
      window.FileSystem.childProcess.exec('explorer "' + _toolsFolder + '"');
    } catch (e) {
      try { window.FileSystem.childProcess.exec('start "" "' + _toolsFolder + '"'); } catch (e2) {}
    }
  }

  function checkAndShowIfNeeded() {
    var skipped = window.StorageManager.getItem('sakugaflow_tools_setup_skipped', '0');
    var complete = window.StorageManager.getItem('sakugaflow_tools_setup_complete', '0');
    if (skipped === '1' || complete === '1') {
      var results = scanFileTools();
      if (results.ffmpeg.found && results.ffprobe.found && results.realesrgan.found) {
        return false;
      }
      showToolsSetup();
      return true;
    }
    showToolsSetup();
    return true;
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  
  function getSetupPyContent() {
    return [
'try:',
'  import os, sys, json, shutil, tempfile, zipfile, io, subprocess, urllib.request',
'except ImportError:',
'  import os, sys, json, shutil, tempfile, zipfile, io; import urllib2 as urllib_mock; urllib = type(sys)(\"urllib\"); urllib.request = urllib_mock; subprocess = __import__(\"subprocess\")',
'SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))',
'FFMPEG_URL = \"https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip\"',
'ESRGAN_URL = \"https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip\"',
'PIP_PACKAGES = [\"opencv-python\", \"numpy\", \"Pillow\"]',
'',
'def log(msg_type, msg, **kw):',
'    out = {\"type\": msg_type, \"msg\": str(msg)}; out.update(kw); print(json.dumps(out), flush=True)',
'',
'def download_file(url, dest_path, label):',
'    log(\"info\", \"Downloading \" + label + \"...\", pct=0)',
'    try:',
'        req = urllib.request.Request(url, headers={\"User-Agent\": \"SakugaFlow/1.0\"})',
'        resp = urllib.request.urlopen(req, timeout=30)',
'    except Exception as e:',
'        log(\"error\", \"Could not connect: \" + str(e)); return False',
'    total = int(resp.headers.get(\"Content-Length\", 0)); downloaded = 0; cs = 65536',
'    try:',
'        with open(dest_path, \"wb\") as f:',
'            while True:',
'                chunk = resp.read(cs)',
'                if not chunk: break',
'                f.write(chunk); downloaded += len(chunk)',
'                if total > 0:',
'                    pct = min(99, int(downloaded * 100 / total))',
'                    if downloaded % (cs * 8) < cs:',
'                        log(\"progress\", \"Downloading \" + label + \": \" + str(pct) + \"%\", pct=pct, done=downloaded, total=total)',
'    except Exception as e:',
'        log(\"error\", \"Download interrupted: \" + str(e))',
'        try: os.unlink(dest_path)',
'        except: pass',
'        return False',
'    log(\"progress\", \"Downloading \" + label + \": 100%\", pct=100, done=downloaded, total=total)',
'    return True',
'',
'def find_in_zip(zip_path, exe_name, dest_dir):',
'    result = None',
'    try:',
'        zf = zipfile.ZipFile(zip_path, \"r\")',
'        for m in zf.namelist():',
'            base = os.path.basename(m)',
'            if base.lower() == exe_name.lower():',
'                dest = os.path.join(dest_dir, base)',
'                zf.extract(m, dest_dir)',
'                extracted = os.path.join(dest_dir, m)',
'                if extracted != dest: shutil.move(extracted, dest)',
'                result = dest',
'            if \"models/\" in m.lower() or \"model/\" in m.lower():',
'                if m.endswith("/") or m.endswith("\\\\"): continue',
'                parts = m.split(\"/\")',
'                mi = -1',
'                for i, p in enumerate(parts):',
'                    if \"model\" in p.lower(): mi = i; break',
'                rel = \"/\".join(parts[mi:]) if mi >= 0 else m',
'                target = os.path.join(dest_dir, rel)',
'                dname = os.path.dirname(target)',
'                if dname and not os.path.exists(dname): os.makedirs(dname)',
'                with zf.open(m) as src:',
'                    with open(target, \"wb\") as dst: dst.write(src.read())',
'        dirs_to_remove = []',
'        for m in zf.namelist():',
'            if m.endswith(\"/\"): continue',
'            for d in m.split(\"/\")[:-1]:',
'                if d and \"model\" not in d.lower() and d not in dirs_to_remove:',
'                    p = os.path.join(dest_dir, d)',
'                    if os.path.isdir(p):',
'                        try:',
'                            has = [x for x in os.listdir(p) if x.lower() != \"models\"]',
'                            if not has: shutil.rmtree(p)',
'                        except: pass',
'        return result',
'    except Exception as e:',
'        log(\"warn\", \"Zip extraction: \" + str(e)); return None',
'',
'def install_ffmpeg():',
'    exe = os.path.join(SCRIPT_DIR, \"ffmpeg.exe\")',
'    prb = os.path.join(SCRIPT_DIR, \"ffprobe.exe\")',
'    if os.path.exists(exe) and os.path.exists(prb):',
'        log(\"info\", \"FFmpeg already installed\")',
'        log(\"done\", \"ffmpeg\", path=exe); log(\"done\", \"ffprobe\", path=prb); return True',
'    zp = os.path.join(SCRIPT_DIR, \"_ffmpeg.zip\")',
'    if not download_file(FFMPEG_URL, zp, \"FFmpeg\"): return False',
'    log(\"info\", \"Extracting FFmpeg...\")',
'    ok1 = find_in_zip(zp, \"ffmpeg.exe\", SCRIPT_DIR)',
'    ok2 = find_in_zip(zp, \"ffprobe.exe\", SCRIPT_DIR)',
'    try: os.unlink(zp)',
'    except: pass',
'    if ok1 and ok2:',
'        log(\"info\", \"FFmpeg installed\"); log(\"done\", \"ffmpeg\", path=ok1); log(\"done\", \"ffprobe\", path=ok2); return True',
'    log(\"error\", \"Could not extract FFmpeg\"); return False',
'',
'def install_esrgan():',
'    tgt = os.path.join(SCRIPT_DIR, "realesrgan-ncnn-vulkan.exe")',
'    model = os.path.join(SCRIPT_DIR, "models", "realesr-animevideov3-x2.param")',
'    if os.path.exists(tgt) and os.path.exists(model):',
'        log("info", "Real-ESRGAN already installed"); log("done", "realesrgan", path=tgt); return True',
'    zp = os.path.join(SCRIPT_DIR, \"_esrgan.zip\")',
'    if not download_file(ESRGAN_URL, zp, \"Real-ESRGAN\"): return False',
'    log(\"info\", \"Extracting Real-ESRGAN...\")',
'    ok = find_in_zip(zp, \"realesrgan-ncnn-vulkan.exe\", SCRIPT_DIR)',
'    try: os.unlink(zp)',
'    except: pass',
'    if ok:',
'        log(\"info\", \"Real-ESRGAN installed\"); log(\"done\", \"realesrgan\", path=ok); return True',
'    log(\"error\", \"Could not extract Real-ESRGAN\"); return False',
'',
'def install_pip_packages():',
'    missing = []',
'    for p in PIP_PACKAGES:',
'        try:',
'            subprocess.check_output([sys.executable, \"-m\", \"pip\", \"show\", p], stderr=subprocess.DEVNULL, timeout=15)',
'        except:',
'            missing.append(p)',
'    if not missing:',
'        log(\"info\", \"All pip packages installed\")',
'        for p in PIP_PACKAGES: log(\"done\", \"pip-\" + p, path=\"pip:\" + p)',
'        return True',
'    log(\"info\", \"Installing: \" + \", \".join(missing) + \"...\")',
'    try:',
'        p = subprocess.Popen([sys.executable, \"-m\", \"pip\", \"install\"] + missing, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)',
'        for line in p.stdout:',
'            line = line.strip()',
'            if line: log(\"pip\", line)',
'        p.wait()',
'        if p.returncode == 0:',
'            log(\"info\", \"pip packages installed\")',
'            for pkg in PIP_PACKAGES: log(\"done\", \"pip-\" + pkg, path=\"pip:\" + pkg)',
'            return True',
'        log(\"warn\", \"pip exit code \" + str(p.returncode)); return False',
'    except Exception as e:',
'        log(\"error\", \"pip failed: \" + str(e))',
'        log(\"error\", \"Run: \" + sys.executable + \" -m pip install \" + \" \".join(missing))',
'        return False',
'',
'def main():',
'    log(\"info\", \"SakugaFlow Tools Installer\")',
'    log(\"info\", \"Target: \" + SCRIPT_DIR)',
'    log(\"info\", \"Python: \" + sys.version.split()[0])',
'    results = {}',
'    log(\"section\", \"FFmpeg\", step=1, total=3)',
'    results[\"ffmpeg\"] = install_ffmpeg()',
'    results[\"ffprobe\"] = results[\"ffmpeg\"]',
'    log(\"section\", \"Real-ESRGAN\", step=2, total=3)',
'    results[\"realesrgan\"] = install_esrgan()',
'    log(\"section\", \"pip packages\", step=3, total=3)',
'    results[\"pip\"] = install_pip_packages()',
'    all_ok = results.get(\"ffmpeg\") and results.get(\"realesrgan\")',
'    log(\"summary\", \"Done\", results=results, all_ok=all_ok)',
'    if all_ok:',
'        log(\"success\", \"All tools installed. SakugaFlow is ready!\")',
'    else:',
'        log(\"error\", \"Some tools failed. Check the log.\")',
'',
'if __name__ == \"__main__\":',
'    try:',
'        main()',
'    except Exception as e:',
'        log(\"fatal\", str(e)); sys.exit(1)',
    ].join('\n');
  }

  window.ToolsSetup = {
    show: showToolsSetup,
    hide: hideToolsSetup,
    scan: scanTools,
    checkAndShowIfNeeded: checkAndShowIfNeeded
  };

  window.showToolsSetup = showToolsSetup;
  window.hideToolsSetup = hideToolsSetup;
  window.goToSetupStep = goToSetupStep;
  window.scanToolsAndRefresh = scanToolsAndRefresh;
  window.skipToolsSetup = skipToolsSetup;
  window.finishToolsSetup = finishToolsSetup;
  window.openToolsFolder = openToolsFolder;
  window.cancelAutoInstall = cancelAutoInstall;
  window.disableUpscaleFeature = disableUpscaleFeature;
})();
