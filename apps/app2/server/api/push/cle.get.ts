import { clePubliquePush } from '../../utils/push'

/**
 * La clé publique VAPID, que le navigateur présente pour s'abonner (`applicationServerKey`), ou
 * `null` quand le push est éteint (clés absentes) : l'interface n'en propose alors pas l'activation.
 * Publique par nature : sans la clé privée, elle ne permet d'envoyer à personne.
 */
export default defineEventHandler(() => ({ clePublique: clePubliquePush() }))
