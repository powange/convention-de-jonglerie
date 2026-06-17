// Layer « artists » — module artistes (espace artiste + gestion + candidatures + repas artistes).
// Découplé du domaine côté serveur via server/artists/ports : setArtistInfo (écriture Edition) et
// meals.getEnabledMeals (catalogue repas). Les lectures de permission passent par #server.
export default defineNuxtConfig({})
