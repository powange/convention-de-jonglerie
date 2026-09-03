import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import CronsPage from '../../../../app/pages/admin/crons.vue'

/**
 * Statut du système de tâches sur la page d'administration des crons.
 *
 * La page annonçait « inactif » en permanence, y compris en production où les tâches tournent :
 * elle lisait `cronEnabled` à la racine de la réponse, alors que les points d'API du dépôt
 * répondent `{ success, data }` via `createSuccessResponse`. La liste des tâches était vide pour
 * la même raison, et personne ne l'avait relevé.
 *
 * Le test sert l'enveloppe RÉELLE et vérifie ce que la page en affiche. Éprouver le
 * déballage lui-même (`payload?.data ?? payload`) ne prouverait rien : c'est le chemin de lecture
 * qui était faux, pas l'opérateur.
 */
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

registerEndpoint('/api/admin/tasks', () => ({
  success: true,
  data: {
    tasks: [
      {
        name: 'cleanup-temp-uploads',
        description: 'Supprime les images abandonnées',
        schedule: 'Toutes les heures',
        cronExpression: '15 * * * *',
        category: 'Maintenance',
      },
    ],
    totalTasks: 1,
    cronEnabled: true,
    timestamp: '2026-09-03T12:00:00.000Z',
  },
}))

describe('Administration des crons', () => {
  it('annonce le système actif quand la réponse le dit, et liste les tâches', async () => {
    const page = await mountSuspended(CronsPage)
    const texte = page.text()

    expect(texte, 'le statut doit suivre `data.cronEnabled`').toContain('admin.cron_system_active')
    expect(texte).not.toContain('admin.cron_system_inactive')
    // La liste vient de la même enveloppe : la vider était l'autre symptôme du même défaut.
    // L'intitulé passe par la traduction, la description est rendue telle quelle.
    expect(texte, 'aucune tâche affichée').toContain('Supprime les images abandonnées')
  })
})
