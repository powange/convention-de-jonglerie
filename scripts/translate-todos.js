import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Traductions pour chaque clé TODO
const translations = {
  de: {
    change_profile_picture: 'Profilbild ändern',
    change_profile_picture_description: 'Profilbild dieses Benutzers hochladen oder ändern',
    profile_picture_alt: 'Profilbild des Benutzers',
    profile_picture_info: 'Profilbild-Informationen',
    profile_picture_placeholder: 'Klicken Sie hier, um ein Profilbild hinzuzufügen',
    profile_picture_update_error: 'Fehler beim Aktualisieren des Profilbilds',
    profile_picture_updated: 'Profilbild erfolgreich aktualisiert',
    'editForm.email': 'E-Mail',
    'editForm.nom': 'Nachname',
    'editForm.phone': 'Telefon',
    'editForm.prenom': 'Vorname',
    'editForm.pseudo': 'Benutzername',
    erreur: 'Notizen zu diesem Fehler hinzufügen...',
    'upload.error': 'Fehler beim Hochladen',
  },
  es: {
    change_profile_picture: 'Cambiar foto de perfil',
    change_profile_picture_description: 'Subir o modificar la foto de perfil de este usuario',
    profile_picture_alt: 'Foto de perfil del usuario',
    profile_picture_info: 'Información de la foto de perfil',
    profile_picture_placeholder: 'Haz clic para añadir una foto de perfil',
    profile_picture_update_error: 'Error al actualizar la foto de perfil',
    profile_picture_updated: 'Foto de perfil actualizada con éxito',
    'editForm.email': 'Correo electrónico',
    'editForm.nom': 'Apellido',
    'editForm.phone': 'Teléfono',
    'editForm.prenom': 'Nombre',
    'editForm.pseudo': 'Nombre de usuario',
    erreur: 'Añadir notas sobre este error...',
    'upload.error': 'Error durante la carga',
  },
  it: {
    change_profile_picture: 'Cambia foto profilo',
    change_profile_picture_description: 'Carica o modifica la foto profilo di questo utente',
    profile_picture_alt: "Foto profilo dell'utente",
    profile_picture_info: 'Informazioni foto profilo',
    profile_picture_placeholder: 'Clicca per aggiungere una foto profilo',
    profile_picture_update_error: "Errore nell'aggiornamento della foto profilo",
    profile_picture_updated: 'Foto profilo aggiornata con successo',
    'editForm.email': 'Email',
    'editForm.nom': 'Cognome',
    'editForm.phone': 'Telefono',
    'editForm.prenom': 'Nome',
    'editForm.pseudo': 'Nome utente',
    erreur: 'Aggiungi note su questo errore...',
    'upload.error': 'Errore durante il caricamento',
  },
  nl: {
    change_profile_picture: 'Profielfoto wijzigen',
    change_profile_picture_description: 'Upload of wijzig de profielfoto van deze gebruiker',
    profile_picture_alt: 'Profielfoto van de gebruiker',
    profile_picture_info: 'Profielfoto informatie',
    profile_picture_placeholder: 'Klik om een profielfoto toe te voegen',
    profile_picture_update_error: 'Fout bij het bijwerken van profielfoto',
    profile_picture_updated: 'Profielfoto succesvol bijgewerkt',
    'editForm.email': 'E-mail',
    'editForm.nom': 'Achternaam',
    'editForm.phone': 'Telefoon',
    'editForm.prenom': 'Voornaam',
    'editForm.pseudo': 'Gebruikersnaam',
    erreur: 'Voeg notities toe over deze fout...',
    'upload.error': 'Fout tijdens uploaden',
  },
  pt: {
    change_profile_picture: 'Alterar foto de perfil',
    change_profile_picture_description: 'Carregar ou modificar a foto de perfil deste utilizador',
    profile_picture_alt: 'Foto de perfil do utilizador',
    profile_picture_info: 'Informações da foto de perfil',
    profile_picture_placeholder: 'Clique para adicionar uma foto de perfil',
    profile_picture_update_error: 'Erro ao atualizar a foto de perfil',
    profile_picture_updated: 'Foto de perfil atualizada com sucesso',
    'editForm.email': 'E-mail',
    'editForm.nom': 'Apelido',
    'editForm.phone': 'Telefone',
    'editForm.prenom': 'Nome',
    'editForm.pseudo': 'Nome de utilizador',
    erreur: 'Adicionar notas sobre este erro...',
    'upload.error': 'Erro durante o carregamento',
  },
  pl: {
    change_profile_picture: 'Zmień zdjęcie profilowe',
    change_profile_picture_description: 'Prześlij lub zmień zdjęcie profilowe tego użytkownika',
    profile_picture_alt: 'Zdjęcie profilowe użytkownika',
    profile_picture_info: 'Informacje o zdjęciu profilowym',
    profile_picture_placeholder: 'Kliknij, aby dodać zdjęcie profilowe',
    profile_picture_update_error: 'Błąd podczas aktualizacji zdjęcia profilowego',
    profile_picture_updated: 'Zdjęcie profilowe zaktualizowane pomyślnie',
    'editForm.email': 'E-mail',
    'editForm.nom': 'Nazwisko',
    'editForm.phone': 'Telefon',
    'editForm.prenom': 'Imię',
    'editForm.pseudo': 'Nazwa użytkownika',
    erreur: 'Dodaj uwagi o tym błędzie...',
    'upload.error': 'Błąd podczas przesyłania',
  },
  ru: {
    change_profile_picture: 'Изменить фото профиля',
    change_profile_picture_description: 'Загрузить или изменить фото профиля этого пользователя',
    profile_picture_alt: 'Фото профиля пользователя',
    profile_picture_info: 'Информация о фото профиля',
    profile_picture_placeholder: 'Нажмите, чтобы добавить фото профиля',
    profile_picture_update_error: 'Ошибка при обновлении фото профиля',
    profile_picture_updated: 'Фото профиля успешно обновлено',
    'editForm.email': 'Эл. почта',
    'editForm.nom': 'Фамилия',
    'editForm.phone': 'Телефон',
    'editForm.prenom': 'Имя',
    'editForm.pseudo': 'Имя пользователя',
    erreur: 'Добавить заметки об этой ошибке...',
    'upload.error': 'Ошибка при загрузке',
  },
  uk: {
    change_profile_picture: 'Змінити фото профілю',
    change_profile_picture_description: 'Завантажити або змінити фото профілю цього користувача',
    profile_picture_alt: 'Фото профілю користувача',
    profile_picture_info: 'Інформація про фото профілю',
    profile_picture_placeholder: 'Натисніть, щоб додати фото профілю',
    profile_picture_update_error: 'Помилка при оновленні фото профілю',
    profile_picture_updated: 'Фото профілю успішно оновлено',
    'editForm.email': 'Ел. пошта',
    'editForm.nom': 'Прізвище',
    'editForm.phone': 'Телефон',
    'editForm.prenom': "Ім'я",
    'editForm.pseudo': "Ім'я користувача",
    erreur: 'Додати нотатки про цю помилку...',
    'upload.error': 'Помилка при завантаженні',
  },
  da: {
    change_profile_picture: 'Skift profilbillede',
    change_profile_picture_description: 'Upload eller ændr denne brugers profilbillede',
    profile_picture_alt: 'Brugerens profilbillede',
    profile_picture_info: 'Profilbillede information',
    profile_picture_placeholder: 'Klik for at tilføje et profilbillede',
    profile_picture_update_error: 'Fejl ved opdatering af profilbillede',
    profile_picture_updated: 'Profilbillede opdateret succesfuldt',
    'editForm.email': 'E-mail',
    'editForm.nom': 'Efternavn',
    'editForm.phone': 'Telefon',
    'editForm.prenom': 'Fornavn',
    'editForm.pseudo': 'Brugernavn',
    erreur: 'Tilføj noter om denne fejl...',
    'upload.error': 'Fejl under upload',
  },
}

// Fonction pour remplacer les TODO dans un fichier
function translateFile(lang) {
  const filePath = path.join(__dirname, '..', 'i18n', 'locales', `${lang}.json`)

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`)
    return
  }

  let content = fs.readFileSync(filePath, 'utf-8')
  let data = JSON.parse(content)
  let modified = false

  // Remplacer les clés dans la section admin
  if (data.admin) {
    Object.keys(translations[lang]).forEach((key) => {
      if (key.startsWith('change_profile_picture') || key.startsWith('profile_picture')) {
        const actualKey = key.split('.').pop()
        if (data.admin[actualKey] && data.admin[actualKey].includes('[TODO]')) {
          data.admin[actualKey] = translations[lang][key]
          modified = true
          console.log(`  - Translated admin.${actualKey}`)
        }
      }
    })
  }

  // Remplacer les clés dans la section editForm
  if (data.editForm) {
    ;['email', 'nom', 'phone', 'prenom', 'pseudo'].forEach((key) => {
      if (data.editForm[key] && data.editForm[key].includes('[TODO]')) {
        data.editForm[key] = translations[lang][`editForm.${key}`]
        modified = true
        console.log(`  - Translated editForm.${key}`)
      }
    })
  }

  // Remplacer les clés dans la section upload
  if (data.upload && data.upload.error && data.upload.error.includes('[TODO]')) {
    data.upload.error = translations[lang]['upload.error']
    modified = true
    console.log(`  - Translated upload.error`)
  }

  // Remplacer la clé erreur (note: structure bizarre dans le JSON)
  if (
    data.erreur &&
    data.erreur[''] &&
    data.erreur[''][''] &&
    typeof data.erreur[''][''] === 'string' &&
    data.erreur[''][''].includes('[TODO]')
  ) {
    data.erreur[''][''] = translations[lang]['erreur']
    modified = true
    console.log(`  - Translated erreur`)
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    console.log(`✓ Translated ${lang}.json`)
  } else {
    console.log(`  No TODO found in ${lang}.json`)
  }
}

// Traduire tous les fichiers
console.log('Translating TODO keys in language files...\n')
Object.keys(translations).forEach((lang) => {
  console.log(`Processing ${lang}.json:`)
  translateFile(lang)
  console.log('')
})

console.log('Translation complete!')
