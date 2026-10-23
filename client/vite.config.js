import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function iplSongPlugin(command) {
  const virtualId = 'virtual:ipl-song';
  const resolvedVirtualId = '\0' + virtualId;

  return {
    name: 'ipl-song-loader',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
    },
    load(id) {
      if (id === resolvedVirtualId) {
        if (command === 'serve') {
          return "export default '/@iplsong';";
        }
        const songDir = path.resolve(__dirname, 'src/iplsong');
        const songFile = fs.readdirSync(songDir).find((f) => f.endsWith('.mp3'));
        if (songFile) {
          const filePath = path.join(songDir, songFile);
          const ref = this.emitFile({
            type: 'asset',
            name: 'ipl-song.mp3',
            source: fs.readFileSync(filePath)
          });
          return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
        }
        return "export default '';";
      }
    },
    configureServer(server) {
      server.middlewares.use('/@iplsong', (req, res) => {
        const songDir = path.resolve(__dirname, 'src/iplsong');
        const songFile = fs.readdirSync(songDir).find((f) => f.endsWith('.mp3'));
        if (!songFile) {
          res.statusCode = 404;
          return res.end();
        }
        const filePath = path.join(songDir, songFile);
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': stat.size,
          'Accept-Ranges': 'bytes'
        });
        fs.createReadStream(filePath).pipe(res);
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), iplSongPlugin(command)],
  assetsInclude: ['**/*.mp3'],
  server: {
    port: 5173,
    host: true, // Listen on all local IP addresses so projector/phones can view
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  }
}));
