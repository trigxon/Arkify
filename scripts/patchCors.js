const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Ensure bin/yt-dlp is available
const binDir = path.join(__dirname, '..', 'bin');
const ytDlpPath = path.join(binDir, 'yt-dlp');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

if (!fs.existsSync(ytDlpPath)) {
  console.log('[setup] Downloading yt-dlp binary...');
  try {
    if (fs.existsSync('/tmp/yt-dlp')) {
      fs.copyFileSync('/tmp/yt-dlp', ytDlpPath);
      fs.chmodSync(ytDlpPath, 0o755);
      console.log('[setup] Copied yt-dlp from /tmp/yt-dlp');
    } else {
      execSync(
        `curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${ytDlpPath}" && chmod +x "${ytDlpPath}"`,
        { stdio: 'inherit' }
      );
      console.log('[setup] Successfully downloaded yt-dlp');
    }
  } catch (err) {
    console.warn('[setup] Failed to download yt-dlp:', err.message);
  }
} else {
  try {
    fs.chmodSync(ytDlpPath, 0o755);
  } catch {}
}

// 2. Patch CorsMiddleware.js and ensure HistoryFallbackMiddleware.js exists for Expo
const middlewareDir = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'start',
  'server',
  'middleware'
);
const historyFallbackPath = path.join(middlewareDir, 'HistoryFallbackMiddleware.js');
if (fs.existsSync(middlewareDir) && !fs.existsSync(historyFallbackPath)) {
  const fallbackCode = `"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "HistoryFallbackMiddleware", {
    enumerable: true,
    get: function() {
        return HistoryFallbackMiddleware;
    }
});
const _resolvePlatform = require("./resolvePlatform");
class HistoryFallbackMiddleware {
    constructor(indexMiddleware){
        this.indexMiddleware = indexMiddleware;
    }
    getHandler() {
        return (req, res, next)=>{
            const platform = (0, _resolvePlatform.parsePlatformHeader)(req);
            if (!platform || platform === 'web') {
                return this.indexMiddleware(req, res, next);
            }
            return next();
        };
    }
}
//# sourceMappingURL=HistoryFallbackMiddleware.js.map`;
  try {
    fs.writeFileSync(historyFallbackPath, fallbackCode, 'utf8');
    console.log('[patchCors] Successfully created HistoryFallbackMiddleware.js');
  } catch (e) {
    console.warn('[patchCors] Failed to write HistoryFallbackMiddleware.js:', e.message);
  }
}

const corsPath = path.join(middlewareDir, 'CorsMiddleware.js');

if (fs.existsSync(corsPath)) {
  let content = fs.readFileSync(corsPath, 'utf8');

  if (content.includes('Unauthorized request from')) {
    content = content.replace(
      /if \(!isSameOrigin && !isAllowedHost\) {[\s\S]*?return;\s*} else if \(!isLocalhost && isAllowedHost\) {[\s\S]*?res\.setHeader\('Access-Control-Allow-Origin', req\.headers\.origin\);\s*}/,
      `res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
            res.setHeader('Access-Control-Allow-Headers', '*');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }`
    );
    fs.writeFileSync(corsPath, content, 'utf8');
    console.log('[patchCors] Successfully patched CorsMiddleware.js');
  } else if (!content.includes('Access-Control-Allow-Methods')) {
    content = content.replace(
      `res.setHeader('Access-Control-Allow-Credentials', 'true');`,
      `res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
            res.setHeader('Access-Control-Allow-Headers', '*');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }`
    );
    fs.writeFileSync(corsPath, content, 'utf8');
    console.log('[patchCors] Successfully updated CorsMiddleware.js with preflight options');
  } else {
    console.log('[patchCors] CorsMiddleware.js already fully patched');
  }
}

// 3. Patch AudioPlayer.web.js to handle autoplay restrictions gracefully
const audioPlayerWebPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-audio',
  'build',
  'AudioPlayer.web.js'
);

if (fs.existsSync(audioPlayerWebPath)) {
  let playerContent = fs.readFileSync(audioPlayerWebPath, 'utf8');
  if (playerContent.includes('this.media.play();\n        this.isPlaying = true;')) {
    playerContent = playerContent.replace(
      'this.media.play();\n        this.isPlaying = true;',
      `try {
            const p = this.media.play();
            if (p && typeof p.catch === 'function') {
                p.catch((err) => {
                    console.warn('[AudioPlayerWeb] Play thwarted by browser:', err);
                });
            }
        } catch (err) {
            console.warn('[AudioPlayerWeb] Play sync error:', err);
        }
        this.isPlaying = true;`
    );
    fs.writeFileSync(audioPlayerWebPath, playerContent, 'utf8');
    console.log('[patchCors] Successfully patched AudioPlayer.web.js play() error handler');
  }
}
