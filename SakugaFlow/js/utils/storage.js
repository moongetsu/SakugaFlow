(function () {
  const StorageManager = {
    
    getItem(key, defaultValue) {
      try {
        const val = localStorage.getItem(key);
        return val !== null ? val : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    },

    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error("StorageManager setItem failed:", e);
      }
    },

    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error("StorageManager removeItem failed:", e);
      }
    },

    
    loadLibrary() {
      try {
        const raw = this.getItem("sakugaboru_library", "[]");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },

    saveLibrary(library) {
      this.setItem("sakugaboru_library", JSON.stringify(library || []));
    },

    
    loadFavorites() {
      try {
        const raw = this.getItem("sakugaboru_favorites", "[]");
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return {};
        const map = {};
        data.forEach(function (id) {
          map[String(id)] = true;
        });
        return map;
      } catch (e) {
        return {};
      }
    },

    saveFavorites(favorites) {
      try {
        const ids = Object.keys(favorites).filter(function (id) {
          return favorites[id];
        });
        this.setItem("sakugaboru_favorites", JSON.stringify(ids));
      } catch (e) {
        console.error("Failed to save favorites:", e);
      }
    },

    
    loadSavedSearchTags() {
      try {
        const raw = this.getItem("sakugaflow_saved_search_tags", "[]");
        const data = JSON.parse(raw);
        return Array.isArray(data)
          ? data.filter(t => typeof t === "string" && t.trim()).map(t => t.trim())
          : [];
      } catch (e) {
        return [];
      }
    },

    saveSavedSearchTags(tags) {
      this.setItem("sakugaflow_saved_search_tags", JSON.stringify(tags || []));
    },

    
    loadUpscaleQueue() {
      try {
        const raw = this.getItem("sakugaflow_upscale_queue", "[]");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },

    saveUpscaleQueue(queue) {
      this.setItem("sakugaflow_upscale_queue", JSON.stringify(queue || []));
    },

    
    loadUpscaleSessionHistory() {
      try {
        const raw = this.getItem("sakugaflow_upscale_history", "[]");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },

    saveUpscaleSessionHistory(history) {
      this.setItem("sakugaflow_upscale_history", JSON.stringify(history || []));
    },

    
    loadScenePackFolders() {
      try {
        const raw = this.getItem("sakugaflow_scene_pack_folders", "[]");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },

    saveScenePackFolders(folders) {
      this.setItem("sakugaflow_scene_pack_folders", JSON.stringify(folders || []));
    }
  };

  window.StorageManager = StorageManager;
})();
