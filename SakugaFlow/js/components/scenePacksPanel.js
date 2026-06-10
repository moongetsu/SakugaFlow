(function () {
  const ScenePacksPanel = {
    init(app) {
      this.app = app;

      
      this.view = document.getElementById("scenePacksView");
      this.status = document.getElementById("scenePacksStatus");
      this.chooseBtn = document.getElementById("chooseScenePackBtn");
      this.folderDropdown = null;

      this.bindEvents();
    },

    bindEvents() {
      if (this.chooseBtn) {
        this.chooseBtn.addEventListener("click", () => this.chooseScenePackFolder());
      }
    },

    updateScenePackDropdown() {
      const container = document.getElementById("scenePackFolderSelect");
      if (!container) return;

      const items = [];
      if (!this.app.scenePackFolders || this.app.scenePackFolders.length === 0) {
        items.push({ value: "", label: "No folders added yet..." });
      } else {
        this.app.scenePackFolders.forEach((folder) => {
          const basename = window.FileSystem.path ? window.FileSystem.path.basename(folder) : folder;
          items.push({ value: folder, label: `${basename} (${folder})` });
        });
      }

      this.folderDropdown = window.Dropdown.create(container, {
        items: items,
        selected: this.app.currentScenePackFolder || "",
        onChange: (selected) => {
          if (selected) {
            this.app.currentScenePackFolder = selected;
            window.StorageManager.setItem("sakugaflow_current_scene_pack_folder", selected);
            this.app.scenePackPage = 1;
            this.loadScenePackClips();
          }
        }
      });
    },

    initScenePacks() {
      this.updateScenePackDropdown();
      if (this.app.currentScenePackFolder) {
        this.loadScenePackClips();
      } else if (this.app.scenePackFolders && this.app.scenePackFolders.length > 0) {
        this.app.currentScenePackFolder = this.app.scenePackFolders[0];
        window.StorageManager.setItem("sakugaflow_current_scene_pack_folder", this.app.currentScenePackFolder);
        this.updateScenePackDropdown();
        this.loadScenePackClips();
      } else {
        if (this.status) {
          this.status.innerHTML = '<div class="top-info">Select a Scene Pack folder to begin browsing your downloaded clips.</div>';
        }
      }
    },

    chooseScenePackFolder() {
      let selected = "";
      if (process.platform === "win32") {
        selected = window.FileSystem.chooseFolderWithSystemExplorer(
          "Choose a scene pack folder",
          this.app.currentScenePackFolder || (window.FileSystem.os ? window.FileSystem.os.homedir() : "")
        );
      }
      if (!selected) return;

      if (this.app.scenePackFolders.indexOf(selected) < 0) {
        this.app.scenePackFolders.push(selected);
        window.StorageManager.saveScenePackFolders(this.app.scenePackFolders);
      }

      this.app.currentScenePackFolder = selected;
      window.StorageManager.setItem("sakugaflow_current_scene_pack_folder", selected);
      this.app.scenePackPage = 1;
      this.initScenePacks();
    },

    loadScenePackClips() {
      if (!this.app.currentScenePackFolder) return;
      if (!this.status) return;

      this.status.innerHTML = '<div class="top-info loading">Reading folder files...</div>';

      window.FileSystem.fs.readdir(this.app.currentScenePackFolder, (err, files) => {
        if (err) {
          this.status.innerHTML = '<div class="top-info error">Failed to read folder: ' + err.message + '</div>';
          return;
        }

        const folders = [];
        const videos = [];

        files.forEach((file) => {
          try {
            const fullPath = window.FileSystem.path.join(this.app.currentScenePackFolder, file);
            const stat = window.FileSystem.fs.statSync(fullPath);

            if (stat.isDirectory()) {
              folders.push({
                name: file,
                filePath: fullPath,
                isFolder: true
              });
            } else {
              const ext = window.FileSystem.path.extname(file).toLowerCase();
              const videoExtensions = [".mp4", ".mov", ".webm", ".avi", ".mkv"];
              if (videoExtensions.indexOf(ext) >= 0) {
                videos.push({
                  name: file,
                  filePath: fullPath,
                  isFolder: false,
                  isLocal: true
                });
              }
            }
          } catch (e) {}
        });

        
        folders.sort((a, b) => a.name.localeCompare(b.name));
        videos.sort((a, b) => a.name.localeCompare(b.name));

        
        const isSubFolder = this.app.scenePackFolders.indexOf(this.app.currentScenePackFolder) < 0;
        const itemsList = [];

        if (isSubFolder) {
          itemsList.push({
            name: ".. (Go Back)",
            filePath: window.FileSystem.path.dirname(this.app.currentScenePackFolder),
            isFolder: true,
            isGoBack: true
          });
        }

        this.app.scenePackClipsList = itemsList.concat(folders).concat(videos);
        this.renderScenePackClips();
      });
    },

    renderScenePackClips() {
      if (!this.status) return;
      this.status.innerHTML = "";

      if (this.app.scenePackClipsList.length === 0) {
        this.status.innerHTML = '<div class="top-info">No folders or video files found in this directory.</div>';
        return;
      }

      const itemsPerPage = this.app.resultsPerPage || 24;
      const startIndex = (this.app.scenePackPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, this.app.scenePackClipsList.length);
      const totalPages = Math.ceil(this.app.scenePackClipsList.length / itemsPerPage);

      const pageItems = this.app.scenePackClipsList.slice(startIndex, endIndex);

      const infoRow = document.createElement("div");
      infoRow.className = "top-info";
      infoRow.style.display = "flex";
      infoRow.style.justifyContent = "space-between";
      infoRow.style.alignItems = "center";
      
      const basename = window.FileSystem.path ? window.FileSystem.path.basename(this.app.currentScenePackFolder) : this.app.currentScenePackFolder;
      
      const labelText = document.createElement("span");
      labelText.innerHTML = `Active folder: <b>${basename}</b> (${this.app.scenePackClipsList.length} items)`;
      infoRow.appendChild(labelText);

      
      if (this.app.scenePackFolders.indexOf(this.app.currentScenePackFolder) >= 0) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "setting-btn danger-btn";
        removeBtn.style.height = "22px";
        removeBtn.style.lineHeight = "20px";
        removeBtn.style.padding = "0 8px";
        removeBtn.style.fontSize = "9px";
        removeBtn.textContent = "Remove root folder";
        removeBtn.onclick = () => {
          this.app.scenePackFolders = this.app.scenePackFolders.filter(f => f !== this.app.currentScenePackFolder);
          window.StorageManager.saveScenePackFolders(this.app.scenePackFolders);
          this.app.currentScenePackFolder = this.app.scenePackFolders[0] || "";
          window.StorageManager.setItem("sakugaflow_current_scene_pack_folder", this.app.currentScenePackFolder);
          this.initScenePacks();
        };
        infoRow.appendChild(removeBtn);
      }

      this.status.appendChild(infoRow);

      const grid = document.createElement("div");
      grid.className = "grid";

      pageItems.forEach((clip) => {
        const card = document.createElement("div");
        card.className = "card";

        const previewBox = document.createElement("div");
        previewBox.className = "preview-box";

        if (clip.isFolder) {
          const fallback = document.createElement("div");
          fallback.className = "library-video-fallback";
          fallback.style.background = "linear-gradient(180deg, #2a1f10, #151005)";

          const icon = document.createElement("div");
          icon.className = "library-video-icon";
          icon.style.borderColor = "#ffb02e";
          icon.style.color = "#ffb02e";
          icon.style.paddingLeft = "0px";
          icon.innerHTML = '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

          const text = document.createElement("div");
          text.className = "library-video-text";
          text.style.color = "#ffc870";
          text.style.textAlign = "center";
          text.style.width = "90%";
          text.style.overflow = "hidden";
          text.style.textOverflow = "ellipsis";
          text.style.whiteSpace = "nowrap";
          text.textContent = clip.isGoBack ? "Parent Directory" : clip.name;

          fallback.appendChild(icon);
          fallback.appendChild(text);
          previewBox.appendChild(fallback);

          const doubleClickHint = document.createElement("div");
          doubleClickHint.className = "double-click-hint";
          doubleClickHint.style.right = "auto";
          doubleClickHint.style.bottom = "12px";
          doubleClickHint.style.left = "50%";
          doubleClickHint.style.transform = "translateX(-50%)";
          doubleClickHint.textContent = "Double click to open";
          previewBox.appendChild(doubleClickHint);

          previewBox.ondblclick = () => {
            this.app.currentScenePackFolder = clip.filePath;
            this.app.scenePackPage = 1;
            this.loadScenePackClips();
          };
        } else {
          
          window.LibraryPanel.showLocalMedia(clip.filePath, previewBox);

          
          this.setupLocalHoverVideo(clip.filePath, previewBox, card);

          previewBox.ondblclick = () => {
            this.playLocalVideoInOverlay(clip);
          };
        }

        card.appendChild(previewBox);

        const body = document.createElement("div");
        body.className = "card-body";

        const title = document.createElement("div");
        title.className = "card-path";
        title.textContent = clip.isFolder ? (clip.isGoBack ? "Parent Directory" : "Folder") : clip.name;
        title.title = clip.name;
        body.appendChild(title);

        const actions = document.createElement("div");
        actions.className = "card-actions";

        if (clip.isFolder) {
          const openBtn = document.createElement("button");
          openBtn.className = "btn-post";
          openBtn.style.flex = "1";
          openBtn.textContent = "Open";
          openBtn.onclick = () => {
            this.app.currentScenePackFolder = clip.filePath;
            this.app.scenePackPage = 1;
            this.loadScenePackClips();
          };
          actions.appendChild(openBtn);
        } else {
          const importBtn = document.createElement("button");
          importBtn.className = "btn-post";
          importBtn.style.flex = "1";
          importBtn.textContent = "Import";
          importBtn.onclick = () => {
            importBtn.disabled = true;
            importBtn.textContent = "Importing...";
            this.app.importFileToAfterEffects(clip.filePath, (success) => {
              importBtn.disabled = false;
              importBtn.innerHTML = success
                ? 'Imported <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:3px;"><polyline points="20 6 9 17 4 12"/></svg>'
                : 'Import';
              if (success) {
                setTimeout(() => {
                  importBtn.textContent = "Import";
                }, 1200);
              }
            });
          };
          actions.appendChild(importBtn);
        }

        body.appendChild(actions);
        card.appendChild(body);
        grid.appendChild(card);
      });

      this.status.appendChild(grid);

      if (totalPages > 1) {
        const pagination = document.createElement("div");
        pagination.className = "pagination";

        const prevBtn = document.createElement("button");
        prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:3px;"><polyline points="15 18 9 12 15 6"/></svg>Previous';
        prevBtn.disabled = this.app.scenePackPage === 1;
        prevBtn.onclick = () => {
          if (this.app.scenePackPage > 1) {
            this.app.scenePackPage--;
            this.renderScenePackClips();
          }
        };

        const label = document.createElement("div");
        label.className = "page-label";
        label.textContent = "Page " + this.app.scenePackPage + " / " + totalPages;

        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = 'Next<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-left:3px;"><polyline points="9 18 15 12 9 6"/></svg>';
        nextBtn.disabled = this.app.scenePackPage === totalPages;
        nextBtn.onclick = () => {
          if (this.app.scenePackPage < totalPages) {
            this.app.scenePackPage++;
            this.renderScenePackClips();
          }
        };

        pagination.appendChild(prevBtn);
        pagination.appendChild(label);
        pagination.appendChild(nextBtn);
        this.status.appendChild(pagination);
      }
    },

        setupLocalHoverVideo(filePath, previewArea, card) {
      let video = null;
      let hoverTimer = null;

      card.addEventListener("mouseenter", () => {
        dbg('debug', 'ScenePackHover', 'Mouse entered card for path: ' + filePath);
        hoverTimer = setTimeout(() => {
          dbg('debug', 'ScenePackHover', 'Hover timer triggered. Loading video: ' + filePath);
          
                    video = document.createElement("video");
          video.className = "hover-video";
          video.muted = !this.app.hoverAudioEnabled || this.app.hoverVolume <= 0;
          video.volume = this.app.hoverVolume / 100;
          video.loop = true;
          video.playsInline = true;
          video.preload = "auto";
          
          const onReady = () => {
            dbg('debug', 'ScenePackHover', 'Video is ready to play (canplay triggered)');
            video.removeEventListener("canplay", onReady);
            card.classList.add("hover-playing");
            video.play()
              .then(() => {
                dbg('debug', 'ScenePackHover', 'Playback started successfully.');
              })
              .catch((err) => dbg('error', 'ScenePackHover', 'Playback failed: ' + err.message));
          };

          video.addEventListener("canplay", onReady);
          video.src = window.FileSystem.pathToFileUrl(filePath);
          previewArea.appendChild(video);
          video.load();
        }, 300);
      });

      card.addEventListener("mouseleave", () => {
        dbg('debug', 'ScenePackHover', 'Mouse left card.');
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
    },

    playLocalVideoInOverlay(clip) {
      const videoFilesOnly = this.app.scenePackClipsList.filter(item => !item.isFolder);

      this.app.playerPlaylist = videoFilesOnly.map(item => ({
        id: item.name,
        file_url: window.FileSystem.pathToFileUrl(item.filePath),
        tags: item.name,
        isLocal: true,
        title: item.name,
        type: "scenePack",
        clip: item
      }));

      this.app.playerPlaylistIndex = videoFilesOnly.findIndex(item => item.filePath === clip.filePath);

      this.app.playerOverlay.openCurrentPlayerItem();
    }
  };

  window.ScenePacksPanel = ScenePacksPanel;
})();
