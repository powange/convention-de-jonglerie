<template>
  <div
    ref="conteneur"
    class="h-64 w-full overflow-hidden rounded-lg border border-default bg-elevated"
    role="img"
    :aria-label="`Carte du lieu : ${titre}`"
  />
</template>

<script setup lang="ts">
/**
 * Petite carte du lieu d'un événement sur sa page publique : un repère sur ses coordonnées GPS,
 * fond OpenStreetMap. Lecture seule.
 *
 * Leaflet est chargé comme dans le layer de la carte (`useLeafletEditable`) : script et feuille de
 * style depuis unpkg, une seule fois par page. La carte n'est PAS gardée dans un ref réactif : un
 * proxy Vue autour d'une carte Leaflet casse ses ajouts de calques en silence.
 */
const props = defineProps<{ latitude: number; longitude: number; titre: string }>()

const conteneur = ref<HTMLElement | null>(null)
let carte: { remove: () => void } | null = null

/*
 * Le strict nécessaire de Leaflet, typé à la main : la bibliothèque est chargée depuis unpkg, et
 * Flowvent n'en installe pas les types (`import('leaflet')` ne se résout pas au typage).
 */
interface CalqueLeaflet {
  addTo: (carte: CarteLeaflet) => unknown
}
interface CarteLeaflet {
  setView: (position: [number, number], zoom: number) => CarteLeaflet
  remove: () => void
}
interface Leaflet {
  map: (el: HTMLElement, options?: Record<string, unknown>) => CarteLeaflet
  tileLayer: (url: string, options?: Record<string, unknown>) => CalqueLeaflet
  divIcon: (options: Record<string, unknown>) => unknown
  marker: (position: [number, number], options?: Record<string, unknown>) => CalqueLeaflet
}

function chargerLeaflet(): Promise<Leaflet> {
  const w = window as unknown as { L?: Leaflet }
  if (w.L) return Promise.resolve(w.L)
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const lien = document.createElement('link')
    lien.rel = 'stylesheet'
    lien.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    lien.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
    lien.crossOrigin = ''
    document.head.appendChild(lien)
  }
  return new Promise((resolve, reject) => {
    const existant = document.querySelector<HTMLScriptElement>('script[src*="leaflet@1.9.4"]')
    const script = existant ?? document.createElement('script')
    script.addEventListener('load', () =>
      w.L ? resolve(w.L) : reject(new Error('Leaflet absent'))
    )
    script.addEventListener('error', () => reject(new Error('Leaflet non chargé')))
    if (!existant) {
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
      script.crossOrigin = ''
      script.async = true
      document.head.appendChild(script)
    }
  })
}

onMounted(async () => {
  try {
    const L = await chargerLeaflet()
    if (!conteneur.value) return
    const position: [number, number] = [props.latitude, props.longitude]
    const m = L.map(conteneur.value, { scrollWheelZoom: false }).setView(position, 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; contributeurs OpenStreetMap',
    }).addTo(m)
    // Un repère dessiné en CSS : l'icône par défaut de Leaflet pointe vers des images absentes.
    const icone = L.divIcon({
      className: '',
      html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#ff6a00;border:3px solid white;box-shadow:0 1px 4px rgb(0 0 0 / .4)"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })
    L.marker(position, { icon: icone, title: props.titre }).addTo(m)
    carte = m
  } catch (erreur) {
    console.warn('[carte du lieu] non affichée :', erreur)
  }
})

onBeforeUnmount(() => carte?.remove())
</script>
