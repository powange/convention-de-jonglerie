import { describe, expect, it } from 'vitest'

import { extractHelloAssoTiers } from '../../../server/utils/helloasso-tiers-extractor'

/**
 * Ce que le JSON-LD de HelloAsso ne dit pas.
 *
 * Il annonce « PASS 3 JOURS, 25€ » et s'arrête là. La phrase qui suit sur la page — « donne accès
 * au gymnase (+douches), aux spectacles+GALA, ateliers, camping & aux petits déj' ! » — est celle
 * qui nomme les services rendus, et c'est elle qu'on vient chercher dans le corps de la page.
 *
 * Le balisage ci-dessous est celui de la vraie page, réduit à deux tarifs.
 */
const PAGE = `
<div class="Tickets StepTransition">
  <div data-test="row-unique" class="CampaignTier">
    <div class="CampaignTierWrapper">
      <div class="tier-item-description" data-v-5fae5562="">
        <p class="tier-item-description__title" data-v-5fae5562="">
          PASS 3 JOURS
          <!---->
        </p>
        <p class="tier-item-description__description" data-v-5fae5562="">
          <span data-v-5fae5562="">du VENDREDI 02 au DIMANCHE 04
[30&euro; sur place]
donne acc&egrave;s au gymnase (+douches), aux spectacles+GALA, ateliers, camping &amp; aux petits d&#39;j !</span>
        </p>
      </div>
      <div class="tier-item-price" data-v-1e679d70="">
        <p class="tier-item-price-fixed" data-v-2c94ac09="">
          25&euro;
          <!---->
        </p>
      </div>
    </div>
  </div>
  <div data-test="row-unique" class="CampaignTier">
    <div class="CampaignTierWrapper">
      <div class="tier-item-description" data-v-5fae5562="">
        <p class="tier-item-description__title" data-v-5fae5562="">SAM-03 : GALA 21H (Adulte)</p>
        <p class="tier-item-description__description" data-v-5fae5562="">
          <span>UNIQUEMENT pour le GALA du SAMEDI 21H</span>
        </p>
      </div>
      <div class="tier-item-price">
        <p class="tier-item-price-fixed">6&euro;</p>
      </div>
    </div>
  </div>
</div>
`

describe('extractHelloAssoTiers', () => {
  it('relève chaque tarif avec son prix', () => {
    const tarifs = extractHelloAssoTiers(PAGE)

    expect(tarifs.map((t) => [t.nom, t.prix])).toEqual([
      ['PASS 3 JOURS', '25€'],
      ['SAM-03 : GALA 21H (Adulte)', '6€'],
    ])
  })

  it('rapporte la description, qui seule nomme les services', () => {
    const [pass] = extractHelloAssoTiers(PAGE)

    expect(pass?.description).toContain('gymnase (+douches)')
    expect(pass?.description).toContain('camping & aux petits')
    expect(pass?.description).toContain('[30€ sur place]')
  })

  it("n'attribue pas à un tarif le prix du suivant", () => {
    // Le découpage court d'un intitulé au suivant : c'est ce qui empêche le prix du GALA de
    // remonter sur le PASS quand un bloc n'a pas de description.
    const tarifs = extractHelloAssoTiers(PAGE)

    expect(tarifs[1]?.description).toBe('UNIQUEMENT pour le GALA du SAMEDI 21H')
    expect(tarifs[1]?.prix).toBe('6€')
  })

  it('accepte un tarif sans description', () => {
    const sansDescription = `
      <div class="CampaignTier">
        <p class="tier-item-description__title">ADHÉSION</p>
        <p class="tier-item-price-fixed">10€</p>
      </div>`

    expect(extractHelloAssoTiers(sansDescription)).toEqual([
      { nom: 'ADHÉSION', description: '', prix: '10€' },
    ])
  })

  it('ne rend rien sur une page qui ne présente pas de tarifs', () => {
    expect(extractHelloAssoTiers('<html><body><h1>Une convention</h1></body></html>')).toEqual([])
    expect(extractHelloAssoTiers('')).toEqual([])
  })
})
