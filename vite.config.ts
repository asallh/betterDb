import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import pkg from './package.json'
import { brandIconSrcForVersion } from './shared/version'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const appChannel = command === 'serve' ? 'dev' : 'auto'
  const faviconHref = brandIconSrcForVersion(pkg.version, appChannel)

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_CHANNEL__: JSON.stringify(appChannel),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      {
        name: 'betterdb-channel-favicon',
        transformIndexHtml(html) {
          if (faviconHref === './betterDB.png') return html
          return html.replace(
            'href="./betterDB.png"',
            `href="${faviconHref}"`,
          )
        },
      },
      react(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: {
                external: [
                  'pg',
                  'mssql',
                  'mysql2',
                  'oracledb',
                  'better-sqlite3',
                  'mongodb',
                  'ioredis',
                  'duckdb',
                  'ibm_db',
                  'snowflake-sdk',
                  '@clickhouse/client',
                  '@google-cloud/bigquery',
                  'electron-updater',
                  'dockerode',
                ],
              },
            },
          },
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: path.join(__dirname, 'electron/preload.ts'),
        },
        // Ployfill the Electron and Node.js API for Renderer process.
        // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
        // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
        renderer: process.env.NODE_ENV === 'test'
          // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
          ? undefined
          : {},
      }),
    ],
  }
})
