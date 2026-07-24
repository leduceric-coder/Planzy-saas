import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

// Tests end-to-end « Feux France ». L'app démarre en mode démonstration
// (sans FIRMS_MAP_KEY) et les appels réseau sont simulés dans les tests
// (page.route). Aucune dépendance à l'API NASA réelle.
const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = `http://127.0.0.1:${PORT}`

// Chromium pré-installé dans l'environnement (évite « playwright install »).
// Surchargé par PW_CHROMIUM_PATH si besoin ; sinon Playwright utilise son propre
// navigateur téléchargé.
const chromiumPath =
  process.env.PW_CHROMIUM_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const useSystemChromium = existsSync(chromiumPath)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    ...(useSystemChromium
      ? { launchOptions: { executablePath: chromiumPath } }
      : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: undefined } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: undefined } },
  ],
  webServer: {
    // Build de production puis démarrage : le serveur de dev repose sur un
    // websocket HMR indisponible dans certains environnements, ce qui empêche
    // le chargement différé de la carte. La prod est déterministe.
    command: `npm run build && npx next start -p ${PORT}`,
    // Sonde de santé sur /feux (route publique, indépendante de Supabase).
    url: `${BASE_URL}/feux`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // Force le mode démonstration (pas de clé) + nom d'app stable.
      FIRMS_MAP_KEY: '',
      NEXT_PUBLIC_APP_NAME: 'Feux France',
    },
  },
})
