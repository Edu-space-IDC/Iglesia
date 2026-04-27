import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function readAdminEnv() {
  const envPath = path.resolve(__dirname, '.env.admin')

  try {
    const fileContents = readFileSync(envPath, 'utf8')
    return Object.fromEntries(
      fileContents
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separatorIndex = line.indexOf('=')
          const key = line.slice(0, separatorIndex).trim()
          const rawValue = line.slice(separatorIndex + 1).trim()
          const cleanedValue = rawValue.replace(/^"(.*)"$/u, '$1').replace(/^'(.*)'$/u, '$1')
          return [key, cleanedValue]
        }),
    )
  } catch {
    return {}
  }
}

const adminEnv = readAdminEnv()
const adminServerHost = adminEnv.ADMIN_SERVER_HOST || '127.0.0.1'
const adminServerPort = adminEnv.ADMIN_SERVER_PORT || '8787'

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api/admin': {
        target: `http://${adminServerHost}:${adminServerPort}`,
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
