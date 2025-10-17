#!/usr/bin/env node

/**
 * Script pour générer les traductions des notifications
 * Ce fichier contient toutes les traductions générées par Claude
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG_PATH = path.join(__dirname, 'translations-config.json')

// Traductions générées pour les notifications
const NOTIFICATION_TRANSLATIONS = {
  // Welcome notifications
  'notifications.welcome.title': {
    da: 'Velkommen! 🎉',
    de: 'Willkommen! 🎉',
    en: 'Welcome! 🎉',
    es: '¡Bienvenido! 🎉',
    it: 'Benvenuto! 🎉',
    nl: 'Welkom! 🎉',
    pl: 'Witamy! 🎉',
    pt: 'Bem-vindo! 🎉',
    ru: 'Добро пожаловать! 🎉',
    uk: 'Ласкаво просимо! 🎉',
  },
  'notifications.welcome.message': {
    da: 'Din konto er blevet oprettet. Opdag jongleringsfestivaler tæt på dig!',
    de: 'Ihr Konto wurde erfolgreich erstellt. Entdecken Sie Jonglier-Conventions in Ihrer Nähe!',
    en: 'Your account has been successfully created. Discover juggling conventions near you!',
    es: 'Tu cuenta ha sido creada con éxito. ¡Descubre convenciones de malabares cerca de ti!',
    it: 'Il tuo account è stato creato con successo. Scopri le convention di giocoleria vicino a te!',
    nl: 'Je account is succesvol aangemaakt. Ontdek jongleerconventies bij jou in de buurt!',
    pl: 'Twoje konto zostało pomyślnie utworzone. Odkryj konwencje żonglerskie w Twojej okolicy!',
    pt: 'A sua conta foi criada com sucesso. Descubra convenções de malabarismo perto de si!',
    ru: 'Ваш аккаунт успешно создан. Откройте для себя жонглёрские конвенции рядом с вами!',
    uk: 'Ваш обліковий запис успішно створено. Відкрийте для себе жонглерські конвенції поблизу!',
  },
  'notifications.welcome.action': {
    da: 'Se festivaler',
    de: 'Conventions ansehen',
    en: 'View conventions',
    es: 'Ver convenciones',
    it: 'Vedi convention',
    nl: 'Bekijk conventies',
    pl: 'Zobacz konwencje',
    pt: 'Ver convenções',
    ru: 'Посмотреть конвенции',
    uk: 'Переглянути конвенції',
  },

  // Carpool notifications - booking received
  'notifications.carpool.booking_received.title': {
    da: 'Ny samkørselsanmodning 🚗',
    de: 'Neue Mitfahranfrage 🚗',
    en: 'New carpool request 🚗',
    es: 'Nueva solicitud de viaje compartido 🚗',
    it: 'Nuova richiesta di car pooling 🚗',
    nl: 'Nieuw carpoolverzoek 🚗',
    pl: 'Nowa prośba o wspólny przejazd 🚗',
    pt: 'Novo pedido de boleia 🚗',
    ru: 'Новый запрос на совместную поездку 🚗',
    uk: 'Новий запит на спільну поїздку 🚗',
  },
  'notifications.carpool.booking_received.message': {
    da: '{requesterName} ønsker at reservere {seats} plads(er) i din samkørsel',
    de: '{requesterName} möchte {seats} Platz/Plätze in Ihrer Mitfahrgelegenheit reservieren',
    en: '{requesterName} wants to book {seats} seat(s) in your carpool',
    es: '{requesterName} quiere reservar {seats} asiento(s) en tu viaje compartido',
    it: '{requesterName} vuole prenotare {seats} posto/i nel tuo car pooling',
    nl: '{requesterName} wil {seats} plaats(en) reserveren in je carpool',
    pl: '{requesterName} chce zarezerwować {seats} miejsce/a w Twoim wspólnym przejeździe',
    pt: '{requesterName} quer reservar {seats} lugar(es) na sua boleia',
    ru: '{requesterName} хочет забронировать {seats} место/а в вашей поездке',
    uk: '{requesterName} хоче забронювати {seats} місце/я у вашій поїздці',
  },
  'notifications.carpool.booking_received.message_with_note': {
    da: '{requesterName} ønsker at reservere {seats} plads(er): "{note}"',
    de: '{requesterName} möchte {seats} Platz/Plätze reservieren: "{note}"',
    en: '{requesterName} wants to book {seats} seat(s): "{note}"',
    es: '{requesterName} quiere reservar {seats} asiento(s): "{note}"',
    it: '{requesterName} vuole prenotare {seats} posto/i: "{note}"',
    nl: '{requesterName} wil {seats} plaats(en) reserveren: "{note}"',
    pl: '{requesterName} chce zarezerwować {seats} miejsce/a: "{note}"',
    pt: '{requesterName} quer reservar {seats} lugar(es): "{note}"',
    ru: '{requesterName} хочет забронировать {seats} место/а: "{note}"',
    uk: '{requesterName} хоче забронювати {seats} місце/я: "{note}"',
  },
  'notifications.carpool.booking_received.action': {
    da: 'Se anmodning',
    de: 'Anfrage ansehen',
    en: 'View request',
    es: 'Ver solicitud',
    it: 'Vedi richiesta',
    nl: 'Bekijk verzoek',
    pl: 'Zobacz prośbę',
    pt: 'Ver pedido',
    ru: 'Посмотреть запрос',
    uk: 'Переглянути запит',
  },

  // Carpool notifications - booking accepted
  'notifications.carpool.booking_accepted.title': {
    da: 'Anmodning accepteret! ✅',
    de: 'Anfrage akzeptiert! ✅',
    en: 'Request accepted! ✅',
    es: '¡Solicitud aceptada! ✅',
    it: 'Richiesta accettata! ✅',
    nl: 'Verzoek geaccepteerd! ✅',
    pl: 'Prośba zaakceptowana! ✅',
    pt: 'Pedido aceite! ✅',
    ru: 'Запрос принят! ✅',
    uk: 'Запит прийнято! ✅',
  },
  'notifications.carpool.booking_accepted.message': {
    da: '{ownerName} har accepteret din anmodning om {seats} plads(er) for rejsen fra {locationCity} den {date}',
    de: '{ownerName} hat Ihre Anfrage für {seats} Platz/Plätze für die Fahrt von {locationCity} am {date} akzeptiert',
    en: '{ownerName} has accepted your request for {seats} seat(s) for the trip from {locationCity} on {date}',
    es: '{ownerName} ha aceptado tu solicitud de {seats} asiento(s) para el viaje desde {locationCity} el {date}',
    it: '{ownerName} ha accettato la tua richiesta di {seats} posto/i per il viaggio da {locationCity} il {date}',
    nl: '{ownerName} heeft je verzoek voor {seats} plaats(en) voor de reis vanaf {locationCity} op {date} geaccepteerd',
    pl: '{ownerName} zaakceptował Twoją prośbę o {seats} miejsce/a na podróż z {locationCity} w dniu {date}',
    pt: '{ownerName} aceitou o seu pedido de {seats} lugar(es) para a viagem de {locationCity} em {date}',
    ru: '{ownerName} принял ваш запрос на {seats} место/а для поездки из {locationCity} {date}',
    uk: '{ownerName} прийняв ваш запит на {seats} місце/я для поїздки з {locationCity} {date}',
  },
  'notifications.carpool.booking_accepted.action': {
    da: 'Se detaljer',
    de: 'Details ansehen',
    en: 'View details',
    es: 'Ver detalles',
    it: 'Vedi dettagli',
    nl: 'Bekijk details',
    pl: 'Zobacz szczegóły',
    pt: 'Ver detalhes',
    ru: 'Посмотреть детали',
    uk: 'Переглянути деталі',
  },

  // Carpool notifications - booking rejected
  'notifications.carpool.booking_rejected.title': {
    da: 'Anmodning afvist',
    de: 'Anfrage abgelehnt',
    en: 'Request declined',
    es: 'Solicitud rechazada',
    it: 'Richiesta rifiutata',
    nl: 'Verzoek geweigerd',
    pl: 'Prośba odrzucona',
    pt: 'Pedido recusado',
    ru: 'Запрос отклонён',
    uk: 'Запит відхилено',
  },
  'notifications.carpool.booking_rejected.message': {
    da: '{ownerName} har afvist din anmodning om {seats} plads(er) for rejsen fra {locationCity}',
    de: '{ownerName} hat Ihre Anfrage für {seats} Platz/Plätze für die Fahrt von {locationCity} abgelehnt',
    en: '{ownerName} has declined your request for {seats} seat(s) for the trip from {locationCity}',
    es: '{ownerName} ha rechazado tu solicitud de {seats} asiento(s) para el viaje desde {locationCity}',
    it: '{ownerName} ha rifiutato la tua richiesta di {seats} posto/i per il viaggio da {locationCity}',
    nl: '{ownerName} heeft je verzoek voor {seats} plaats(en) voor de reis vanaf {locationCity} geweigerd',
    pl: '{ownerName} odrzucił Twoją prośbę o {seats} miejsce/a na podróż z {locationCity}',
    pt: '{ownerName} recusou o seu pedido de {seats} lugar(es) para a viagem de {locationCity}',
    ru: '{ownerName} отклонил ваш запрос на {seats} место/а для поездки из {locationCity}',
    uk: '{ownerName} відхилив ваш запит на {seats} місце/я для поїздки з {locationCity}',
  },
  'notifications.carpool.booking_rejected.action': {
    da: 'Se andre tilbud',
    de: 'Andere Angebote ansehen',
    en: 'View other offers',
    es: 'Ver otras ofertas',
    it: 'Vedi altre offerte',
    nl: 'Bekijk andere aanbiedingen',
    pl: 'Zobacz inne oferty',
    pt: 'Ver outras ofertas',
    ru: 'Посмотреть другие предложения',
    uk: 'Переглянути інші пропозиції',
  },

  // Carpool notifications - booking cancelled
  'notifications.carpool.booking_cancelled.title': {
    da: 'Reservation annulleret 📅',
    de: 'Reservierung storniert 📅',
    en: 'Booking cancelled 📅',
    es: 'Reserva cancelada 📅',
    it: 'Prenotazione cancellata 📅',
    nl: 'Reservering geannuleerd 📅',
    pl: 'Rezerwacja anulowana 📅',
    pt: 'Reserva cancelada 📅',
    ru: 'Бронирование отменено 📅',
    uk: 'Бронювання скасовано 📅',
  },
  'notifications.carpool.booking_cancelled.message': {
    da: '{passengerName} har annulleret sin reservation af {seats} plads(er) for rejsen fra {locationCity} den {date}',
    de: '{passengerName} hat seine/ihre Reservierung von {seats} Platz/Plätzen für die Fahrt von {locationCity} am {date} storniert',
    en: '{passengerName} has cancelled their booking of {seats} seat(s) for the trip from {locationCity} on {date}',
    es: '{passengerName} ha cancelado su reserva de {seats} asiento(s) para el viaje desde {locationCity} el {date}',
    it: '{passengerName} ha cancellato la prenotazione di {seats} posto/i per il viaggio da {locationCity} il {date}',
    nl: '{passengerName} heeft zijn/haar reservering van {seats} plaats(en) voor de reis vanaf {locationCity} op {date} geannuleerd',
    pl: '{passengerName} anulował swoją rezerwację {seats} miejsc/a na podróż z {locationCity} w dniu {date}',
    pt: '{passengerName} cancelou a sua reserva de {seats} lugar(es) para a viagem de {locationCity} em {date}',
    ru: '{passengerName} отменил бронирование {seats} место/а для поездки из {locationCity} {date}',
    uk: '{passengerName} скасував бронювання {seats} місце/я для поїздки з {locationCity} {date}',
  },
  'notifications.carpool.booking_cancelled.action': {
    da: 'Se samkørsel',
    de: 'Mitfahrgelegenheit ansehen',
    en: 'View carpool',
    es: 'Ver viaje compartido',
    it: 'Vedi car pooling',
    nl: 'Bekijk carpool',
    pl: 'Zobacz wspólny przejazd',
    pt: 'Ver boleia',
    ru: 'Посмотреть поездку',
    uk: 'Переглянути поїздку',
  },

  // Volunteer notifications - application submitted
  'notifications.volunteer.application_submitted.title': {
    da: 'Ansøgning indsendt! 🎉',
    de: 'Bewerbung eingereicht! 🎉',
    en: 'Application submitted! 🎉',
    es: '¡Solicitud enviada! 🎉',
    it: 'Candidatura inviata! 🎉',
    nl: 'Aanmelding ingediend! 🎉',
    pl: 'Zgłoszenie wysłane! 🎉',
    pt: 'Candidatura enviada! 🎉',
    ru: 'Заявка отправлена! 🎉',
    uk: 'Заявку надіслано! 🎉',
  },
  'notifications.volunteer.application_submitted.message': {
    da: 'Din ansøgning til "{editionName}" er blevet indsendt. Arrangørerne vil gennemgå den.',
    de: 'Ihre Bewerbung für "{editionName}" wurde erfolgreich eingereicht. Die Organisatoren werden sie prüfen.',
    en: 'Your application for "{editionName}" has been successfully submitted. The organizers will review it.',
    es: 'Tu solicitud para "{editionName}" ha sido enviada con éxito. Los organizadores la revisarán.',
    it: 'La tua candidatura per "{editionName}" è stata inviata con successo. Gli organizzatori la esamineranno.',
    nl: 'Je aanmelding voor "{editionName}" is succesvol ingediend. De organisatoren zullen deze beoordelen.',
    pl: 'Twoje zgłoszenie do "{editionName}" zostało wysłane pomyślnie. Organizatorzy je sprawdzą.',
    pt: 'A sua candidatura para "{editionName}" foi enviada com sucesso. Os organizadores irão analisá-la.',
    ru: 'Ваша заявка на "{editionName}" успешно отправлена. Организаторы рассмотрят её.',
    uk: 'Вашу заявку на "{editionName}" успішно надіслано. Організатори розглянуть її.',
  },
  'notifications.volunteer.application_submitted.action': {
    da: 'Se mine ansøgninger',
    de: 'Meine Bewerbungen ansehen',
    en: 'View my applications',
    es: 'Ver mis solicitudes',
    it: 'Vedi le mie candidature',
    nl: 'Bekijk mijn aanmeldingen',
    pl: 'Zobacz moje zgłoszenia',
    pt: 'Ver as minhas candidaturas',
    ru: 'Посмотреть мои заявки',
    uk: 'Переглянути мої заявки',
  },

  // Volunteer notifications - application accepted
  'notifications.volunteer.application_accepted.title': {
    da: 'Ansøgning accepteret! ✅',
    de: 'Bewerbung angenommen! ✅',
    en: 'Application accepted! ✅',
    es: '¡Solicitud aceptada! ✅',
    it: 'Candidatura accettata! ✅',
    nl: 'Aanmelding geaccepteerd! ✅',
    pl: 'Zgłoszenie zaakceptowane! ✅',
    pt: 'Candidatura aceite! ✅',
    ru: 'Заявка принята! ✅',
    uk: 'Заявку прийнято! ✅',
  },
  'notifications.volunteer.application_accepted.message': {
    da: 'Din frivillig-ansøgning til "{editionName}" er blevet accepteret.',
    de: 'Ihre Freiwilligenbewerbung für "{editionName}" wurde angenommen.',
    en: 'Your volunteer application for "{editionName}" has been accepted.',
    es: 'Tu solicitud de voluntariado para "{editionName}" ha sido aceptada.',
    it: 'La tua candidatura da volontario per "{editionName}" è stata accettata.',
    nl: 'Je vrijwilligersaanmelding voor "{editionName}" is geaccepteerd.',
    pl: 'Twoje zgłoszenie wolontariusza do "{editionName}" zostało zaakceptowane.',
    pt: 'A sua candidatura de voluntário para "{editionName}" foi aceite.',
    ru: 'Ваша заявка волонтёра на "{editionName}" была принята.',
    uk: 'Вашу заявку волонтера на "{editionName}" прийнято.',
  },
  'notifications.volunteer.application_accepted.message_with_teams': {
    da: 'Din ansøgning til "{editionName}" er blevet accepteret.\n\nDu er tildelt følgende hold:\n• {teams}',
    de: 'Ihre Bewerbung für "{editionName}" wurde angenommen.\n\nSie wurden den folgenden Teams zugewiesen:\n• {teams}',
    en: 'Your application for "{editionName}" has been accepted.\n\nYou have been assigned to the following teams:\n• {teams}',
    es: 'Tu solicitud para "{editionName}" ha sido aceptada.\n\nHas sido asignado a los siguientes equipos:\n• {teams}',
    it: 'La tua candidatura per "{editionName}" è stata accettata.\n\nSei stato assegnato ai seguenti team:\n• {teams}',
    nl: 'Je aanmelding voor "{editionName}" is geaccepteerd.\n\nJe bent toegewezen aan de volgende teams:\n• {teams}',
    pl: 'Twoje zgłoszenie do "{editionName}" zostało zaakceptowane.\n\nZostałeś przypisany do następujących zespołów:\n• {teams}',
    pt: 'A sua candidatura para "{editionName}" foi aceite.\n\nFoi atribuído às seguintes equipas:\n• {teams}',
    ru: 'Ваша заявка на "{editionName}" принята.\n\nВы были назначены в следующие команды:\n• {teams}',
    uk: 'Вашу заявку на "{editionName}" прийнято.\n\nВас призначено до таких команд:\n• {teams}',
  },
  'notifications.volunteer.application_accepted.message_with_note': {
    da: 'Din ansøgning til "{editionName}" er blevet accepteret.\n\nBesked fra arrangøren:\n"{note}"',
    de: 'Ihre Bewerbung für "{editionName}" wurde angenommen.\n\nNachricht vom Organisator:\n"{note}"',
    en: 'Your application for "{editionName}" has been accepted.\n\nMessage from the organizer:\n"{note}"',
    es: 'Tu solicitud para "{editionName}" ha sido aceptada.\n\nMensaje del organizador:\n"{note}"',
    it: 'La tua candidatura per "{editionName}" è stata accettata.\n\nMessaggio dall\'organizzatore:\n"{note}"',
    nl: 'Je aanmelding voor "{editionName}" is geaccepteerd.\n\nBericht van de organisator:\n"{note}"',
    pl: 'Twoje zgłoszenie do "{editionName}" zostało zaakceptowane.\n\nWiadomość od organizatora:\n"{note}"',
    pt: 'A sua candidatura para "{editionName}" foi aceite.\n\nMensagem do organizador:\n"{note}"',
    ru: 'Ваша заявка на "{editionName}" принята.\n\nСообщение от организатора:\n"{note}"',
    uk: 'Вашу заявку на "{editionName}" прийнято.\n\nПовідомлення від організатора:\n"{note}"',
  },
  'notifications.volunteer.application_accepted.message_complete': {
    da: 'Din ansøgning til "{editionName}" er blevet accepteret.\n\nDu er tildelt følgende hold:\n• {teams}\n\nBesked fra arrangøren:\n"{note}"',
    de: 'Ihre Bewerbung für "{editionName}" wurde angenommen.\n\nSie wurden den folgenden Teams zugewiesen:\n• {teams}\n\nNachricht vom Organisator:\n"{note}"',
    en: 'Your application for "{editionName}" has been accepted.\n\nYou have been assigned to the following teams:\n• {teams}\n\nMessage from the organizer:\n"{note}"',
    es: 'Tu solicitud para "{editionName}" ha sido aceptada.\n\nHas sido asignado a los siguientes equipos:\n• {teams}\n\nMensaje del organizador:\n"{note}"',
    it: 'La tua candidatura per "{editionName}" è stata accettata.\n\nSei stato assegnato ai seguenti team:\n• {teams}\n\nMessaggio dall\'organizzatore:\n"{note}"',
    nl: 'Je aanmelding voor "{editionName}" is geaccepteerd.\n\nJe bent toegewezen aan de volgende teams:\n• {teams}\n\nBericht van de organisator:\n"{note}"',
    pl: 'Twoje zgłoszenie do "{editionName}" zostało zaakceptowane.\n\nZostałeś przypisany do następujących zespołów:\n• {teams}\n\nWiadomość od organizatora:\n"{note}"',
    pt: 'A sua candidatura para "{editionName}" foi aceite.\n\nFoi atribuído às seguintes equipas:\n• {teams}\n\nMensagem do organizador:\n"{note}"',
    ru: 'Ваша заявка на "{editionName}" принята.\n\nВы были назначены в следующие команды:\n• {teams}\n\nСообщение от организатора:\n"{note}"',
    uk: 'Вашу заявку на "{editionName}" прийнято.\n\nВас призначено до таких команд:\n• {teams}\n\nПовідомлення від організатора:\n"{note}"',
  },
  'notifications.volunteer.application_accepted.action': {
    da: 'Se detaljer',
    de: 'Details ansehen',
    en: 'View details',
    es: 'Ver detalles',
    it: 'Vedi dettagli',
    nl: 'Bekijk details',
    pl: 'Zobacz szczegóły',
    pt: 'Ver detalhes',
    ru: 'Посмотреть детали',
    uk: 'Переглянути деталі',
  },

  // Volunteer notifications - application rejected
  'notifications.volunteer.application_rejected.title': {
    da: 'Ansøgning ikke accepteret',
    de: 'Bewerbung nicht angenommen',
    en: 'Application not accepted',
    es: 'Solicitud no aceptada',
    it: 'Candidatura non accettata',
    nl: 'Aanmelding niet geaccepteerd',
    pl: 'Zgłoszenie odrzucone',
    pt: 'Candidatura não aceite',
    ru: 'Заявка не принята',
    uk: 'Заявку не прийнято',
  },
  'notifications.volunteer.application_rejected.message': {
    da: 'Din frivillig-ansøgning til "{editionName}" blev desværre ikke accepteret denne gang.',
    de: 'Ihre Freiwilligenbewerbung für "{editionName}" wurde dieses Mal leider nicht angenommen.',
    en: 'Your volunteer application for "{editionName}" was not accepted this time.',
    es: 'Tu solicitud de voluntariado para "{editionName}" no ha sido aceptada en esta ocasión.',
    it: 'La tua candidatura da volontario per "{editionName}" non è stata accettata questa volta.',
    nl: 'Je vrijwilligersaanmelding voor "{editionName}" is deze keer niet geaccepteerd.',
    pl: 'Twoje zgłoszenie wolontariusza do "{editionName}" nie zostało tym razem zaakceptowane.',
    pt: 'A sua candidatura de voluntário para "{editionName}" não foi aceite desta vez.',
    ru: 'Ваша заявка волонтёра на "{editionName}" не была принята в этот раз.',
    uk: 'Вашу заявку волонтера на "{editionName}" не прийнято цього разу.',
  },
  'notifications.volunteer.application_rejected.action': {
    da: 'Se udgaven',
    de: 'Edition ansehen',
    en: 'View edition',
    es: 'Ver edición',
    it: 'Vedi edizione',
    nl: 'Bekijk editie',
    pl: 'Zobacz edycję',
    pt: 'Ver edição',
    ru: 'Посмотреть издание',
    uk: 'Переглянути видання',
  },

  // Volunteer notifications - back to pending
  'notifications.volunteer.back_to_pending.title': {
    da: 'Ansøgning sat i venteposition',
    de: 'Bewerbung zurück auf ausstehend',
    en: 'Application back to pending',
    es: 'Solicitud en espera nuevamente',
    it: 'Candidatura tornata in attesa',
    nl: 'Aanmelding terug in afwachting',
    pl: 'Zgłoszenie z powrotem w oczekiwaniu',
    pt: 'Candidatura de volta a pendente',
    ru: 'Заявка снова в ожидании',
    uk: 'Заявка знову очікує',
  },
  'notifications.volunteer.back_to_pending.message': {
    da: 'Din frivillig-ansøgning til "{editionName}" er sat i venteposition af arrangørerne.',
    de: 'Ihre Freiwilligenbewerbung für "{editionName}" wurde von den Organisatoren zurück auf ausstehend gesetzt.',
    en: 'Your volunteer application for "{editionName}" has been put back to pending by the organizers.',
    es: 'Tu solicitud de voluntariado para "{editionName}" ha sido puesta en espera nuevamente por los organizadores.',
    it: 'La tua candidatura da volontario per "{editionName}" è stata rimessa in attesa dagli organizzatori.',
    nl: 'Je vrijwilligersaanmelding voor "{editionName}" is door de organisatoren terug in afwachting gezet.',
    pl: 'Twoje zgłoszenie wolontariusza do "{editionName}" zostało z powrotem ustawione w oczekiwaniu przez organizatorów.',
    pt: 'A sua candidatura de voluntário para "{editionName}" foi colocada de volta a pendente pelos organizadores.',
    ru: 'Ваша заявка волонтёра на "{editionName}" была возвращена в ожидание организаторами.',
    uk: 'Вашу заявку волонтера на "{editionName}" повернуто до очікування організаторами.',
  },
  'notifications.volunteer.back_to_pending.action': {
    da: 'Se min ansøgning',
    de: 'Meine Bewerbung ansehen',
    en: 'View my application',
    es: 'Ver mi solicitud',
    it: 'Vedi la mia candidatura',
    nl: 'Bekijk mijn aanmelding',
    pl: 'Zobacz moje zgłoszenie',
    pt: 'Ver a minha candidatura',
    ru: 'Посмотреть мою заявку',
    uk: 'Переглянути мою заявку',
  },

  // Edition notifications - new convention
  'notifications.edition.new_convention.title': {
    da: 'Ny festival tilføjet',
    de: 'Neue Convention hinzugefügt',
    en: 'New convention added',
    es: 'Nueva convención añadida',
    it: 'Nuova convention aggiunta',
    nl: 'Nieuwe conventie toegevoegd',
    pl: 'Dodano nową konwencję',
    pt: 'Nova convenção adicionada',
    ru: 'Добавлена новая конвенция',
    uk: 'Додано нову конвенцію',
  },
  'notifications.edition.new_convention.message': {
    da: 'Festivalen "{conventionName}" er lige blevet tilføjet til platformen.',
    de: 'Die Convention "{conventionName}" wurde gerade zur Plattform hinzugefügt.',
    en: 'The convention "{conventionName}" has just been added to the platform.',
    es: 'La convención "{conventionName}" acaba de ser añadida a la plataforma.',
    it: 'La convention "{conventionName}" è appena stata aggiunta alla piattaforma.',
    nl: 'De conventie "{conventionName}" is zojuist toegevoegd aan het platform.',
    pl: 'Konwencja "{conventionName}" została właśnie dodana do platformy.',
    pt: 'A convenção "{conventionName}" acabou de ser adicionada à plataforma.',
    ru: 'Конвенция "{conventionName}" только что была добавлена на платформу.',
    uk: 'Конвенцію "{conventionName}" щойно додано на платформу.',
  },
  'notifications.edition.new_convention.action': {
    da: 'Se detaljer',
    de: 'Details ansehen',
    en: 'View details',
    es: 'Ver detalles',
    it: 'Vedi dettagli',
    nl: 'Bekijk details',
    pl: 'Zobacz szczegóły',
    pt: 'Ver detalhes',
    ru: 'Посмотреть детали',
    uk: 'Переглянути деталі',
  },

  // Edition notifications - reminder
  'notifications.edition.reminder.title': {
    da: 'Begivenhedspåmindelse 📅',
    de: 'Veranstaltungserinnerung 📅',
    en: 'Event reminder 📅',
    es: 'Recordatorio de evento 📅',
    it: 'Promemoria evento 📅',
    nl: 'Evenement herinnering 📅',
    pl: 'Przypomnienie o wydarzeniu 📅',
    pt: 'Lembrete de evento 📅',
    ru: 'Напоминание о событии 📅',
    uk: 'Нагадування про подію 📅',
  },
  'notifications.edition.reminder.message': {
    da: 'Udgaven "{editionName}" starter om {daysUntil} dag(e)!',
    de: 'Die Edition "{editionName}" beginnt in {daysUntil} Tag(en)!',
    en: 'The edition "{editionName}" starts in {daysUntil} day(s)!',
    es: 'La edición "{editionName}" comienza en {daysUntil} día(s)!',
    it: 'L\'edizione "{editionName}" inizia tra {daysUntil} giorno/i!',
    nl: 'De editie "{editionName}" begint over {daysUntil} dag(en)!',
    pl: 'Edycja "{editionName}" zaczyna się za {daysUntil} dzień/dni!',
    pt: 'A edição "{editionName}" começa em {daysUntil} dia(s)!',
    ru: 'Издание "{editionName}" начинается через {daysUntil} день/дня/дней!',
    uk: 'Видання "{editionName}" починається через {daysUntil} день/днів!',
  },
  'notifications.edition.reminder.action': {
    da: 'Se detaljer',
    de: 'Details ansehen',
    en: 'View details',
    es: 'Ver detalles',
    it: 'Vedi dettagli',
    nl: 'Bekijk details',
    pl: 'Zobacz szczegóły',
    pt: 'Ver detalhes',
    ru: 'Посмотреть детали',
    uk: 'Переглянути деталі',
  },

  // System notifications - error
  'notifications.system.error.title': {
    da: 'Systemfejl',
    de: 'Systemfehler',
    en: 'System error',
    es: 'Error del sistema',
    it: 'Errore di sistema',
    nl: 'Systeemfout',
    pl: 'Błąd systemu',
    pt: 'Erro do sistema',
    ru: 'Системная ошибка',
    uk: 'Системна помилка',
  },
  'notifications.system.error.message': {
    da: 'Der opstod en fejl: {errorMessage}',
    de: 'Ein Fehler ist aufgetreten: {errorMessage}',
    en: 'An error occurred: {errorMessage}',
    es: 'Se produjo un error: {errorMessage}',
    it: 'Si è verificato un errore: {errorMessage}',
    nl: 'Er is een fout opgetreden: {errorMessage}',
    pl: 'Wystąpił błąd: {errorMessage}',
    pt: 'Ocorreu um erro: {errorMessage}',
    ru: 'Произошла ошибка: {errorMessage}',
    uk: 'Сталася помилка: {errorMessage}',
  },

  // Common actions
  'notifications.common.view': {
    da: 'Se',
    de: 'Ansehen',
    en: 'View',
    es: 'Ver',
    it: 'Vedi',
    nl: 'Bekijken',
    pl: 'Zobacz',
    pt: 'Ver',
    ru: 'Посмотреть',
    uk: 'Переглянути',
  },
  'notifications.common.view_details': {
    da: 'Se detaljer',
    de: 'Details ansehen',
    en: 'View details',
    es: 'Ver detalles',
    it: 'Vedi dettagli',
    nl: 'Bekijk details',
    pl: 'Zobacz szczegóły',
    pt: 'Ver detalhes',
    ru: 'Посмотреть детали',
    uk: 'Переглянути деталі',
  },
  'notifications.common.close': {
    da: 'Luk',
    de: 'Schließen',
    en: 'Close',
    es: 'Cerrar',
    it: 'Chiudi',
    nl: 'Sluiten',
    pl: 'Zamknij',
    pt: 'Fechar',
    ru: 'Закрыть',
    uk: 'Закрити',
  },
}

// Charger le fichier de config existant
console.log('📖 Chargement du fichier translations-config.json...')
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))

// Mettre à jour avec les traductions notifications
console.log('\n🔄 Ajout des traductions notifications...\n')

let updatedCount = 0
for (const [key, translations] of Object.entries(NOTIFICATION_TRANSLATIONS)) {
  if (config.translations[key]) {
    for (const [lang, value] of Object.entries(translations)) {
      config.translations[key][lang] = value
      updatedCount++
    }
  }
}

// Sauvegarder le fichier de config mis à jour
console.log(`\n💾 Sauvegarde de ${updatedCount} traductions...`)
fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')

console.log('\n✅ Traductions notifications générées avec succès !')
console.log(`📄 Fichier mis à jour : ${CONFIG_PATH}`)

// Compter combien de TODO restent
let remainingTodos = 0
for (const translations of Object.values(config.translations)) {
  for (const [lang, value] of Object.entries(translations)) {
    if (lang !== 'fr' && typeof value === 'string' && value.startsWith('TODO:')) {
      remainingTodos++
    }
  }
}

if (remainingTodos > 0) {
  console.log(`\n⚠️  ${remainingTodos} traductions TODO restantes`)
} else {
  console.log('\n🎉 Toutes les traductions ont été générées !')
}
