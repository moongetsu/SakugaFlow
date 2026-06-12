import sys, os, json, shutil, tempfile, zipfile, io, subprocess

# Globally bypass SSL verification for all urllib requests in this script (fixes CERTIFICATE_VERIFY_FAILED)
try:
    import ssl
    ssl._create_default_https_context = ssl._create_unverified_context
except Exception:
    pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
ESRGAN_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip"
FALLBACK_ESRGAN_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip"

PIP_PACKAGES = ["opencv-python", "numpy", "Pillow"]

def log(msg_type, msg, **kw):
    out = {"type": msg_type, "msg": str(msg)}
    out.update(kw)
    print(json.dumps(out), flush=True)

def download_file(url, dest_path, label):
    """Download a file with progress reporting. Returns True on success."""
    import urllib.request

    log("info", f"Downloading {label}...", pct=0)

    try:
        import ssl
        context = ssl._create_unverified_context()
        req = urllib.request.Request(url, headers={"User-Agent": "SakugaFlow/1.0"})
        resp = urllib.request.urlopen(req, timeout=30, context=context)
    except Exception as e:
        log("error", f"Could not connect to download server: {e}")
        return False

    total = int(resp.headers.get("Content-Length", 0))
    downloaded = 0
    chunk_size = 65536

    try:
        with open(dest_path, "wb") as f:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    pct = min(99, int(downloaded * 100 / total))
                    if downloaded % (chunk_size * 8) < chunk_size:
                        log("progress", f"Downloading {label}: {pct}%", pct=pct, done=downloaded, total=total)
    except Exception as e:
        log("error", f"Download interrupted: {e}")
        try:
            os.unlink(dest_path)
        except Exception:
            pass
        return False

    log("progress", f"Downloading {label}: 100%", pct=100, done=downloaded, total=total)
    return True

def find_in_zip(zip_path, exe_name, dest_dir):
    """Extract a single .exe from a zip, searching recursively. Also extracts models/ folder if present."""
    import fnmatch
    result = None
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.namelist():
                base = os.path.basename(member)
                
                if base.lower() == exe_name.lower():
                    dest = os.path.join(dest_dir, base)
                    zf.extract(member, dest_dir)
                    extracted = os.path.join(dest_dir, member)
                    if extracted != dest:
                        shutil.move(extracted, dest)
                    result = dest
                
                if "models/" in member.lower() or "model/" in member.lower():
                    
                    rel = member
                    if "/" in rel:
                        parts = rel.split("/")
                        model_idx = -1
                        for i, p in enumerate(parts):
                            if "model" in p.lower():
                                model_idx = i
                                break
                        if model_idx >= 0:
                            rel = "/".join(parts[model_idx:])
                    target = os.path.join(dest_dir, rel)
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with zf.open(member) as src:
                        with open(target, "wb") as dst:
                            dst.write(src.read())

            
            for item in zf.namelist():
                if item.endswith("/"):
                    continue
                dirs_to_clean = item.split("/")[:-1]
                for d in reversed(dirs_to_clean):
                    if not d or "model" in d.lower():
                        continue
                    cleanup = os.path.join(dest_dir, d)
                    try:
                        if os.path.isdir(cleanup):
                            remaining = [f for f in os.listdir(cleanup) if f.lower() != "models"]
                            if not remaining:
                                shutil.rmtree(cleanup)
                    except Exception:
                        pass
        return result
    except Exception as e:
        log("warn", f"Zip extraction error: {e}")
        return None

def install_ffmpeg():
    """Download and install ffmpeg.exe and ffprobe.exe."""
    ffmpeg_exe = os.path.join(SCRIPT_DIR, "ffmpeg.exe")
    ffprobe_exe = os.path.join(SCRIPT_DIR, "ffprobe.exe")

    if os.path.exists(ffmpeg_exe) and os.path.exists(ffprobe_exe):
        log("info", "FFmpeg already installed")
        log("done", "ffmpeg", path=ffmpeg_exe)
        log("done", "ffprobe", path=ffprobe_exe)
        return True

    zip_path = os.path.join(SCRIPT_DIR, "_ffmpeg_download.zip")
    if not download_file(FFMPEG_URL, zip_path, "FFmpeg"):
        return False

    log("info", "Extracting FFmpeg...")
    ffmpeg_found = find_in_zip(zip_path, "ffmpeg.exe", SCRIPT_DIR)
    ffprobe_found = find_in_zip(zip_path, "ffprobe.exe", SCRIPT_DIR)

    try:
        os.unlink(zip_path)
    except Exception:
        pass

    if ffmpeg_found and ffprobe_found:
        log("info", "FFmpeg installed successfully")
        log("done", "ffmpeg", path=ffmpeg_found)
        log("done", "ffprobe", path=ffprobe_found)
        return True
    else:
        log("error", "Could not extract FFmpeg from the downloaded archive")
        return False

def install_esrgan():
    """Download and install realesrgan-ncnn-vulkan.exe."""
    target = os.path.join(SCRIPT_DIR, "realesrgan-ncnn-vulkan.exe")

    if os.path.exists(target):
        log("info", "Real-ESRGAN already installed")
        log("done", "realesrgan", path=target)
        return True

    zip_path = os.path.join(SCRIPT_DIR, "_esrgan_download.zip")
    if not download_file(ESRGAN_URL, zip_path, "Real-ESRGAN"):
        return False

    log("info", "Extracting Real-ESRGAN...")
    esrgan = find_in_zip(zip_path, "realesrgan-ncnn-vulkan.exe", SCRIPT_DIR)

    try:
        os.unlink(zip_path)
    except Exception:
        pass

    if esrgan:
        log("info", "Real-ESRGAN installed successfully")
        log("done", "realesrgan", path=esrgan)
        return True
    else:
        log("error", "Could not extract Real-ESRGAN executable from the archive")
        return False

def install_pip_packages():
    """Install required pip packages for the upscale pipeline."""
    import subprocess

    
    missing = []
    for pkg in PIP_PACKAGES:
        try:
            subprocess.check_output(
                [sys.executable, "-m", "pip", "show", pkg],
                stderr=subprocess.DEVNULL,
                timeout=15
            )
        except Exception:
            missing.append(pkg)

    if not missing:
        log("info", "All pip packages already installed")
        for pkg in PIP_PACKAGES:
            log("done", "pip-" + pkg, path="pip:" + pkg)
        return True

    log("info", f"Installing pip packages: {', '.join(missing)}...")

    try:
        proc = subprocess.Popen(
            [sys.executable, "-m", "pip", "install"] + missing,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        for line in proc.stdout:
            line = line.strip()
            if line:
                log("pip", line)

        proc.wait()
        if proc.returncode == 0:
            log("info", "pip packages installed successfully")
            for pkg in PIP_PACKAGES:
                log("done", "pip-" + pkg, path="pip:" + pkg)
            return True
        else:
            log("warn", f"pip install exited with code {proc.returncode}")
            log("error", "Some pip packages may not have been installed")
            return False
    except Exception as e:
        log("error", f"pip install failed: {e}")
        log("error", f"Run manually: {sys.executable} -m pip install {' '.join(missing)}")
        return False

def main():
    log("info", "SakugaFlow Tools Installer [Bypass SSL = True]")
    log("info", f"Target directory: {SCRIPT_DIR}")
    log("info", f"Python: {sys.version}")
    log("info", f"Script Path: {os.path.abspath(__file__)}")

    results = {"ffmpeg": False, "ffprobe": False, "realesrgan": False, "pip": False}

    
    log("section", "FFmpeg", step=1, total=3)
    results["ffmpeg"] = install_ffmpeg()
    if results["ffmpeg"]:
        results["ffprobe"] = True  

    
    log("section", "Real-ESRGAN", step=2, total=3)
    results["realesrgan"] = install_esrgan()

    
    log("section", "pip packages", step=3, total=3)
    results["pip"] = install_pip_packages()

    
    all_ok = results["ffmpeg"] and results["realesrgan"]
    pip_ok = results["pip"]

    log("summary", "installation_summary", results=results, all_ok=all_ok, pip_ok=pip_ok)

    if all_ok:
        log("success", "All essential tools installed. SakugaFlow is ready!")
    else:
        log("error", "Some tools could not be installed. Check the log above.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log("fatal", str(e))
        sys.exit(1)
