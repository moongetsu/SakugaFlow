(function () {
  const SettingsPanel = {
    init(app) {
      this.app = app;

      this.categoryButtons = document.querySelectorAll(".settings-cat-btn");
      this.settingsSections = document.querySelectorAll(".settings-section");

      this.chooseFolderBtn = document.getElementById("chooseFolderBtn");
      this.downloadFolderText = document.getElementById("downloadFolderText");
      this.clearCacheBtn = document.getElementById("clearCacheBtn");
      this.cacheInfoText = document.getElementById("cacheInfoText");

      this.chooseBackgroundBtn = document.getElementById("chooseBackgroundBtn");
      this.clearBackgroundBtn = document.getElementById("clearBackgroundBtn");
      this.backgroundFileText = document.getElementById("backgroundFileText");

      this.bindEvents();
      this.loadSettings();
    },

    bindEvents() {
      this.categoryButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.categoryButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const target = btn.getAttribute("data-target");
          this.settingsSections.forEach((sec) => {
            sec.classList.toggle("hidden", sec.id !== target);
          });
        });
      });

      if (this.chooseFolderBtn) {
        this.chooseFolderBtn.addEventListener("click", () => this.chooseDownloadFolder());
      }

      if (this.chooseBackgroundBtn) {
        this.chooseBackgroundBtn.addEventListener("click", () => this.chooseBackgroundImage());
      }

      if (this.clearBackgroundBtn) {
        this.clearBackgroundBtn.addEventListener("click", () => this.clearBackgroundImage());
      }

      if (this.clearCacheBtn) {
        this.clearCacheBtn.addEventListener("click", () => {
          this.app.clearSessionPreviews();
          this.updateCacheInfo();
          this.app.showCepToast("Preview cache cleared.", "success");
        });
      }
    },

    loadSettings() {
      this.updateDownloadFolderText();
      this.updateCacheInfo();

      this._createSlider({
        id: "cardSizeSetting",
        label: "Clip size",
        min: 120,
        max: 260,
        value: window.StorageManager.getItem("sakugaboru_card_size", "170"),
        storageKey: "sakugaboru_card_size",
        unit: "px",
        callback: (val) => this.applyCardSize(val)
      });

      const bgPath = window.StorageManager.getItem("sakugaflow_background_path", "");
      this.applyBackgroundPath(bgPath);

      this._createSlider({
        id: "backgroundOpacitySetting",
        label: "Image opacity",
        min: 0,
        max: 100,
        value: window.StorageManager.getItem("sakugaflow_bg_opacity", "32"),
        storageKey: "sakugaflow_bg_opacity",
        unit: "%",
        callback: (val) => this.applyBackgroundOpacity(val)
      });

      this._createSlider({
        id: "backgroundBlurSetting",
        label: "Blur",
        min: 0,
        max: 30,
        value: window.StorageManager.getItem("sakugaflow_bg_blur", "8"),
        storageKey: "sakugaflow_bg_blur",
        unit: "px",
        callback: (val) => this.applyBackgroundBlur(val)
      });

      this._createSlider({
        id: "glassOpacitySetting",
        label: "Glass opacity",
        min: 35,
        max: 98,
        value: window.StorageManager.getItem("sakugaflow_glass_opacity", "82"),
        storageKey: "sakugaflow_glass_opacity",
        unit: "%",
        callback: (val) => this.applyGlassOpacity(val)
      });

      this._createSlider({
        id: "gradientOpacitySetting",
        label: "Gradient overlay",
        min: 0,
        max: 100,
        value: window.StorageManager.getItem("sakugaflow_gradient_opacity", "70"),
        storageKey: "sakugaflow_gradient_opacity",
        unit: "%",
        callback: (val) => this.applyGradientOpacity(val)
      });

      const hoverAudioEnabledContainer = document.getElementById("hoverAudioEnabledSetting");
      if (hoverAudioEnabledContainer) {
        const savedValue = window.StorageManager.getItem("sakugaflow_hover_audio_enabled", "false") === "true";
        this.app.hoverAudioEnabled = savedValue;

        window.CustomSwitcher.create(hoverAudioEnabledContainer, {
          label: "Hover Preview Audio",
          value: savedValue,
          onChange: (newValue) => {
            this.app.hoverAudioEnabled = newValue;
            window.StorageManager.setItem("sakugaflow_hover_audio_enabled", newValue);
          }
        });
      }

      const hoverVolumeContainer = document.getElementById("hoverVolumeSetting");
      if (hoverVolumeContainer) {
        const savedVolume = window.StorageManager.getItem("sakugaflow_hover_volume", 0);
        this.app.hoverVolume = savedVolume;

        window.CustomSlider.create(hoverVolumeContainer, {
          label: "Hover Preview Volume",
          min: 0,
          max: 100,
          step: 1,
          value: savedVolume,
          onChange: (newValue) => {
            this.app.hoverVolume = newValue;
            window.StorageManager.setItem("sakugaflow_hover_volume", newValue);
          }
        });
      }

      const upscaleEnabledContainer = document.getElementById("upscaleEnabledSetting");
      if (upscaleEnabledContainer) {
        const isDisabled = window.StorageManager.getItem("sakugaflow_upscale_disabled", "0") === "1";
        window.CustomSwitcher.create(upscaleEnabledContainer, {
          label: "AI Upscaling",
          value: !isDisabled,
          onChange: (newValue) => {
            var upscaleBtn = document.getElementById('upscaleTabBtn');
            if (newValue) {
              window.StorageManager.removeItem("sakugaflow_upscale_disabled");
              window.StorageManager.removeItem("sakugaflow_tools_setup_skipped");
              if (upscaleBtn) upscaleBtn.style.display = '';
            } else {
              window.StorageManager.setItem("sakugaflow_upscale_disabled", "1");
              if (upscaleBtn) upscaleBtn.style.display = 'none';
            }
          }
        });
      }

      const scenePacksEnabledContainer = document.getElementById("scenePacksEnabledSetting");
      if (scenePacksEnabledContainer) {
        const isDisabled = window.StorageManager.getItem("sakugaflow_scene_packs_disabled", "0") === "1";
        window.CustomSwitcher.create(scenePacksEnabledContainer, {
          label: "Scene Packs",
          value: !isDisabled,
          onChange: (newValue) => {
            var scenePacksBtn = document.getElementById('scenePacksTabBtn');
            if (newValue) {
              window.StorageManager.removeItem("sakugaflow_scene_packs_disabled");
              if (scenePacksBtn) scenePacksBtn.style.display = '';
            } else {
              window.StorageManager.setItem("sakugaflow_scene_packs_disabled", "1");
              if (scenePacksBtn) scenePacksBtn.style.display = 'none';
            }
          }
        });
      }

      const consoleEnabledContainer = document.getElementById("consoleEnabledSetting");
      if (consoleEnabledContainer) {
        const isDisabled = window.StorageManager.getItem("sakugaflow_console_disabled", "0") === "1";
        window.CustomSwitcher.create(consoleEnabledContainer, {
          label: "Developer Console",
          value: !isDisabled,
          onChange: (newValue) => {
            var consoleBtn = document.getElementById('consoleTabBtn');
            if (newValue) {
              window.StorageManager.removeItem("sakugaflow_console_disabled");
              if (consoleBtn) consoleBtn.style.display = '';
            } else {
              window.StorageManager.setItem("sakugaflow_console_disabled", "1");
              if (consoleBtn) consoleBtn.style.display = 'none';
            }
          }
        });
      }
    },

    _createSlider(options) {
      const container = document.getElementById(options.id);
      if (!container) return;

      options.callback(options.value);

      window.CustomSlider.create(container, {
        label: options.label,
        min: options.min,
        max: options.max,
        step: options.step || 1,
        value: options.value,
        unit: options.unit,
        onChange: (newValue) => {
          options.callback(newValue);
          window.StorageManager.setItem(options.storageKey, newValue);
        }
      });
    },

    applyCardSize(value) {
      document.documentElement.style.setProperty("--card-size", value + "px");
    },

    chooseDownloadFolder() {
      let selected = "";
      if (process.platform === "win32") {
        selected = window.FileSystem.chooseFolderWithSystemExplorer(
          "Choose the folder where clips will be downloaded",
          this.app.downloadFolder
        );
      }
      if (!selected) return;

      try {
        window.FileSystem.createFolder(selected);
        this.app.downloadFolder = selected;
        window.StorageManager.setItem("sakugaboru_download_folder", selected);
        this.updateDownloadFolderText();
      } catch (e) {
        alert("Could not use this folder: " + e.message);
      }
    },

    updateDownloadFolderText() {
      if (this.downloadFolderText) {
        this.downloadFolderText.textContent = this.app.downloadFolder;
        this.downloadFolderText.title = this.app.downloadFolder;
      }
    },

    updateCacheInfo() {
      if (!this.cacheInfoText) return;
      const size = window.FileSystem.calculateFolderSizeMB(this.app.previewCacheFolder);
      this.cacheInfoText.textContent = `Preview cache: ${size.toFixed(1)} MB`;
      this.cacheInfoText.title = this.app.previewCacheFolder;
    },

    chooseBackgroundImage() {
      let selected = "";
      if (process.platform === "win32") {
        selected = window.FileSystem.chooseFileWithSystemExplorer(
          "Choose a background image or GIF",
          window.FileSystem.os ? window.FileSystem.os.homedir() : "",
          "Images and GIFs (*.jpg;*.jpeg;*.png;*.webp;*.gif)|*.jpg;*.jpeg;*.png;*.webp;*.gif|All files (*.*)|*.*"
        );
      }
      if (!selected) return;

      if (window.FileSystem.fs && !window.FileSystem.fs.existsSync(selected)) {
        alert("Background file not found.");
        return;
      }

      const extension = window.FileSystem.getExtension(selected).toLowerCase();
      const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
      if (allowed.indexOf(extension) < 0) {
        alert("Please choose a JPG, PNG, WEBP or GIF file.");
        return;
      }

      window.StorageManager.setItem("sakugaflow_background_path", selected);
      this.applyBackgroundPath(selected);
    },

    clearBackgroundImage() {
      window.StorageManager.removeItem("sakugaflow_background_path");
      this.applyBackgroundPath("");
    },

    applyBackgroundPath(filePath) {
      dbg('debug', 'Settings', 'Background: ' + (filePath || 'default'));
      if (filePath && window.FileSystem.fs && window.FileSystem.fs.existsSync(filePath)) {
        document.documentElement.style.setProperty(
          "--custom-bg-image",
          "url('" + window.FileSystem.pathToFileUrl(filePath).replace(/'/g, "%27") + "')"
        );
        document.body.classList.add("has-custom-background");
        if (this.backgroundFileText) {
          this.backgroundFileText.textContent = window.FileSystem.path ? window.FileSystem.path.basename(filePath) : filePath;
          this.backgroundFileText.title = filePath;
        }
      } else {
        document.documentElement.style.setProperty("--custom-bg-image", "none");
        document.body.classList.remove("has-custom-background");
        if (this.backgroundFileText) {
          this.backgroundFileText.textContent = "Default background";
          this.backgroundFileText.title = "";
        }
      }
    },

    applyBackgroundOpacity(value) {
      const opacity = Math.max(0, Math.min(100, parseInt(value, 10) || 0)) / 100;
      document.documentElement.style.setProperty("--background-image-opacity", String(opacity));
    },

    applyBackgroundBlur(value) {
      const blur = Math.max(0, Math.min(30, parseInt(value, 10) || 0));
      document.documentElement.style.setProperty("--background-blur", blur + "px");
    },

    applyGlassOpacity(value) {
      const opacity = Math.max(35, Math.min(98, parseInt(value, 10) || 82)) / 100;
      document.documentElement.style.setProperty("--glass-opacity", String(opacity));
      document.documentElement.style.setProperty("--glass-opacity-soft", String(Math.max(0.18, opacity - 0.18)));
    },

    applyGradientOpacity(value) {
      const opacity = Math.max(0, Math.min(100, parseInt(value, 10) || 0)) / 100;
      document.documentElement.style.setProperty("--gradient-opacity", String(opacity));
    }
  };

  window.SettingsPanel = SettingsPanel;
})();
