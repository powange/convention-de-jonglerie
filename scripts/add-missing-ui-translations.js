#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Nouvelles traductions à ajouter
const newTranslations = {
  fr: {
    'components.edition_form.poster_placeholder':
      "Cliquez pour sélectionner le poster de l'édition",
    'components.edition_form.poster_alt': "Poster de l'édition",
    'components.edition_form.address_tip':
      'Saisissez une adresse complète dans le champ de recherche pour préremplir automatiquement tous les champs ci-dessous. Une adresse précise permettra aussi de géolocaliser votre édition sur la carte.',
    'components.edition_form.country_placeholder': 'Nom du pays',
    'components.edition_form.convention_description_placeholder': 'Description de la convention',
    'components.edition_form.social_networks_title': 'Réseaux sociaux',
    'components.edition_form.step_general_title': 'Informations Générales',
    'components.edition_form.step_general_description': 'Informations Générales',
    'components.edition_form.step_services_title': 'Services Proposés',
    'components.edition_form.step_visibility_title': 'Visibilité (Réseaux Sociaux)',
    'components.edition_form.step_visibility_description': 'Réseaux Sociaux',
    'components.date_time_picker.placeholder': 'Sélectionner une date',
    'components.country_multi_select.placeholder': 'Sélectionner des pays...',
    'components.convention_form.image_uploaded': 'Image uploadée',
    'components.convention_form.image_deleted': 'Image supprimée',
    'components.collaborators.added': 'Collaborateur ajouté',
    'components.collaborators.add_error': "Impossible d'ajouter le collaborateur",
    'components.collaborators.removed': 'Collaborateur retiré',
    'pages.benevoles.external_mode_active':
      'Mode externe actif : les candidatures sont gérées via un outil tiers.',
    'pages.benevoles.url_label': 'URL:',
    'pages.benevoles.sort_tip': 'Tri: cliquer sur les entêtes (Shift+clic pour multi)',
    'pages.objets_trouves.photo_alt': "Photo de l'objet trouvé",
    'pages.profile.photo_alt': 'Photo de profil',
    'pages.profile.photo_placeholder': 'Cliquez pour changer votre photo de profil',
    'validation.name_min_3': 'Le nom doit contenir au moins 3 caractères',
    'validation.name_max_100': 'Le nom ne peut pas dépasser 100 caractères',
    'validation.name_max_200': 'Le nom ne peut pas dépasser 200 caractères',
    'validation.description_max_1000': 'La description ne peut pas dépasser 1000 caractères',
    'validation.date_end_after_start':
      'La date de fin doit être strictement supérieure à la date de début',
    'validation.date_start_required': 'La date de début est requise',
    'countries.czech_republic': 'République Tchèque',
    'upload.success_message': 'Image uploadée avec succès !',
    'upload.delete_message': 'Image supprimée',
    'upload.error_message': "Erreur d'upload",
  },
  en: {
    'components.edition_form.poster_placeholder': 'Click to select the edition poster',
    'components.edition_form.poster_alt': 'Edition poster',
    'components.edition_form.address_tip':
      'Enter a complete address in the search field to automatically prefill all fields below. A precise address will also allow your edition to be geolocated on the map.',
    'components.edition_form.country_placeholder': 'Country name',
    'components.edition_form.convention_description_placeholder': 'Convention description',
    'components.edition_form.social_networks_title': 'Social Networks',
    'components.edition_form.step_general_title': 'General Information',
    'components.edition_form.step_general_description': 'General Information',
    'components.edition_form.step_services_title': 'Offered Services',
    'components.edition_form.step_visibility_title': 'Visibility (Social Networks)',
    'components.edition_form.step_visibility_description': 'Social Networks',
    'components.date_time_picker.placeholder': 'Select a date',
    'components.country_multi_select.placeholder': 'Select countries...',
    'components.convention_form.image_uploaded': 'Image uploaded',
    'components.convention_form.image_deleted': 'Image deleted',
    'components.collaborators.added': 'Collaborator added',
    'components.collaborators.add_error': 'Unable to add collaborator',
    'components.collaborators.removed': 'Collaborator removed',
    'pages.benevoles.external_mode_active':
      'External mode active: applications are managed via a third-party tool.',
    'pages.benevoles.url_label': 'URL:',
    'pages.benevoles.sort_tip': 'Sort: click on headers (Shift+click for multi)',
    'pages.objets_trouves.photo_alt': 'Photo of found item',
    'pages.profile.photo_alt': 'Profile photo',
    'pages.profile.photo_placeholder': 'Click to change your profile photo',
    'validation.name_min_3': 'Name must contain at least 3 characters',
    'validation.name_max_100': 'Name cannot exceed 100 characters',
    'validation.name_max_200': 'Name cannot exceed 200 characters',
    'validation.description_max_1000': 'Description cannot exceed 1000 characters',
    'validation.date_end_after_start': 'End date must be strictly after start date',
    'validation.date_start_required': 'Start date is required',
    'countries.czech_republic': 'Czech Republic',
    'upload.success_message': 'Image uploaded successfully!',
    'upload.delete_message': 'Image deleted',
    'upload.error_message': 'Upload error',
  },
}

// Fonction pour ajouter une clé imbriquée
function setNestedKey(obj, keyPath, value) {
  const keys = keyPath.split('.')
  const lastKey = keys.pop()

  let current = obj
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {}
    }
    current = current[key]
  }

  current[lastKey] = value
}

// Langues à traiter
const languages = ['fr', 'en']

// Traiter chaque langue
languages.forEach((lang) => {
  const filePath = path.join(__dirname, '..', 'i18n', 'locales', `${lang}.json`)

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(content)

    // Ajouter les nouvelles traductions
    const langTranslations = newTranslations[lang]
    if (langTranslations) {
      Object.entries(langTranslations).forEach(([key, value]) => {
        setNestedKey(data, key, value)
        console.log(`✓ ${lang}: Ajouté ${key}`)
      })

      // Écrire le fichier mis à jour
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
      console.log(`\n✓ Fichier ${lang}.json mis à jour avec succès\n`)
    }
  } catch (error) {
    console.error(`✗ Erreur lors du traitement de ${lang}.json:`, error.message)
  }
})

console.log('\n✓ Ajout des traductions UI terminé')
