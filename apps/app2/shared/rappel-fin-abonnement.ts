/**
 * Le rappel par courriel avant la fin d'un abonnement Flowvent — à qui l'envoyer, et ce qu'il dit.
 *
 * Décision de l'utilisateur (rapport « Tarifs de Flowvent ») : on prévient AVANT la fin d'une
 * période, et en particulier avant la fin d'un avantage de code promo. Le paiement étant simulé,
 * aucun abonnement ne se renouvelle seul : toute période qui s'achève mérite un rappel, sans quoi la
 * formule gratuite s'appliquerait sans que personne l'ait vu venir.
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import de valeur) : un test d'app1 le transpile et
 * l'exécute tel quel (cf. apps/app1/test/unit/utils/flowvent-rappel-fin-abonnement.test.ts).
 */

/** Combien de jours avant la fin le rappel part. */
export const JOURS_AVANT_RAPPEL = 15

export interface AbonnementARappeler {
  status: string
  currentPeriodEnd: Date | string
  /** La fin de période pour laquelle un rappel est déjà parti (un seul par période). */
  endReminderFor: Date | string | null
}

/** Faut-il envoyer le rappel de cette période ? Actif, fin dans 15 jours au plus, pas déjà envoyé. */
export function doitRappeler(a: AbonnementARappeler, maintenant: Date): boolean {
  if (a.status !== 'active') return false
  const fin = new Date(a.currentPeriodEnd)
  if (fin <= maintenant) return false
  if (fin.getTime() - maintenant.getTime() > JOURS_AVANT_RAPPEL * 24 * 60 * 60 * 1000) return false
  return !a.endReminderFor || new Date(a.endReminderFor).getTime() !== fin.getTime()
}

export interface ContenuRappel {
  /** Le nom à saluer : le prénom, à défaut le pseudo (jamais nul). */
  nom: string
  /** « Festival annuel ». */
  formule: string
  fin: Date | string
  code: { code: string; advantage: string; duration: string } | null
  advantageEndsAt: Date | string | null
  lienTarifs: string
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

function jour(d: Date | string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

/** Le sujet, le corps HTML et le corps texte du rappel. */
export function contenuRappel(c: ContenuRappel): { subject: string; html: string; text: string } {
  const fin = jour(c.fin)
  const gratuit = c.code?.advantage === 'free'
  const finAvantage = c.advantageEndsAt ? new Date(c.advantageEndsAt) : null
  const finPeriode = new Date(c.fin)

  const subject = gratuit
    ? `Votre période offerte sur Flowvent se termine le ${fin}`
    : `Votre abonnement Flowvent se termine le ${fin}`

  const phrases: string[] = [
    gratuit
      ? `Votre formule ${c.formule}, offerte par le code ${c.code!.code}, prend fin le ${fin}.`
      : `Votre formule ${c.formule} prend fin le ${fin}.`,
  ]
  if (c.code && !gratuit) {
    if (c.code.duration === 'forever') {
      phrases.push(
        `Votre code ${c.code.code} reste acquis : il s'appliquera de nouveau à votre prochaine souscription.`
      )
    } else if (finAvantage && finAvantage > finPeriode) {
      phrases.push(
        `La remise de votre code ${c.code.code} court jusqu'au ${jour(finAvantage)} : elle s'appliquera à votre renouvellement.`
      )
    } else {
      phrases.push(`La remise de votre code ${c.code.code} prend fin avec cette période.`)
    }
  }
  phrases.push(
    'Pour continuer, renouvelez votre formule : la nouvelle période commencera à la fin de celle-ci.',
    "Sans renouvellement, vous reviendrez à la formule gratuite Découverte : rien n'est supprimé, mais ses plafonds s'appliqueront aux nouveaux ajouts, et si vous avez plus d'un événement en cours, leur gestion passera en lecture seule jusqu'à ce que vous en archiviez."
  )

  const html = `<div>
  <p>Bonjour ${echapper(c.nom)},</p>
${phrases.map((p) => `  <p>${echapper(p)}</p>`).join('\n')}
  <p><a href="${echapper(c.lienTarifs)}">Renouveler ma formule</a></p>
</div>`
  const text = [
    `Bonjour ${c.nom},`,
    '',
    ...phrases,
    '',
    `Renouveler ma formule : ${c.lienTarifs}`,
  ].join('\n')
  return { subject, html, text }
}
