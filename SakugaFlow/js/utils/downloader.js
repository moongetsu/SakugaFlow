(function () {
  const nodeRequire = (typeof window !== 'undefined' && window.cep && window.cep.node && window.cep.node.require)
      ? window.cep.node.require
      : (typeof require !== 'undefined' ? require : null);

  const https = nodeRequire ? nodeRequire("https") : null;
  const http = nodeRequire ? nodeRequire("http") : null;
  const fs = nodeRequire ? nodeRequire("fs") : null;
  const path = nodeRequire ? nodeRequire("path") : null;
  const childProcess = nodeRequire ? nodeRequire("child_process") : null;

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

    getJson(url, callback, timeoutMs) {
      let finished = false;
      timeoutMs = timeoutMs || 15000;

      function done(error, data) {
        if (finished) return;
        finished = true;
        callback(error, data);
      }

      if (!http || !https) {
        return done("Node http/https modules not available");
      }

      const fixed = this.fixUrl(url);
      const options = {
        headers: {
          "User-Agent": "Mozilla/5.0 SakugaFlow/1.0",
          Accept: "application/json",
          Referer: sakugabooruBaseUrl + "/"
        }
      };

      const protocol = fixed.startsWith("https") ? https : http;

      const request = protocol.get(fixed, options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
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
      });

      request.on("error", (err) => {
        done(err.message);
      });

      request.setTimeout(timeoutMs, () => {
        try {
          request.abort();
        } catch (e) {}
        done("Request timed out after " + Math.round(timeoutMs / 1000) + "s");
      });
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

      const options = {
        headers: {
          "User-Agent": "Mozilla/5.0 SakugaFlow/1.0",
          Accept: "*/*",
          Referer: sakugabooruBaseUrl + "/"
        }
      };

      const request = protocol.get(fixedUrl, options, (res) => {
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
      });

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
      const options = {
        headers: {
          "User-Agent": "Mozilla/5.0 SakugaFlow/1.0",
          Accept: "*/*",
          Referer: sakugabooruBaseUrl + "/"
        }
      };

      const request = protocol.get(fixedUrl, options, (res) => {
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
      });

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
