/**
 * Le gabarit des courriels de Flowvent — l'habillage écrit UNE fois, que portent tous les envois
 * (vérification de compte, mot de passe, invitation, créneaux de bénévolat, rappel de fin
 * d'abonnement, alerte de plafond).
 *
 * Contraintes des clients de messagerie, qui dictent la forme :
 * - mise en page en TABLEAUX et styles EN LIGNE : Gmail retire les `<style>` dans bien des cas,
 *   Outlook ignore flexbox et la plupart des propriétés modernes ;
 * - largeur fixe de 560 px, qui se replie sur mobile (`width:100%` + `max-width`) ;
 * - une image seulement, le pictogramme (PNG, servi par le site) : le nom « Flowvent » est écrit en
 *   texte à côté, si bien que l'en-tête reste lisible quand les images sont bloquées ;
 * - bouton « à l'épreuve des balles » (lien stylé dans une cellule), doublé du lien en clair.
 *
 * Charte : l'orange de marque #FF6A00 en filet et dans le nom ; le bouton prend un orange plus
 * soutenu (#EA580C) pour que son texte blanc reste lisible.
 *
 * Tout ce qui vient de l'appelant est ÉCHAPPÉ ici : un prénom ou un nom d'événement contenant du
 * HTML ne doit rien injecter.
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import) : un test d'app1 le transpile et l'exécute
 * tel quel (apps/app1/test/unit/utils/flowvent-gabarit-courriel.test.ts).
 */

export interface ContenuCourriel {
  /** Le titre affiché en tête du message. */
  titre: string
  /** Texte d'aperçu montré par les messageries à côté du sujet (invisible dans le message). */
  apercu?: string
  /** « Bonjour Camille, » — sans la virgule. */
  salutation?: string
  /** Paragraphes de texte brut, échappés. */
  paragraphes: string[]
  /** Un code à recopier (vérification), affiché en grand. */
  code?: string
  /** Une liste à puces (créneaux…), en texte brut. */
  liste?: string[]
  /** L'action principale. */
  bouton?: { libelle: string; url: string }
  /** Précision discrète sous le bouton (durée de validité…). */
  note?: string
  /** Pourquoi la personne reçoit ce courriel (pied de page). */
  raison?: string
  /** L'adresse du site (liens du pied de page et du pictogramme). */
  siteUrl: string
}

const ORANGE = '#FF6A00'
const ORANGE_BOUTON = '#EA580C'
const ENCRE = '#1C1917'
const TEXTE = '#3F3A36'
const DISCRET = '#78716C'
const FOND = '#F5F5F4'
const BORDURE = '#E7E5E4'
const POLICE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Typographie française : espace insécable à l'intérieur des guillemets et devant « : ; ! ? »,
 * pour qu'une ligne ne se coupe pas entre un mot et sa ponctuation (« Festival des Balles » ne
 * doit pas laisser son guillemet seul en fin de ligne).
 */
export function typographie(texte: string): string {
  return texte
    .replace(/« /g, '«\u00a0')
    .replace(/ »/g, '\u00a0»')
    .replace(/ ([:;!?])/g, '\u00a0$1')
}

/** Le nom d'hôte de l'adresse du site (« flowvent.org »), pour le pied de page. */
function hote(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

/** Le message complet, en HTML prêt à envoyer. */
export function gabaritCourriel(c: ContenuCourriel): string {
  const e = echapperHtml
  /** Un texte affiché (et non une adresse) : typographie, puis échappement. */
  const t = (texte: string) => echapperHtml(typographie(texte))
  const site = c.siteUrl.replace(/\/$/, '')
  const p = (texte: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${TEXTE};">${t(texte)}</p>`

  const blocs: string[] = []
  if (c.salutation) blocs.push(p(`${c.salutation},`))
  for (const paragraphe of c.paragraphes) blocs.push(p(paragraphe))

  if (c.code) {
    // `class="code"` : le journal de simulation l'y relève (layers/core/server/socle/envoi-courriel.ts).
    blocs.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
          <tr><td align="center" style="background:${FOND};border:1px solid ${BORDURE};border-radius:10px;padding:18px 12px;">
            <span class="code" style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${ENCRE};">${e(c.code)}</span>
          </td></tr>
        </table>`)
  }

  if (c.liste?.length) {
    const items = c.liste
      .map(
        (l) =>
          `<tr><td style="padding:10px 14px;border-bottom:1px solid ${BORDURE};font-size:15px;line-height:1.5;color:${TEXTE};">${t(l)}</td></tr>`
      )
      .join('')
    blocs.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${BORDURE};border-radius:10px;border-collapse:separate;overflow:hidden;">${items}</table>`
    )
  }

  if (c.bouton) {
    blocs.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
          <tr><td style="border-radius:8px;background:${ORANGE_BOUTON};">
            <a href="${e(c.bouton.url)}" style="display:inline-block;padding:13px 24px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${t(c.bouton.libelle)}</a>
          </td></tr>
        </table>`)
  }
  if (c.note) {
    blocs.push(
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${DISCRET};">${t(c.note)}</p>`
    )
  }
  if (c.bouton) {
    blocs.push(`<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${DISCRET};">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          <a href="${e(c.bouton.url)}" style="color:${ORANGE_BOUTON};word-break:break-all;">${e(c.bouton.url)}</a></p>`)
  }

  const apercu = c.apercu
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${t(c.apercu)}</div>`
    : ''

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${t(c.titre)}</title>
</head>
<body style="margin:0;padding:0;background:${FOND};">
${apercu}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FOND};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${POLICE};">
      <tr><td style="padding:0 4px 20px;">
        <a href="${e(site)}" style="text-decoration:none;">
          <img src="${e(site)}/favicons/favicon-96x96.png" width="36" height="36" alt="" style="vertical-align:middle;border:0;border-radius:8px;">
          <span style="vertical-align:middle;margin-left:10px;font-size:20px;font-weight:700;color:${ENCRE};">Flow<span style="color:${ORANGE};">vent</span></span>
        </a>
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid ${BORDURE};border-top:4px solid ${ORANGE};border-radius:12px;padding:32px 32px 28px;">
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:${ENCRE};">${t(c.titre)}</h1>
        ${blocs.join('\n        ')}
      </td></tr>
      <tr><td style="padding:20px 4px 0;font-size:13px;line-height:1.6;color:${DISCRET};">
        <p style="margin:0 0 6px;">L'équipe Flowvent</p>
        ${c.raison ? `<p style="margin:0 0 6px;">${t(c.raison)}</p>` : ''}
        <p style="margin:0;"><a href="${e(site)}" style="color:${DISCRET};text-decoration:underline;">${e(hote(site))}</a> — le flow de vos événements</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
