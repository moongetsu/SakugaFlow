(function () {
  const App = {
    
    sakugabooruBaseUrl: "https://www.sakugabooru.com",
    previewCacheSoftLimitMB: 700,
    previewCacheHardLimitMB: 1536,
    resultsPerPage: 24,
    suggestionLimit: 14,
    maxPreviewDownloadsAtOnce: 4,
    playerLoadTimeoutMs: 20000,
    playerPrefetchAheadCount: 3,
    pagePreloadInitialCount: 3,
    maxPagePreloadDownloadsAtOnce: 2,
    searchTimeoutMs: 18000,
    upscaleDefaultScale: 2,
    upscaleModelName: "realesr-animevideov3",
    sakugaflowToolsFolder: (function () {
      var appdata = "";
      try { appdata = process.env.APPDATA || ""; } catch (e) {}
      if (!appdata && window.FileSystem && window.FileSystem.os && window.FileSystem.path) {
        appdata = window.FileSystem.path.join(window.FileSystem.os.homedir(), "AppData", "Roaming");
      }
      var base = appdata ? window.FileSystem.path.join(appdata, "com.moongetsu.extensions", "SakugaFlow") : "";
      return base ? window.FileSystem.path.join(base, "backend") : "C:\\SakugaflowTools";
    })(),

    sakugaflowPythonEnvFolder: (function () {
      var appdata = "";
      try { appdata = process.env.APPDATA || ""; } catch (e) {}
      if (!appdata && window.FileSystem && window.FileSystem.os && window.FileSystem.path) {
        appdata = window.FileSystem.path.join(window.FileSystem.os.homedir(), "AppData", "Roaming");
      }
      return appdata ? window.FileSystem.path.join(appdata, "com.moongetsu.extensions", "SakugaFlow") : "";
    })(),

    init() {
      dbg('info', 'App', 'Initializing SakugaFlow...');
      
      const path = window.FileSystem.path;
      const os = window.FileSystem.os;
      this.defaultDownloadFolder = path ? path.join(os.homedir(), "Downloads", "SakugaFlow") : "";
      this.previewCacheFolder = path ? path.join(os.tmpdir(), "SakugaFlowCEP", "previews") : "";

      
      this.downloadFolder = window.StorageManager.getItem("sakugaboru_download_folder") || this.defaultDownloadFolder;
      this.library = window.StorageManager.loadLibrary();
      this.favorites = window.StorageManager.loadFavorites();
      this.savedSearchTags = window.StorageManager.loadSavedSearchTags();
      this.upscaleQueue = window.StorageManager.loadUpscaleQueue();
      this.upscaleSessionHistory = window.StorageManager.loadUpscaleSessionHistory();

      
      this.scenePackFolders = window.StorageManager.loadScenePackFolders();
      this.currentScenePackFolder = window.StorageManager.getItem("sakugaflow_current_scene_pack_folder") || "";
      this.scenePackPage = 1;
      this.scenePackClipsList = [];

      
      this.currentSearchTags = "";
      this.currentSearchMode = "tags";
      this.lastSearchedTagsForSave = "";
      this.isSearchResultsVisible = false;
      this.savedTagsCollapsed = window.StorageManager.getItem("sakugaflow_saved_tags_collapsed", "0") === "1";
      this.currentPage = 1;
      this.lastResultHadMorePosts = false;
      this.currentSearchPosts = [];
      this.currentLibraryMode = window.StorageManager.getItem("sakugaboru_library_mode") || "all";
      this.upscaleRecent = [];
      try {
        const rec = window.StorageManager.getItem("sakugaflow_upscale_recent", "[]");
        this.upscaleRecent = JSON.parse(rec);
      } catch (e) {}

      this.processStatusResultImported = false;
      this.isUpscaleProcessing = false;
      this.upscaleSharpnessMode = window.StorageManager.getItem("sakugaflow_upscale_sharpness") || "natural";
      this.playerFitMode = window.StorageManager.getItem("sakugaboru_player_fit_mode") || "fit";

      
      this.previewsInUse = new Set();
      this.selectedPosts = {};
      this.selectedLibraryClips = {};

      this.previewQueue = [];
      this.activePreviewDownloads = 0;
      this.searchSessionId = 0;
      this.searchRequestId = 0;
      this.playerPageRequestId = 0;

      this.playerPlaylist = [];
      this.playerPlaylistIndex = -1;
      this.currentPlayerItem = null;
      this.playerDownloadJobs = {};
      this.pagePreloadQueue = [];
      this.activePagePreloadDownloads = 0;
      this.pagePreloadSessionId = 0;
      this.isLoadingPlayerPage = false;
      this.playerAttemptToken = 0;
      this.playerPrefetchSessionId = 0;

      
      window.FileSystem.createFolder(this.downloadFolder);
      window.FileSystem.createFolder(this.previewCacheFolder);
      window.FileSystem.createFolder(this.sakugaflowToolsFolder);
      window.FileSystem.createFolder(this.sakugaflowPythonEnvFolder);

      
      this.settingsPanel = window.SettingsPanel;
      this.searchPanel = window.SearchPanel;
      this.playerOverlay = window.PlayerOverlay;
      this.libraryPanel = window.LibraryPanel;
      this.upscalePanel = window.UpscalePanel;
      this.consolePanel = window.ConsolePanel;
      this.scenePacksPanel = window.ScenePacksPanel;
      this.scenePacksPanel = window.ScenePacksPanel;
      this.aboutPanel = window.AboutPanel;

      this.settingsPanel.init(this);
      this.searchPanel.init(this);
      this.playerOverlay.init(this);
      this.libraryPanel.init(this);
      this.upscalePanel.init(this);
      this.consolePanel.init(this);
      this.scenePacksPanel.init(this);
      this.aboutPanel.init(this);

      this.aboutPanel.init(this);

      dbg('info', 'App', 'SakugaFlow initialized');
      this.bindGlobalEvents();
      this.switchTab("search");

      if (window.StorageManager.getItem("sakugaflow_upscale_disabled", "0") === "1") {
        var upscaleBtn = document.getElementById('upscaleTabBtn');
        if (upscaleBtn) upscaleBtn.style.display = 'none';
      } else if (window.ToolsSetup && typeof window.ToolsSetup.checkAndShowIfNeeded === 'function') {
        setTimeout(function () {
          window.ToolsSetup.checkAndShowIfNeeded();
        }, 300);
      }

      if (window.StorageManager.getItem("sakugaflow_scene_packs_disabled", "0") === "1") {
        var scenePacksBtn = document.getElementById('scenePacksTabBtn');
        if (scenePacksBtn) scenePacksBtn.style.display = 'none';
      }

      if (window.StorageManager.getItem("sakugaflow_console_disabled", "0") === "1") {
        var consoleBtn = document.getElementById('consoleTabBtn');
        if (consoleBtn) consoleBtn.style.display = 'none';
      }
    },

    bindGlobalEvents() {
      
      document.getElementById("searchTabBtn").addEventListener("click", () => this.switchTab("search"));
      document.getElementById("libraryTabBtn").addEventListener("click", () => this.switchTab("library"));
      document.getElementById("scenePacksTabBtn").addEventListener("click", () => this.switchTab("scenePacks"));
      document.getElementById("upscaleTabBtn").addEventListener("click", () => this.switchTab("upscale"));
      document.getElementById("consoleTabBtn").addEventListener("click", () => this.switchTab("console"));
      document.getElementById("settingsTabBtn").addEventListener("click", () => this.switchTab("settings"));
      document.getElementById("aboutTabBtn").addEventListener("click", () => this.switchTab("about"));

      
      document.getElementById("openSakugabooruBtn").addEventListener("click", () => {
        window.Downloader.openInBrowser("https://www.sakugabooru.com/");
      });

      
      document.addEventListener("click", () => {
        this.libraryPanel.closeAllCardMenus();
      });
    },

    switchTab(tab) {
      const tabs = ["search", "library", "scenePacks", "upscale", "console", "settings", "about"];
      dbg('info', 'Nav', 'Switched to: ' + tab);

      if (this._activeTab && this._activeTab !== tab) {
        this.clearSessionPreviews();
        this.settingsPanel.updateCacheInfo();
      }
      this._activeTab = tab;
      tabs.forEach((t) => {
        const btn = document.getElementById(`${t}TabBtn`);
        const view = document.getElementById(`${t}View`);
        if (btn) btn.classList.remove("active");
        if (view) view.classList.add("hidden");
      });

      const activeBtn = document.getElementById(`${tab}TabBtn`);
      const activeView = document.getElementById(`${tab}View`);
      if (activeBtn) activeBtn.classList.add("active");
      if (activeView) activeView.classList.remove("hidden");

      if (tab === "library") {
        this.libraryPanel.renderLibrary();
      } else if (tab === "scenePacks") {
        this.scenePacksPanel.initScenePacks();
      } else if (tab === "upscale") {
        this.upscalePanel.renderUpscaleQueue();
        this.upscalePanel.renderUpscaleHistory();
        this.upscalePanel.updateUpscaleToolsPanel();
        this.checkUpscaleTools();
      } else if (tab === "console") {
        window.ConsolePanel.active = true;
        window.ConsolePanel.renderLogContent();
      } else {
        window.ConsolePanel.active = false;
      }

      this.searchPanel.updateBulkBar();
      this.libraryPanel.updateLibraryActionBar();
    },

    
    addToLibrary(item) {
      dbg('debug', 'Library', 'Added: ' + (item.filePath || item.id));
      const existing = this.library.find(clip => String(clip.id) === String(item.id) || clip.filePath === item.filePath);
      if (existing) {
        Object.keys(item).forEach((key) => {
          existing[key] = item[key];
        });
      } else {
        this.library.unshift(item);
      }
      window.StorageManager.saveLibrary(this.library);
    },

    isPostDownloaded(postId) {
      return this.library.some(clip => String(clip.id) === String(postId) && clip.filePath && window.FileSystem.fs.existsSync(clip.filePath));
    },

    updateDownloadedBadges() {
      document.querySelectorAll("#searchView .card").forEach((card) => {
        const postId = card.dataset.postId;
        if (!postId || !this.isPostDownloaded(postId)) return;
        if (card.querySelector(".downloaded-badge")) return;

        const badge = document.createElement("div");
        badge.className = "downloaded-badge";
        badge.innerHTML = 'Downloaded <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg>';
        card.appendChild(badge);
      });
    },

    
    importFileToAfterEffects(filePath, callback) {
      if (!window.__adobe_cep__ || !window.__adobe_cep__.evalScript) {
        console.warn("CEP evalScript is not available.");
        if (callback) callback(false);
        return;
      }

      const escapedPath = String(filePath || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      window.__adobe_cep__.evalScript(`importSakugaboruFile("${escapedPath}")`, (result) => {
        console.log("ExtendScript Result:", result);
        if (callback) callback(true);
      });
    },

    
    clearSessionPreviews() {
      if (!window.FileSystem.fs) return;
      try {
        if (!window.FileSystem.fs.existsSync(this.previewCacheFolder)) return;
        const files = window.FileSystem.fs.readdirSync(this.previewCacheFolder);
        var deleted = 0;
        var skipped = 0;
        files.forEach((file) => {
          const fullPath = window.FileSystem.path.join(this.previewCacheFolder, file);
          if (this.currentPlayerItem && this.currentPlayerItem.currentSourcePath) {
            const currentPlaying = window.FileSystem.path.resolve(this.currentPlayerItem.currentSourcePath);
            if (window.FileSystem.path.resolve(fullPath) === currentPlaying) {
              skipped++;
              return;
            }
          }
          try {
            window.FileSystem.fs.unlinkSync(fullPath);
            deleted++;
          } catch (e) {}
        });
        dbg('debug', 'CacheCleaner', 'Cleared ' + deleted + ' files' + (skipped > 0 ? ', skipped ' + skipped + ' in-use' : ''));
      } catch (e) {
        dbg('error', 'CacheCleaner', 'Failed: ' + e.message);
      }
    },

    resetPreviewQueue() {
      this.previewQueue = [];
      this.activePreviewDownloads = 0;
    },

    setupHoverVideo(post, previewArea, videoUrl, card) {
      const postId = String(post.id);
      dbg('debug', 'HoverPreview', 'Setup: post=' + postId);

      const video = document.createElement("video");
      video.className = "hover-video";
      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("preload", "none");
      video.dataset.postId = postId;
      video.dataset.videoUrl = videoUrl;

      previewArea.appendChild(video);

      let hoverTimer = null;

      card.addEventListener("mouseenter", () => {
        hoverTimer = setTimeout(() => {
          this.loadHoverVideo(postId, videoUrl, card);
        }, 300);
      });

      card.addEventListener("mouseleave", () => {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        this.stopHoverVideo(postId, card);
      });
    },

    loadHoverVideo(postId, videoUrl, card) {
      const video = card.querySelector('.hover-video[data-post-id="' + postId + '"]');
      const imgs = card.querySelectorAll('.preview-box img:not(.hover-thumbnail-fallback)');

      if (!video) return;
      if (video.dataset.loading === "true") return;

      dbg('debug', 'HoverPreview', 'Loading: post=' + postId);
      video.dataset.loading = "true";

      const ext = window.FileSystem.getExtension(videoUrl) || 'mp4';
      const cacheName = 'hover_' + postId + '.' + ext;
      const cachePath = window.FileSystem.path.join(this.previewCacheFolder, cacheName);
      const app = this;

      var playLocal = function(localPath) {
        const fileUrl = window.FileSystem.pathToFileUrl(localPath);
        video.preload = "auto";
        video.src = fileUrl;

        var onReady = function() {
          dbg('debug', 'HoverPreview', 'Ready: post=' + postId);
          video.removeEventListener("canplay", onReady);
          video.removeEventListener("error", onFail);
          imgs.forEach(function(img) { img.style.opacity = "0"; });
          video.style.opacity = "1";
          video.play().catch(function() {});
        };

        var onFail = function() {
          dbg('warn', 'HoverPreview', 'Playback failed: post=' + postId);
          video.removeEventListener("canplay", onReady);
          video.removeEventListener("error", onFail);
          video.dataset.loading = "false";
          video.style.opacity = "0";
          imgs.forEach(function(img) { img.style.opacity = "1"; });
        };

        video.addEventListener("canplay", onReady);
        video.addEventListener("error", onFail);
        video.load();
      };

      if (window.FileSystem.fs.existsSync(cachePath) && window.FileSystem.fs.statSync(cachePath).size > 0) {
        dbg('debug', 'HoverPreview', 'Cache hit: post=' + postId);
        playLocal(cachePath);
        return;
      }

      dbg('debug', 'HoverPreview', 'Downloading: post=' + postId);
      window.Downloader.downloadFile(videoUrl, cachePath, function(error) {
        if (error || !window.FileSystem.fs.existsSync(cachePath)) {
          dbg('warn', 'HoverPreview', 'Download failed: post=' + postId);
          video.dataset.loading = "false";
          video.style.opacity = "0";
          imgs.forEach(function(img) { img.style.opacity = "1"; });
          return;
        }
        playLocal(cachePath);
      });
    },

    playHoverVideo(postId, videoUrl, card) {
      
    },

    stopHoverVideo(postId, card) {
      if (!card) return;
      const video = card.querySelector('.hover-video[data-post-id="' + postId + '"]');
      const imgs = card.querySelectorAll('.preview-box img:not(.hover-thumbnail-fallback)');

      if (!video) return;
      if (video.dataset.loading !== "true" && video.style.opacity !== "1") return;

      dbg('debug', 'HoverPreview', 'Stop: post=' + postId);
      video.dataset.loading = "false";

      video.pause();
      video.removeAttribute("src");
      video.load();
      video.preload = "none";

      imgs.forEach(function(img) { img.style.opacity = "1"; });
      video.style.opacity = "0";
    },

    queuePreviewLoad(post, previewUrl, previewArea, card, sessionId) {
      if (!previewUrl) {
        previewArea.textContent = "No preview";
        return;
      }
      const extension = window.FileSystem.getExtension(previewUrl);
      const previewName = `image_preview_${post.id}.${extension}`;
      const previewPath = window.FileSystem.path.join(this.previewCacheFolder, previewName);

      if (window.FileSystem.fs.existsSync(previewPath)) {
        dbg('debug', 'ImagePreview', 'Cache hit: post=' + post.id);
        this.showPreviewImage(previewPath, previewArea);
        return;
      }

      dbg('debug', 'ImagePreview', 'Queue: post=' + post.id);
      this.previewQueue.push({
        post: post,
        previewUrl: previewUrl,
        previewPath: previewPath,
        previewArea: previewArea,
        card: card,
        sessionId: sessionId
      });

      this.processPreviewQueue();
    },

    processPreviewQueue() {
      while (this.activePreviewDownloads < this.maxPreviewDownloadsAtOnce && this.previewQueue.length > 0) {
        const job = this.previewQueue.shift();
        if (job.sessionId !== this.searchSessionId) continue;

        this.activePreviewDownloads++;
        this.downloadPreviewJob(job, () => {
          this.activePreviewDownloads--;
          this.processPreviewQueue();
        });
      }
    },

    downloadPreviewJob(job, done) {
      window.Downloader.downloadFile(job.previewUrl, job.previewPath, (error) => {
        if (job.sessionId !== this.searchSessionId) {
          done();
          return;
        }
        if (error) {
          dbg('warn', 'ImagePreview', 'Failed: post=' + job.post.id);
          job.previewArea.textContent = "Preview blocked";
          done();
          return;
        }
        dbg('debug', 'ImagePreview', 'Loaded: post=' + job.post.id);
        this.showPreviewImage(job.previewPath, job.previewArea);
        done();
      });
    },

    showPreviewImage(filePath, previewArea) {
      this.touchFileDate(filePath);
      this.previewsInUse.add(filePath);

      const loadingBox = previewArea.querySelector(".loading-box");
      const existingImg = previewArea.querySelector("img:not(.hover-thumbnail-fallback)");
      const existingHint = previewArea.querySelector(".double-click-hint");
      const videoEl = previewArea.querySelector(".hover-video");

      if (loadingBox) loadingBox.remove();
      if (existingImg) existingImg.remove();
      if (existingHint) existingHint.remove();

      const img = document.createElement("img");
      img.src = window.FileSystem.pathToFileUrl(filePath);

      const hint = document.createElement("div");
      hint.className = "double-click-hint";
      hint.textContent = "click select • 2x open";

      previewArea.insertBefore(hint, videoEl || null);
      previewArea.insertBefore(img, hint);
    },

    resetPagePreload(clearOld) {
      this.pagePreloadSessionId++;
      this.pagePreloadQueue = [];
      this.activePagePreloadDownloads = 0;
      if (clearOld) {
        this.clearSearchPlayerCacheForOldPage(true);
      }
    },

    clearSearchPlayerCacheForOldPage(preserveInUse) {
      if (!window.FileSystem.fs) return 0;
      try {
        if (!window.FileSystem.fs.existsSync(this.previewCacheFolder)) return 0;
        const files = window.FileSystem.fs.readdirSync(this.previewCacheFolder);
        let deleted = 0;

        files.forEach((file) => {
          const filePath = window.FileSystem.path.join(this.previewCacheFolder, file);
          const name = file.toLowerCase();
          if (!/^player_/.test(name)) return;
          if (!/\.(mp4|webm|mov)$/i.test(name)) return;
          if (preserveInUse && this.previewsInUse.has(filePath)) return;
          if (this.playerDownloadJobs[filePath]) return;

          try {
            window.FileSystem.fs.unlinkSync(filePath);
            deleted++;
          } catch (e) {}
        });

        return deleted;
      } catch (e) {
        return 0;
      }
    },

    startPagePreload(posts, sessionId) {
      if (!Array.isArray(posts) || posts.length === 0) return;
      const preloadSession = ++this.pagePreloadSessionId;
      this.pagePreloadQueue = [];
      this.activePagePreloadDownloads = 0;

      posts.slice(0, this.pagePreloadInitialCount).forEach((post) => {
        const source = this.getFirstVideoPlayerSource(post);
        if (!source) return;

        if (window.FileSystem.fs.existsSync(source.cachePath)) {
          this.touchFileDate(source.cachePath);
          return;
        }

        this.pagePreloadQueue.push({
          post: post,
          url: source.url,
          cachePath: source.cachePath,
          sourceIndex: source.sourceIndex,
          searchSession: sessionId,
          preloadSession: preloadSession
        });
      });

      this.processPagePreloadQueue();
    },

    processPagePreloadQueue() {
      while (this.activePagePreloadDownloads < this.maxPagePreloadDownloadsAtOnce && this.pagePreloadQueue.length > 0) {
        const job = this.pagePreloadQueue.shift();
        if (job.searchSession !== this.searchSessionId || job.preloadSession !== this.pagePreloadSessionId) continue;

        if (window.FileSystem.fs.existsSync(job.cachePath)) {
          this.touchFileDate(job.cachePath);
          continue;
        }

        this.activePagePreloadDownloads++;
        this.downloadPlayerFile(job.post, job.url, job.cachePath, (error) => {
          this.activePagePreloadDownloads--;
          const stillCurrent = job.searchSession === this.searchSessionId && job.preloadSession === this.pagePreloadSessionId;

          if (!stillCurrent) {
            try {
              window.FileSystem.fs.unlinkSync(job.cachePath);
            } catch (e) {}
            this.processPagePreloadQueue();
            return;
          }

          if (!error && window.FileSystem.fs.existsSync(job.cachePath)) {
            this.touchFileDate(job.cachePath);
          }

          this.processPagePreloadQueue();
        });
      }
    },

    getFirstVideoPlayerSource(post) {
      const sources = this.playerOverlay.getPlayerSources(post);
      for (let i = 0; i < sources.length; i++) {
        if (sources[i] && window.Downloader.isVideo(sources[i].url)) {
          return {
            url: sources[i].url,
            sourceIndex: i,
            cachePath: this.playerOverlay.getPlayerCachePath(post, sources[i].url, i)
          };
        }
      }
      return null;
    },

    downloadPlayerFile(post, playerUrl, playerPath, callback, progressCallback) {
      if (window.FileSystem.fs.existsSync(playerPath)) {
        callback(null);
        return;
      }
      if (this.playerDownloadJobs[playerPath]) {
        this.playerDownloadJobs[playerPath].callbacks.push(callback);
        if (progressCallback) this.playerDownloadJobs[playerPath].progressCallbacks.push(progressCallback);
        return;
      }

      this.playerDownloadJobs[playerPath] = {
        callbacks: [callback],
        progressCallbacks: progressCallback ? [progressCallback] : []
      };

      window.Downloader.downloadFileWithProgress(playerUrl, playerPath, (progress) => {
        const job = this.playerDownloadJobs[playerPath];
        if (job) {
          job.progressCallbacks.forEach(cb => cb(progress));
        }
      }, (error) => {
        const job = this.playerDownloadJobs[playerPath] || { callbacks: [], progressCallbacks: [] };
        delete this.playerDownloadJobs[playerPath];
        job.callbacks.forEach(cb => cb(error));
      });
    },

    prefetchSelectedSearchClip(post) {
      if (!post || !post.id) return;
      const priority = [post];
      const idx = this.currentSearchPosts.findIndex(item => item && String(item.id) === String(post.id));

      if (idx >= 0) {
        for (let i = 1; i <= 2; i++) {
          const next = this.currentSearchPosts[idx + i];
          if (next) priority.push(next);
        }
      }
      this.prefetchPlayerPostsPriority(priority);
    },

    prefetchPlayerPostsPriority(posts) {
      if (!Array.isArray(posts) || !posts.length) return;
      const session = ++this.playerPrefetchSessionId;

      posts.slice(0, 3).forEach((post, index) => {
        setTimeout(() => {
          if (session !== this.playerPrefetchSessionId) return;
          const source = this.getFirstVideoPlayerSource(post);
          if (!source) return;

          if (window.FileSystem.fs.existsSync(source.cachePath)) {
            this.touchFileDate(source.cachePath);
            return;
          }

          this.downloadPlayerFile(post, source.url, source.cachePath, () => {
            if (session !== this.playerPrefetchSessionId) return;
          });
        }, index * 180);
      });
    },

    
    touchFileDate(filePath) {
      if (!window.FileSystem.fs) return;
      try {
        const now = new Date();
        window.FileSystem.fs.utimesSync(filePath, now, now);
      } catch (e) {}
    },

    goToPage(newPage) {
      if (newPage < 1) return;
      this.currentPage = newPage;
      if (this.currentSearchMode === "latest") {
        this.searchPanel.loadLatestSakugabooruClips();
      } else {
        this.searchPanel.searchSakugabooru();
      }
    },

    updatePageLabels() {
      const labels = document.querySelectorAll(".page-label, .player-page-label");
      labels.forEach((label) => {
        if (label.classList.contains("player-page-label")) {
          label.textContent = this.currentPlayerItem && this.currentPlayerItem.type === "search" ? "Page " + this.currentPage : "Library";
        } else {
          label.textContent = "Page " + this.currentPage;
        }
      });
    },

    createFavoriteButton(postId) {
      const fav = document.createElement("button");
      fav.className = "favorite-btn";
      fav.dataset.postId = String(postId);
      this.setFavoriteButtonState(fav, postId);
      fav.onclick = (e) => {
        e.stopPropagation();
        this.toggleFavorite(postId);
      };
      return fav;
    },

    setFavoriteButtonState(button, postId) {
      if (!button) return;
      const fav = this.isFavorite(postId);
      button.innerHTML = fav
        ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
      button.title = fav ? "Remove favorite" : "Add favorite";
      button.classList.toggle("is-favorite", fav);
    },

    isFavorite(postId) {
      return !!this.favorites[String(postId)];
    },

    toggleFavorite(postId) {
      const id = String(postId);
      if (this.favorites[id]) {
        delete this.favorites[id];
      } else {
        this.favorites[id] = true;
      }

      window.StorageManager.saveFavorites(this.favorites);
      this.updateFavoriteButtons();

      if (!document.getElementById("libraryView").classList.contains("hidden")) {
        this.libraryPanel.renderLibrary();
      }
    },

    updateFavoriteButtons() {
      document.querySelectorAll(".favorite-btn").forEach((btn) => {
        const id = btn.dataset.postId;
        if (id) this.setFavoriteButtonState(btn, id);
      });
      document.querySelectorAll(".player-header-favorite-btn").forEach((btn) => {
        const id = btn.dataset.postId;
        if (id) this.setFavoriteButtonState(btn, id);
      });
    },

    showCepToast(message, type) {
      dbg(type === 'success' ? 'success' : (type === 'error' ? 'error' : 'info'), 'Toast', message);
      const old = document.querySelector(".sakug-toast");
      if (old) old.remove();

      const toast = document.createElement("div");
      toast.className = "sakug-toast " + (type || "");
      toast.textContent = message;

      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add("show"), 20);
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
          if (toast && toast.parentNode) toast.remove();
        }, 220);
      }, 2300);
    },

    escapeHtml(text) {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    },

    checkUpscaleTools() {
      var tools = this.upscalePanel.findUpscaleTools();
      if (!tools) return;

      var coreFound = tools.ffmpeg && tools.realesrgan;

      if (coreFound) {
        window.StorageManager.setItem('sakugaflow_tools_setup_complete', '1');
        return;
      }

      if (window.ToolsSetup && typeof window.ToolsSetup.checkAndShowIfNeeded === 'function') {
        setTimeout(function () {
          window.ToolsSetup.checkAndShowIfNeeded();
        }, 400);
      }
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    App.init();
    window.App = App;
  });
})();
