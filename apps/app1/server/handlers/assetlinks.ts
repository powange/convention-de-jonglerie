import { empreintesDeSignature, lienVersApplication } from '#server/utils/liens-application-android'

/**
 * Digital Asset Links : la preuve que ce domaine et l'application Android sont la même chose.
 *
 * ⚠️ C'EST LE FICHIER QUI DÉCIDE si le TWA du Play Store s'ouvre en plein écran ou avec la barre
 * d'adresse de Chrome par-dessus. Android le télécharge au premier lancement ; s'il est absent,
 * illisible, ou si l'empreinte ne correspond pas, l'application s'affiche comme un navigateur
 * déguisé — et une application qui ressemble à un navigateur déguisé se fait refuser à l'examen.
 *
 * ⚠️ RIEN N'ÉCHOUE BRUYAMMENT : pas d'erreur, pas de journal côté serveur, juste une barre
 * d'adresse en haut de l'écran. C'est le genre de défaut qu'on met des heures à rattacher à sa
 * cause.
 *
 * ⚠️ L'EMPREINTE EST CELLE DE GOOGLE, PAS LA VÔTRE. Avec « Play App Signing » — le mode retenu —
 * la clé qui signe réellement l'application livrée est détenue par Google : celle que l'on garde
 * localement ne sert qu'à ENVOYER. L'empreinte à publier ici se relève dans la console Play, sous
 * « Intégrité de l'application › Signature d'application », après le premier envoi. Y mettre
 * l'empreinte de la clé d'envoi est l'erreur classique, et elle produit exactement le même
 * symptôme muet.
 *
 * ⚠️ POURQUOI IL N'EST PAS DANS `server/routes/.well-known/`, où le nom du fichier aurait suffi à
 * poser la route. Parce que ce dossier commence par un POINT, et qu'un scan de système de fichiers
 * qui saute les dossiers cachés est un comportement banal. Le serveur de développement le sert
 * bien — mais dev et build ne font pas tourner le même code, et l'oubli de cette route à la
 * construction ne produirait aucune erreur : juste un 404, donc la barre d'adresse de Chrome, donc
 * le symptôme que tout ce fichier existe pour éviter.
 *
 * Il est donc déclaré à la main dans `nitro.handlers` (nuxt.config.ts), ce qui ne dépend d'aucune
 * convention de nommage. `server/handlers/` n'est pas un dossier scanné par Nitro : rien n'est
 * enregistré deux fois.
 *
 * ⚠️ POURQUOI UNE ROUTE ET NON UN FICHIER DANS `public/`. Deux raisons, dans cet ordre :
 *
 * 1. L'empreinte n'est connue qu'APRÈS le premier envoi sur le Play Store. En variable
 *    d'environnement, la corriger est un redémarrage ; dans `public/`, c'est une reconstruction
 *    d'image et un déploiement.
 * 2. `public/` passe par le cache de Cloudflare, réglé à quatre heures sur ce site. Une empreinte
 *    fautive y resterait servie bien après sa correction, et l'on chercherait le défaut dans
 *    l'application. Ici, l'en-tête de cache est court et posé explicitement.
 */
export default defineEventHandler((event) => {
  const empreintes = empreintesDeSignature(process.env.ANDROID_SIGNING_FINGERPRINTS)

  /*
   * Une heure, et non un jour. Android relit ce fichier rarement, mais une empreinte fausse est
   * précisément ce qu'on veut pouvoir corriger vite — un cache long transformerait une faute de
   * frappe en attente d'une journée.
   *
   * 📍 En développement, Nitro impose `no-cache` par-dessus cette valeur : la réponse observée sur
   * `localhost` ne dit donc rien de ce que servira la production. Ce n'est pas gênant en soi —
   * `no-cache` fait revalider, ce qui est plus sûr que trop de cache — mais c'est à reconstater
   * sur le domaine de production plutôt qu'à supposer.
   */
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')

  /*
   * Un tableau VIDE tant qu'aucune empreinte n'est configurée, et surtout pas une entrée avec une
   * empreinte d'exemple. Le tableau vide est un « aucune application n'est associée », que Chrome
   * traite comme tel ; une fausse empreinte serait un « cette application-ci est associée », et
   * la vraie se verrait alors refuser sans qu'on comprenne pourquoi.
   */
  return empreintes.map((empreinte) => lienVersApplication(empreinte))
})
