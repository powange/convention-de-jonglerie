import countries from 'i18n-iso-countries'
// Imports statiques pour éviter les problèmes d'import dynamique avec Vite
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
 * Plugin client pour initialiser les locales i18n-iso-countries.
 * Charge toutes les locales supportées au démarrage.
 */
export default defineNuxtPlugin(() => {
  // Enregistrer toutes les locales supportées
  const locales = [cs, da, de, en, es, fr, it, nl, pl, pt, ru, sv, uk]

  for (const locale of locales) {
    countries.registerLocale(locale)
  }
})
