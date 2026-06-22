<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-3xl font-bold mb-8">{{ t('title') }}</h1>

    <div class="prose prose-gray dark:prose-invert max-w-none space-y-6">
      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.dataController.title') }}</h2>
        <p>{{ t('sections.dataController.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.dataCollected.title') }}</h2>
        <p>{{ t('sections.dataCollected.intro') }}</p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>{{ t('sections.dataCollected.items.identity') }}</li>
          <li>{{ t('sections.dataCollected.items.contact') }}</li>
          <li>{{ t('sections.dataCollected.items.preferences') }}</li>
        </ul>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.purpose.title') }}</h2>
        <p>{{ t('sections.purpose.intro') }}</p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>{{ t('sections.purpose.items.accountManagement') }}</li>
          <li>{{ t('sections.purpose.items.serviceProvision') }}</li>
          <li>{{ t('sections.purpose.items.communication') }}</li>
          <li>{{ t('sections.purpose.items.improvement') }}</li>
        </ul>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.legalBasis.title') }}</h2>
        <p>{{ t('sections.legalBasis.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.dataSharing.title') }}</h2>
        <p>{{ t('sections.dataSharing.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.dataRetention.title') }}</h2>
        <p>{{ t('sections.dataRetention.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.userRights.title') }}</h2>
        <p>{{ t('sections.userRights.intro') }}</p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>{{ t('sections.userRights.items.access') }}</li>
          <li>{{ t('sections.userRights.items.rectification') }}</li>
          <li>{{ t('sections.userRights.items.erasure') }}</li>
          <li>{{ t('sections.userRights.items.portability') }}</li>
          <li>{{ t('sections.userRights.items.objection') }}</li>
        </ul>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.cookies.title') }}</h2>
        <p>{{ t('sections.cookies.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.security.title') }}</h2>
        <p>{{ t('sections.security.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.updates.title') }}</h2>
        <p>{{ t('sections.updates.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('sections.contact.title') }}</h2>
        <p>{{ t('sections.contact.content') }}</p>
        <p class="font-medium">{{ t('sections.contact.emailLabel') }}: powange@gmail.com</p>
      </section>
    </div>

    <div class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('lastUpdated') }}: {{ t('updateDate') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({
  useScope: 'local',
})

// Métadonnées de la page
definePageMeta({
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles',
})

// SEO
useHead({
  title: 'Politique de confidentialité',
  meta: [
    {
      name: 'description',
      content:
        'Politique de confidentialité et protection des données personnelles sur Convention de Jonglerie',
    },
    { name: 'robots', content: 'index, follow' },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Politique de confidentialité",
    "lastUpdated": "Dernière mise à jour",
    "updateDate": "11 septembre 2025",
    "sections": {
      "dataController": {
        "title": "Responsable du traitement",
        "content": "Convention de Jonglerie est responsable du traitement de vos données personnelles. Nous nous engageons à protéger votre vie privée et à traiter vos données personnelles de manière transparente et conforme au Règlement Général sur la Protection des Données (RGPD)."
      },
      "dataCollected": {
        "title": "Données collectées",
        "intro": "Nous collectons les types de données personnelles suivants :",
        "items": {
          "identity": "Informations d'identité : nom, prénom, pseudonyme",
          "contact": "Informations de contact : adresse e-mail",
          "preferences": "Préférences utilisateur : conventions favorites, paramètres de notification"
        }
      },
      "purpose": {
        "title": "Finalités du traitement",
        "intro": "Vos données personnelles sont traitées pour les finalités suivantes :",
        "items": {
          "accountManagement": "Gestion de votre compte utilisateur et authentification",
          "serviceProvision": "Fourniture des services de la plateforme (consultation, ajout de conventions)",
          "communication": "Communication relative au service et notifications importantes",
          "improvement": "Amélioration de nos services et analyse d'usage"
        }
      },
      "legalBasis": {
        "title": "Base légale",
        "content": "Le traitement de vos données personnelles repose sur votre consentement pour la création de compte et l'utilisation du service, ainsi que sur notre intérêt légitime pour l'amélioration de nos services et la sécurité de la plateforme."
      },
      "dataSharing": {
        "title": "Partage des données",
        "content": "Nous ne vendons, ne louons, ni ne partageons vos données personnelles avec des tiers, sauf dans les cas suivants : obligation légale, protection de nos droits, ou avec votre consentement explicite. Les données peuvent être partagées avec nos prestataires techniques dans le cadre strict de la fourniture du service."
      },
      "dataRetention": {
        "title": "Conservation des données",
        "content": "Vos données personnelles sont conservées pendant la durée nécessaire aux finalités pour lesquelles elles ont été collectées. Les comptes inactifs depuis plus de 3 ans peuvent être supprimés après notification préalable."
      },
      "userRights": {
        "title": "Vos droits",
        "intro": "Conformément au RGPD, vous disposez des droits suivants :",
        "items": {
          "access": "Droit d'accès : obtenir une copie de vos données personnelles",
          "rectification": "Droit de rectification : corriger vos données inexactes ou incomplètes",
          "erasure": "Droit à l'effacement : supprimer vos données personnelles",
          "portability": "Droit à la portabilité : récupérer vos données dans un format structuré",
          "objection": "Droit d'opposition : vous opposer au traitement de vos données"
        }
      },
      "cookies": {
        "title": "Cookies et technologies similaires",
        "content": "Nous utilisons des cookies techniques nécessaires au fonctionnement du site, notamment pour la gestion de votre session de connexion. Ces cookies ne nécessitent pas votre consentement préalable car ils sont strictement nécessaires à la fourniture du service."
      },
      "security": {
        "title": "Sécurité des données",
        "content": "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données personnelles contre la perte, l'utilisation abusive, l'accès non autorisé, la divulgation, la modification ou la destruction non autorisée."
      },
      "updates": {
        "title": "Modifications de la politique",
        "content": "Cette politique de confidentialité peut être mise à jour périodiquement. Nous vous informerons de toute modification substantielle par e-mail ou via une notification sur le site."
      },
      "contact": {
        "title": "Contact",
        "content": "Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, vous pouvez nous contacter à :",
        "emailLabel": "E-mail"
      }
    }
  },
  "en": {
    "title": "Privacy Policy",
    "lastUpdated": "Last updated",
    "updateDate": "September 11, 2025",
    "sections": {
      "dataController": {
        "title": "Data Controller",
        "content": "Convention de Jonglerie is the data controller for your personal data. We are committed to protecting your privacy and processing your personal data transparently and in compliance with the General Data Protection Regulation (GDPR)."
      },
      "dataCollected": {
        "title": "Data Collected",
        "intro": "We collect the following types of personal data:",
        "items": {
          "identity": "Identity information: last name, first name, username",
          "contact": "Contact information: email address",
          "preferences": "User preferences: favorite conventions, notification settings"
        }
      },
      "purpose": {
        "title": "Processing Purposes",
        "intro": "Your personal data is processed for the following purposes:",
        "items": {
          "accountManagement": "User account management and authentication",
          "serviceProvision": "Platform service provision (browsing, adding conventions)",
          "communication": "Service-related communication and important notifications",
          "improvement": "Service improvement and usage analysis"
        }
      },
      "legalBasis": {
        "title": "Legal Basis",
        "content": "The processing of your personal data is based on your consent for account creation and service use, as well as our legitimate interest in improving our services and platform security."
      },
      "dataSharing": {
        "title": "Data Sharing",
        "content": "We do not sell, rent, or share your personal data with third parties, except in the following cases: legal obligation, protection of our rights, or with your explicit consent. Data may be shared with our technical service providers strictly within the scope of service provision."
      },
      "dataRetention": {
        "title": "Data Retention",
        "content": "Your personal data is retained for the duration necessary for the purposes for which it was collected. Accounts inactive for more than 3 years may be deleted after prior notification."
      },
      "userRights": {
        "title": "Your Rights",
        "intro": "In accordance with GDPR, you have the following rights:",
        "items": {
          "access": "Right of access: obtain a copy of your personal data",
          "rectification": "Right of rectification: correct your inaccurate or incomplete data",
          "erasure": "Right to erasure: delete your personal data",
          "portability": "Right to portability: retrieve your data in a structured format",
          "objection": "Right to objection: object to the processing of your data"
        }
      },
      "cookies": {
        "title": "Cookies and Similar Technologies",
        "content": "We use technical cookies necessary for the site's operation, particularly for managing your login session. These cookies do not require your prior consent as they are strictly necessary for service provision."
      },
      "security": {
        "title": "Data Security",
        "content": "We implement appropriate technical and organizational measures to protect your personal data against loss, misuse, unauthorized access, disclosure, alteration, or unauthorized destruction."
      },
      "updates": {
        "title": "Policy Updates",
        "content": "This privacy policy may be updated periodically. We will inform you of any substantial changes by email or via a notification on the site."
      },
      "contact": {
        "title": "Contact",
        "content": "For any questions regarding this privacy policy or to exercise your rights, you can contact us at:",
        "emailLabel": "Email"
      }
    }
  },
  "de": {
    "title": "Datenschutzrichtlinie",
    "lastUpdated": "Zuletzt aktualisiert",
    "updateDate": "11. September 2025",
    "sections": {
      "dataController": {
        "title": "Datenverantwortlicher",
        "content": "Convention de Jonglerie ist der Datenverantwortliche für Ihre personenbezogenen Daten. Wir verpflichten uns, Ihre Privatsphäre zu schützen und Ihre personenbezogenen Daten transparent und in Übereinstimmung mit der Datenschutz-Grundverordnung (DSGVO) zu verarbeiten."
      },
      "dataCollected": {
        "title": "Erhobene Daten",
        "intro": "Wir erheben die folgenden Arten von personenbezogenen Daten:",
        "items": {
          "identity": "Identitätsinformationen: Nachname, Vorname, Benutzername",
          "contact": "Kontaktinformationen: E-Mail-Adresse",
          "preferences": "Benutzerpräferenzen: Lieblings-Conventions, Benachrichtigungseinstellungen"
        }
      },
      "purpose": {
        "title": "Verarbeitungszwecke",
        "intro": "Ihre personenbezogenen Daten werden für die folgenden Zwecke verarbeitet:",
        "items": {
          "accountManagement": "Verwaltung Ihres Benutzerkontos und Authentifizierung",
          "serviceProvision": "Bereitstellung der Plattformdienste (Durchsuchen, Hinzufügen von Conventions)",
          "communication": "Service-bezogene Kommunikation und wichtige Benachrichtigungen",
          "improvement": "Verbesserung unserer Dienste und Nutzungsanalyse"
        }
      },
      "legalBasis": {
        "title": "Rechtsgrundlage",
        "content": "Die Verarbeitung Ihrer personenbezogenen Daten basiert auf Ihrer Einwilligung zur Kontoerstellung und Dienstnutzung sowie auf unserem berechtigten Interesse an der Verbesserung unserer Dienste und der Plattformsicherheit."
      },
      "dataSharing": {
        "title": "Datenweitergabe",
        "content": "Wir verkaufen, vermieten oder teilen Ihre personenbezogenen Daten nicht mit Dritten, außer in den folgenden Fällen: gesetzliche Verpflichtung, Schutz unserer Rechte oder mit Ihrer ausdrücklichen Einwilligung. Daten können mit unseren technischen Dienstleistern streng im Rahmen der Diensterbringung geteilt werden."
      },
      "dataRetention": {
        "title": "Datenspeicherung",
        "content": "Ihre personenbezogenen Daten werden für die Dauer gespeichert, die für die Zwecke erforderlich ist, für die sie erhoben wurden. Konten, die länger als 3 Jahre inaktiv sind, können nach vorheriger Benachrichtigung gelöscht werden."
      },
      "userRights": {
        "title": "Ihre Rechte",
        "intro": "In Übereinstimmung mit der DSGVO haben Sie die folgenden Rechte:",
        "items": {
          "access": "Auskunftsrecht: eine Kopie Ihrer personenbezogenen Daten erhalten",
          "rectification": "Berichtigungsrecht: Ihre unrichtigen oder unvollständigen Daten korrigieren",
          "erasure": "Recht auf Löschung: Ihre personenbezogenen Daten löschen",
          "portability": "Recht auf Datenübertragbarkeit: Ihre Daten in einem strukturierten Format abrufen",
          "objection": "Widerspruchsrecht: der Verarbeitung Ihrer Daten widersprechen"
        }
      },
      "cookies": {
        "title": "Cookies und ähnliche Technologien",
        "content": "Wir verwenden technische Cookies, die für den Betrieb der Website erforderlich sind, insbesondere für die Verwaltung Ihrer Anmeldesitzung. Diese Cookies erfordern nicht Ihre vorherige Einwilligung, da sie für die Diensterbringung unbedingt erforderlich sind."
      },
      "security": {
        "title": "Datensicherheit",
        "content": "Wir implementieren angemessene technische und organisatorische Maßnahmen zum Schutz Ihrer personenbezogenen Daten vor Verlust, Missbrauch, unbefugtem Zugriff, Offenlegung, Änderung oder unbefugter Zerstörung."
      },
      "updates": {
        "title": "Richtlinien-Updates",
        "content": "Diese Datenschutzrichtlinie kann regelmäßig aktualisiert werden. Wir werden Sie über wesentliche Änderungen per E-Mail oder über eine Benachrichtigung auf der Website informieren."
      },
      "contact": {
        "title": "Kontakt",
        "content": "Für Fragen zu dieser Datenschutzrichtlinie oder zur Ausübung Ihrer Rechte können Sie uns kontaktieren unter:",
        "emailLabel": "E-Mail"
      }
    }
  },
  "es": {
    "title": "Política de Privacidad",
    "lastUpdated": "Última actualización",
    "updateDate": "11 de septiembre de 2025",
    "sections": {
      "dataController": {
        "title": "Responsable del Tratamiento",
        "content": "Convention de Jonglerie es el responsable del tratamiento de sus datos personales. Nos comprometemos a proteger su privacidad y procesar sus datos personales de manera transparente y en cumplimiento del Reglamento General de Protección de Datos (RGPD)."
      },
      "dataCollected": {
        "title": "Datos Recopilados",
        "intro": "Recopilamos los siguientes tipos de datos personales:",
        "items": {
          "identity": "Información de identidad: apellido, nombre, nombre de usuario",
          "contact": "Información de contacto: dirección de correo electrónico",
          "preferences": "Preferencias del usuario: convenciones favoritas, configuración de notificaciones"
        }
      },
      "purpose": {
        "title": "Propósitos del Tratamiento",
        "intro": "Sus datos personales se procesan para los siguientes propósitos:",
        "items": {
          "accountManagement": "Gestión de cuenta de usuario y autenticación",
          "serviceProvision": "Provisión de servicios de la plataforma (navegación, agregado de convenciones)",
          "communication": "Comunicación relacionada con el servicio y notificaciones importantes",
          "improvement": "Mejora del servicio y análisis de uso"
        }
      },
      "legalBasis": {
        "title": "Base Legal",
        "content": "El procesamiento de sus datos personales se basa en su consentimiento para la creación de cuenta y uso del servicio, así como en nuestro interés legítimo en mejorar nuestros servicios y la seguridad de la plataforma."
      },
      "dataSharing": {
        "title": "Compartir Datos",
        "content": "No vendemos, alquilamos ni compartimos sus datos personales con terceros, excepto en los siguientes casos: obligación legal, protección de nuestros derechos, o con su consentimiento explícito. Los datos pueden compartirse con nuestros proveedores de servicios técnicos estrictamente dentro del alcance de la prestación del servicio."
      },
      "dataRetention": {
        "title": "Retención de Datos",
        "content": "Sus datos personales se conservan durante el tiempo necesario para los propósitos para los cuales fueron recopilados. Las cuentas inactivas por más de 3 años pueden eliminarse después de notificación previa."
      },
      "userRights": {
        "title": "Sus Derechos",
        "intro": "De acuerdo con el RGPD, tiene los siguientes derechos:",
        "items": {
          "access": "Derecho de acceso: obtener una copia de sus datos personales",
          "rectification": "Derecho de rectificación: corregir sus datos inexactos o incompletos",
          "erasure": "Derecho al borrado: eliminar sus datos personales",
          "portability": "Derecho a la portabilidad: recuperar sus datos en un formato estructurado",
          "objection": "Derecho de oposición: oponerse al procesamiento de sus datos"
        }
      },
      "cookies": {
        "title": "Cookies y Tecnologías Similares",
        "content": "Utilizamos cookies técnicas necesarias para el funcionamiento del sitio, particularmente para gestionar su sesión de inicio de sesión. Estas cookies no requieren su consentimiento previo ya que son estrictamente necesarias para la prestación del servicio."
      },
      "security": {
        "title": "Seguridad de Datos",
        "content": "Implementamos medidas técnicas y organizativas apropiadas para proteger sus datos personales contra pérdida, mal uso, acceso no autorizado, divulgación, alteración o destrucción no autorizada."
      },
      "updates": {
        "title": "Actualizaciones de Política",
        "content": "Esta política de privacidad puede actualizarse periódicamente. Le informaremos de cualquier cambio sustancial por correo electrónico o mediante una notificación en el sitio."
      },
      "contact": {
        "title": "Contacto",
        "content": "Para cualquier pregunta sobre esta política de privacidad o para ejercer sus derechos, puede contactarnos en:",
        "emailLabel": "Correo electrónico"
      }
    }
  }
}
</i18n>
