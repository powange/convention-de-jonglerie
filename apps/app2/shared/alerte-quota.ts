/**
 * Le courriel qui prévient le propriétaire d'un événement qu'un plafond de sa formule approche
 * (80 %) ou est atteint — décision du 26/11/2026 (rapport « Tarifs de Flowvent », version 2). Un
 * courriel par palier et par compteur, jamais deux : la règle d'envoi est dans
 * server/utils/quotas.ts, le texte ici.
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import de valeur) : un test d'app1 le transpile et
 * l'exécute tel quel (apps/app1/test/unit/utils/flowvent-alerte-quota.test.ts).
 */

export type PalierAlerte = 'alerte' | 'plein'

const RANG: Record<PalierAlerte, number> = { alerte: 1, plein: 2 }

/** Le palier franchi par cet usage : `plein` à la limite, `alerte` dès 80 %, sinon `null`. */
export function palierAlerte(usage: number, plafond: number | null): PalierAlerte | null {
  if (plafond === null || plafond <= 0) return null
  if (usage >= plafond) return 'plein'
  if (usage >= Math.ceil(plafond * 0.8)) return 'alerte'
  return null
}

/** Faut-il écrire, sachant le palier déjà signalé ? Seulement en montant d'un palier. */
export function doitAlerter(palier: PalierAlerte | null, dejaSignale: unknown): boolean {
  if (!palier) return false
  const deja = dejaSignale === 'alerte' || dejaSignale === 'plein' ? RANG[dejaSignale] : 0
  return RANG[palier] > deja
}

export interface ContenuAlerte {
  nom: string
  evenement: string
  /** « bénévoles acceptés », « artistes », « co-organisateurs ». */
  quoi: string
  usage: number
  plafond: number
  /** Ce que la marge laisse encore ajouter au-delà du plafond (0 : aucune marge). */
  marge: number
  formule: string
  /** La formule qui relève ce plafond, ou `null` (sur devis). */
  formuleSuivante: { libelle: string; plafond: number | null } | null
  palier: PalierAlerte
  lienTarifs: string
  lienEvenement: string
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function contenuAlerte(c: ContenuAlerte): {
  subject: string
  html: string
  text: string
  phrases: string[]
} {
  const subject =
    c.palier === 'plein'
      ? `${c.evenement} : la limite de ${c.quoi} de votre formule est atteinte`
      : `${c.evenement} : la limite de ${c.quoi} de votre formule approche`
  const phrases = [
    `${c.evenement} compte ${c.usage} ${c.quoi} sur les ${c.plafond} de votre formule ${c.formule}.`,
    c.palier === 'plein'
      ? c.marge > 0
        ? `Une marge vous permet d'en ajouter encore ${c.marge}. Au-delà, il faudra une formule plus grande.`
        : 'Pour en ajouter, il faudra une formule plus grande.'
      : "Vous approchez de la limite : rien ne presse, mais c'est le moment d'y penser.",
    c.formuleSuivante
      ? `La formule ${c.formuleSuivante.libelle} en comprend ${c.formuleSuivante.plafond ?? 'un nombre illimité'}.`
      : 'Pour aller au-delà, écrivez-nous : nous établirons une formule sur devis.',
    "Rien de ce qui existe n'est retiré ni bloqué.",
  ]
  const html = `<div>
  <p>Bonjour ${echapper(c.nom)},</p>
${phrases.map((p) => `  <p>${echapper(p)}</p>`).join('\n')}
  <p><a href="${echapper(c.lienTarifs)}">Voir les formules</a> · <a href="${echapper(c.lienEvenement)}">Ouvrir l'événement</a></p>
</div>`
  const text = [
    `Bonjour ${c.nom},`,
    '',
    ...phrases,
    '',
    `Voir les formules : ${c.lienTarifs}`,
    `Ouvrir l'événement : ${c.lienEvenement}`,
  ].join('\n')
  // `phrases` : pour l'habillage complet du courriel (shared/gabarit-courriel.ts, côté appelant).
  return { subject, html, text, phrases }
}
