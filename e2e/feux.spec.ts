import { test, expect } from '@playwright/test'
import {
  mockFirms,
  mockFirmsError,
  mockGeocode,
  blockExternal,
  waitForMarkers,
} from './fixtures'

test.beforeEach(async ({ page }) => {
  await blockExternal(page)
  await mockGeocode(page)
})

test('ouverture de l’application et affichage de la carte', async ({ page }) => {
  await mockFirms(page)
  await page.goto('/feux')

  await expect(page.getByRole('heading', { name: 'Feux France' })).toBeVisible()
  await expect(page.getByTestId('map-container')).toBeVisible()
  // Avertissement de prudence présent.
  await expect(page.getByText(/détections satellitaires de chaleur/i)).toBeVisible()
  await expect(page.getByText(/appelez le/i)).toBeVisible()
})

test('affiche le nombre de détections simulées', async ({ page }) => {
  await mockFirms(page)
  await page.goto('/feux')
  await waitForMarkers(page)
  // 3 détections dans la fixture.
  await expect(page.getByText(/3 détections/)).toBeVisible()
})

test('zoom et déplacement de la carte', async ({ page }) => {
  await mockFirms(page)
  await page.goto('/feux')
  await waitForMarkers(page)

  const zoomBefore = await page.evaluate(() => {
    // @ts-expect-error hook de test
    return window.__feuxMap.getZoom()
  })
  await page.getByLabel('Zoom in').click()
  await page.waitForTimeout(500)
  const zoomAfter = await page.evaluate(() => {
    // @ts-expect-error hook de test
    return window.__feuxMap.getZoom()
  })
  expect(zoomAfter).toBeGreaterThan(zoomBefore)

  // Déplacement (panBy) programmatique.
  const centerBefore = await page.evaluate(() => {
    // @ts-expect-error hook de test
    const c = window.__feuxMap.getCenter()
    return { lng: c.lng, lat: c.lat }
  })
  await page.evaluate(() => {
    // @ts-expect-error hook de test
    window.__feuxMap.panBy([200, 120], { duration: 0 })
  })
  await page.waitForTimeout(400)
  const centerAfter = await page.evaluate(() => {
    // @ts-expect-error hook de test
    const c = window.__feuxMap.getCenter()
    return { lng: c.lng, lat: c.lat }
  })
  expect(centerAfter.lng !== centerBefore.lng || centerAfter.lat !== centerBefore.lat).toBeTruthy()
})

test('ouverture d’une fiche de détection au clic sur un marqueur', async ({ page }) => {
  await mockFirms(page)
  await page.goto('/feux')
  await waitForMarkers(page)

  const box = await page.getByTestId('map-container').boundingBox()
  expect(box).not.toBeNull()

  // Clique sur un marqueur réellement rendu (robuste quel que soit le viewport).
  const xy = await page.evaluate(() => {
    // @ts-expect-error hook de test
    const m = window.__feuxMap
    const feats = m.queryRenderedFeatures({ layers: ['markers'] })
    if (!feats.length) return null
    const c = feats[0].geometry.coordinates
    const p = m.project(c)
    return { x: p.x, y: p.y }
  })
  expect(xy).not.toBeNull()
  await page.mouse.click(box!.x + xy!.x, box!.y + xy!.y)

  const sheet = page.getByTestId('detail-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Détection satellite', { exact: true })).toBeVisible()
  await expect(sheet.getByText(/Satellite \/ capteur/)).toBeVisible()
  await expect(sheet.getByText(/confirmation officielle/i)).toBeVisible()
})

test('changement de période relance une requête avec le bon paramètre', async ({ page }) => {
  await mockFirms(page)
  await page.goto('/feux')
  await waitForMarkers(page)

  // Ouvre les filtres si mobile (bouton visible seulement < lg).
  const filtersToggle = page.getByRole('button', { name: 'Ouvrir les filtres' })
  if (await filtersToggle.isVisible()) await filtersToggle.click()

  const reqPromise = page.waitForRequest((r) => r.url().includes('/api/firms') && r.url().includes('period=6'))
  await page.getByRole('radio', { name: '6 h' }).first().click()
  await reqPromise
})

test('recherche géographique centre la carte sans vider les détections', async ({ page }) => {
  await mockFirms(page)
  await page.goto('/feux')
  await waitForMarkers(page)

  const search = page.getByRole('combobox', { name: /Rechercher une commune/i })
  await search.fill('Marseille')
  const option = page.getByRole('option', { name: /Marseille/ })
  await expect(option).toBeVisible()
  await option.click()

  // La carte se recentre près de Marseille (lng ≈ 5.37, lat ≈ 43.30).
  await page.waitForTimeout(1500)
  const center = await page.evaluate(() => {
    // @ts-expect-error hook de test
    const c = window.__feuxMap.getCenter()
    return { lng: c.lng, lat: c.lat }
  })
  expect(Math.abs(center.lng - 5.3698)).toBeLessThan(1)
  expect(Math.abs(center.lat - 43.2965)).toBeLessThan(1)

  // Les détections ne sont pas supprimées : le compteur reste à 3 (elles sont
  // simplement hors de la vue rapprochée sur Marseille).
  await expect(page.getByText(/3 détections/)).toBeVisible()
})

test('gestion de l’erreur API : bandeau discret affiché', async ({ page }) => {
  await mockFirmsError(page)
  await page.goto('/feux')
  await expect(page.getByTestId('map-container')).toBeVisible()
  await expect(page.getByText(/temporairement indisponibles/i)).toBeVisible()
})

test('basculement du thème clair/sombre', async ({ page }) => {
  await mockFirms(page)
  await page.goto('/feux')
  const before = await page.evaluate(() => document.documentElement.classList.contains('light'))
  await page.getByRole('button', { name: /mode (sombre|clair)/i }).click()
  const after = await page.evaluate(() => document.documentElement.classList.contains('light'))
  expect(after).not.toBe(before)
})

test('affichage mobile : bouton filtres et bottom sheet', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'spécifique au projet mobile')
  await mockFirms(page)
  await page.goto('/feux')
  const toggle = page.getByRole('button', { name: 'Ouvrir les filtres' })
  await expect(toggle).toBeVisible()
  await toggle.click()
  const dialog = page.getByRole('dialog', { name: 'Filtres' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('filter-panel')).toBeVisible()
})
