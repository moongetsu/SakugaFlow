(function () {
  const nodeRequire = (typeof window !== 'undefined' && window.cep && window.cep.node && window.cep.node.require)
      ? window.cep.node.require
      : (typeof require !== 'undefined' ? require : null);

  const https = nodeRequire ? nodeRequire("https") : null;
  const http = nodeRequire ? nodeRequire("http") : null;
  const fs = nodeRequire ? nodeRequire("fs") : null;
  const path = nodeRequire ? nodeRequire("path") : null;
  const childProcess = nodeRequire ? nodeRequire("child_process") : null;
  const urlModule = nodeRequire ? nodeRequire("url") : null;

  const sakugabooruBaseUrl = "https://www.sakugabooru.com";

  const Downloader = {
    fixUrl(url) {
      if (!url) return "";
      if (url.startsWith("https://") || url.startsWith("http://")) {
        return url;
      }
      if (url.startsWith("//")) {
        return "https:" + url;
      }
      return sakugabooruBaseUrl + url;
    },

    resolveRedirect(oldUrl, location) {
      if (location.startsWith("http")) {
        return location;
      }
      if (location.startsWith("//")) {
        return "https:" + location;
      }
      try {
        const base = new URL(oldUrl);
        return base.origin + location;
      } catch (e) {
        return location;
      }
    },

    isVideo(filePath) {
      return /\.(mp4|webm|mov)(\?|$)/i.test(String(filePath || ""));
    },

    debugLog(msg) {
      console.log("[DEBUG]", msg);
      if (fs) {
        try {
          const os = nodeRequire ? nodeRequire("os") : null;
          if (os) {
            const logPath = path.join(os.tmpdir(), "SakugaFlow_debug.log");
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
          }
        } catch (e) {
          console.error("Failed to write debug log to file", e);
        }
      }
    },

    getJson(url, callback, timeoutMs) {
      let finished = false;
      timeoutMs = timeoutMs || 15000;

      const self = this;
      function done(error, data) {
        if (finished) return;
        finished = true;
        self.debugLog(`getJson finished. Error: ${error ? JSON.stringify(error) : 'none'}, HasData: ${!!data}`);
        callback(error, data);
      }

      const fixed = this.fixUrl(url);
      this.debugLog(`getJson start. URL: ${url} -> Fixed: ${fixed}`);

      
      if (childProcess) {
        this.getJsonViaCurl(fixed, (err, data) => {
          if (err) {
            self.debugLog(`getJson: Curl failed, falling back to other methods. Error: ${err}`);
            self.getJsonFallback(fixed, done, timeoutMs);
          } else {
            done(null, data);
          }
        }, timeoutMs);
        return;
      }

      this.getJsonFallback(fixed, done, timeoutMs);
    },

    getJsonViaCurl(fixedUrl, done, timeoutMs) {
      if (!childProcess) {
        return done("child_process not available");
      }
      this.debugLog(`getJsonViaCurl: Fetching via curl: ${fixedUrl}`);
      
      const cmd = `curl -s -k -L -A "Mozilla/5.0 SakugaFlow/1.0" "${fixedUrl.replace(/"/g, '\\"')}"`;
      childProcess.exec(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: timeoutMs }, (error, stdout, stderr) => {
        if (error) {
          this.debugLog(`getJsonViaCurl failed: ${error.message}`);
          return done(error.message);
        }
        try {
          const parsed = JSON.parse(stdout);
          this.debugLog(`getJsonViaCurl success. Length: ${stdout.length}`);
          done(null, parsed);
        } catch (e) {
          this.debugLog(`getJsonViaCurl parse failed or callback crashed. Error: ${e.message}\nStack: ${e.stack}`);
          done("JSON parse error: " + e.message);
        }
      });
    },

    getJsonFallback(fixed, done, timeoutMs) {
      const self = this;
      
      if (typeof window !== 'undefined' && window.fetch) {
        this.debugLog("getJsonFallback: Browser fetch is available, trying browser fetch...");
        const controller = new AbortController();
        const signal = controller.signal;
        const timeoutId = setTimeout(() => {
          self.debugLog("getJsonFallback: Browser fetch timeout triggered, aborting...");
          try { controller.abort(); } catch(e) {}
        }, timeoutMs);

        window.fetch(fixed, {
          headers: {
            "Accept": "application/json"
          },
          signal: signal
        })
        .then(res => {
          self.debugLog(`getJsonFallback: Browser fetch response received. Status: ${res.status}, Ok: ${res.ok}`);
          clearTimeout(timeoutId);
          if (res.ok) {
            return res.json();
          } else {
            throw new Error("HTTP " + res.status);
          }
        })
        .then(data => {
          self.debugLog("getJsonFallback: Browser fetch json parsed successfully");
          done(null, data);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          self.debugLog(`getJsonFallback: Browser fetch failed. Error: ${err.message}. Falling back to Node getJsonNode...`);
          
          this.getJsonNode(fixed, done, timeoutMs);
        });
        return;
      }

      this.debugLog("getJsonFallback: Browser fetch NOT available, going straight to Node getJsonNode...");
      this.getJsonNode(fixed, done, timeoutMs);
    },

    getJsonNode(fixedUrl, done, timeoutMs) {
      this.debugLog(`getJsonNode start. URL: ${fixedUrl}`);
      if (!http || !https) {
        this.debugLog("getJsonNode: Node http/https modules NOT available");
        return done("Node http/https modules not available");
      }

      let options = {
        rejectUnauthorized: false, 
        headers: {
          "User-Agent": "Mozilla/5.0 SakugaFlow/1.0",
          Accept: "application/json",
          Referer: sakugabooruBaseUrl + "/"
        }
      };

      if (urlModule) {
        const parsedUrl = urlModule.parse(fixedUrl);
        options.protocol = parsedUrl.protocol;
        options.hostname = parsedUrl.hostname;
        options.port = parsedUrl.port;
        options.path = parsedUrl.path;
      }

      const protocol = fixedUrl.startsWith("https") ? https : http;
      this.debugLog(`getJsonNode: Using protocol: ${fixedUrl.startsWith("https") ? "https" : "http"}`);

      try {
        const reqOptions = urlModule ? options : fixedUrl;
        const callbackFn = (res) => {
          this.debugLog(`getJsonNode response header received. Status: ${res.statusCode}`);
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            this.debugLog(`getJsonNode response end. Total bytes received: ${data.length}`);
            try {
              if (res.statusCode !== 200) {
                done("HTTP " + res.statusCode + " | " + data.slice(0, 120));
                return;
              }
              done(null, JSON.parse(data));
            } catch (e) {
              done("Response was not JSON. Start: " + data.slice(0, 120));
            }
          });
        };

        const request = urlModule ? protocol.get(reqOptions, callbackFn) : protocol.get(fixedUrl, options, callbackFn);

        request.on("error", (err) => {
          this.debugLog(`getJsonNode request error: ${err.message}`);
          done(err.message);
        });

        request.setTimeout(timeoutMs, () => {
          this.debugLog("getJsonNode request timeout event triggered");
          try {
            request.abort();
          } catch (e) {}
          done("Request timed out after " + Math.round(timeoutMs / 1000) + "s");
        });
      } catch (e) {
        this.debugLog(`getJsonNode crash caught in try-catch: ${e.message}`);
        done(e.message);
      }
    },

    downloadFile(url, destination, callback) {
      if (!fs || !http || !https) {
        return callback("Node components not available");
      }
      const fixedUrl = this.fixUrl(url);

      
      const dir = path.dirname(destination);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const protocol = fixedUrl.startsWith("https") ? https : http;
      let finished = false;

      function done(error) {
        if (finished) return;
        finished = true;
        callback(error || null);
      }

      let options = {
        rejectUnauthorized: false,
        headers: {
          "User-Agent": "Mozilla/5.0 SakugaFlow/1.0",
          Accept: "*/*",
          Referer: sakugabooruBaseUrl + "/"
        }
      };

      if (urlModule) {
        const parsedUrl = urlModule.parse(fixedUrl);
        options.protocol = parsedUrl.protocol;
        options.hostname = parsedUrl.hostname;
        options.port = parsedUrl.port;
        options.path = parsedUrl.path;
      }

      const reqOptions = urlModule ? options : fixedUrl;
      const callbackFn = (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const newUrl = this.resolveRedirect(fixedUrl, res.headers.location);
          this.downloadFile(newUrl, destination, callback);
          return;
        }

        if (res.statusCode !== 200) {
          done("HTTP " + res.statusCode);
          return;
        }

        const file = fs.createWriteStream(destination);
        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            done(null);
          });
        });

        file.on("error", (err) => {
          try {
            fs.unlinkSync(destination);
          } catch (e) {}
          done(err.message);
        });
      };

      const request = urlModule ? protocol.get(reqOptions, callbackFn) : protocol.get(fixedUrl, options, callbackFn);

      request.setTimeout(30000, () => {
        try {
          request.abort();
        } catch (e) {}
        try {
          fs.unlinkSync(destination);
        } catch (e) {}
        done("Timeout");
      });

      request.on("error", (err) => {
        done(err.message);
      });
    },

    downloadFileWithProgress(url, destination, progressCallback, callback) {
      if (!fs || !http || !https) {
        return callback("Node components not available");
      }
      const fixedUrl = this.fixUrl(url);

      const dir = path.dirname(destination);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const protocol = fixedUrl.startsWith("https") ? https : http;
      let options = {
        rejectUnauthorized: false,
        headers: {
          "User-Agent": "Mozilla/5.0 SakugaFlow/1.0",
          Accept: "*/*",
          Referer: sakugabooruBaseUrl + "/"
        }
      };

      if (urlModule) {
        const parsedUrl = urlModule.parse(fixedUrl);
        options.protocol = parsedUrl.protocol;
        options.hostname = parsedUrl.hostname;
        options.port = parsedUrl.port;
        options.path = parsedUrl.path;
      }

      const reqOptions = urlModule ? options : fixedUrl;
      const callbackFn = (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const newUrl = this.resolveRedirect(fixedUrl, res.headers.location);
          this.downloadFileWithProgress(newUrl, destination, progressCallback, callback);
          return;
        }

        if (res.statusCode !== 200) {
          callback("HTTP " + res.statusCode);
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let downloadedBytes = 0;
        const file = fs.createWriteStream(destination);

        res.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          if (progressCallback && totalBytes > 0) {
            progressCallback({
              downloadedBytes: downloadedBytes,
              totalBytes: totalBytes,
              percent: (downloadedBytes / totalBytes) * 100
            });
          }
        });

        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            if (progressCallback) {
              progressCallback({
                downloadedBytes: downloadedBytes,
                totalBytes: totalBytes,
                percent: 100
              });
            }
            callback(null);
          });
        });

        file.on("error", (err) => {
          try {
            fs.unlinkSync(destination);
          } catch (e) {}
          callback(err.message);
        });
      };

      const request = urlModule ? protocol.get(reqOptions, callbackFn) : protocol.get(fixedUrl, options, callbackFn);

      request.setTimeout(45000, () => {
        try {
          request.abort();
        } catch (e) {}
        try {
          fs.unlinkSync(destination);
        } catch (e) {}
        callback("Timeout");
      });

      request.on("error", (err) => {
        callback(err.message);
      });
    },

    openInBrowser(url) {
      const fixed = this.fixUrl(url);
      try {
        if (window.cep && window.cep.util) {
          window.cep.util.openURLInDefaultBrowser(fixed);
          return;
        }
      } catch (e) {}

      try {
        if (!childProcess) return;
        if (process.platform === "win32") {
          childProcess.exec('start "" "' + fixed + '"');
        } else if (process.platform === "darwin") {
          childProcess.exec('open "' + fixed + '"');
        } else {
          childProcess.exec('xdg-open "' + fixed + '"');
        }
      } catch (e) {
        console.error("Could not open link in browser:", e.message);
      }
    },

    openFolder(folder) {
      try {
        if (!childProcess) return;
        if (process.platform === "win32") {
          childProcess.exec('explorer "' + folder + '"');
        } else if (process.platform === "darwin") {
          childProcess.exec('open "' + folder + '"');
        } else {
          childProcess.exec('xdg-open "' + folder + '"');
        }
      } catch (e) {
        console.error("Could not open folder:", e.message);
      }
    },

    openFolderAndSelect(filePath) {
      if (!filePath) return;
      try {
        if (!childProcess) return;
        if (process.platform === "win32") {
          childProcess.exec('explorer /select,"' + filePath + '"');
          return;
        }
        if (process.platform === "darwin") {
          childProcess.exec('open -R "' + filePath + '"');
          return;
        }
        this.openFolder(path.dirname(filePath));
      } catch (e) {
        console.error("Could not select file:", e.message);
        this.openFolder(path.dirname(filePath));
      }
    }
  };

  window.Downloader = Downloader;
})();
