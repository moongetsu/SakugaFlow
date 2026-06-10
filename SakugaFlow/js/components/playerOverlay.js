(function () {
  const PlayerOverlay = {
    init(app) {
      this.app = app;

      
      this.overlay = document.getElementById("playerOverlay");
      this.content = document.getElementById("playerContent");
      this.title = document.getElementById("playerTitle");
      this.closeBtn = document.getElementById("playerCloseBtn");

      this.bindEvents();
    },

    bindEvents() {
      if (this.closeBtn) {
        this.closeBtn.addEventListener("click", () => this.close());
      }

      if (this.overlay) {
        this.overlay.addEventListener("click", (e) => {
          if (e.target === this.overlay) {
            this.close();
          }
        });
      }

      
      document.addEventListener("keydown", (event) => {
        if (!this.overlay || this.overlay.classList.contains("hidden")) {
          return;
        }

        if (event.key === "Escape") {
          this.close();
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          this.togglePlay();
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          this.goToItem(1);
          return;
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          this.goToItem(-1);
        }
      });

      window.addEventListener("resize", () => {
        if (this.app.canvasPlayer) {
          this.resizeCanvasPlayer();
        }
      });
    },

    close() {
      this.app.playerAttemptToken++;
      this.clearPlayerHeaderButtons();
      this.destroyCanvasPlayer();
      if (this.content) this.content.innerHTML = "";
      if (this.overlay) this.overlay.classList.add("hidden");
      this.app.playerPlaylist = [];
      this.app.playerPlaylistIndex = -1;
      this.app.currentPlayerItem = null;
      this.app.previewsInUse = new Set();
      this.app.clearSessionPreviews();
      this.app.settingsPanel.updateCacheInfo();
    },

    destroyCanvasPlayer() {
      if (!this.app.canvasPlayer) {
        if (this.content) {
          const old = this.content.querySelectorAll(".canvas-controls");
          old.forEach(c => c.remove());
        }
        return;
      }

      try {
        if (this.app.canvasPlayer.animationId) {
          cancelAnimationFrame(this.app.canvasPlayer.animationId);
        }
      } catch (e) {}

      try {
        this.app.canvasPlayer.video.pause();
        this.app.canvasPlayer.video.removeAttribute("src");
        this.app.canvasPlayer.video.src = "";
        this.app.canvasPlayer.video.load();
      } catch (e) {}

      try {
        if (this.app.canvasPlayer.controls && this.app.canvasPlayer.controls.parentNode) {
          this.app.canvasPlayer.controls.remove();
        }
      } catch (e) {}

      this.app.canvasPlayer = null;

      if (this.content) {
        const old = this.content.querySelectorAll(".canvas-controls");
        old.forEach(c => c.remove());
      }
    },

    openSearchPlayerAt(postId) {
      const idx = this.app.currentSearchPosts.findIndex(p => String(p.id) === String(postId));
      if (idx < 0) return;

      this.app.playerPlaylist = this.app.currentSearchPosts.map(post => ({
        type: "search",
        post: post
      }));
      this.app.playerPlaylistIndex = idx;
      this.openCurrentPlayerItem();
    },

    openLibraryPlayerAt(filePath) {
      const clips = this.app.library.filter(c => c.filePath && window.FileSystem.fs.existsSync(c.filePath));
      const idx = clips.findIndex(c => c.filePath === filePath);
      if (idx < 0) return;

      this.app.playerPlaylist = clips.map(clip => ({
        type: "library",
        clip: clip
      }));
      this.app.playerPlaylistIndex = idx;
      this.openCurrentPlayerItem();
    },

    openCurrentPlayerItem() {
      if (!this.app.playerPlaylist.length || this.app.playerPlaylistIndex < 0) return;

      const item = this.app.playerPlaylist[this.app.playerPlaylistIndex];
      this.app.currentPlayerItem = item;
      this.app.playerAttemptToken++;
      this.app.playerPrefetchSessionId++;

      this.destroyCanvasPlayer();

      if (item.type === "search") {
        this.openPostPlayerLocal(item.post, 0, this.app.playerAttemptToken);
      } else if (item.type === "library") {
        this.openLibraryPlayer(item.clip);
      } else if (item.type === "scenePack") {
        this.openScenePackPlayer(item.clip);
      }
    },

    goToItem(direction) {
      if (!this.app.playerPlaylist.length || this.app.isLoadingPlayerPage) return;

      const newIdx = this.app.playerPlaylistIndex + direction;

      if (this.app.currentPlayerItem && this.app.currentPlayerItem.type === "search") {
        if (newIdx >= this.app.playerPlaylist.length) {
          this.loadSearchPageForPlayer(this.app.currentPage + 1, "first");
          return;
        }
        if (newIdx < 0) {
          this.loadSearchPageForPlayer(this.app.currentPage - 1, "last");
          return;
        }
      }

      this.app.playerPlaylistIndex = newIdx;
      if (this.app.playerPlaylistIndex < 0) {
        this.app.playerPlaylistIndex = this.app.playerPlaylist.length - 1;
      }
      if (this.app.playerPlaylistIndex >= this.app.playerPlaylist.length) {
        this.app.playerPlaylistIndex = 0;
      }
      this.openCurrentPlayerItem();
    },

    loadSearchPageForPlayer(newPage, openPosition) {
      if (this.app.isLoadingPlayerPage) return;
      if (newPage < 1) {
        this.showTemporaryPlayerMessage("Already on first page.");
        return;
      }
      if (!this.app.currentSearchTags && this.app.currentSearchMode !== "latest") {
        this.showTemporaryPlayerMessage("No active search.");
        return;
      }

      this.app.isLoadingPlayerPage = true;
      this.showTemporaryPlayerMessage(`Loading page ${newPage}...`);

      const requestId = ++this.app.playerPageRequestId;
      const url = this.app.currentSearchMode === "latest"
        ? `${this.app.sakugabooruBaseUrl}/post.json?limit=${this.app.resultsPerPage}&page=${newPage}`
        : `${this.app.sakugabooruBaseUrl}/post.json?limit=${this.app.resultsPerPage}&page=${newPage}&tags=${encodeURIComponent(this.app.currentSearchTags)}`;

      window.Downloader.getJson(url, (error, posts) => {
        if (requestId !== this.app.playerPageRequestId) return;
        this.app.isLoadingPlayerPage = false;

        if (error || !Array.isArray(posts) || posts.length === 0) {
          this.showTemporaryPlayerMessage("No clips on that page.");
          return;
        }

        this.app.currentPage = newPage;
        this.app.lastResultHadMorePosts = posts.length >= this.app.resultsPerPage;

        this.app.searchPanel.renderSearchPosts(posts, this.app.currentSearchTags, this.app.searchSessionId);
        this.app.updatePageLabels();

        this.app.playerPlaylist = posts.map(post => ({
          type: "search",
          post: post
        }));

        if (openPosition === "last") {
          this.app.playerPlaylistIndex = this.app.playerPlaylist.length - 1;
        } else {
          this.app.playerPlaylistIndex = 0;
        }

        this.openCurrentPlayerItem();
      }, this.app.searchTimeoutMs);
    },

    openPostPlayerLocal(post, sourceIndex, token) {
      const sources = this.getPlayerSources(post);
      if (!sources.length) {
        this.showPlayerFatalError(post, "This post has no playable file.", sourceIndex);
        return;
      }
      if (sourceIndex >= sources.length) {
        this.showPlayerFatalError(post, "This clip could not be played inside CEP.", sourceIndex);
        return;
      }

      const source = sources[sourceIndex];
      const title = "Post " + post.id;
      const playerPath = this.getPlayerCachePath(post, source.url, sourceIndex);

      this.app.playerPrefetchSessionId++;
      this.destroyCanvasPlayer();

      this.content.innerHTML = "";
      this.title.textContent = title;
      this.syncPlayerHeaderButtons(post);

      this.content.appendChild(this.createPlayerPageControls());

      const mediaWrap = document.createElement("div");
      mediaWrap.className = "player-media-wrap";

      const loading = document.createElement("div");
      loading.className = "player-loading-text";
      loading.textContent = window.FileSystem.fs.existsSync(playerPath)
        ? "Opening canvas player..."
        : "Downloading temporary video...";

      mediaWrap.appendChild(loading);
      this.content.appendChild(mediaWrap);
      this.content.appendChild(this.createPlayerBottomControls());
      this.overlay.classList.remove("hidden");

      setTimeout(() => this.prefetchNeighborPlayerFiles(), 120);

      if (window.FileSystem.fs.existsSync(playerPath)) {
        this.app.previewsInUse.add(playerPath);
        this.setPlayerLoadingMessage(loading, "Opening canvas player...");
        this.showPlayerMediaFile(post, playerPath, mediaWrap, loading, sourceIndex, token);
        setTimeout(() => this.prefetchNeighborPlayerFiles(), 300);
        return;
      }

      const loadingTicker = this.startPlayerLoadingTicker(loading, "Downloading video");

      this.app.downloadPlayerFile(post, source.url, playerPath, (error) => {
        this.stopPlayerLoadingTicker(loadingTicker);
        if (!this.isSamePlayerAttempt(post, token)) return;

        if (error) {
          this.setPlayerLoadingMessage(loading, "Trying another source...");
          this.tryNextPlayerSource(post, sourceIndex, token, playerPath);
          return;
        }

        this.app.previewsInUse.add(playerPath);
        this.setPlayerLoadingMessage(loading, "Opening canvas player...");
        this.showPlayerMediaFile(post, playerPath, mediaWrap, loading, sourceIndex, token);
        setTimeout(() => this.prefetchNeighborPlayerFiles(), 300);
        this.app.settingsPanel.updateCacheInfo();
      }, (progress) => {
        if (!this.isSamePlayerAttempt(post, token)) return;
        if (progress && progress.percent >= 0) {
          this.setPlayerLoadingMessage(loading, `Downloading video... ${Math.min(99, Math.floor(progress.percent))}%`);
        }
      });
    },

    openLibraryPlayer(clip) {
      this.app.playerAttemptToken++;
      this.destroyCanvasPlayer();

      this.content.innerHTML = "";
      this.title.textContent = "Library clip";
      this.syncPlayerHeaderButtons(clip);

      this.content.appendChild(this.createPlayerPageControls());

      const mediaWrap = document.createElement("div");
      mediaWrap.className = "player-media-wrap";

      const loading = document.createElement("div");
      loading.className = "player-loading-text";
      loading.textContent = "Opening canvas player...";
      mediaWrap.appendChild(loading);

      this.content.appendChild(mediaWrap);
      this.content.appendChild(this.createPlayerBottomControls());
      this.overlay.classList.remove("hidden");

      if (!window.Downloader.isVideo(clip.filePath)) {
        mediaWrap.innerHTML = "";
        const img = document.createElement("img");
        img.src = window.FileSystem.pathToFileUrl(clip.filePath);
        img.className = "player-media";
        mediaWrap.appendChild(img);
        this.applyPlayerFitMode();
        return;
      }

      this.startCanvasVideoPlayer(clip.filePath, mediaWrap, () => {
        this.showSequenceError(mediaWrap, "Could not open this clip in canvas player.");
      });
    },

    openScenePackPlayer(clip) {
      this.app.playerAttemptToken++;
      this.destroyCanvasPlayer();

      this.content.innerHTML = "";
      this.title.textContent = clip.name;
      this.clearPlayerHeaderButtons();

      this.content.appendChild(this.createPlayerPageControls());

      const mediaWrap = document.createElement("div");
      mediaWrap.className = "player-media-wrap";

      const loading = document.createElement("div");
      loading.className = "player-loading-text";
      loading.textContent = "Opening canvas player...";
      mediaWrap.appendChild(loading);

      this.content.appendChild(mediaWrap);
      this.content.appendChild(this.createPlayerBottomControls());
      this.overlay.classList.remove("hidden");

      if (!window.Downloader.isVideo(clip.filePath)) {
        mediaWrap.innerHTML = "";
        const img = document.createElement("img");
        img.src = window.FileSystem.pathToFileUrl(clip.filePath);
        img.className = "player-media";
        mediaWrap.appendChild(img);
        this.applyPlayerFitMode();
        return;
      }

      this.startCanvasVideoPlayer(clip.filePath, mediaWrap, () => {
        this.showSequenceError(mediaWrap, "Could not open this clip in canvas player.");
      });
    },

    getPlayerSources(post) {
      const sources = [];
      const used = {};
      const add = (url, label) => {
        url = window.Downloader.fixUrl(url || "");
        if (!url || used[url]) return;
        used[url] = true;
        sources.push({ url: url, label: label || "file" });
      };

      if (post.sample_url && window.Downloader.isVideo(post.sample_url)) {
        add(post.sample_url, "sample");
      }
      if (post.file_url && window.Downloader.isVideo(post.file_url)) {
        add(post.file_url, "file");
      }
      if (post.file_url && !window.Downloader.isVideo(post.file_url)) {
        add(post.file_url, "image");
      }
      if (post.sample_url && !window.Downloader.isVideo(post.sample_url)) {
        add(post.sample_url, "sample-image");
      }
      if (post.preview_url) {
        add(post.preview_url, "preview");
      }

      return sources;
    },

    getPlayerCachePath(post, playerUrl, sourceIndex) {
      const extension = window.FileSystem.getExtension(playerUrl);
      return window.FileSystem.path.join(this.app.previewCacheFolder, `player_${post.id}_${sourceIndex}.${extension}`);
    },

    tryNextPlayerSource(post, sourceIndex, token, badPath) {
      if (badPath && window.FileSystem.fs) {
        try {
          window.FileSystem.fs.unlinkSync(badPath);
        } catch (e) {}
      }
      if (!this.isSamePlayerAttempt(post, token)) return;

      const nextIndex = sourceIndex + 1;
      const sources = this.getPlayerSources(post);

      if (nextIndex < sources.length) {
        this.openPostPlayerLocal(post, nextIndex, token);
      } else {
        this.showPlayerFatalError(post, "Could not play this clip inside CEP.", nextIndex);
      }
    },

    showPlayerFatalError(post, message, sourceIndex) {
      this.destroyCanvasPlayer();
      this.content.innerHTML = "";
      this.title.textContent = "Post " + post.id;
      this.syncPlayerHeaderButtons(post);

      this.content.appendChild(this.createPlayerPageControls());

      const mediaWrap = document.createElement("div");
      mediaWrap.className = "player-media-wrap";

      const box = document.createElement("div");
      box.className = "player-error-box";

      const text = document.createElement("div");
      text.textContent = message || "Could not play this clip.";

      const buttons = document.createElement("div");
      buttons.className = "player-error-buttons";

      const tryAgain = document.createElement("button");
      tryAgain.className = "player-mini-btn";
      tryAgain.textContent = "Try Again";
      tryAgain.onclick = (e) => {
        e.stopPropagation();
        this.clearPostPlayerCache(post);
        this.app.playerAttemptToken++;
        this.openPostPlayerLocal(post, 0, this.app.playerAttemptToken);
      };

      const openUrl = document.createElement("button");
      openUrl.className = "player-mini-btn";
      openUrl.textContent = "Open in Browser";
      openUrl.onclick = (e) => {
        e.stopPropagation();
        window.Downloader.openInBrowser(`${this.app.sakugabooruBaseUrl}/post/show/${post.id}`);
      };

      buttons.appendChild(tryAgain);
      buttons.appendChild(openUrl);
      box.appendChild(text);
      box.appendChild(buttons);
      mediaWrap.appendChild(box);
      this.content.appendChild(mediaWrap);
      this.content.appendChild(this.createPlayerBottomControls());
      this.overlay.classList.remove("hidden");
    },

    clearPostPlayerCache(post) {
      const sources = this.getPlayerSources(post);
      sources.forEach((source, index) => {
        const cachePath = this.getPlayerCachePath(post, source.url, index);
        if (window.FileSystem.fs) {
          try {
            if (window.FileSystem.fs.existsSync(cachePath)) {
              window.FileSystem.fs.unlinkSync(cachePath);
            }
          } catch (e) {}
        }
      });
    },

    isSamePlayerAttempt(post, token) {
      if (token !== this.app.playerAttemptToken) return false;
      if (!this.app.currentPlayerItem || this.app.currentPlayerItem.type !== "search") return false;
      return String(this.app.currentPlayerItem.post.id) === String(post.id);
    },

    showTemporaryPlayerMessage(message) {
      const old = this.content.querySelector(".player-page-message");
      if (old) old.remove();

      const box = document.createElement("div");
      box.className = "player-page-message";
      box.textContent = message;
      this.content.appendChild(box);

      setTimeout(() => {
        if (box && box.parentNode) box.remove();
      }, 1300);
    },

    setPlayerLoadingMessage(element, message) {
      if (element && element.parentNode) {
        element.textContent = message;
      }
    },

    startPlayerLoadingTicker(element, baseMessage) {
      if (!element) return null;
      let dots = 0;
      element.textContent = baseMessage + "...";
      return setInterval(() => {
        if (!element || !element.parentNode) return;
        dots = (dots + 1) % 4;
        element.textContent = baseMessage + ".".repeat(dots || 3);
      }, 420);
    },

    stopPlayerLoadingTicker(timer) {
      if (timer) clearInterval(timer);
    },

    showPlayerMediaFile(post, filePath, mediaWrap, loadingText, sourceIndex, token) {
      if (!this.isSamePlayerAttempt(post, token)) return;
      mediaWrap.innerHTML = "";

      if (!window.Downloader.isVideo(filePath)) {
        const img = document.createElement("img");
        img.src = window.FileSystem.pathToFileUrl(filePath);
        img.className = "player-media";
        mediaWrap.appendChild(img);
        this.applyPlayerFitMode();
        return;
      }

      this.startCanvasVideoPlayer(filePath, mediaWrap, () => {
        if (!this.isSamePlayerAttempt(post, token)) return;
        this.setPlayerLoadingMessage(loadingText, "Trying alternative stream...");
        this.tryNextPlayerSource(post, sourceIndex, token, filePath);
      });
    },

    startCanvasVideoPlayer(filePath, mediaWrap, errorCallback) {
      const canvas = document.createElement("canvas");
      canvas.className = "player-media player-canvas";

      const video = document.createElement("video");
      video.src = window.FileSystem.pathToFileUrl(filePath);
      video.preload = "auto";
      video.autoplay = false;
      video.loop = true;
      video.muted = this.app.playerFitMode === "muted"; 

      const ctx = canvas.getContext("2d");
      
      this.app.canvasPlayer = {
        video: video,
        canvas: canvas,
        ctx: ctx,
        filePath: filePath,
        started: false,
        animationId: null,
        controls: null
      };

      const fail = (err) => {
        console.error("CanvasPlayer init failed:", err);
        this.destroyCanvasPlayer();
        errorCallback();
      };

      const ready = () => {
        if (!this.app.canvasPlayer || this.app.canvasPlayer.filePath !== filePath) return;
        if (this.app.canvasPlayer.started) return;

        this.app.canvasPlayer.started = true;
        mediaWrap.innerHTML = "";
        mediaWrap.appendChild(canvas);

        const controls = this.createCanvasControls(video);
        this.app.canvasPlayer.controls = controls;
        this.app.canvasPlayer.playButton = controls.querySelector(".canvas-play-btn");
        this.app.canvasPlayer.muteButton = controls.querySelector(".canvas-mute-btn");
        this.app.canvasPlayer.volumeSlider = controls.querySelector(".canvas-volume-slider");
        this.app.canvasPlayer.timeLabel = controls.querySelector(".canvas-time");
        this.app.canvasPlayer.progress = controls.querySelector(".canvas-progress");
        this.content.appendChild(controls);

        this.resizeCanvasPlayer();
        this.drawCanvasFrame();

        
        try {
          const promise = video.play();
          if (promise && promise.catch) {
            promise.catch(() => {
              try {
                video.muted = true;
                this.updateCanvasControls();
                video.play().catch(() => {});
              } catch (e) {}
            });
          }
        } catch (e) {}

        this.drawCanvasLoop();
      };

      video.addEventListener("loadedmetadata", () => {
        this.resizeCanvasPlayer();
        this.updateCanvasControls();
      });

      video.addEventListener("canplay", ready);
      video.addEventListener("loadeddata", ready);
      video.addEventListener("error", () => fail("Video source load failed"));

      const timer = setTimeout(() => {
        if (this.app.canvasPlayer && this.app.canvasPlayer.filePath === filePath && !this.app.canvasPlayer.started) {
          fail("Canvas player timeout");
        }
      }, this.app.playerLoadTimeoutMs);

      const oldReady = ready;
      video.addEventListener("canplay", () => clearTimeout(timer));
      video.addEventListener("loadeddata", () => clearTimeout(timer));
    },

    createCanvasControls(video) {
      const controls = document.createElement("div");
      controls.className = "canvas-controls";

      const playButton = document.createElement("button");
      playButton.className = "canvas-btn canvas-play-btn";
      playButton.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      playButton.title = "Play / Pause (Space)";

      const time = document.createElement("div");
      time.className = "canvas-time";
      time.textContent = "0:00 / 0:00";

      const progress = document.createElement("input");
      progress.className = "canvas-progress";
      progress.type = "range";
      progress.min = "0";
      progress.max = "1000";
      progress.value = "0";
      progress.step = "1";

      const volumeContainer = document.createElement("div");
      volumeContainer.className = "canvas-volume-container";

      const volumePopup = document.createElement("div");
      volumePopup.className = "canvas-volume-popup";

      const volumeSlider = document.createElement("input");
      volumeSlider.className = "canvas-volume-slider";
      volumeSlider.type = "range";
      volumeSlider.min = "0";
      volumeSlider.max = "100";
      volumeSlider.value = video.muted ? "0" : String(Math.round(video.volume * 100));
      volumeSlider.step = "1";
      volumeSlider.title = "Volume";

      volumeSlider.addEventListener("input", (e) => {
        e.stopPropagation();
        const vol = parseFloat(volumeSlider.value) / 100;
        video.volume = vol;
        if (vol > 0) {
          video.muted = false;
        }
        muteButton.innerHTML = this.getVolumeIcon(vol, video.muted);
      });

      volumePopup.appendChild(volumeSlider);

      const muteButton = document.createElement("button");
      muteButton.className = "canvas-btn canvas-mute-btn";
      muteButton.innerHTML = video.muted ? this.getVolumeIcon(0, true) : this.getVolumeIcon(video.volume, video.muted);
      muteButton.title = "Mute / Unmute";

      muteButton.onclick = (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        muteButton.innerHTML = video.muted ? this.getVolumeIcon(0, true) : this.getVolumeIcon(video.volume, video.muted);
        if (!video.muted) {
          volumeSlider.value = String(Math.round(video.volume * 100));
        }
      };

      volumeContainer.appendChild(volumePopup);
      volumeContainer.appendChild(muteButton);

      playButton.onclick = (e) => {
        e.stopPropagation();
        this.togglePlay();
      };

      progress.addEventListener("input", (e) => {
        e.stopPropagation();
        if (!video.duration || isNaN(video.duration)) return;
        const ratio = parseFloat(progress.value) / 1000;
        video.currentTime = ratio * video.duration;
        this.updateCanvasControls();
        this.drawCanvasFrame();
      });

      controls.appendChild(playButton);
      controls.appendChild(time);
      controls.appendChild(progress);
      controls.appendChild(volumeContainer);

      return controls;
    },

    drawCanvasLoop() {
      if (!this.app.canvasPlayer) return;
      if (this.app.canvasPlayer.animationId) {
        cancelAnimationFrame(this.app.canvasPlayer.animationId);
      }
      const frame = () => {
        if (!this.app.canvasPlayer) return;
        this.drawCanvasFrame();
        this.updateCanvasControls();
        this.app.canvasPlayer.animationId = requestAnimationFrame(frame);
      };
      this.app.canvasPlayer.animationId = requestAnimationFrame(frame);
    },

    drawCanvasFrame() {
      if (!this.app.canvasPlayer) return;
      const video = this.app.canvasPlayer.video;
      const canvas = this.app.canvasPlayer.canvas;
      const ctx = this.app.canvasPlayer.ctx;

      if (!video || !canvas || !ctx || !video.videoWidth || !video.videoHeight) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.max(1, Math.floor(rect.width * dpr));
      const targetHeight = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const videoRatio = video.videoWidth / video.videoHeight;
      const canvasRatio = canvas.width / canvas.height;

      let dw, dh, dx, dy;
      if (this.app.playerFitMode === "fill") {
        if (videoRatio > canvasRatio) {
          dh = canvas.height;
          dw = dh * videoRatio;
        } else {
          dw = canvas.width;
          dh = dw / videoRatio;
        }
      } else {
        if (videoRatio > canvasRatio) {
          dw = canvas.width;
          dh = dw / videoRatio;
        } else {
          dh = canvas.height;
          dw = dh * videoRatio;
        }
      }

      dx = (canvas.width - dw) / 2;
      dy = (canvas.height - dh) / 2;

      try {
        ctx.drawImage(video, dx, dy, dw, dh);
      } catch (e) {}
    },

    resizeCanvasPlayer() {
      this.drawCanvasFrame();
    },

    togglePlay() {
      if (!this.app.canvasPlayer || !this.app.canvasPlayer.video) return;
      const video = this.app.canvasPlayer.video;
      if (video.paused) {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
        this.drawCanvasLoop();
      } else {
        video.pause();
      }
    },

    updateCanvasControls() {
      if (!this.app.canvasPlayer || !this.app.canvasPlayer.video) return;
      const video = this.app.canvasPlayer.video;
      const dur = video.duration || 0;
      const cur = video.currentTime || 0;

      if (this.app.canvasPlayer.timeLabel) {
        this.app.canvasPlayer.timeLabel.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)}`;
      }
      if (this.app.canvasPlayer.progress) {
        if (dur && !isNaN(dur)) {
          this.app.canvasPlayer.progress.value = String(Math.round((cur / dur) * 1000));
        } else {
          this.app.canvasPlayer.progress.value = "0";
        }
      }
      if (this.app.canvasPlayer.playButton) {
        this.app.canvasPlayer.playButton.innerHTML = video.paused
          ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
          : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      }
      if (this.app.canvasPlayer.muteButton) {
        this.app.canvasPlayer.muteButton.innerHTML = video.muted ? this.getVolumeIcon(0, true) : this.getVolumeIcon(video.volume, video.muted);
      }
      if (this.app.canvasPlayer.volumeSlider && !video.muted) {
        const volVal = Math.round(video.volume * 100);
        if (this.app.canvasPlayer.volumeSlider.value !== String(volVal)) {
          this.app.canvasPlayer.volumeSlider.value = String(volVal);
        }
      }
    },

    formatTime(seconds) {
      if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
      const total = Math.floor(seconds);
      const minutes = Math.floor(total / 60);
      const secs = total % 60;
      return `${minutes}:${String(secs).padStart(2, "0")}`;
    },

    getVolumeIcon(volume, muted) {
      if (muted || volume <= 0) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
      }
      if (volume <= 0.33) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>';
      }
      if (volume <= 0.66) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    },

    applyPlayerFitMode() {
      
    },

    showSequenceError(mediaWrap, message) {
      this.destroyCanvasPlayer();
      mediaWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "player-error-box";
      box.textContent = message;
      mediaWrap.appendChild(box);
    },

    syncPlayerHeaderButtons(post) {
      this.clearPlayerHeaderButtons();
      this.title.style.flex = "0 1 auto";
      this.title.style.marginRight = "6px";

      const favorite = document.createElement("button");
      favorite.className = "player-header-action-btn player-header-favorite-btn";
      favorite.dataset.postId = String(post.id || "");
      this.app.setFavoriteButtonState(favorite, post.id);
      favorite.onclick = (e) => {
        e.stopPropagation();
        this.app.toggleFavorite(post.id);
      };

      const closeContainer = this.closeBtn.parentNode;
      if (closeContainer) {
        closeContainer.insertBefore(favorite, this.closeBtn);
      }
    },

    clearPlayerHeaderButtons() {
      this.title.style.flex = "";
      this.title.style.marginRight = "";
      const old = this.overlay.querySelectorAll(".player-header-favorite-btn");
      old.forEach(btn => btn.remove());
    },

    createPlayerPageControls() {
      const row = document.createElement("div");
      row.className = "player-page-row";

      if (this.app.currentPlayerItem && this.app.currentPlayerItem.type === "search") {
        const prevPage = document.createElement("button");
        prevPage.className = "player-page-nav-btn";
        prevPage.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:4px;"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>Previous Page';
        prevPage.disabled = this.app.currentPage <= 1;
        prevPage.onclick = (e) => {
          e.stopPropagation();
          this.goToPlayerPage(-1);
        };

        const pageLabel = document.createElement("span");
        pageLabel.className = "player-page-label";
        pageLabel.textContent = "Page " + this.app.currentPage;

        const nextPage = document.createElement("button");
        nextPage.className = "player-page-nav-btn";
        nextPage.innerHTML = 'Next Page<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-left:4px;"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>';
        nextPage.disabled = !this.app.lastResultHadMorePosts;
        nextPage.onclick = (e) => {
          e.stopPropagation();
          this.goToPlayerPage(1);
        };

        row.appendChild(prevPage);
        row.appendChild(pageLabel);
        row.appendChild(nextPage);
      } else {
        const label = document.createElement("span");
        label.className = "player-page-label";
        label.textContent = "Library";
        row.appendChild(label);
      }

      return row;
    },

    goToPlayerPage(direction) {
      if (!this.app.currentPlayerItem || this.app.currentPlayerItem.type !== "search") return;
      if (direction > 0) {
        this.loadSearchPageForPlayer(this.app.currentPage + 1, "first");
      } else {
        this.loadSearchPageForPlayer(this.app.currentPage - 1, "last");
      }
    },

    createPlayerBottomControls() {
      const controls = document.createElement("div");
      controls.className = "player-bottom-controls";

      const previous = document.createElement("button");
      previous.className = "player-nav-btn";
      previous.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:3px;"><polyline points="15 18 9 12 15 6"/></svg>Prev';
      previous.disabled = !this.app.playerPlaylist.length || (this.app.playerPlaylist.length <= 1 && this.app.currentPlayerItem.type !== "search");
      previous.onclick = (e) => {
        e.stopPropagation();
        this.goToItem(-1);
      };

      const center = document.createElement("div");
      center.className = "player-nav-center";

      const counter = document.createElement("div");
      counter.className = "player-counter";
      counter.textContent = this.app.playerPlaylist.length
        ? `${this.app.playerPlaylistIndex + 1} / ${this.app.playerPlaylist.length}`
        : "1 / 1";

      const actionRow = document.createElement("div");
      actionRow.className = "player-action-row compact-action-row";

      if (this.app.currentPlayerItem && this.app.currentPlayerItem.type === "search") {
        const post = this.app.currentPlayerItem.post;

        const downloadButton = document.createElement("button");
        downloadButton.className = "player-download-btn";
        downloadButton.innerHTML = this.app.isPostDownloaded(post.id)
          ? 'Downloaded <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:3px;"><polyline points="20 6 9 17 4 12"/></svg>'
          : 'Download';
        downloadButton.onclick = (e) => {
          e.stopPropagation();
          this.downloadCurrentPlayerItem(downloadButton, false);
        };

        const downloadImportButton = document.createElement("button");
        downloadImportButton.className = "player-download-import-btn";
        downloadImportButton.textContent = "Download + Import";
        downloadImportButton.onclick = (e) => {
          e.stopPropagation();
          this.downloadCurrentPlayerItem(downloadImportButton, true);
        };

        actionRow.appendChild(downloadButton);
        actionRow.appendChild(downloadImportButton);
      } else if (this.app.currentPlayerItem && this.app.currentPlayerItem.type === "library") {
        const clip = this.app.currentPlayerItem.clip;

        const folderButton = document.createElement("button");
        folderButton.className = "player-download-btn";
        folderButton.textContent = "Open Folder";
        folderButton.onclick = (e) => {
          e.stopPropagation();
          window.Downloader.openFolderAndSelect(clip.filePath);
        };

        const importButton = document.createElement("button");
        importButton.className = "player-download-import-btn";
        importButton.textContent = "Import";
        importButton.onclick = (e) => {
          e.stopPropagation();
          this.app.importFileToAfterEffects(clip.filePath, () => {
            importButton.innerHTML = 'Imported <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:3px;"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(() => {
              importButton.textContent = "Import";
            }, 1200);
          });
        };

        actionRow.appendChild(folderButton);
        actionRow.appendChild(importButton);
      }

      center.appendChild(counter);
      center.appendChild(actionRow);

      const next = document.createElement("button");
      next.className = "player-nav-btn";
      next.innerHTML = 'Next<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-left:3px;"><polyline points="9 18 15 12 9 6"/></svg>';
      next.disabled = !this.app.playerPlaylist.length || (this.app.playerPlaylist.length <= 1 && this.app.currentPlayerItem.type !== "search");
      next.onclick = (e) => {
        e.stopPropagation();
        this.goToItem(1);
      };

      controls.appendChild(previous);
      controls.appendChild(center);
      controls.appendChild(next);

      return controls;
    },

    downloadCurrentPlayerItem(downloadButton, shouldImport) {
      if (!this.app.currentPlayerItem || this.app.currentPlayerItem.type !== "search") return;
      const post = this.app.currentPlayerItem.post;
      const item = {
        id: post.id,
        tags: post.tags || "",
        fileUrl: window.Downloader.fixUrl(post.file_url || post.sample_url || post.preview_url),
        postUrl: `${this.app.sakugabooruBaseUrl}/post/show/${post.id}`
      };

      const finalPath = window.FileSystem.path.join(
        this.app.downloadFolder,
        "sakugaflow_" + item.id + "." + window.FileSystem.getExtension(item.fileUrl)
      );

      if (window.FileSystem.fs && window.FileSystem.fs.existsSync(finalPath)) {
        downloadButton.textContent = shouldImport ? "Importing..." : "Already Downloaded";
        if (shouldImport) {
          this.app.importFileToAfterEffects(finalPath, () => {
            downloadButton.innerHTML = 'Imported <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:3px;"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(() => {
              downloadButton.textContent = "Download + Import";
            }, 1200);
          });
        } else {
          setTimeout(() => {
            downloadButton.textContent = "Download";
          }, 1200);
        }
        return;
      }

      downloadButton.disabled = true;
      downloadButton.textContent = "Downloading...";

      this.app.searchPanel.downloadSinglePost(item, (success, savedPath) => {
        downloadButton.disabled = false;
        if (!success) {
          downloadButton.textContent = "Download failed";
          setTimeout(() => {
            downloadButton.textContent = shouldImport ? "Download + Import" : "Download";
          }, 1400);
          return;
        }

        this.app.updateDownloadedBadges();

        if (shouldImport) {
          downloadButton.textContent = "Importing...";
          this.app.importFileToAfterEffects(savedPath, () => {
            downloadButton.innerHTML = 'Imported <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:3px;"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(() => {
              downloadButton.textContent = "Download + Import";
            }, 1200);
          });
        } else {
          downloadButton.innerHTML = 'Downloaded <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:3px;"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            downloadButton.textContent = "Download";
          }, 1200);
        }
      });
    },

    prefetchNeighborPlayerFiles() {
      if (!this.app.playerPlaylist.length || this.app.playerPlaylistIndex < 0) return;
      const session = ++this.app.playerPrefetchSessionId;
      const priority = [];

      for (let i = 1; i <= this.app.playerPrefetchAheadCount; i++) {
        const index = this.app.playerPlaylistIndex + i;
        if (index >= 0 && index < this.app.playerPlaylist.length) {
          const item = this.app.playerPlaylist[index];
          if (item && item.type === "search" && item.post) {
            priority.push(item.post);
          }
        }
      }

      priority.slice(0, 3).forEach((post, index) => {
        setTimeout(() => {
          if (session !== this.app.playerPrefetchSessionId) return;
          this.prefetchSinglePlayerPost(post, session);
        }, index * 180);
      });

      
      const canPreloadNextPage =
        this.app.currentPlayerItem &&
        this.app.currentPlayerItem.type === "search" &&
        (this.app.currentSearchMode === "latest" || !!this.app.currentSearchTags);

      if (canPreloadNextPage) {
        const remaining = this.app.playerPlaylist.length - 1 - this.app.playerPlaylistIndex;
        if (remaining <= 3 && this.app.lastResultHadMorePosts) {
          this.prefetchNextSearchPageFirstClips(session);
        }
      }
    },

    prefetchSinglePlayerPost(post, session) {
      const source = this.app.getFirstVideoPlayerSource(post);
      if (!source) return;

      if (window.FileSystem.fs && window.FileSystem.fs.existsSync(source.cachePath)) {
        this.app.touchFileDate(source.cachePath);
        return;
      }

      this.app.downloadPlayerFile(post, source.url, source.cachePath, () => {
        if (session !== this.app.playerPrefetchSessionId) return;
      });
    },

    prefetchNextSearchPageFirstClips(session) {
      if (this.app.prefetchNextSearchPageFirstClipsRunning) return;
      this.app.prefetchNextSearchPageFirstClipsRunning = true;

      const nextPage = this.app.currentPage + 1;
      const url = this.app.currentSearchMode === "latest"
        ? `${this.app.sakugabooruBaseUrl}/post.json?limit=${this.app.resultsPerPage}&page=${nextPage}`
        : `${this.app.sakugabooruBaseUrl}/post.json?limit=${this.app.resultsPerPage}&page=${nextPage}&tags=${encodeURIComponent(this.app.currentSearchTags)}`;

      window.Downloader.getJson(url, (error, posts) => {
        this.app.prefetchNextSearchPageFirstClipsRunning = false;
        if (session !== this.app.playerPrefetchSessionId || error || !Array.isArray(posts) || !posts.length) return;

        posts.slice(0, 3).forEach((post, index) => {
          setTimeout(() => {
            if (session !== this.app.playerPrefetchSessionId) return;
            this.prefetchSinglePlayerPost(post, session);
          }, index * 180);
        });
      }, 12000);
    }
  };

  window.PlayerOverlay = PlayerOverlay;
})();
