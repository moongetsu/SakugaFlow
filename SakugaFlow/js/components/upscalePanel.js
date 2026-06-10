(function () {
  const UpscalePanel = {
    init(app) {
      this.app = app;

      
      this.dropZone = document.getElementById("upscaleDropZone");
      this.addExternalBtn = document.getElementById("addExternalUpscaleBtn");
      this.addSelectedAeBtn = document.getElementById("addSelectedAeClipBtn");
      this.clearQueueBtn = document.getElementById("clearUpscaleQueueBtn");
      this.startBtn = document.getElementById("startUpscaleBtn");
      
      this.queueList = document.getElementById("upscaleQueueList");
      this.statusText = document.getElementById("upscaleStatusText");
      this.progressFill = document.getElementById("upscaleProgressFill");
      this.progressText = document.getElementById("upscaleProgressText");
      
      this.processImportBtn = document.getElementById("processImportUpscaledBtn");
      this.processFolderBtn = document.getElementById("processFolderUpscaledBtn");
      this.historyList = document.getElementById("upscaleSessionHistoryList");
      this.clearHistoryBtn = document.getElementById("clearUpscaleSessionHistoryBtn");

      
      this.categoryButtons = document.querySelectorAll(".upscale-cat-btn");
      this.upscaleSections = document.querySelectorAll(".upscale-section");
      
      this.categoryButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.categoryButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const target = btn.getAttribute("data-target");
          this.upscaleSections.forEach((sec) => {
            sec.classList.toggle("hidden", sec.id !== target);
          });
        });
      });

      const openHistoryFolderBtn = document.getElementById("openUpscalesFolderBtn");
      if (openHistoryFolderBtn) {
        openHistoryFolderBtn.addEventListener("click", () => {
          var folder = this.app.downloadFolder;
          if (folder) {
            try {
              if (!window.FileSystem.fs.existsSync(folder)) {
                window.FileSystem.fs.mkdirSync(folder, { recursive: true });
              }
              window.FileSystem.childProcess.exec('explorer "' + folder + '"');
            } catch (ex) {
              try { window.FileSystem.childProcess.exec('start "" "' + folder + '"'); } catch (ex2) {}
            }
          }
        });
      }

      this.bindEvents();
      
      
      this.ensureUpscaleToolsPanel();
      this.restoreToolsPanelState();
      this.updateUpscaleToolsPanel();
      this.updateProcessStatusButtons();
      this.updateStartButtonState();
      this.updateUpscaleStatus("Waiting for clips...", 0);
    },

    bindEvents() {
      if (this.processImportBtn) {
        this.processImportBtn.addEventListener("click", () => this.importLatestUpscaleResult());
      }
      if (this.processFolderBtn) {
        this.processFolderBtn.addEventListener("click", () => this.openLatestUpscaleFolder());
      }
      if (this.clearHistoryBtn) {
        this.clearHistoryBtn.addEventListener("click", () => {
          this.app.upscaleSessionHistory = [];
          window.StorageManager.saveUpscaleSessionHistory([]);
          this.renderUpscaleHistory();
          this.updateUpscaleStatus("Render history cleared.", 0);
        });
      }
      if (this.addSelectedAeBtn) {
        this.addSelectedAeBtn.addEventListener("click", () => this.addSelectedAeClip());
      }
      if (this.addExternalBtn) {
        this.addExternalBtn.addEventListener("click", () => this.chooseExternalClip());
      }
      if (this.clearQueueBtn) {
        this.clearQueueBtn.addEventListener("click", () => {
          if (this.app.isUpscaleProcessing) {
            this.updateUpscaleStatus("Wait for the current process to finish before clearing.", 0);
            return;
          }
          this.app.upscaleQueue = [];
          window.StorageManager.saveUpscaleQueue([]);
          this.renderUpscaleQueue();
          this.updateStartButtonState();
          this.updateUpscaleStatus("Queue cleared.", 0);
        });
      }
      if (this.startBtn) {
        this.startBtn.addEventListener("click", () => this.startUpscaleProcess());
      }

      if (this.dropZone) {
        this.dropZone.addEventListener("dragenter", (e) => this.handleDragEnter(e));
        this.dropZone.addEventListener("dragover", (e) => this.handleDragOver(e));
        this.dropZone.addEventListener("dragleave", (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener("drop", (e) => this.handleDrop(e));
      }
    },

    handleDragEnter(e) {
      e.preventDefault();
      e.stopPropagation();
      if (this.dropZone) this.dropZone.classList.add("drag-over");
    },

    handleDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      if (this.dropZone) this.dropZone.classList.add("drag-over");
    },

    handleDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      if (this.dropZone) this.dropZone.classList.remove("drag-over");
    },

    handleDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      if (this.dropZone) this.dropZone.classList.remove("drag-over");

      const files = e.dataTransfer && e.dataTransfer.files
        ? Array.prototype.slice.call(e.dataTransfer.files)
        : [];

      if (!files.length) {
        this.updateUpscaleStatus("No file was dropped.", 0);
        this.flashDropZone("No file detected", "error");
        return;
      }

      let added = 0;
      files.forEach((file) => {
        const filePath = file.path || file.name || "";
        if (this.addExternalFileToQueue(filePath)) {
          added++;
        }
      });

      if (added > 0) {
        this.updateUpscaleStatus(`${added} clip(s) added to the upscale queue.`, 0);
        this.flashDropZone(`✓ ${added} clip(s) added`, "success");
      } else {
        this.updateUpscaleStatus("No supported video file was added.", 0);
        this.flashDropZone("Only MP4, MOV or WEBM", "error");
      }
    },

    addSelectedAeClip() {
      if (!window.__adobe_cep__ || !window.__adobe_cep__.evalScript) {
        this.updateUpscaleStatus("After Effects connection is not available in this panel.", 0);
        this.flashDropZone("AE connection not available", "error");
        return;
      }

      this.updateUpscaleStatus("Reading selected After Effects clip...", 5);
      this.flashDropZone("Reading AE selection...", "success");

      window.__adobe_cep__.evalScript("getSelectedSakugaflowLayerFile()", (result) => {
        let data = null;
        try {
          data = JSON.parse(result || "{}");
        } catch (e) {
          this.updateUpscaleStatus("Could not read the selected AE clip.", 0);
          this.flashDropZone("Could not read AE selection", "error");
          return;
        }

        if (!data || !data.ok || !data.filePath) {
          this.updateUpscaleStatus(data && data.message ? data.message : "Select a video layer in your active AE composition first.", 0);
          this.flashDropZone("Select a video layer first", "error");
          return;
        }

        if (this.addAfterEffectsFileToQueue(data.filePath, data.name || "AE clip")) {
          this.app.switchTab("upscale");
          this.updateUpscaleStatus("Selected AE clip added to the upscale queue.", 0);
          this.flashDropZone("✓ AE clip added", "success");
        } else {
          this.updateUpscaleStatus("Could not add the selected AE clip. Make sure it is a video file.", 0);
          this.flashDropZone("Could not add AE clip", "error");
        }
      });
    },

    addAfterEffectsFileToQueue(filePath, displayName) {
      filePath = this.normalizeLocalPath(filePath);
      if (!filePath || !window.FileSystem.fs.existsSync(filePath) || !window.Downloader.isVideo(filePath)) {
        return false;
      }

      const clip = {
        id: "ae_" + this.createSimpleId(filePath),
        tags: displayName || "After Effects selected clip",
        filePath: filePath,
        originalUrl: "",
        postUrl: "",
        source: "after_effects",
        addedAt: new Date().toISOString()
      };

      return this.addClipToUpscaleQueue(clip, "after_effects", false);
    },

    chooseExternalClip() {
      let files = [];
      try {
        if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
          const result = window.cep.fs.showOpenDialog(
            true,
            false,
            "Choose video clips to upscale",
            this.app.downloadFolder,
            ["mp4", "mov", "webm"]
          );
          if (result && result.data && result.data.length > 0) {
            files = result.data;
          }
        }
      } catch (e) {}

      if (!files.length) {
        const pasted = prompt("Paste the full video file path:", "") || "";
        if (pasted.trim()) {
          files = [pasted.trim()];
        }
      }

      if (!files.length) return;

      let added = 0;
      files.forEach((filePath) => {
        if (this.addExternalFileToQueue(filePath)) {
          added++;
        }
      });

      if (added > 0) {
        this.app.switchTab("upscale");
        this.updateUpscaleStatus(`${added} external clip(s) added to the queue.`, 0);
        this.flashDropZone(`✓ ${added} clip(s) added`, "success");
      } else {
        this.updateUpscaleStatus("Could not add the selected file(s).", 0);
        this.flashDropZone("Could not add this file", "error");
      }
    },

    addExternalFileToQueue(filePath) {
      filePath = this.normalizeLocalPath(filePath);
      if (!filePath || !window.FileSystem.fs.existsSync(filePath) || !window.Downloader.isVideo(filePath)) {
        return false;
      }

      const clip = {
        id: "external_" + this.createSimpleId(filePath),
        tags: "External clip",
        filePath: filePath,
        originalUrl: "",
        postUrl: "",
        source: "external",
        addedAt: new Date().toISOString()
      };

      return this.addClipToUpscaleQueue(clip, "external", false);
    },

    addClipToUpscaleQueue(clip, source, showStatus) {
      if (!clip || !clip.filePath || !window.FileSystem.fs.existsSync(clip.filePath)) {
        if (showStatus !== false) this.updateUpscaleStatus("Clip file not found.", 0);
        return false;
      }

      if (!window.Downloader.isVideo(clip.filePath)) {
        if (showStatus !== false) this.updateUpscaleStatus("Only video clips can be added to Upscale.", 0);
        return false;
      }

      const exists = this.app.upscaleQueue.some(item => item.filePath === clip.filePath);
      if (exists) {
        if (showStatus !== false) this.updateUpscaleStatus("This clip is already in the upscale queue.", 0);
        return false;
      }

      const queueItem = {
        queueId: "queue_" + Date.now() + "_" + Math.floor(Math.random() * 99999),
        id: clip.id || this.createSimpleId(clip.filePath),
        originalId: clip.originalId || clip.id || "",
        source: source || clip.source || "library",
        tags: clip.tags || "",
        filePath: clip.filePath,
        name: window.FileSystem.path ? window.FileSystem.path.basename(clip.filePath) : clip.filePath,
        postUrl: clip.postUrl || "",
        addedAt: new Date().toISOString(),
        trimStart: clip.trimStart || "",
        trimEnd: clip.trimEnd || "",
        upscaleScale: this.getSafeUpscaleScale(clip.upscaleScale || this.app.upscaleDefaultScale),
        status: "waiting"
      };

      this.app.upscaleQueue.push(queueItem);
      this.app.processStatusResultImported = true;
      window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
      this.renderUpscaleQueue();
      this.updateStartButtonState();
      this.updateProcessStatusButtons();

      if (showStatus !== false) {
        this.updateUpscaleStatus("Added to upscale queue: " + queueItem.name, 0);
      }

      return true;
    },

    removeUpscaleQueueItem(queueId) {
      if (this.app.isUpscaleProcessing) {
        this.updateUpscaleStatus("Wait for current process to finish before removing clips.", 0);
        return;
      }
      this.app.upscaleQueue = this.app.upscaleQueue.filter(item => item.queueId !== queueId);
      window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
      this.renderUpscaleQueue();
      this.updateStartButtonState();
    },

    renderUpscaleQueue() {
      if (!this.queueList) return;
      this.queueList.innerHTML = "";

      this.updateQueueStats();

      if (!this.app.upscaleQueue.length) {
        const empty = document.createElement("div");
        empty.className = "upscale-empty";
        empty.textContent = "No clips in queue yet. Drop videos or add from AE to get started.";
        this.queueList.appendChild(empty);
        return;
      }

      this.app.upscaleQueue.forEach((item, index) => {
        const row = document.createElement("div");
        row.id = "queue-item-" + item.queueId;
        const statusClass = item.status && item.status !== "waiting" ? "status-" + item.status : "status-waiting";
        row.className = "upscale-queue-item " + statusClass;

        const icon = document.createElement("div");
        icon.className = "upscale-queue-icon";
        icon.id = "queue-icon-" + item.queueId;
        icon.textContent = String(index + 1);

        const info = document.createElement("div");
        info.className = "upscale-queue-info";

        const name = document.createElement("div");
        name.className = "upscale-queue-name";
        name.textContent = item.name;

        const sourceRow = document.createElement("div");
        sourceRow.className = "upscale-queue-source-row";
        sourceRow.id = "queue-source-row-" + item.queueId;

        const badge = document.createElement("span");
        badge.className = "upscale-queue-badge";
        badge.textContent = item.source === "external" ? "External" : item.source === "after_effects" ? "AE Selected" : "Library";

        const pathText = document.createElement("span");
        pathText.className = "upscale-queue-path";
        pathText.textContent = item.filePath;
        pathText.title = item.filePath;

        sourceRow.appendChild(badge);
        if (item.status && item.status !== "waiting") {
          const statusBadge = document.createElement("span");
          statusBadge.className = "upscale-queue-badge status-" + item.status;
          statusBadge.textContent = item.status;
          statusBadge.title = item.error || item.status;
          sourceRow.appendChild(statusBadge);
        }
        sourceRow.appendChild(pathText);

        info.appendChild(name);
        info.appendChild(sourceRow);
        info.appendChild(this.createUpscaleScaleControls(item));
        info.appendChild(this.createUpscaleTrimControls(item));
        info.appendChild(this.createUpscaleItemProgress(item));

        const actions = document.createElement("div");
        actions.className = "upscale-item-actions";

        const folderButton = document.createElement("button");
        folderButton.className = "upscale-mini-btn";
        folderButton.textContent = "Folder";
        folderButton.onclick = () => window.Downloader.openFolderAndSelect(item.filePath);

        const removeButton = document.createElement("button");
        removeButton.className = "upscale-mini-btn delete";
        removeButton.textContent = "Remove";
        removeButton.onclick = () => this.removeUpscaleQueueItem(item.queueId);

        actions.appendChild(folderButton);
        actions.appendChild(removeButton);

        row.appendChild(icon);
        row.appendChild(info);
        row.appendChild(actions);
        this.queueList.appendChild(row);
      });
    },

    updateQueueStats() {
      const queue = this.app.upscaleQueue || [];
      const total = queue.length;
      const waiting = queue.filter(i => !i.status || i.status === "waiting").length;
      const processing = queue.filter(i => i.status === "processing" || i.status === "trimming" || i.status === "extracting" || i.status === "enhancing" || i.status === "building").length;
      const done = queue.filter(i => i.status === "done").length;
      const failed = queue.filter(i => i.status === "failed").length;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
      };
      setVal("queueStatTotal", total);
      setVal("queueStatWaiting", waiting);
      setVal("queueStatProcessing", processing);
      setVal("queueStatDone", done);
      setVal("queueStatFailed", failed);
    },

    refreshQueueItem(item) {
      if (!item || !item.queueId) return;
      const row = document.getElementById("queue-item-" + item.queueId);
      if (!row) return;

      const statusClass = item.status && item.status !== "waiting" ? "status-" + item.status : "status-waiting";
      row.className = "upscale-queue-item " + statusClass;

      const icon = document.getElementById("queue-icon-" + item.queueId);
      if (icon) {
        icon.className = "upscale-queue-icon";
      }

      const sourceRow = document.getElementById("queue-source-row-" + item.queueId);
      if (sourceRow) {
        sourceRow.querySelectorAll(".upscale-queue-badge").forEach(b => {
          if (b.className.indexOf("status-") !== -1) b.remove();
        });
        if (item.status && item.status !== "waiting") {
          const statusBadge = document.createElement("span");
          statusBadge.className = "upscale-queue-badge status-" + item.status;
          statusBadge.textContent = item.status;
          statusBadge.title = item.error || item.status;
          const pathText = sourceRow.querySelector(".upscale-queue-path");
          if (pathText) {
            sourceRow.insertBefore(statusBadge, pathText);
          } else {
            sourceRow.appendChild(statusBadge);
          }
        }
      }

      const progressWrap = document.getElementById("queue-progress-" + item.queueId);
      if (progressWrap) {
        const active = { trimming: 1, extracting: 1, enhancing: 1, building: 1, processing: 1 };
        const percent = Math.max(0, Math.min(100, Number(item.progress) || 0));
        const shouldShow = active[item.status] || item.status === "done" || item.status === "failed";

        if (!shouldShow) {
          progressWrap.classList.add("hidden");
        } else {
          progressWrap.classList.remove("hidden");
          const label = progressWrap.querySelector(".upscale-item-progress-label");
          const value = progressWrap.querySelector(".upscale-item-progress-value");
          const fill = progressWrap.querySelector(".upscale-item-progress-fill");
          if (label) label.textContent = item.progressDetail || this.getUpscaleProgressDetailFromStatus(item.status);
          if (value) value.textContent = item.status === "failed" ? "Failed" : percent + "%";
          if (fill) {
            fill.style.width = percent + "%";
            fill.className = "upscale-item-progress-fill";
            if (item.status === "failed") fill.classList.add("failed");
            if (item.status === "done") fill.classList.add("done");
          }
        }
      }

      this.updateQueueStats();
    },

    createUpscaleItemProgress(item) {
      const wrap = document.createElement("div");
      wrap.className = "upscale-item-progress-wrap";
      wrap.id = "queue-progress-" + item.queueId;

      const active = { trimming: 1, extracting: 1, enhancing: 1, building: 1, processing: 1 };
      const percent = Math.max(0, Math.min(100, Number(item.progress) || 0));
      const shouldShow = active[item.status] || item.status === "done" || item.status === "failed";

      if (!shouldShow) {
        wrap.classList.add("hidden");
        return wrap;
      }

      const top = document.createElement("div");
      top.className = "upscale-item-progress-top";

      const label = document.createElement("span");
      label.className = "upscale-item-progress-label";
      label.textContent = item.progressDetail || this.getUpscaleProgressDetailFromStatus(item.status);

      const value = document.createElement("span");
      value.className = "upscale-item-progress-value";
      value.textContent = item.status === "failed" ? "Failed" : percent + "%";

      top.appendChild(label);
      top.appendChild(value);

      const bar = document.createElement("div");
      bar.className = "upscale-item-progress-bar";

      const fill = document.createElement("div");
      fill.className = "upscale-item-progress-fill";
      fill.style.width = percent + "%";

      if (item.status === "failed") fill.classList.add("failed");
      if (item.status === "done") fill.classList.add("done");

      bar.appendChild(fill);
      wrap.appendChild(top);
      wrap.appendChild(bar);

      return wrap;
    },

    getUpscaleProgressDetailFromStatus(status) {
      if (status === "trimming") return "Trimming clip";
      if (status === "extracting") return "Extracting frames";
      if (status === "enhancing") return "AI upscaling frames";
      if (status === "building") return "Building final video";
      if (status === "done") return "Finished";
      if (status === "failed") return "Error";
      return "Preparing";
    },

    getSafeUpscaleScale(value) {
      const scale = parseInt(value, 10);
      return scale === 4 ? 4 : 2;
    },

    createUpscaleScaleControls(item) {
      const scaleBox = document.createElement("div");
      scaleBox.className = "upscale-scale-box";

      const label = document.createElement("div");
      label.className = "upscale-scale-label";
      label.textContent = "Upscale size";

      const actions = document.createElement("div");
      actions.className = "upscale-scale-actions";

      const currentScale = this.getSafeUpscaleScale(item.upscaleScale || this.app.upscaleDefaultScale);

      [2, 4].forEach((scale) => {
        const button = document.createElement("button");
        button.className = "upscale-scale-btn";
        button.textContent = scale + "x";
        button.disabled = this.app.isUpscaleProcessing;

        if (currentScale === scale) {
          button.classList.add("active");
        }

        button.onclick = () => {
          item.upscaleScale = scale;
          window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
          this.renderUpscaleQueue();
          this.updateUpscaleStatus(`Upscale size set to ${scale}x for ${item.name || "clip"}.`, 0);
        };

        actions.appendChild(button);
      });

      const note = document.createElement("div");
      note.className = "upscale-scale-note";
      note.textContent = currentScale === 4
        ? "4x creates a much larger file and takes longer."
        : "2x is faster and recommended for most clips.";

      scaleBox.appendChild(label);
      scaleBox.appendChild(actions);
      scaleBox.appendChild(note);

      return scaleBox;
    },

    createUpscaleTrimControls(item) {
      const trimBox = document.createElement("div");
      trimBox.className = "upscale-trim-box upscale-trim-visual-box";

      const top = document.createElement("div");
      top.className = "upscale-trim-visual-top";

      const textWrap = document.createElement("div");
      textWrap.className = "upscale-trim-visual-text";

      const label = document.createElement("div");
      label.className = "upscale-trim-label";
      label.textContent = "Cut before upscale";

      const rangeText = document.createElement("div");
      rangeText.className = "upscale-trim-range-text";
      rangeText.textContent = this.getUpscaleTrimLabel(item);

      textWrap.appendChild(label);
      textWrap.appendChild(rangeText);

      const buttonWrap = document.createElement("div");
      buttonWrap.className = "upscale-trim-visual-actions";

      const cutButton = document.createElement("button");
      cutButton.className = "upscale-cut-btn";
      cutButton.textContent = "Cut your clip";
      cutButton.disabled = this.app.isUpscaleProcessing;
      cutButton.onclick = () => {
        this.openUpscaleCutModal(item);
      };

      const clearButton = document.createElement("button");
      clearButton.className = "upscale-trim-clear-btn upscale-trim-clear-visual-btn";
      clearButton.textContent = "Clear";
      clearButton.disabled = this.app.isUpscaleProcessing || !this.validateUpscaleTrim(item).hasTrim;
      clearButton.onclick = () => {
        item.trimStart = "";
        item.trimEnd = "";
        window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
        this.renderUpscaleQueue();
        this.updateUpscaleStatus(`Cut cleared for ${item.name || "clip"}.`, 0);
      };

      buttonWrap.appendChild(cutButton);
      buttonWrap.appendChild(clearButton);
      top.appendChild(textWrap);
      top.appendChild(buttonWrap);

      const help = document.createElement("div");
      help.className = "upscale-trim-help";
      help.textContent = "Choose only the part you want to upscale. Leave empty for full clip.";

      trimBox.appendChild(top);
      trimBox.appendChild(help);

      if (this.validateUpscaleTrim(item).error) {
        trimBox.classList.add("trim-error");
      }

      return trimBox;
    },

    getUpscaleTrimLabel(item) {
      const val = this.validateUpscaleTrim(item);
      if (!val.hasTrim || val.error) return "Full clip";
      return (item.trimStart || "0").trim() + " → " + (item.trimEnd || "end").trim();
    },

    validateUpscaleTrim(item) {
      const startRaw = String(item && item.trimStart ? item.trimStart : "").trim();
      const endRaw = String(item && item.trimEnd ? item.trimEnd : "").trim();

      if (!startRaw && !endRaw) {
        return { hasTrim: false, startSeconds: 0, endSeconds: null, error: "" };
      }

      const startSeconds = startRaw ? this.parseUpscaleTrimTime(startRaw) : 0;
      const endSeconds = endRaw ? this.parseUpscaleTrimTime(endRaw) : null;

      if (startRaw && startSeconds === null) {
        return { hasTrim: true, error: "Invalid trim start time. Use seconds, mm:ss or hh:mm:ss." };
      }
      if (endRaw && endSeconds === null) {
        return { hasTrim: true, error: "Invalid trim end time. Use seconds, mm:ss or hh:mm:ss." };
      }
      if (endSeconds !== null && endSeconds <= startSeconds) {
        return { hasTrim: true, error: "Trim end time must be greater than start time." };
      }

      return { hasTrim: true, startSeconds, endSeconds, error: "" };
    },

    parseUpscaleTrimTime(value) {
      value = String(value || "").trim().replace(",", ".");
      if (!value) return null;
      if (/^\d+(\.\d+)?$/.test(value)) {
        return parseFloat(value);
      }
      const parts = value.split(":");
      if (parts.length < 2 || parts.length > 3) return null;

      let total = 0;
      for (let i = 0; i < parts.length; i++) {
        if (!/^\d+(\.\d+)?$/.test(parts[i])) return null;
        const number = parseFloat(parts[i]);
        if (i > 0 && number >= 60) return null;
        total = total * 60 + number;
      }
      return total;
    },

    openUpscaleCutModal(item) {
      if (!item || !item.filePath || !window.FileSystem.fs.existsSync(item.filePath)) {
        this.updateUpscaleStatus("Clip file not found.", 0);
        return;
      }
      if (!window.Downloader.isVideo(item.filePath)) {
        this.updateUpscaleStatus("Only video clips can be cut.", 0);
        return;
      }

      let overlay = document.getElementById("upscaleCutOverlay");
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);

      overlay = document.createElement("div");
      overlay.id = "upscaleCutOverlay";
      overlay.className = "upscale-cut-overlay";

      const modal = document.createElement("div");
      modal.className = "upscale-cut-modal";

      const header = document.createElement("div");
      header.className = "upscale-cut-header";

      const titleWrap = document.createElement("div");
      titleWrap.className = "upscale-cut-title-wrap";

      const title = document.createElement("div");
      title.className = "upscale-cut-title";
      title.textContent = "Cut your clip";

      const subtitle = document.createElement("div");
      subtitle.className = "upscale-cut-subtitle";
      subtitle.textContent = item.name;

      titleWrap.appendChild(title);
      titleWrap.appendChild(subtitle);

      const closeButton = document.createElement("button");
      closeButton.className = "upscale-cut-close-btn";
      closeButton.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      closeButton.onclick = () => close();

      header.appendChild(titleWrap);
      header.appendChild(closeButton);

      const body = document.createElement("div");
      body.className = "upscale-cut-body";

      const videoWrap = document.createElement("div");
      videoWrap.className = "upscale-cut-video-wrap";

      const video = document.createElement("video");
      video.className = "upscale-cut-video";
      video.src = window.FileSystem.pathToFileUrl(item.filePath);
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      videoWrap.appendChild(video);

      const timeRow = document.createElement("div");
      timeRow.className = "upscale-cut-time-row";

      const currentLabel = document.createElement("div");
      currentLabel.className = "upscale-cut-current-label";
      currentLabel.textContent = "00:00 / 00:00";

      const selectedLabel = document.createElement("div");
      selectedLabel.className = "upscale-cut-selected-label";
      selectedLabel.textContent = "Selected: Full clip";

      timeRow.appendChild(currentLabel);
      timeRow.appendChild(selectedLabel);

      const timelineWrap = document.createElement("div");
      timelineWrap.className = "upscale-cut-timeline-wrap";

      const timeline = document.createElement("div");
      timeline.className = "upscale-cut-timeline";

      const trackBg = document.createElement("div");
      trackBg.className = "upscale-cut-track-bg";

      const selection = document.createElement("div");
      selection.className = "upscale-cut-selection";

      const progress = document.createElement("div");
      progress.className = "upscale-cut-progress";

      const startHandle = document.createElement("div");
      startHandle.className = "upscale-cut-handle start";

      const endHandle = document.createElement("div");
      endHandle.className = "upscale-cut-handle end";

      timeline.appendChild(trackBg);
      timeline.appendChild(selection);
      timeline.appendChild(progress);
      timeline.appendChild(startHandle);
      timeline.appendChild(endHandle);
      timelineWrap.appendChild(timeline);

      const footer = document.createElement("div");
      footer.className = "upscale-cut-footer";

      const cancelButton = document.createElement("button");
      cancelButton.className = "upscale-cut-secondary-btn";
      cancelButton.textContent = "Cancel";
      cancelButton.onclick = () => close();

      const saveButton = document.createElement("button");
      saveButton.className = "upscale-cut-save-btn";
      saveButton.textContent = "Save Cut";

      footer.appendChild(cancelButton);
      footer.appendChild(saveButton);

      body.appendChild(videoWrap);
      body.appendChild(timeRow);
      body.appendChild(timelineWrap);

      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      let duration = 0;
      let startSeconds = 0;
      let endSeconds = 0;
      let activeDrag = "";
      let wasPlayingSelection = false;

      const close = () => {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch (e) {}
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      const initTimes = () => {
        duration = Number(video.duration) || 0;
        const val = this.validateUpscaleTrim(item);
        startSeconds = val.hasTrim ? val.startSeconds : 0;
        endSeconds = val.hasTrim && val.endSeconds !== null ? val.endSeconds : duration;
        updateUI();
      };

      const updateUI = () => {
        const safeDur = Math.max(0.001, duration);
        const startPct = (startSeconds / safeDur) * 100;
        const endPct = (endSeconds / safeDur) * 100;
        const curPct = ((video.currentTime || 0) / safeDur) * 100;

        selection.style.left = startPct + "%";
        selection.style.width = Math.max(0, endPct - startPct) + "%";
        startHandle.style.left = startPct + "%";
        endHandle.style.left = endPct + "%";
        progress.style.left = curPct + "%";

        currentLabel.textContent = `${this.formatSecondsForCutDisplay(video.currentTime)} / ${this.formatSecondsForCutDisplay(duration)}`;
        selectedLabel.textContent = `Selected: ${this.formatSecondsForCutDisplay(startSeconds)} → ${this.formatSecondsForCutDisplay(endSeconds)}`;
      };

      const getTimeFromX = (clientX) => {
        const rect = timeline.getBoundingClientRect();
        const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
        return Math.max(0, Math.min(duration, ratio * duration));
      };

      const onMouseMove = (e) => {
        if (!activeDrag) return;
        const t = getTimeFromX(e.clientX);
        if (activeDrag === "start") {
          startSeconds = Math.max(0, Math.min(t, endSeconds - 0.05));
          video.currentTime = startSeconds;
        } else if (activeDrag === "end") {
          endSeconds = Math.max(startSeconds + 0.05, Math.min(t, duration));
          video.currentTime = endSeconds;
        }
        updateUI();
      };

      const onMouseUp = () => {
        activeDrag = "";
      };

      startHandle.onmousedown = (e) => {
        e.preventDefault();
        activeDrag = "start";
      };

      endHandle.onmousedown = (e) => {
        e.preventDefault();
        activeDrag = "end";
      };

      video.addEventListener("loadedmetadata", initTimes);
      video.addEventListener("timeupdate", () => {
        if (wasPlayingSelection && video.currentTime >= endSeconds) {
          video.pause();
          video.currentTime = startSeconds;
          wasPlayingSelection = false;
        }
        updateUI();
      });

      saveButton.onclick = () => {
        const isFull = startSeconds <= 0.04 && endSeconds >= duration - 0.04;
        if (isFull) {
          item.trimStart = "";
          item.trimEnd = "";
        } else {
          item.trimStart = this.formatSecondsForCutInput(startSeconds);
          item.trimEnd = this.formatSecondsForCutInput(endSeconds);
        }
        window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
        this.renderUpscaleQueue();
        this.updateUpscaleStatus("Cut saved: " + this.getUpscaleTrimLabel(item), 0);
        close();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);

      video.load();
    },

    formatSecondsForCutDisplay(seconds) {
      seconds = Math.max(0, Number(seconds) || 0);
      const total = Math.floor(seconds);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      if (h > 0) {
        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      }
      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    },

    formatSecondsForCutInput(seconds) {
      seconds = Math.max(0, Number(seconds) || 0);
      const rounded = Math.round(seconds * 100) / 100;
      const total = Math.floor(rounded);
      const decimals = Math.round((rounded - total) * 100);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      let val = h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      if (decimals > 0) {
        val += "." + String(decimals).padStart(2, "0").replace(/0+$/, "");
      }
      return val;
    },

    flashDropZone(message, type) {
      if (!this.dropZone) return;
      const old = this.dropZone.querySelector(".upscale-drop-feedback");
      if (old) old.remove();

      const feedback = document.createElement("div");
      feedback.className = "upscale-drop-feedback " + (type || "success");
      feedback.textContent = message || "Clip added";

      this.dropZone.appendChild(feedback);
      this.dropZone.classList.add(type === "error" ? "drop-error" : "drop-success");

      setTimeout(() => {
        if (feedback && feedback.parentNode) feedback.remove();
        this.dropZone.classList.remove("drop-success", "drop-error");
      }, 1400);
    },

    updateUpscaleStatus(message, progress) {
      if (this.statusText) {
        this.statusText.textContent = message || "Waiting for clips...";
      }
      progress = Math.max(0, Math.min(100, Number(progress) || 0));
      if (this.progressFill) this.progressFill.style.width = progress + "%";
      if (this.progressText) this.progressText.textContent = progress + "%";
      this.updateStatusSteps(message);
    },

    updateStatusSteps(message) {
      const steps = ["trimming", "extracting", "enhancing", "building", "done"];
      const stepMap = {
        "trimming": "trimming",
        "extracting": "extracting",
        "enhancing": "enhancing",
        "building": "building",
        "done": "done"
      };

      let activeStep = "";
      const lowerMsg = (message || "").toLowerCase();
      for (const key in stepMap) {
        if (lowerMsg.includes(key)) {
          activeStep = stepMap[key];
        }
      }
      if (!activeStep && lowerMsg.includes("ai upscale")) activeStep = "enhancing";
      if (!activeStep && lowerMsg.includes("encoding")) activeStep = "building";
      if (!activeStep && lowerMsg.includes("finished")) activeStep = "done";
      if (!activeStep && lowerMsg.includes("waiting")) activeStep = "";

      document.querySelectorAll(".upscale-step").forEach(el => {
        const step = el.getAttribute("data-step");
        el.classList.remove("active", "done");
        if (activeStep === step) {
          el.classList.add("active");
        } else if (steps.indexOf(step) < steps.indexOf(activeStep)) {
          el.classList.add("done");
        }
      });

      const stepText = document.getElementById("upscaleProgressStep");
      if (stepText) {
        stepText.textContent = activeStep ? activeStep.toUpperCase() : "";
      }
    },

    ensureUpscaleToolsPanel() {
      var container = document.getElementById("upscale-tools-tab") || document.querySelector(".upscale-layout");
      if (!container) return;

      var existing = document.getElementById("upscaleToolsPanel");
      if (existing) return;

      var panel = document.createElement("div");
      panel.id = "upscaleToolsPanel";
      panel.className = "upscale-panel upscale-tools-panel";

      panel.innerHTML =
        '<div class="upscale-panel-header upscale-tools-header" id="upscaleToolsHeader">' +
          '<div>' +
            '<div class="upscale-title">Upscale Tools Status</div>' +
            '<div class="upscale-subtitle">External executables required for AI upscaling.</div>' +
          '</div>' +
          '<div class="upscale-tools-toggle open" id="upscaleToolsToggle"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="12 5 19 19 5 19 12 5"/></svg></div>' +
        '</div>' +
        '<div class="upscale-tools-body open" id="upscaleToolsBody">' +
          '<div id="upscaleToolsList"></div>' +
          '<div class="upscale-tools-actions-row">' +
            '<button class="upscale-tools-setup-btn open-folder" id="upscaleToolsOpenFolderBtn">' +
              '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
              ' Open Tools Folder' +
            '</button>' +
            '<button class="upscale-tools-setup-btn" id="upscaleToolsSetupBtn">' +
              '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
              ' Setup Guide' +
            '</button>' +
          '</div>' +
        '</div>';

      container.appendChild(panel);

      var header = document.getElementById("upscaleToolsHeader");
      var body = document.getElementById("upscaleToolsBody");
      var toggle = document.getElementById("upscaleToolsToggle");

      if (header && body && toggle) {
        header.addEventListener("click", function () {
          var isOpen = body.classList.toggle("open");
          toggle.classList.toggle("open", isOpen);
          window.StorageManager.setItem("sakugaflow_tools_details_collapsed", isOpen ? "0" : "1");
        });
      }

      var openBtn = document.getElementById("upscaleToolsOpenFolderBtn");
      if (openBtn) {
        openBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          var folder = window.App ? window.App.sakugaflowToolsFolder : "";
          if (!folder) {
            var appdata = "";
            try { appdata = process.env.APPDATA || ""; } catch (ex) {}
            if (!appdata && window.FileSystem && window.FileSystem.os && window.FileSystem.path) {
              appdata = window.FileSystem.path.join(window.FileSystem.os.homedir(), "AppData", "Roaming");
            }
            folder = appdata ? window.FileSystem.path.join(appdata, "com.moongetsu.extensions", "SakugaFlow", "backend") : "C:\\SakugaflowTools";
          }
          try {
            if (!window.FileSystem.fs.existsSync(folder)) {
              window.FileSystem.fs.mkdirSync(folder, { recursive: true });
            }
            window.FileSystem.childProcess.exec('explorer "' + folder + '"');
          } catch (ex) {
            try {
              window.FileSystem.childProcess.exec('start "" "' + folder + '"');
            } catch (ex2) {}
          }
        });
      }

      var setupBtn = document.getElementById("upscaleToolsSetupBtn");
      if (setupBtn) {
        setupBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (window.showToolsSetup) {
            window.showToolsSetup();
          }
        });
      }
    },

    restoreToolsPanelState() {
      var collapsed = window.StorageManager.getItem("sakugaflow_tools_details_collapsed", "0") === "1";
      var body = document.getElementById("upscaleToolsBody");
      var toggle = document.getElementById("upscaleToolsToggle");
      if (body && !collapsed) {
        body.classList.add("open");
      } else if (body) {
        body.classList.remove("open");
      }
      if (toggle) {
        toggle.classList.toggle("open", !collapsed);
      }
    },

    updateUpscaleToolsPanel() {
      var list = document.getElementById("upscaleToolsList");
      if (!list) return;

      var folder = this.app.sakugaflowToolsFolder;
      var tools = this.findUpscaleTools();

      var items = [
        { name: "FFmpeg", key: "ffmpeg", found: !!tools.ffmpeg, path: tools.ffmpeg },
        { name: "FFprobe", key: "ffprobe", found: !!tools.ffprobe, path: tools.ffprobe },
        { name: "Real-ESRGAN", key: "realesrgan", found: !!tools.realesrgan, path: tools.realesrgan },
        { name: "Python 3", key: "python", found: false, path: "", checking: true }
      ];

      list.innerHTML = items.map(function (item) {
        var cls, icon, pathDisplay;

        if (item.checking) {
          cls = "checking";
          icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>';
          pathDisplay = '<span class="upscale-tools-path">Checking...</span>';
        } else if (item.found) {
          cls = "found";
          icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
          pathDisplay = '<span class="upscale-tools-path">' + item.path + '</span>';
        } else {
          cls = "missing";
          icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
          pathDisplay = '<span class="upscale-tools-path">Not found on PATH</span>';
        }

        return '<div class="upscale-tools-row">' +
          '<div class="upscale-tools-status-icon ' + cls + '" id="upscale-tools-icon-' + item.key + '">' + icon + '</div>' +
          '<div class="upscale-tools-name">' + item.name + '</div>' +
          '<span class="upscale-tools-path" id="upscale-tools-path-' + item.key + '">' + pathDisplay + '</span>' +
        '</div>';
      }).join("");

      var self = this;
      self._checkPythonForPanel();
    },

    _checkPythonForPanel() {
      var self = this;
      var commands = ['python', 'python3'];

      function tryCmd(idx) {
        if (idx >= commands.length) {
          updatePythonRow(false, '');
          return;
        }

        try {
          var proc = window.FileSystem.childProcess.spawn(commands[idx], ['--version']);
          var output = '';
          proc.stdout.on('data', function (d) { output += d.toString(); });
          proc.stderr.on('data', function (d) { output += d.toString(); });
          proc.on('close', function (code) {
            if (code === 0) {
              var ver = output.trim().replace(/Python /i, '');
              updatePythonRow(true, commands[idx] + ' (' + ver + ')');
            } else {
              tryCmd(idx + 1);
            }
          });
          proc.on('error', function () {
            tryCmd(idx + 1);
          });
        } catch (e) {
          tryCmd(idx + 1);
        }
      }

      function updatePythonRow(found, path) {
        var iconEl = document.getElementById('upscale-tools-icon-python');
        var pathEl = document.getElementById('upscale-tools-path-python');
        if (!iconEl || !pathEl) return;

        if (found) {
          iconEl.className = 'upscale-tools-status-icon found';
          iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
          pathEl.textContent = path;
        } else {
          iconEl.className = 'upscale-tools-status-icon missing';
          iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
          pathEl.textContent = 'Not found on PATH';
        }
      }

      tryCmd(0);
    },

    updateProcessStatusButtons() {
      const result = this.getLatestUpscaleResult();
      const ready = !!result && !this.app.processStatusResultImported;

      if (this.processImportBtn) {
        this.processImportBtn.disabled = !ready;
        this.processImportBtn.classList.toggle("ready", ready);
      }
      if (this.processFolderBtn) {
        this.processFolderBtn.disabled = !result;
      }
    },

    getLatestUpscaleResult() {
      if (!this.app.upscaleRecent || !this.app.upscaleRecent.length) return null;
      const item = this.app.upscaleRecent[0];
      if (!item || !item.filePath || !window.FileSystem.fs.existsSync(item.filePath)) return null;
      return item;
    },

    importLatestUpscaleResult() {
      const result = this.getLatestUpscaleResult();
      if (!result || this.app.processStatusResultImported) return;

      this.app.processStatusResultImported = true;
      this.updateProcessStatusButtons();
      this.updateStartButtonState();

      this.app.importFileToAfterEffects(result.filePath, () => {});
    },

    openLatestUpscaleFolder() {
      const result = this.getLatestUpscaleResult();
      if (!result) return;
      window.Downloader.openFolderAndSelect(result.filePath);
    },

    updateStartButtonState() {
      if (!this.startBtn) return;
      this.startBtn.classList.remove("upscale-start-no-clip", "upscale-start-has-clip", "upscale-start-processing");

      if (this.app.isUpscaleProcessing) {
        this.startBtn.disabled = true;
        this.startBtn.textContent = "Processing...";
        this.startBtn.classList.add("upscale-start-processing");
        return;
      }

      this.startBtn.disabled = false;
      this.startBtn.textContent = "Start Upscale";
      if (this.app.upscaleQueue && this.app.upscaleQueue.length > 0) {
        this.startBtn.classList.add("upscale-start-has-clip");
      } else {
        this.startBtn.classList.add("upscale-start-no-clip");
      }
    },

    startUpscaleProcess() {
      if (this.app.isUpscaleProcessing) return;
      if (!this.app.upscaleQueue.length) {
        this.updateUpscaleStatus("Add clips to the queue first.", 0);
        return;
      }

      const tools = this.findUpscaleTools();
      if (!tools.ffmpeg || !tools.realesrgan) {
        this.updateUpscaleStatus("Upscale tools (FFmpeg/Real-ESRGAN) are missing. Open the Setup Guide to install them.", 0);
        if (window.showToolsSetup) {
          setTimeout(function () { window.showToolsSetup(); }, 500);
        }
        return;
      }

      this.app.isUpscaleProcessing = true;
      this.updateStartButtonState();
      if (this.clearQueueBtn) this.clearQueueBtn.disabled = true;

      this.updateUpscaleStatus("Starting upscale...", 1);
      this.processUpscaleQueueItem(0, tools, []);
    },

    findUpscaleTools() {
      const folder = this.app.sakugaflowToolsFolder;
      const ffmpegCandidates = [
        window.FileSystem.path.join(folder, "ffmpeg.exe"),
        window.FileSystem.path.join(folder, "ffmpeg", "ffmpeg.exe"),
        window.FileSystem.path.join(folder, "ffmpeg", "bin", "ffmpeg.exe")
      ];
      const ffprobeCandidates = [
        window.FileSystem.path.join(folder, "ffprobe.exe"),
        window.FileSystem.path.join(folder, "ffmpeg", "ffprobe.exe"),
        window.FileSystem.path.join(folder, "ffmpeg", "bin", "ffprobe.exe")
      ];
      const realesrganCandidates = [
        window.FileSystem.path.join(folder, "realesrgan", "realesrgan-ncnn-vulkan.exe"),
        window.FileSystem.path.join(folder, "Real-ESRGAN", "realesrgan-ncnn-vulkan.exe"),
        window.FileSystem.path.join(folder, "realesrgan-ncnn-vulkan.exe")
      ];

      return {
        ffmpeg: this.firstExistingPath(ffmpegCandidates),
        ffprobe: this.firstExistingPath(ffprobeCandidates),
        realesrgan: this.findRealEsrganWithModels(realesrganCandidates)
      };
    },

    findRealEsrganWithModels(candidates) {
      var exePath = this.firstExistingPath(candidates);
      if (!exePath) return "";

      var folder = window.FileSystem.path.dirname(exePath);
      var rootFolder = this.app.sakugaflowToolsFolder;

      var modelNames = [
        "realesr-animevideov3-x2.param",
        "realesr-animevideov3-x4.param",
        "RealESRGAN_AnimeVideoV3_x2.param",
        "realesrgan-x2.param",
        "realesr-animevideov3.param"
      ];

      var foldersToCheck = [folder];
      if (rootFolder && rootFolder !== folder) {
        foldersToCheck.push(rootFolder);
      }

      for (var fi = 0; fi < foldersToCheck.length; fi++) {
        for (var mi = 0; mi < modelNames.length; mi++) {
          var modelPath = window.FileSystem.path.join(foldersToCheck[fi], "models", modelNames[mi]);
          try {
            if (window.FileSystem.fs.existsSync(modelPath)) {
              return exePath;
            }
          } catch (e) {}
        }
        for (var mj = 0; mj < modelNames.length; mj++) {
          var altPath = window.FileSystem.path.join(foldersToCheck[fi], modelNames[mj]);
          try {
            if (window.FileSystem.fs.existsSync(altPath)) {
              return exePath;
            }
          } catch (e) {}
        }
      }

      return exePath;
    },

    firstExistingPath(candidates) {
      for (let i = 0; i < candidates.length; i++) {
        if (window.FileSystem.fs.existsSync(candidates[i])) {
          return candidates[i];
        }
      }
      return "";
    },

    processUpscaleQueueItem(index, tools, failedItems) {
      if (index >= this.app.upscaleQueue.length) {
        this.finishUpscaleProcess(failedItems);
        return;
      }

      const total = this.app.upscaleQueue.length;
      const item = this.app.upscaleQueue[index];

      if (!item || !item.filePath || !window.FileSystem.fs.existsSync(item.filePath)) {
        if (item) {
          item.status = "failed";
          item.error = "File not found";
          failedItems.push(item);
        }
        this.processUpscaleQueueItem(index + 1, tools, failedItems);
        return;
      }

      item.status = "processing";
      window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
      this.refreshQueueItem(item);

      this.runSingleUpscaleJob(item, tools, index, total, (error, resultPath) => {
        if (error) {
          item.status = "failed";
          item.progress = item.progress || 0;
          item.progressDetail = "Failed";
          item.error = error;
          failedItems.push(item);
          this.updateUpscaleStatus(`Failed: ${item.name} | ${error}`, this.getOverallProgress(index, total, 100));
          window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
          this.refreshQueueItem(item);
          this.app.showCepToast(`Failed: ${item.name} — ${error}`, "error");
          setTimeout(() => this.processUpscaleQueueItem(index + 1, tools, failedItems), 600);
          return;
        }

        const scale = this.getSafeUpscaleScale(item.upscaleScale || this.app.upscaleDefaultScale);
        this.addUpscaleResultToLibrary({
          id: "upscaled_" + scale + "x_" + this.createSimpleId(resultPath),
          originalId: item.originalId || item.id || "",
          tags: (item.tags || "") + " upscale_" + scale + "x",
          filePath: resultPath,
          sourceFilePath: item.filePath,
          originalUrl: item.originalUrl || "",
          postUrl: item.postUrl || "",
          upscaledAt: new Date().toISOString(),
          upscaleScale: scale
        });

        item.status = "done";
        item.progress = 100;
        item.progressDetail = "Finished";
        this.updateUpscaleStatus("Done: " + window.FileSystem.path.basename(resultPath), this.getOverallProgress(index, total, 100));
        window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
        this.refreshQueueItem(item);
        this.app.showCepToast(`Upscaled: ${window.FileSystem.path.basename(resultPath)} (${scale}x)`, "success");
        setTimeout(() => this.processUpscaleQueueItem(index + 1, tools, failedItems), 450);
      });
    },

    finishUpscaleProcess(failedItems) {
      failedItems = failedItems || [];
      this.app.upscaleQueue = failedItems;
      window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
      this.renderUpscaleQueue();
      this.renderUpscaleHistory();

      if (!document.getElementById("libraryView").classList.contains("hidden")) {
        this.app.libraryPanel.renderLibrary();
      }

      this.app.isUpscaleProcessing = false;
      this.updateProcessStatusButtons();
      this.updateStartButtonState();
      if (this.clearQueueBtn) this.clearQueueBtn.disabled = false;

      if (failedItems.length) {
        this.updateUpscaleStatus(`Finished with ${failedItems.length} failed clip(s).`, 100);
        this.app.showCepToast(`Upscale finished: ${failedItems.length} clip(s) failed`, "warning");
      } else {
        this.updateUpscaleStatus("All upscale jobs finished. Results added to Library.", 100);
        this.app.showCepToast("Upscale complete — results added to Library", "success");
      }
    },

    runSingleUpscaleJob(item, tools, index, total, callback) {
      const original = item.filePath;
      const scale = this.getSafeUpscaleScale(item.upscaleScale || this.app.upscaleDefaultScale);
      const output = this.getUpscaleOutputPath(original, scale, item);
      
      const jobFolder = window.FileSystem.path.join(
        window.FileSystem.os ? window.FileSystem.os.tmpdir() : "",
        "SakugaFlow",
        "upscale",
        this.createSimpleId(original) + "_" + Date.now()
      );
      const framesIn = window.FileSystem.path.join(jobFolder, "frames_in");
      const framesOut = window.FileSystem.path.join(jobFolder, "frames_out");

      window.FileSystem.createFolder(jobFolder);
      window.FileSystem.createFolder(framesIn);
      window.FileSystem.createFolder(framesOut);

      const trimVal = this.validateUpscaleTrim(item);
      if (trimVal.error) {
        window.FileSystem.deleteFolderRecursive(jobFolder);
        callback(trimVal.error);
        return;
      }

      const reportProgress = (status, detail, stepProgress) => {
        const pct = Math.max(0, Math.min(100, Math.round(Number(stepProgress) || 0)));
        item.status = status;
        item.progress = pct;
        item.progressDetail = detail;
        window.StorageManager.saveUpscaleQueue(this.app.upscaleQueue);
        this.refreshQueueItem(item);
        this.updateUpscaleStatus(`${detail}: ${item.name}`, this.getOverallProgress(index, total, pct));
      };

      const runMainUpscale = (inputPath, trimLabel) => {
        reportProgress("processing", "Reading clip metadata" + trimLabel, 4);
        this.getVideoFps(tools.ffprobe, inputPath, (fps) => {
          this.getVideoDuration(tools.ffprobe, inputPath, (duration) => {
            const inPattern = window.FileSystem.path.join(framesIn, "frame_%08d.png");
            
            reportProgress("extracting", "Extracting frames" + trimLabel, 8);
            this.runFfmpegWithProgress(
              tools.ffmpeg,
              ["-y", "-i", inputPath, "-vsync", "0", inPattern],
              duration,
              (percent) => {
                reportProgress("extracting", "Extracting frames" + trimLabel, 8 + percent * 0.24);
              },
              (extractErr) => {
                if (extractErr) {
                  window.FileSystem.deleteFolderRecursive(jobFolder);
                  callback("Could not extract frames: " + extractErr);
                  return;
                }

                const framesCount = this.countFiles(framesIn);
                if (framesCount <= 0) {
                  window.FileSystem.deleteFolderRecursive(jobFolder);
                  callback("No frames were extracted");
                  return;
                }

                reportProgress("enhancing", "Upscaling 2x frames: 0/" + framesCount + trimLabel, 34);

                this.runRealEsrgan(
                  tools.realesrgan,
                  ["-i", framesIn, "-o", framesOut, "-n", this.app.upscaleModelName, "-s", String(scale), "-f", "png"],
                  framesOut,
                  framesCount,
                  (done, tot, percent) => {
                    reportProgress("enhancing", `AI Upscaling ${scale}x: ${done}/${tot} frames${trimLabel}`, 34 + percent * 0.43);
                  },
                  (enhanceErr) => {
                    if (enhanceErr) {
                      window.FileSystem.deleteFolderRecursive(jobFolder);
                      callback("Real-ESRGAN failed. Check GPU compatibility.");
                      return;
                    }

                    const outCount = this.countFiles(framesOut);
                    if (outCount <= 0) {
                      window.FileSystem.deleteFolderRecursive(jobFolder);
                      callback("No upscaled frames were created");
                      return;
                    }

                    const outPattern = window.FileSystem.path.join(framesOut, "frame_%08d.png");
                    const buildArgs = [
                      "-y",
                      "-framerate", fps,
                      "-i", outPattern,
                      "-i", inputPath,
                      "-map", "0:v:0",
                      "-map", "1:a?"
                    ];

                    const filter = this.getSharpnessFilter();
                    if (filter) {
                      buildArgs.push("-vf", filter);
                    }

                    buildArgs.push(
                      "-c:v", "libx264",
                      "-pix_fmt", "yuv420p",
                      "-crf", "16",
                      "-preset", "medium",
                      "-c:a", "aac",
                      "-b:a", "192k",
                      "-shortest",
                      output
                    );

                    reportProgress("building", "Encoding final MP4" + trimLabel, 80);

                    this.runFfmpegWithProgress(
                      tools.ffmpeg,
                      buildArgs,
                      duration || (outCount / parseFloat(fps)),
                      (encPct) => {
                        reportProgress("building", `Encoding final MP4 ${Math.floor(encPct)}%${trimLabel}`, 80 + encPct * 0.18);
                      },
                      (buildErr) => {
                        window.FileSystem.deleteFolderRecursive(jobFolder);
                        if (buildErr || !window.FileSystem.fs.existsSync(output)) {
                          callback("Could not build final video file: " + buildErr);
                        } else {
                          reportProgress("done", "Finished", 100);
                          callback(null, output);
                        }
                      }
                    );
                  }
                );
              }
            );
          });
        });
      };

      if (trimVal.hasTrim) {
        const label = " [" + this.getUpscaleTrimLabel(item) + "]";
        const trimmed = window.FileSystem.path.join(jobFolder, "trimmed_input.mp4");
        const trimArgs = ["-y"];
        const trimDur = trimVal.endSeconds !== null ? Math.max(0.1, trimVal.endSeconds - trimVal.startSeconds) : 0;

        if (trimVal.startSeconds > 0) {
          trimArgs.push("-ss", this.formatSecondsForFfmpeg(trimVal.startSeconds));
        }
        trimArgs.push("-i", original);
        if (trimVal.endSeconds !== null) {
          trimArgs.push("-t", this.formatSecondsForFfmpeg(trimVal.endSeconds - trimVal.startSeconds));
        }

        trimArgs.push("-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", trimmed);

        reportProgress("trimming", "Cutting clip before upscale" + label, 2);
        this.runFfmpegWithProgress(
          tools.ffmpeg,
          trimArgs,
          trimDur,
          (pct) => {
            reportProgress("trimming", `Cutting clip ${Math.floor(pct)}%${label}`, 2 + pct * 0.05);
          },
          (err) => {
            if (err || !window.FileSystem.fs.existsSync(trimmed)) {
              window.FileSystem.deleteFolderRecursive(jobFolder);
              callback("Could not cut clip before upscale");
            } else {
              runMainUpscale(trimmed, label);
            }
          }
        );
      } else {
        runMainUpscale(original, "");
      }
    },

    getOverallProgress(index, total, stepProgress) {
      total = Math.max(1, total);
      return Math.round(((index / total) * 100) + (stepProgress / total));
    },

    getVideoDuration(ffprobe, filePath, callback) {
      let output = "";
      try {
        const proc = window.FileSystem.childProcess.spawn(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
        proc.stdout.on("data", d => output += d.toString());
        proc.on("close", () => callback(parseFloat(output.trim()) || 0));
      } catch (e) {
        callback(0);
      }
    },

    getVideoFps(ffprobe, filePath, callback) {
      let output = "";
      try {
        const proc = window.FileSystem.childProcess.spawn(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
        proc.stdout.on("data", d => output += d.toString());
        proc.on("close", () => {
          const raw = output.trim();
          if (raw.includes("/")) {
            const parts = raw.split("/");
            const fps = parseFloat(parts[0]) / parseFloat(parts[1]);
            callback(fps.toFixed(3));
          } else {
            callback(parseFloat(raw) || "24");
          }
        });
      } catch (e) {
        callback("24");
      }
    },

    runFfmpegWithProgress(ffmpeg, args, durationSeconds, onProgress, callback) {
      let stderr = "";
      try {
        dbg('info', 'Upscale', 'Spawning FFmpeg: ' + ffmpeg + ' ' + args.join(' '));
        const proc = window.FileSystem.childProcess.spawn(ffmpeg, args);
        proc.stderr.on("data", (data) => {
          const text = data.toString();
          stderr += text;
          if (stderr.length > 5000) stderr = stderr.slice(stderr.length - 5000);
          
          if (durationSeconds > 0 && onProgress) {
            const match = stderr.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
            if (match) {
              const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
              onProgress(Math.max(0, Math.min(99, (seconds / durationSeconds) * 100)));
            }
          }
        });
        proc.on("close", (code) => {
          if (code === 0) {
            onProgress(100);
            callback(null);
          } else {
            dbg('error', 'Upscale', 'FFmpeg failed with exit code ' + code);
            if (stderr) dbg('error', 'Upscale', 'FFmpeg stderr:\n' + stderr);
            callback("Exit code " + code);
          }
        });
        proc.on("error", (err) => {
          dbg('error', 'Upscale', 'FFmpeg process error: ' + err.message);
          callback("Process error: " + err.message);
        });
      } catch (e) {
        dbg('error', 'Upscale', 'FFmpeg exception: ' + e.message);
        callback(e.message);
      }
    },

    runRealEsrgan(realesrgan, args, outputFolder, totalFrames, onProgress, callback) {
      let stderr = "";
      let stdout = "";
      try {
        dbg('info', 'Upscale', 'Spawning Real-ESRGAN: ' + realesrgan + ' ' + args.join(' '));
        const proc = window.FileSystem.childProcess.spawn(realesrgan, args);
        
        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });
        
        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        const timer = setInterval(() => {
          const done = this.countFiles(outputFolder);
          const percent = Math.max(0, Math.min(99, (done / totalFrames) * 100));
          onProgress(done, totalFrames, percent);
        }, 800);

        proc.on("close", (code) => {
          clearInterval(timer);
          if (code === 0) {
            onProgress(totalFrames, totalFrames, 100);
            callback(null);
          } else {
            dbg('error', 'Upscale', 'Real-ESRGAN failed with exit code ' + code);
            if (stdout) dbg('debug', 'Upscale', 'Real-ESRGAN stdout:\n' + stdout);
            if (stderr) dbg('error', 'Upscale', 'Real-ESRGAN stderr:\n' + stderr);
            callback("Exit code " + code);
          }
        });

        proc.on("error", (err) => {
          clearInterval(timer);
          dbg('error', 'Upscale', 'Real-ESRGAN process error: ' + err.message);
          callback("Process error: " + err.message);
        });
      } catch (e) {
        dbg('error', 'Upscale', 'Real-ESRGAN exception: ' + e.message);
        callback(e.message);
      }
    },

    countFiles(folder) {
      if (!window.FileSystem.fs.existsSync(folder)) return 0;
      return window.FileSystem.fs.readdirSync(folder).length;
    },

    getUpscaleOutputPath(inputPath, scale, item) {
      const dir = window.FileSystem.path.dirname(inputPath);
      const ext = window.FileSystem.path.extname(inputPath);
      const base = window.FileSystem.path.basename(inputPath, ext);
      
      let suffix = `_upscaled_${scale}x`;
      const val = this.validateUpscaleTrim(item);
      if (val.hasTrim && !val.error) {
        const start = this.formatSecondsForName(val.startSeconds);
        const end = val.endSeconds !== null ? this.formatSecondsForName(val.endSeconds) : "end";
        suffix = `_trim_${start}_to_${end}${suffix}`;
      }

      let candidate = window.FileSystem.path.join(dir, base + suffix + ".mp4");
      if (!window.FileSystem.fs.existsSync(candidate)) return candidate;

      for (let i = 2; i < 999; i++) {
        candidate = window.FileSystem.path.join(dir, `${base}${suffix}_${i}.mp4`);
        if (!window.FileSystem.fs.existsSync(candidate)) return candidate;
      }
      return window.FileSystem.path.join(dir, `${base}${suffix}_${Date.now()}.mp4`);
    },

    formatSecondsForName(seconds) {
      seconds = Math.max(0, Number(seconds) || 0);
      const tot = Math.floor(seconds);
      const h = Math.floor(tot / 3600);
      const m = Math.floor((tot % 3600) / 60);
      const s = tot % 60;
      let val = h > 0 ? `${String(h).padStart(2, "0")}_` : "";
      val += `${String(m).padStart(2, "0")}_${String(s).padStart(2, "0")}`;
      const dec = seconds % 1;
      if (dec > 0) val += "_" + Math.round(dec * 1000);
      return val;
    },

    formatSecondsForFfmpeg(seconds) {
      return (Math.max(0, Number(seconds) || 0)).toFixed(3);
    },

    getSharpnessFilter() {
      const mode = this.app.upscaleSharpnessMode;
      if (mode === "soft") return "gblur=sigma=0.45";
      if (mode === "natural") return "gblur=sigma=0.22";
      return "";
    },

    addUpscaleResultToLibrary(res) {
      this.app.library = this.app.library.filter(clip => {
        if (!clip || clip.type !== "upscaled") return true;
        if (res.sourceFilePath && clip.sourceFilePath === res.sourceFilePath) return false;
        if (res.originalId && String(clip.originalId) === String(res.originalId)) return false;
        return true;
      });

      this.app.addToLibrary({
        id: res.id,
        originalId: res.originalId || "",
        tags: res.tags || "Upscaled clip",
        filePath: res.filePath,
        sourceFilePath: res.sourceFilePath || "",
        originalUrl: res.originalUrl || "",
        postUrl: res.postUrl || "",
        downloadedAt: new Date().toISOString(),
        upscaledAt: new Date().toISOString(),
        upscaleScale: res.upscaleScale || 2,
        type: "upscaled"
      });

      this.app.upscaleRecent = [{
        name: window.FileSystem.path.basename(res.filePath),
        filePath: res.filePath,
        createdAt: new Date().toISOString()
      }];
      window.StorageManager.setItem("sakugaflow_upscale_recent", JSON.stringify(this.app.upscaleRecent));
      
      this.app.processStatusResultImported = false;
      this.updateProcessStatusButtons();
      this.updateStartButtonState();
      this.addHistoryItem(res.filePath);
    },

    addHistoryItem(filePath) {
      if (!filePath || !window.FileSystem.fs.existsSync(filePath)) return;
      const pathNorm = this.normalizeLocalPath(filePath);
      
      this.app.upscaleSessionHistory = this.app.upscaleSessionHistory.filter(item => item.filePath !== pathNorm);
      
      const item = {
        id: "history_" + Date.now(),
        name: window.FileSystem.path.basename(pathNorm),
        filePath: pathNorm,
        createdAt: new Date().toISOString(),
        thumbnail: ""
      };

      this.app.upscaleSessionHistory.unshift(item);
      if (this.app.upscaleSessionHistory.length > 12) {
        this.app.upscaleSessionHistory = this.app.upscaleSessionHistory.slice(0, 12);
      }

      window.StorageManager.saveUpscaleSessionHistory(this.app.upscaleSessionHistory);
      this.renderUpscaleHistory();
      this.generateHistoryThumbnail(item);
    },

    renderUpscaleHistory() {
      if (!this.historyList) return;
      this.historyList.innerHTML = "";

      const countEl = document.getElementById("history-total-count");
      if (countEl) {
        countEl.textContent = this.app.upscaleSessionHistory.length;
      }
      const sessionCountEl = document.getElementById("history-session-count");
      if (sessionCountEl) {
        sessionCountEl.textContent = this.app.upscaleSessionHistory.length;
      }

      if (!this.app.upscaleSessionHistory.length) {
        const empty = document.createElement("div");
        empty.className = "upscale-empty";
        empty.textContent = "No renders in this session yet.";
        this.historyList.appendChild(empty);
        return;
      }

      this.app.upscaleSessionHistory.forEach((item) => {
        const row = document.createElement("div");
        row.className = "upscale-session-history-item";

        const thumb = document.createElement("div");
        thumb.className = "upscale-session-history-thumb";

        if (item.thumbnail) {
          const img = document.createElement("img");
          img.src = item.thumbnail;
          thumb.appendChild(img);
        } else {
          const place = document.createElement("div");
          place.className = "upscale-session-history-placeholder";
          place.textContent = "Frame";
          thumb.appendChild(place);
          setTimeout(() => this.generateHistoryThumbnail(item), 80);
        }

        const info = document.createElement("div");
        info.className = "upscale-session-history-info";

        const title = document.createElement("div");
        title.className = "upscale-session-history-title";
        title.textContent = item.name;

        const path = document.createElement("div");
        path.className = "upscale-session-history-meta";
        path.textContent = item.filePath;
        path.title = item.filePath;

        info.appendChild(title);
        info.appendChild(path);

        const actions = document.createElement("div");
        actions.className = "upscale-session-history-actions";

        const importBtn = document.createElement("button");
        importBtn.className = "upscale-mini-btn import-ready";
        importBtn.textContent = "Import";
        importBtn.onclick = () => this.app.importFileToAfterEffects(item.filePath, () => {});

        const folderBtn = document.createElement("button");
        folderBtn.className = "upscale-mini-btn";
        folderBtn.textContent = "Folder";
        folderBtn.onclick = () => window.Downloader.openFolderAndSelect(item.filePath);

        actions.appendChild(importBtn);
        actions.appendChild(folderBtn);

        row.appendChild(thumb);
        row.appendChild(info);
        row.appendChild(actions);
        this.historyList.appendChild(row);
      });
    },

    generateHistoryThumbnail(item) {
      if (!item || !item.filePath || item.thumbnail || !window.FileSystem.fs.existsSync(item.filePath)) return;

      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = window.FileSystem.pathToFileUrl(item.filePath);

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch (e) {}
      };

      video.addEventListener("loadedmetadata", () => {
        video.currentTime = Math.min(0.2, (video.duration || 1) * 0.1);
      });

      video.addEventListener("seeked", () => {
        if (done) return;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          item.thumbnail = canvas.toDataURL("image/jpeg", 0.72);
          window.StorageManager.saveUpscaleSessionHistory(this.app.upscaleSessionHistory);
          this.renderUpscaleHistory();
        } catch (e) {}
        finish();
      });

      video.addEventListener("error", finish);
      setTimeout(finish, 6000);
    },

    normalizeLocalPath(filePath) {
      if (!window.FileSystem.path) return String(filePath || "");
      return String(filePath || "")
        .replace(/^file:\/\//i, "")
        .replace(/^\//, "")
        .replace(/\//g, window.FileSystem.path.sep);
    },

    createSimpleId(text) {
      text = String(text || "");
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
      }
      return String(Math.abs(hash));
    }
  };

  window.UpscalePanel = UpscalePanel;
})();
