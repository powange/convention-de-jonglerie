import countries from 'i18n-iso-countries'
// Imports statiques pour éviter les erreurs de type: json en ESM
import cs from 'i18n-iso-countries/langs/cs.json'
import da from 'i18n-iso-countries/langs/da.json'
import de from 'i18n-iso-countries/langs/de.json'
import en from 'i18n-iso-countries/langs/en.json'
import es from 'i18n-iso-countries/langs/es.json'
import fr from 'i18n-iso-countries/langs/fr.json'
import it from 'i18n-iso-countries/langs/it.json'
import nl from 'i18n-iso-countries/langs/nl.json'
import pl from 'i18n-iso-countries/langs/pl.json'
import pt from 'i18n-iso-countries/langs/pt.json'
import ru from 'i18n-iso-countries/langs/ru.json'
import sv from 'i18n-iso-countries/langs/sv.json'
import uk from 'i18n-iso-countries/langs/uk.json'

/**
 * Plugin Nitro pour initialiser les locales i18n-iso-countries côté serveur.
 * Charge toutes les locales supportées par l'application au démarrage.
 * Le cache est partagé entre toutes les requêtes (module-level singleton).
 */
export default defineNitroPlugin(() => {
  console.log('[countries] Initialisation des locales i18n-iso-countries...')

  // Enregistrer toutes les locales supportées
  const locales = [cs, da, de, en, es, fr, it, nl, pl, pt, ru, sv, uk]

  for (const locale of locales) {
    countries.registerLocale(locale)
  }

  console.log(`[countries] ${locales.length} locales chargées`)
})
