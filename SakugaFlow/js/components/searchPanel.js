(function () {
  const SearchPanel = {
    init(app) {
      this.app = app;

      
      this.input = document.getElementById("search");
      this.button = document.getElementById("btn");
      this.status = document.getElementById("status");
      this.suggestionsBox = document.getElementById("suggestions");
      
      this.saveSearchTagBar = document.getElementById("saveSearchTagBar");
      this.saveSearchTagBtn = document.getElementById("saveSearchTagBtn");
      this.saveSearchTagText = document.getElementById("saveSearchTagText");
      this.clearSearchResultsBtn = document.getElementById("clearSearchResultsBtn");
      this.savedSearchTagsBox = document.getElementById("savedSearchTagsBox");
      this.savedSearchTagsList = document.getElementById("savedSearchTagsList");
      this.latestClipsBar = document.getElementById("latestClipsBar");
      this.latestClipsBtn = document.getElementById("latestClipsBtn");
      this.toggleSavedTagsBtn = document.getElementById("toggleSavedTagsBtn");

      
      this.orderDropdown = null;
      this.ratingDropdown = null;

      this.initDropdowns();

      
      this.bulkBar = document.getElementById("bulkBar");
      this.bulkInfo = document.getElementById("bulkInfo");
      this.clearSelectionBtn = document.getElementById("clearSelectionBtn");
      this.downloadSelectedBtn = document.getElementById("downloadSelectedBtn");

      
      this.currentSuggestions = [];
      this.selectedSuggestionIndex = -1;
      this.autocompleteTimer = null;
      this.autocompleteRequestId = 0;
      this.searchDebounceTimer = null;

      
      this.bindEvents();
      this.showSavedTagsHome();
    },

    initDropdowns() {
      this.orderDropdown = window.Dropdown.create(
        document.getElementById("searchOrderDropdown"),
        {
          items: [
            { value: "date", label: "Date (Newest)" },
            { value: "score", label: "Score" },
            { value: "favcount", label: "Favorites" },
            { value: "id_desc", label: "ID (Desc)" },
            { value: "id_asc", label: "ID (Asc)" }
          ],
          selected: "date",
          onChange: () => {
            this.app.currentPage = 1;
            this.searchSakugabooru();
          }
        }
      );

      this.ratingDropdown = window.Dropdown.create(
        document.getElementById("searchRatingDropdown"),
        {
          items: [
            { value: "any", label: "Any" },
            { value: "safe", label: "Safe" },
            { value: "questionable", label: "Questionable" },
            { value: "explicit", label: "Explicit" }
          ],
          selected: "any",
          onChange: () => {
            this.app.currentPage = 1;
            this.searchSakugabooru();
          }
        }
      );
    },

    bindEvents() {
      if (this.button) {
        this.button.addEventListener("click", () => {
          this.app.currentPage = 1;
          this.hideSuggestions();
          this.searchSakugabooru();
        });
      }

      if (this.input) {
        this.input.addEventListener("input", () => {
          this.prepareAutocomplete();
          this.triggerDebouncedSearch();
        });
        this.input.addEventListener("keydown", (e) => this.handleInputKeydown(e));
        this.input.addEventListener("blur", () => {
          setTimeout(() => this.hideSuggestions(), 160);
        });
      }

      if (this.saveSearchTagBtn) {
        this.saveSearchTagBtn.addEventListener("click", () => this.saveCurrentSearchTag());
      }

      if (this.clearSearchResultsBtn) {
        this.clearSearchResultsBtn.addEventListener("click", () => this.clearSearchAndShowSavedTags());
      }

      if (this.latestClipsBtn) {
        this.latestClipsBtn.addEventListener("click", () => {
          this.app.currentPage = 1;
          this.hideSuggestions();
          this.loadLatestSakugabooruClips();
        });
      }

      if (this.toggleSavedTagsBtn) {
        this.toggleSavedTagsBtn.addEventListener("click", () => {
          this.app.savedTagsCollapsed = !this.app.savedTagsCollapsed;
          window.StorageManager.setItem("sakugaflow_saved_tags_collapsed", this.app.savedTagsCollapsed ? "1" : "0");
          this.renderSavedSearchTags();
        });
      }

      if (this.clearSelectionBtn) {
        this.clearSelectionBtn.addEventListener("click", () => this.clearSelectedPosts());
      }

      if (this.downloadSelectedBtn) {
        this.downloadSelectedBtn.addEventListener("click", () => this.downloadSelectedPosts());
      }
    },

    prepareAutocomplete() {
      clearTimeout(this.autocompleteTimer);
      this.autocompleteTimer = setTimeout(() => {
        this.searchTagSuggestions();
      }, 180);
    },

    triggerDebouncedSearch() {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.app.currentPage = 1;
        this.searchSakugabooru();
      }, 350);
    },

    searchTagSuggestions() {
      const token = this.getCurrentSearchToken();
      if (!token || token.length < 1) {
        this.hideSuggestions();
        return;
      }

      const requestId = ++this.autocompleteRequestId;
      const url = `${this.app.sakugabooruBaseUrl}/tag.json?limit=${this.app.suggestionLimit}&order=count&name=${encodeURIComponent(token + "*")}`;

      window.Downloader.getJson(url, (error, tags) => {
        if (requestId !== this.autocompleteRequestId) return;
        if (error || !Array.isArray(tags) || tags.length === 0) {
          this.hideSuggestions();
          return;
        }

        this.currentSuggestions = tags
          .filter(t => t && t.name)
          .slice(0, this.app.suggestionLimit);

        this.renderSuggestions();
      }, 10000);
    },

    renderSuggestions() {
      if (!this.suggestionsBox) return;
      this.suggestionsBox.innerHTML = "";
      this.selectedSuggestionIndex = -1;

      if (!this.currentSuggestions || this.currentSuggestions.length === 0) {
        this.hideSuggestions();
        return;
      }

      this.currentSuggestions.forEach((tag, index) => {
        const item = document.createElement("div");
        item.className = "suggestion-item";

        const name = document.createElement("div");
        name.className = "suggestion-name";
        name.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-right:2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' + tag.name.replace(/_/g, " ");

        const count = document.createElement("div");
        count.className = "suggestion-count";
        count.textContent = tag.count || 0;

        item.appendChild(name);
        item.appendChild(count);

        item.addEventListener("mouseenter", () => {
          this.selectedSuggestionIndex = index;
          this.updateSuggestionSelection();
        });

        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          this.applySuggestion(tag.name);
        });

        this.suggestionsBox.appendChild(item);
      });

      this.suggestionsBox.classList.remove("hidden");
    },

    updateSuggestionSelection() {
      if (!this.suggestionsBox) return;
      const items = this.suggestionsBox.querySelectorAll(".suggestion-item");
      items.forEach((item, index) => {
        item.classList.toggle("active", index === this.selectedSuggestionIndex);
      });
    },

    applySuggestion(tagName) {
      if (!this.input) return;
      const value = this.input.value;
      const position = this.input.selectionStart || value.length;
      const beforeCursor = value.slice(0, position);
      const afterCursor = value.slice(position);
      
      const lastComma = beforeCursor.lastIndexOf(",");
      const tokenStart = lastComma + 1;
      const beforeToken = value.slice(0, tokenStart);

      let afterToken = afterCursor;
      const nextComma = afterCursor.indexOf(",");
      if (nextComma >= 0) {
        afterToken = afterCursor.slice(nextComma);
      } else {
        afterToken = "";
      }

      const beautifiedName = tagName.replace(/_/g, " ");
      const prefix = beforeToken + (beforeToken && !beforeToken.endsWith(" ") ? " " : "");
      const suffix = afterToken.replace(/^\s*,\s*/, "").trimStart();
      
      this.input.value = prefix + beautifiedName + ", " + suffix;
      const newPosition = (prefix + beautifiedName + ", ").length;
      this.input.focus();
      this.input.setSelectionRange(newPosition, newPosition);
      this.hideSuggestions();

      this.app.currentPage = 1;
      this.searchSakugabooru();
    },

    getCurrentSearchToken() {
      if (!this.input) return "";
      const value = this.input.value;
      const position = this.input.selectionStart || value.length;
      const beforeCursor = value.slice(0, position);
      const parts = beforeCursor.split(",");
      const currentToken = parts[parts.length - 1].trim();
      return currentToken.replace(/\s+/g, "_");
    },

    hideSuggestions() {
      if (this.suggestionsBox) {
        this.suggestionsBox.classList.add("hidden");
        this.suggestionsBox.innerHTML = "";
      }
      this.currentSuggestions = [];
      this.selectedSuggestionIndex = -1;
    },

    handleInputKeydown(event) {
      if (this.suggestionsBox && !this.suggestionsBox.classList.contains("hidden")) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.moveSuggestionSelection(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          this.moveSuggestionSelection(-1);
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          if (this.selectedSuggestionIndex >= 0 && this.currentSuggestions[this.selectedSuggestionIndex]) {
            event.preventDefault();
            this.applySuggestion(this.currentSuggestions[this.selectedSuggestionIndex].name);
            return;
          }
        }
        if (event.key === "Escape") {
          event.preventDefault();
          this.hideSuggestions();
          return;
        }
      }

      if (event.key === "Enter") {
        this.app.currentPage = 1;
        this.hideSuggestions();
        this.searchSakugabooru();
      }
    },

    moveSuggestionSelection(direction) {
      if (!this.currentSuggestions || this.currentSuggestions.length === 0) return;
      this.selectedSuggestionIndex += direction;
      if (this.selectedSuggestionIndex < 0) {
        this.selectedSuggestionIndex = this.currentSuggestions.length - 1;
      }
      if (this.selectedSuggestionIndex >= this.currentSuggestions.length) {
        this.selectedSuggestionIndex = 0;
      }
      this.updateSuggestionSelection();
    },

    showSavedTagsHome() {
      this.app.isSearchResultsVisible = false;
      if (this.saveSearchTagBar) this.saveSearchTagBar.classList.add("hidden");
      if (this.latestClipsBar) this.latestClipsBar.classList.remove("hidden");
      this.renderSavedSearchTags();
    },

    hideSavedTagsHome() {
      this.app.isSearchResultsVisible = true;
      if (this.latestClipsBar) this.latestClipsBar.classList.add("hidden");
      if (this.savedSearchTagsBox) this.savedSearchTagsBox.classList.add("hidden");
    },

    clearSearchAndShowSavedTags() {
      this.app.searchRequestId++;
      this.autocompleteRequestId++;
      this.app.currentSearchTags = "";
      this.app.currentSearchMode = "tags";
      this.app.currentSearchPosts = [];
      this.app.currentPage = 1;
      this.app.lastSearchedTagsForSave = "";
      this.app.previewsInUse = new Set();

      this.clearSelectedPosts();
      this.app.resetPreviewQueue();
      this.app.resetPagePreload(true);
      this.hideSuggestions();

      if (this.input) this.input.value = "";
      if (this.status) this.status.innerHTML = "";
      if (this.button) {
        this.button.disabled = false;
        this.button.textContent = "Search";
      }

      this.showSavedTagsHome();
      this.app.updatePageLabels();
    },

    showSaveSearchTagButton(tags) {
      this.app.lastSearchedTagsForSave = String(tags || "").trim();
      this.hideSavedTagsHome();

      if (!this.saveSearchTagBar || !this.saveSearchTagText || !this.app.lastSearchedTagsForSave) {
        return;
      }

      this.saveSearchTagBar.classList.remove("hidden");
      if (this.saveSearchTagBtn) {
        this.saveSearchTagBtn.classList.remove("saved");
        this.saveSearchTagBtn.disabled = false;
        this.saveSearchTagBtn.textContent = "Save tag";
      }

      this.saveSearchTagText.textContent = this.app.lastSearchedTagsForSave;
      this.updateSaveSearchTagButtonState();
    },

    updateSaveSearchTagButtonState() {
      if (!this.saveSearchTagBtn || !this.app.lastSearchedTagsForSave) return;
      const exists = this.app.savedSearchTags.some(item => item.toLowerCase() === this.app.lastSearchedTagsForSave.toLowerCase());
      this.saveSearchTagBtn.innerHTML = exists
        ? 'Saved <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-left:2px;"><polyline points="20 6 9 17 4 12"/></svg>'
        : 'Save tag';
      this.saveSearchTagBtn.disabled = exists;
      this.saveSearchTagBtn.classList.toggle("saved", exists);
    },

    saveCurrentSearchTag() {
      const tag = String(this.app.lastSearchedTagsForSave || (this.input ? this.input.value : "") || "").trim();
      if (!tag) return;

      const exists = this.app.savedSearchTags.some(item => item.toLowerCase() === tag.toLowerCase());
      if (!exists) {
        this.app.savedSearchTags.unshift(tag);
        if (this.app.savedSearchTags.length > 30) {
          this.app.savedSearchTags = this.app.savedSearchTags.slice(0, 30);
        }
        window.StorageManager.saveSavedSearchTags(this.app.savedSearchTags);
      }

      this.renderSavedSearchTags();
      this.updateSaveSearchTagButtonState();
    },

    renderSavedSearchTags() {
      if (!this.savedSearchTagsBox || !this.savedSearchTagsList) return;
      this.savedSearchTagsList.innerHTML = "";

      if (this.app.isSearchResultsVisible) {
        if (this.latestClipsBar) this.latestClipsBar.classList.add("hidden");
        this.savedSearchTagsBox.classList.add("hidden");
        return;
      }

      if (this.latestClipsBar) this.latestClipsBar.classList.remove("hidden");
      this.savedSearchTagsBox.classList.remove("hidden");
      this.savedSearchTagsBox.classList.toggle("collapsed", this.app.savedTagsCollapsed);

      if (this.toggleSavedTagsBtn) {
        this.toggleSavedTagsBtn.innerHTML = this.app.savedTagsCollapsed
          ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg>'
          : '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 8 19 8 12 19 5 8"/></svg>';
        this.toggleSavedTagsBtn.title = this.app.savedTagsCollapsed ? "Open saved tags" : "Close saved tags";
      }

      if (this.app.savedTagsCollapsed) return;

      if (!this.app.savedSearchTags.length) {
        const hint = document.createElement("div");
        hint.className = "saved-search-tags-empty-hint";
        hint.textContent = "You have no saved tags at the moment.";
        this.savedSearchTagsList.appendChild(hint);
        return;
      }

      this.app.savedSearchTags.forEach((tag) => {
        const chip = document.createElement("button");
        chip.className = "saved-search-tag-chip";
        chip.textContent = tag;
        chip.title = "Search: " + tag;
        chip.onclick = () => {
          if (this.input) this.input.value = tag;
          this.app.currentPage = 1;
          this.hideSuggestions();
          this.searchSakugabooru();
        };

        const remove = document.createElement("button");
        remove.className = "saved-search-tag-remove";
        remove.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        remove.title = "Remove saved tag";
        remove.onclick = (event) => {
          event.stopPropagation();
          this.app.savedSearchTags = this.app.savedSearchTags.filter(item => item !== tag);
          window.StorageManager.saveSavedSearchTags(this.app.savedSearchTags);
          this.renderSavedSearchTags();
          this.updateSaveSearchTagButtonState();
        };

        const wrap = document.createElement("div");
        wrap.className = "saved-search-tag-wrap";
        wrap.appendChild(chip);
        wrap.appendChild(remove);
        this.savedSearchTagsList.appendChild(wrap);
      });
    },

    searchSakugabooru() {
      if (!this.input) return;
      const originalInput = this.input.value.trim();

      if (!originalInput) {
        this.status.innerHTML = '<div class="top-info error">Type at least one tag first.</div>';
        return;
      }

      const requestId = ++this.app.searchRequestId;
      this.hideSavedTagsHome();
      this.app.currentSearchMode = "tags";
      this.app.currentSearchTags = originalInput;
      this.showSaveSearchTagButton(originalInput);
      this.app.currentSearchPosts = [];
      this.app.lastResultHadMorePosts = false;
      this.app.previewsInUse = new Set();

      this.clearSelectedPosts();
      this.app.resetPreviewQueue();
      this.app.resetPagePreload(true);

      this.app.searchSessionId++;
      this.app.clearSessionPreviews();
      this.app.settingsPanel.updateCacheInfo();

      if (this.button) {
        this.button.disabled = true;
        this.button.textContent = "Searching...";
      }

      this.status.innerHTML = '<div class="top-info loading">Searching Sakugabooru...</div>';

      const parts = originalInput.split(",")
        .map(t => t.trim().replace(/\s+/g, "_"))
        .filter(t => t.length > 0);

      const order = this.orderDropdown ? this.orderDropdown.getValue() : "date";
      if (order !== "date") {
        parts.push("order:" + order);
      }

      const rating = this.ratingDropdown ? this.ratingDropdown.getValue() : "any";
      if (rating !== "any") {
        parts.push("rating:" + rating);
      }

      const tagsQuery = parts.join(" ");

      const url = `${this.app.sakugabooruBaseUrl}/post.json?limit=${this.app.resultsPerPage}&page=${this.app.currentPage}&tags=${encodeURIComponent(tagsQuery)}`;

      window.Downloader.getJson(url, (error, posts) => {
        if (requestId !== this.app.searchRequestId) return;
        if (this.button) {
          this.button.disabled = false;
          this.button.textContent = "Search";
        }

        if (error) {
          this.app.currentSearchPosts = [];
          this.status.innerHTML = `<div class="top-info error">Search timeout/error: ${this.app.escapeHtml(error)}</div>`;
          return;
        }

        if (!posts || posts.length === 0) {
          this.app.lastResultHadMorePosts = false;
          this.app.currentSearchPosts = [];
          this.status.innerHTML = '<div class="top-info">No results found on this page.</div>';
          this.status.appendChild(this.createPagination());
          this.app.updatePageLabels();
          return;
        }

        this.app.lastResultHadMorePosts = posts.length >= this.app.resultsPerPage;
        this.renderSearchPosts(posts, originalInput, this.app.searchSessionId);
        this.app.startPagePreload(posts, this.app.searchSessionId);
        this.app.updatePageLabels();
      }, this.app.searchTimeoutMs);
    },

    loadLatestSakugabooruClips() {
      const requestId = ++this.app.searchRequestId;
      this.hideSavedTagsHome();
      this.app.currentSearchMode = "latest";
      this.app.currentSearchTags = "";
      this.app.currentSearchPosts = [];
      this.app.lastResultHadMorePosts = false;
      this.app.previewsInUse = new Set();

      this.clearSelectedPosts();
      this.app.resetPreviewQueue();
      this.app.resetPagePreload(true);

      this.app.searchSessionId++;
      this.app.clearSessionPreviews();
      this.app.settingsPanel.updateCacheInfo();

      if (this.input) this.input.value = "";
      if (this.button) {
        this.button.disabled = true;
        this.button.textContent = "Loading...";
      }

      if (this.saveSearchTagBar) this.saveSearchTagBar.classList.remove("hidden");
      if (this.saveSearchTagBtn) {
        this.saveSearchTagBtn.disabled = true;
        this.saveSearchTagBtn.classList.add("saved");
        this.saveSearchTagBtn.textContent = "Latest";
      }

      if (this.saveSearchTagText) {
        this.saveSearchTagText.textContent = "Recently added clips from Sakugabooru";
      }

      this.status.innerHTML = '<div class="top-info loading">Loading latest Sakugabooru clips...</div>';

      const url = `${this.app.sakugabooruBaseUrl}/post.json?limit=${this.app.resultsPerPage}&page=${this.app.currentPage}`;

      window.Downloader.getJson(url, (error, posts) => {
        if (requestId !== this.app.searchRequestId) return;
        if (this.button) {
          this.button.disabled = false;
          this.button.textContent = "Search";
        }

        if (error) {
          this.app.currentSearchPosts = [];
          this.status.innerHTML = `<div class="top-info error">Latest clips timeout/error: ${this.app.escapeHtml(error)}</div>`;
          return;
        }

        if (!posts || posts.length === 0) {
          this.app.lastResultHadMorePosts = false;
          this.app.currentSearchPosts = [];
          this.status.innerHTML = '<div class="top-info">No latest clips found on this page.</div>';
          this.status.appendChild(this.createPagination());
          this.app.updatePageLabels();
          return;
        }

        this.app.lastResultHadMorePosts = posts.length >= this.app.resultsPerPage;
        this.renderSearchPosts(posts, "", this.app.searchSessionId);
        this.app.startPagePreload(posts, this.app.searchSessionId);
        this.app.updatePageLabels();
      }, this.app.searchTimeoutMs);
    },

    renderSearchPosts(posts, searchedTags, sessionId) {
      this.app.currentSearchPosts = posts.slice();
      this.status.innerHTML = "";

      const info = document.createElement("div");
      info.className = "top-info";

      const left = document.createElement("span");
      left.textContent = posts.length + " results";

      const right = document.createElement("span");
      right.textContent = this.app.currentSearchMode === "latest"
        ? "Latest Clips | Page " + this.app.currentPage
        : "Search: " + searchedTags + " | Page " + this.app.currentPage;

      info.appendChild(left);
      info.appendChild(right);

      const grid = document.createElement("div");
      grid.className = "grid";

      this.status.appendChild(info);
      this.status.appendChild(grid);

      posts.forEach((post) => {
        const card = this.createSearchCard(post, sessionId);
        grid.appendChild(card);
      });

      this.status.appendChild(this.createPagination());
    },

    createPagination() {
      const pagination = document.createElement("div");
      pagination.className = "pagination";

      const previous = document.createElement("button");
      previous.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:3px;"><polyline points="15 18 9 12 15 6"/></svg>Previous';
      previous.disabled = this.app.currentPage <= 1;
      previous.onclick = () => this.app.goToPage(this.app.currentPage - 1);

      const label = document.createElement("div");
      label.className = "page-label";
      label.textContent = "Page " + this.app.currentPage;

      const next = document.createElement("button");
      next.innerHTML = 'Next<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-left:3px;"><polyline points="9 18 15 12 9 6"/></svg>';
      next.className = "primary-page";
      next.disabled = !this.app.lastResultHadMorePosts;
      next.onclick = () => this.app.goToPage(this.app.currentPage + 1);

      pagination.appendChild(previous);
      pagination.appendChild(label);
      pagination.appendChild(next);

      return pagination;
    },

    createSearchCard(post, sessionId) {
      const previewUrl = this.getStillPreviewUrl(post);
      const videoUrl = this.getHoverVideoUrl(post);
      const downloaded = this.app.isPostDownloaded(post.id);

      const card = document.createElement("div");
      card.className = "card";
      card.dataset.postId = String(post.id);

      const favoriteButton = this.app.createFavoriteButton(post.id);
      favoriteButton.classList.add("search-favorite-btn");

      const selectCircle = document.createElement("div");
      selectCircle.className = "select-circle";
      selectCircle.title = "Select clip";
      selectCircle.onclick = (event) => {
        event.stopPropagation();
        this.togglePostSelection(post, card);
      };

      const previewArea = document.createElement("div");
      previewArea.className = "preview-box";
      this.setLoadingBox(previewArea);

      let clickTimer = null;
      previewArea.addEventListener("click", (event) => {
        event.stopPropagation();
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        clickTimer = setTimeout(() => {
          this.app.playerOverlay.openSearchPlayerAt(post.id);
          clickTimer = null;
        }, 260);
      });

      previewArea.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        this.downloadAndImportPost(post, card);
      });

      if (downloaded) {
        const badge = document.createElement("div");
        badge.className = "downloaded-badge";
        badge.innerHTML = 'Downloaded <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg>';
        card.appendChild(badge);
      }

      const body = document.createElement("div");
      body.className = "card-body";

      const tags = document.createElement("div");
      tags.className = "card-tags";
      tags.textContent = post.tags || "";

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const postButton = document.createElement("button");
      postButton.className = "btn-post";
      postButton.textContent = "Post";
      postButton.onclick = () => {
        window.Downloader.openInBrowser(`${this.app.sakugabooruBaseUrl}/post/show/${post.id}`);
      };

      actions.appendChild(postButton);
      body.appendChild(tags);
      body.appendChild(actions);

      card.appendChild(favoriteButton);
      card.appendChild(selectCircle);
      card.appendChild(previewArea);
      card.appendChild(body);

      this.app.queuePreviewLoad(post, previewUrl, previewArea, card, sessionId);

      if (videoUrl) {
        dbg('debug', 'HoverPreview', 'Detected video card: post=' + post.id);
        this.app.setupHoverVideo(post, previewArea, videoUrl, card);
      }

      return card;
    },

    getStillPreviewUrl(post) {
      return window.Downloader.fixUrl(post.preview_url || post.sample_url || post.file_url || "");
    },

    getHoverVideoUrl(post) {
      const fileUrl = window.Downloader.fixUrl(post.file_url || "");
      if (!fileUrl) return null;
      const ext = window.FileSystem.getExtension(fileUrl).toLowerCase();
      if (ext === "mp4" || ext === "webm") return fileUrl;
      const sampleUrl = window.Downloader.fixUrl(post.sample_url || "");
      if (sampleUrl) {
        const sampleExt = window.FileSystem.getExtension(sampleUrl).toLowerCase();
        if (sampleExt === "mp4" || sampleExt === "webm") return sampleUrl;
      }
      return null;
    },

    setLoadingBox(previewArea) {
      previewArea.innerHTML = "";
      const loading = document.createElement("div");
      loading.className = "loading-box";
      loading.textContent = "Loading preview...";
      previewArea.appendChild(loading);
    },

    togglePostSelection(post, card) {
      const id = String(post.id);
      if (this.app.selectedPosts[id]) {
        delete this.app.selectedPosts[id];
        card.classList.remove("selected");
      } else {
        this.app.selectedPosts[id] = {
          id: post.id,
          tags: post.tags || "",
          fileUrl: window.Downloader.fixUrl(post.file_url),
          postUrl: `${this.app.sakugabooruBaseUrl}/post/show/${post.id}`
        };
        card.classList.add("selected");
        this.app.prefetchSelectedSearchClip(post);
      }
      this.updateBulkBar();
    },

    clearSelectedPosts() {
      this.app.selectedPosts = {};
      const selectedCards = document.querySelectorAll("#searchView .card.selected");
      selectedCards.forEach(c => c.classList.remove("selected"));
      this.updateBulkBar();
    },

    updateBulkBar() {
      const selectedCount = Object.keys(this.app.selectedPosts).length;
      const searchVisible = !searchView.classList.contains("hidden");

      if (selectedCount === 0 || !searchVisible) {
        this.bulkBar.classList.add("hidden");
        this.bulkInfo.textContent = "0 selected";
        return;
      }

      this.bulkBar.classList.remove("hidden");
      this.bulkInfo.textContent = selectedCount === 1 ? "1 clip selected" : selectedCount + " clips selected";
    },

    downloadSelectedPosts() {
      const posts = Object.keys(this.app.selectedPosts).map(k => this.app.selectedPosts[k]);
      if (posts.length === 0) return;

      if (this.downloadSelectedBtn) this.downloadSelectedBtn.disabled = true;
      if (this.clearSelectionBtn) this.clearSelectionBtn.disabled = true;

      this.downloadPostsSequentially(posts, 0, 0, (downloadedCount) => {
        if (this.downloadSelectedBtn) this.downloadSelectedBtn.disabled = false;
        if (this.clearSelectionBtn) this.clearSelectionBtn.disabled = false;
        this.clearSelectedPosts();
        if (downloadedCount > 0) {
          this.app.switchTab("library");
        }
      });
    },

    downloadPostsSequentially(posts, index, downloadedCount, done) {
      if (index >= posts.length) {
        done(downloadedCount);
        return;
      }
      const post = posts[index];
      if (this.bulkInfo) {
        this.bulkInfo.textContent = `Downloading ${index + 1} / ${posts.length}...`;
      }

      this.downloadSinglePost(post, (success) => {
        this.downloadPostsSequentially(posts, index + 1, downloadedCount + (success ? 1 : 0), done);
      });
    },

    downloadSinglePost(post, callback) {
      if (!post.fileUrl) {
        callback(false);
        return;
      }
      window.FileSystem.createFolder(this.app.downloadFolder);

      const extension = window.FileSystem.getExtension(post.fileUrl);
      const filename = `sakugaflow_${post.id}.${extension}`;
      const finalPath = window.FileSystem.path.join(this.app.downloadFolder, filename);

      if (window.FileSystem.fs && window.FileSystem.fs.existsSync(finalPath)) {
        this.app.addToLibrary({
          id: post.id,
          tags: post.tags || "",
          filePath: finalPath,
          originalUrl: post.fileUrl,
          postUrl: post.postUrl,
          downloadedAt: new Date().toISOString()
        });
        callback(true, finalPath);
        return;
      }

      window.Downloader.downloadFile(post.fileUrl, finalPath, (error) => {
        if (error) {
          console.error("Download error:", error);
          callback(false);
          return;
        }
        this.app.addToLibrary({
          id: post.id,
          tags: post.tags || "",
          filePath: finalPath,
          originalUrl: post.fileUrl,
          postUrl: post.postUrl,
          downloadedAt: new Date().toISOString()
        });
        callback(true, finalPath);
      });
    },

    downloadAndImportPost(post, card) {
      this.app.showCepToast("Downloading and importing clip...", "info");
      
      const fileUrl = window.Downloader.fixUrl(post.file_url);
      const postUrl = `${this.app.sakugabooruBaseUrl}/post/show/${post.id}`;
      
      const downloadItem = {
        id: post.id,
        tags: post.tags || "",
        fileUrl: fileUrl,
        postUrl: postUrl
      };

      this.downloadSinglePost(downloadItem, (success, filePath) => {
        if (success && filePath) {
          this.app.showCepToast("Importing to AE...", "info");
          this.app.importFileToAfterEffects(filePath, (imported) => {
            if (imported) {
              this.app.showCepToast("Imported successfully!", "success");
              if (card && !card.querySelector(".downloaded-badge")) {
                const badge = document.createElement("div");
                badge.className = "downloaded-badge";
        badge.innerHTML = 'Downloaded <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg>';
                card.appendChild(badge);
              }
            } else {
              this.app.showCepToast("Import failed.", "error");
            }
          });
        } else {
          this.app.showCepToast("Download failed.", "error");
        }
      });
    }
  };

  window.SearchPanel = SearchPanel;
})();
