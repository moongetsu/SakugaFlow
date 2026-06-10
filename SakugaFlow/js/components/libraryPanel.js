(function () {
  const LibraryPanel = {
    init(app) {
      this.app = app;

      
      this.view = document.getElementById("libraryView");
      this.status = document.getElementById("libraryStatus");
      
      this.actionBar = document.getElementById("libraryActionBar");
      this.actionInfo = document.getElementById("libraryActionInfo");
      this.importSelectedBtn = document.getElementById("importSelectedBtn");
      this.sendSelectedToUpscaleBtn = document.getElementById("sendSelectedToUpscaleBtn");

      this.bindEvents();
    },

    bindEvents() {
      if (this.importSelectedBtn) {
        this.importSelectedBtn.addEventListener("click", () => this.importSelectedLibraryClips());
      }

      if (this.sendSelectedToUpscaleBtn) {
        this.sendSelectedToUpscaleBtn.addEventListener("click", () => this.sendSelectedLibraryClipsToUpscale());
      }
    },

    renderLibrary() {
      if (!this.status) return;
      this.status.innerHTML = "";

      this.removeMissingLibraryFiles();

      const favoriteCount = this.app.library.filter(clip => this.app.isFavorite(clip.id)).length;
      const upscaledCount = this.app.library.filter(clip => clip.type === "upscaled").length;

      const info = document.createElement("div");
      info.className = "top-info";
      info.innerHTML = `<span>Library</span><span>${this.app.library.length} downloaded clips | ${favoriteCount} favorites | ${upscaledCount} upscaled</span>`;
      this.status.appendChild(info);

      const tools = document.createElement("div");
      tools.className = "library-tools";

      const filterTabs = document.createElement("div");
      filterTabs.className = "library-filter-tabs";

      const allButton = document.createElement("button");
      allButton.className = "library-filter-btn" + (this.app.currentLibraryMode === "all" ? " active" : "");
      allButton.textContent = "All";
      allButton.onclick = () => {
        this.app.currentLibraryMode = "all";
        window.StorageManager.setItem("sakugaboru_library_mode", "all");
        this.renderLibrary();
      };

      const favoritesButton = document.createElement("button");
      favoritesButton.className = "library-filter-btn" + (this.app.currentLibraryMode === "favorites" ? " active" : "");
      favoritesButton.textContent = "Favorites";
      favoritesButton.onclick = () => {
        this.app.currentLibraryMode = "favorites";
        window.StorageManager.setItem("sakugaboru_library_mode", "favorites");
        this.renderLibrary();
      };

      const upscaledButton = document.createElement("button");
      upscaledButton.className = "library-filter-btn" + (this.app.currentLibraryMode === "upscaled" ? " active" : "");
      upscaledButton.textContent = "Upscaled";
      upscaledButton.onclick = () => {
        this.app.currentLibraryMode = "upscaled";
        window.StorageManager.setItem("sakugaboru_library_mode", "upscaled");
        this.renderLibrary();
      };

      const clearMissing = document.createElement("button");
      clearMissing.className = "small-btn";
      clearMissing.textContent = "Clean Missing";
      clearMissing.onclick = () => {
        this.removeMissingLibraryFiles();
        this.renderLibrary();
      };

      filterTabs.appendChild(allButton);
      filterTabs.appendChild(favoritesButton);
      filterTabs.appendChild(upscaledButton);
      tools.appendChild(filterTabs);
      tools.appendChild(clearMissing);
      this.status.appendChild(tools);

      if (this.app.library.length === 0) {
        const empty = document.createElement("div");
        empty.className = "top-info";
        empty.textContent = "No downloaded clips yet. Select clips in Search and download them.";
        this.status.appendChild(empty);
        return;
      }

      const filtered = this.app.library.filter((clip) => {
        if (this.app.currentLibraryMode === "all" && clip.type === "upscaled") return false;
        if (this.app.currentLibraryMode === "favorites" && !this.app.isFavorite(clip.id)) return false;
        if (this.app.currentLibraryMode === "favorites" && clip.type === "upscaled") return false;
        if (this.app.currentLibraryMode === "upscaled" && clip.type !== "upscaled") return false;
        return true;
      });

      if (filtered.length === 0) {
        const emptyFilter = document.createElement("div");
        emptyFilter.className = "top-info";
        if (this.app.currentLibraryMode === "favorites") {
          emptyFilter.textContent = "No favorite clips found.";
        } else if (this.app.currentLibraryMode === "upscaled") {
          emptyFilter.textContent = "No upscaled clips yet.";
        } else {
          emptyFilter.textContent = "No clips found.";
        }
        this.status.appendChild(emptyFilter);
        return;
      }

      const grid = document.createElement("div");
      grid.className = "grid";
      this.status.appendChild(grid);

      filtered.forEach((clip) => {
        const card = this.createLibraryCard(clip);
        grid.appendChild(card);
      });
    },

    removeMissingLibraryFiles() {
      if (!window.FileSystem.fs) return;
      const before = this.app.library.length;
      this.app.library = this.app.library.filter(clip => clip.filePath && window.FileSystem.fs.existsSync(clip.filePath));
      if (this.app.library.length !== before) {
        window.StorageManager.saveLibrary(this.app.library);
      }
      Object.keys(this.app.selectedLibraryClips).forEach((filePath) => {
        if (!window.FileSystem.fs.existsSync(filePath)) {
          delete this.app.selectedLibraryClips[filePath];
        }
      });
    },

    createLibraryCard(clip) {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.postId = String(clip.id);

      if (this.app.selectedLibraryClips[clip.filePath]) {
        card.classList.add("selected");
      }

      const favoriteButton = this.app.createFavoriteButton(clip.id);
      favoriteButton.classList.add("library-favorite-btn");

      const selectCircle = document.createElement("div");
      selectCircle.className = "select-circle";
      selectCircle.title = "Select library clip";
      selectCircle.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
      selectCircle.onclick = (event) => {
        event.stopPropagation();
        this.toggleLibraryClipSelection(clip, card);
      };

      const menuButton = document.createElement("button");
      menuButton.className = "card-menu-button";
      menuButton.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
      menuButton.title = "More options";

      const menu = document.createElement("div");
      menu.className = "card-menu hidden";

      const addToUpscaleButton = document.createElement("button");
      addToUpscaleButton.className = "card-menu-item";
      addToUpscaleButton.textContent = "Add to Upscale";
      addToUpscaleButton.onclick = (event) => {
        event.stopPropagation();
        this.closeAllCardMenus();
        this.app.upscalePanel.addClipToUpscaleQueue(clip, "library");
        this.app.switchTab("upscale");
      };

      const removeButton = document.createElement("button");
      removeButton.className = "card-menu-item";
      removeButton.textContent = "Remove from Library";
      removeButton.onclick = (event) => {
        event.stopPropagation();
        this.closeAllCardMenus();
        this.removeFromLibrary(clip.filePath);
      };

      const deleteFileButton = document.createElement("button");
      deleteFileButton.className = "card-menu-item delete";
      deleteFileButton.textContent = "Delete File from PC";
      deleteFileButton.onclick = (event) => {
        event.stopPropagation();
        this.closeAllCardMenus();
        this.deleteLibraryClipFromPc(clip);
      };

      menu.appendChild(addToUpscaleButton);
      menu.appendChild(removeButton);
      menu.appendChild(deleteFileButton);

      menuButton.onclick = (event) => {
        event.stopPropagation();
        this.closeAllCardMenus();
        menu.classList.toggle("hidden");
      };

      const previewArea = document.createElement("div");
      previewArea.className = "preview-box";

      let clickTimer = null;
      previewArea.addEventListener("click", (event) => {
        event.stopPropagation();
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        clickTimer = setTimeout(() => {
          this.app.playerOverlay.openLibraryPlayerAt(clip.filePath);
          clickTimer = null;
        }, 260);
      });

      previewArea.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        this.app.showCepToast("Importing to AE...", "info");
        this.app.importFileToAfterEffects(clip.filePath, (imported) => {
          if (imported) {
            this.app.showCepToast("Imported successfully!", "success");
          } else {
            this.app.showCepToast("Import failed.", "error");
          }
        });
      });

      const body = document.createElement("div");
      body.className = "card-body";

      const tags = document.createElement("div");
      tags.className = "card-tags";
      tags.textContent = clip.tags || "";

      const filePath = document.createElement("div");
      filePath.className = "card-path";
      filePath.textContent = clip.filePath;
      filePath.title = clip.filePath;

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const folderButton = document.createElement("button");
      folderButton.className = "btn-post";
      folderButton.textContent = "Folder";
      folderButton.onclick = () => {
        window.Downloader.openFolderAndSelect(clip.filePath);
      };

      const importButton = document.createElement("button");
      importButton.className = "btn-post";
      importButton.textContent = "Import";
      importButton.onclick = () => {
        this.app.importFileToAfterEffects(clip.filePath, () => {
          importButton.innerHTML = 'Imported <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:3px;"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            importButton.textContent = "Import";
          }, 1200);
        });
      };

      actions.appendChild(folderButton);
      actions.appendChild(importButton);

      body.appendChild(tags);
      body.appendChild(filePath);
      body.appendChild(actions);

      card.appendChild(menuButton);
      card.appendChild(menu);
      card.appendChild(favoriteButton);
      card.appendChild(selectCircle);
      card.appendChild(previewArea);
      card.appendChild(body);

      this.showLocalMedia(clip.filePath, previewArea);
      this.setupLocalHoverVideo(clip.filePath, previewArea, card);

      return card;
    },

    toggleLibraryClipSelection(clip, card) {
      if (this.app.selectedLibraryClips[clip.filePath]) {
        delete this.app.selectedLibraryClips[clip.filePath];
        card.classList.remove("selected");
      } else {
        this.app.selectedLibraryClips[clip.filePath] = clip;
        card.classList.add("selected");
      }
      this.updateLibraryActionBar();
    },

    updateLibraryActionBar() {
      const visible = !this.view.classList.contains("hidden");
      const selectedPaths = Object.keys(this.app.selectedLibraryClips).filter(p => window.FileSystem.fs.existsSync(p));

      if (!visible || selectedPaths.length === 0) {
        this.actionBar.classList.add("hidden");
        this.actionInfo.textContent = "No clip selected";
        return;
      }

      this.actionBar.classList.remove("hidden");
      if (selectedPaths.length === 1) {
        this.actionInfo.textContent = "1 library clip selected";
        this.importSelectedBtn.textContent = "Import to Timeline";
      } else {
        this.actionInfo.textContent = selectedPaths.length + " library clips selected";
        this.importSelectedBtn.textContent = "Import Selected";
      }
    },

    importSelectedLibraryClips() {
      const clips = Object.keys(this.app.selectedLibraryClips)
        .map(p => this.app.selectedLibraryClips[p])
        .filter(c => c && c.filePath && window.FileSystem.fs.existsSync(c.filePath));

      if (clips.length === 0) {
        this.updateLibraryActionBar();
        return;
      }

      this.importSelectedBtn.disabled = true;
      this.importSelectedBtn.textContent = "Importing...";

      this.importLibraryClipsSequentially(clips, 0, 0, () => {
        this.importSelectedBtn.disabled = false;
        this.updateLibraryActionBar();
      });
    },

    importLibraryClipsSequentially(clips, index, importedCount, done) {
      if (index >= clips.length) {
        done(importedCount);
        return;
      }

      const clip = clips[index];
      this.actionInfo.textContent = `Importing ${index + 1} / ${clips.length}...`;

      this.app.importFileToAfterEffects(clip.filePath, () => {
        this.importLibraryClipsSequentially(clips, index + 1, importedCount + 1, done);
      });
    },

    sendSelectedLibraryClipsToUpscale() {
      const clips = Object.keys(this.app.selectedLibraryClips)
        .map(p => this.app.selectedLibraryClips[p])
        .filter(c => c && c.filePath && window.FileSystem.fs.existsSync(c.filePath));

      if (!clips.length) {
        this.app.upscalePanel.updateUpscaleStatus("No selected clips to send.", 0);
        return;
      }

      let added = 0;
      clips.forEach((clip) => {
        if (this.app.upscalePanel.addClipToUpscaleQueue(clip, "library", false)) {
          added++;
        }
      });

      this.app.selectedLibraryClips = {};
      this.renderLibrary();
      this.updateLibraryActionBar();
      this.app.switchTab("upscale");
      this.app.upscalePanel.updateUpscaleStatus(`${added} selected clip(s) sent to Upscale.`, 0);
    },

    removeFromLibrary(filePath) {
      const normTarget = this.normalizeLibraryPath(filePath);
      this.app.library = this.app.library.filter(clip => this.normalizeLibraryPath(clip.filePath) !== normTarget);

      Object.keys(this.app.selectedLibraryClips).forEach((p) => {
        if (this.normalizeLibraryPath(p) === normTarget) {
          delete this.app.selectedLibraryClips[p];
        }
      });

      window.StorageManager.saveLibrary(this.app.library);
      this.renderLibrary();
      this.updateLibraryActionBar();
    },

    normalizeLibraryPath(value) {
      if (!window.FileSystem.path) return String(value || "").toLowerCase();
      try {
        return window.FileSystem.path.normalize(String(value || "")).toLowerCase();
      } catch (e) {
        return String(value || "").toLowerCase();
      }
    },

    deleteLibraryClipFromPc(clip) {
      if (!clip || !clip.filePath || !window.FileSystem.fs) {
        this.app.showCepToast("Could not delete: invalid clip.", "error");
        return;
      }
      const filePath = window.FileSystem.path.normalize(clip.filePath);

      try {
        if (this.app.currentPlayerItem && this.app.currentPlayerItem.type === "library") {
          const curPath = this.app.currentPlayerItem.clip && this.app.currentPlayerItem.clip.filePath;
          if (curPath && window.FileSystem.path.normalize(curPath) === filePath) {
            this.app.playerOverlay.close();
          }
        }

        if (!window.FileSystem.fs.existsSync(filePath)) {
          this.removeFromLibrary(clip.filePath);
          this.app.showCepToast("File was not found. Removed from Library.", "warning");
          return;
        }

        try {
          window.FileSystem.fs.unlinkSync(filePath);
        } catch (firstError) {
          if (process.platform === "win32") {
            try {
              window.FileSystem.childProcess.execSync('cmd /c del /f /q "' + filePath.replace(/"/g, '\"') + '"', { windowsHide: true });
            } catch (cmdError) {
              throw firstError;
            }
          } else {
            throw firstError;
          }
        }

        if (window.FileSystem.fs.existsSync(filePath)) {
          throw new Error("Windows did not allow deleting this file.");
        }

        this.removeFromLibrary(clip.filePath);
        this.app.showCepToast("File deleted from PC.", "success");
      } catch (e) {
        console.error("Could not delete file from PC:", e.message);
        this.removeFromLibrary(clip.filePath);
        this.app.showCepToast("Removed from Library. Windows blocked deleting file from PC.", "warning");
      }
    },

    showLocalMedia(filePath, previewArea) {
      this.app.touchFileDate(filePath);
      previewArea.innerHTML = "";

      const doubleClickHint = document.createElement("div");
      doubleClickHint.className = "double-click-hint";
      doubleClickHint.textContent = "click select • 2x open";

      if (!window.Downloader.isVideo(filePath)) {
        const img = document.createElement("img");
        img.src = window.FileSystem.pathToFileUrl(filePath);
        previewArea.appendChild(img);
        previewArea.appendChild(doubleClickHint);
        return;
      }

      const thumbPath = this.getLibraryThumbnailPath(filePath);

      if (window.FileSystem.fs.existsSync(thumbPath)) {
        this.app.touchFileDate(thumbPath);
        const img = document.createElement("img");
        img.src = window.FileSystem.pathToFileUrl(thumbPath);
        previewArea.appendChild(img);
        previewArea.appendChild(doubleClickHint);
        return;
      }

      const loading = document.createElement("div");
      loading.className = "loading-box";
      loading.textContent = "Generating thumbnail...";
      previewArea.appendChild(loading);

      this.generateVideoThumbnail(filePath, thumbPath, (success) => {
        previewArea.innerHTML = "";
        if (success && window.FileSystem.fs.existsSync(thumbPath)) {
          const img = document.createElement("img");
          img.src = window.FileSystem.pathToFileUrl(thumbPath);
          previewArea.appendChild(img);
          previewArea.appendChild(doubleClickHint);

          this.app.settingsPanel.updateCacheInfo();
          return;
        }

        const fallback = document.createElement("div");
        fallback.className = "library-video-fallback";
        fallback.innerHTML = '<div class="library-video-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div><div class="library-video-text">Video clip</div>';
        previewArea.appendChild(fallback);
        previewArea.appendChild(doubleClickHint);
      });
    },

    getLibraryThumbnailPath(filePath) {
      const key = this.getFileStatKey(filePath);
      const safe = String(filePath || "")
        .replace(/\\/g, "_")
        .replace(/\//g, "_")
        .replace(/:/g, "_")
        .replace(/\*/g, "_")
        .replace(/\?/g, "_")
        .replace(/"/g, "_")
        .replace(/</g, "_")
        .replace(/>/g, "_")
        .replace(/\|/g, "_")
        .slice(-140);
      return window.FileSystem.path.join(this.app.previewCacheFolder, `library_thumb_${safe}_${key}.jpg`);
    },

    getFileStatKey(filePath) {
      if (!window.FileSystem.fs) return "unknown";
      try {
        const stat = window.FileSystem.fs.statSync(filePath);
        return String(stat.size) + "_" + String(Math.floor(stat.mtime.getTime()));
      } catch (e) {
        return "unknown";
      }
    },

    generateVideoThumbnail(filePath, thumbPath, callback) {
      if (!window.FileSystem.fs) return callback(false);
      let finished = false;

      const done = (success) => {
        if (finished) return;
        finished = true;
        callback(success);
      };

      try {
        window.FileSystem.createFolder(window.FileSystem.path.dirname(thumbPath));

        const video = document.createElement("video");
        video.src = window.FileSystem.pathToFileUrl(filePath);
        video.controls = false;
        video.muted = true;
        video.preload = "metadata";
        video.playsInline = true;
        video.setAttribute("playsinline", "playsinline");
        video.setAttribute("webkit-playsinline", "webkit-playsinline");

        video.style.position = "fixed";
        video.style.left = "-99999px";
        video.style.top = "-99999px";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0";
        video.style.pointerEvents = "none";
        video.style.zIndex = "-1";

        document.body.appendChild(video);

        const timeout = setTimeout(() => {
          cleanup();
          done(false);
        }, 7000);

        const cleanup = () => {
          clearTimeout(timeout);
          try {
            video.pause();
            video.removeAttribute("src");
            video.load();
          } catch (e) {}
          try {
            if (video.parentNode) video.parentNode.removeChild(video);
          } catch (e) {}
        };

        const captureFrame = () => {
          try {
            if (!video.videoWidth || !video.videoHeight) {
              cleanup();
              done(false);
              return;
            }

            const maxWidth = 480;
            const ratio = video.videoWidth / video.videoHeight;
            const canvas = document.createElement("canvas");
            canvas.width = maxWidth;
            canvas.height = Math.max(1, Math.round(maxWidth / ratio));

            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#050505";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
            const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

            window.FileSystem.fs.writeFileSync(thumbPath, base64, "base64");
            cleanup();
            done(true);
          } catch (e) {
            console.error("Thumbnail capture error:", e.message);
            cleanup();
            done(false);
          }
        };

        video.addEventListener("loadedmetadata", () => {
          try {
            const seekTime = video.duration && video.duration > 1 ? 0.15 : 0.01;
            video.currentTime = seekTime;
          } catch (e) {
            captureFrame();
          }
        });

        video.addEventListener("seeked", () => {
          captureFrame();
        });

        video.addEventListener("loadeddata", () => {
          if (!video.duration || video.duration <= 1) {
            captureFrame();
          }
        });

        video.addEventListener("error", () => {
          cleanup();
          done(false);
        });

        video.load();
      } catch (e) {
        console.error("Thumbnail generator setup error:", e.message);
        done(false);
      }
    },

    closeAllCardMenus() {
      const menus = document.querySelectorAll(".card-menu");
      menus.forEach(m => m.classList.add("hidden"));
    },

        setupLocalHoverVideo(filePath, previewArea, card) {
       if (!window.Downloader.isVideo(filePath)) return;

      let video = null;
      let hoverTimer = null;

      card.addEventListener("mouseenter", () => {
        dbg('debug', 'LibraryHover', 'Mouse entered card for path: ' + filePath);
        hoverTimer = setTimeout(() => {
          dbg('debug', 'LibraryHover', 'Hover timer triggered. Loading video: ' + filePath);
          
                    video = document.createElement("video");
          video.className = "hover-video";
          video.muted = !this.app.hoverAudioEnabled || this.app.hoverVolume <= 0;
          video.volume = this.app.hoverVolume / 100;
          video.loop = true;
          video.playsInline = true;
          video.preload = "auto";
          
          const onReady = () => {
            dbg('debug', 'LibraryHover', 'Video is ready to play (canplay triggered)');
            video.removeEventListener("canplay", onReady);
            card.classList.add("hover-playing");
            video.play()
              .then(() => {
                dbg('debug', 'LibraryHover', 'Playback started successfully.');
              })
              .catch((err) => dbg('error', 'LibraryHover', 'Playback failed: ' + err.message));
          };

          video.addEventListener("canplay", onReady);
          video.src = window.FileSystem.pathToFileUrl(filePath);
          previewArea.appendChild(video);
          video.load();
        }, 300);
      });

       card.addEventListener("mouseleave", () => {
         dbg('debug', 'LibraryHover', 'Mouse left card.');
         if (hoverTimer) {
           clearTimeout(hoverTimer);
           hoverTimer = null;
         }
         card.classList.remove("hover-playing");
         
                           if (video) {
           video.muted = true;
           video.pause();
           video.removeAttribute("src");
           video.load();
          if (video.parentNode) {
            video.parentNode.removeChild(video);
          }
           video = null;
         }
       });
     }
  };

  window.LibraryPanel = LibraryPanel;
})();
