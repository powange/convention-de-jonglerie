import { getEmailHash } from '../../utils/email-hash';
import { prisma } from '../../utils/prisma';

import type { Edition } from '~/types';


export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { 
      name, 
      startDate, 
      endDate, 
      countries,
      hasFoodTrucks,
      hasKidsZone,
      acceptsPets,
      hasTentCamping,
      hasTruckCamping,
      hasFamilyCamping,
      hasGym,
      hasFireSpace,
      hasGala,
      hasOpenStage,
      hasConcert,
      hasCantine,
      hasAerialSpace,
      hasSlacklineSpace,
      hasToilets,
      hasShowers,
      hasAccessibility,
      hasWorkshops
    } = query;

    const where: {
      name?: { contains: string };
      startDate?: { gte: Date };
      endDate?: { lte: Date };
      country?: { in: string[] };
      hasFoodTrucks?: boolean;
      hasKidsZone?: boolean;
      acceptsPets?: boolean;
      hasTentCamping?: boolean;
      hasTruckCamping?: boolean;
      hasFamilyCamping?: boolean;
      hasGym?: boolean;
      hasFireSpace?: boolean;
      hasGala?: boolean;
      hasOpenStage?: boolean;
      hasConcert?: boolean;
      hasCantine?: boolean;
      hasAerialSpace?: boolean;
      hasSlacklineSpace?: boolean;
      hasToilets?: boolean;
      hasShowers?: boolean;
      hasAccessibility?: boolean;
      hasWorkshops?: boolean;
    } = {};

    if (name) {
      where.name = {
        contains: name as string,
      };
    }

    if (startDate) {
      where.startDate = {
        gte: new Date(startDate as string),
      };
    }

    if (endDate) {
      where.endDate = {
        lte: new Date(endDate as string),
      };
    }

    // Filtre par pays (support multiselect)
    if (countries) {
      let countryList: string[] = [];
      
      // Gérer le cas où countries peut être une string ou un array
      if (typeof countries === 'string') {
        // Si c'est une string, essayer de la parser comme JSON ou la traiter comme un seul pays
        try {
          countryList = JSON.parse(countries);
        } catch {
          countryList = [countries];
        }
      } else if (Array.isArray(countries)) {
        countryList = countries;
      }
      
      if (countryList.length > 0) {
        where.country = {
          in: countryList
        };
      }
    }

    // Filtres par services (booléens)
    if (hasFoodTrucks === 'true') {
      where.hasFoodTrucks = true;
    }
    if (hasKidsZone === 'true') {
      where.hasKidsZone = true;
    }
    if (acceptsPets === 'true') {
      where.acceptsPets = true;
    }
    if (hasTentCamping === 'true') {
      where.hasTentCamping = true;
    }
    if (hasTruckCamping === 'true') {
      where.hasTruckCamping = true;
    }
    if (hasFamilyCamping === 'true') {
      where.hasFamilyCamping = true;
    }
    if (hasGym === 'true') {
      where.hasGym = true;
    }
    if (hasFireSpace === 'true') {
      where.hasFireSpace = true;
    }
    if (hasGala === 'true') {
      where.hasGala = true;
    }
    if (hasOpenStage === 'true') {
      where.hasOpenStage = true;
    }
    if (hasConcert === 'true') {
      where.hasConcert = true;
    }
    if (hasCantine === 'true') {
      where.hasCantine = true;
    }
    if (hasAerialSpace === 'true') {
      where.hasAerialSpace = true;
    }
    if (hasSlacklineSpace === 'true') {
      where.hasSlacklineSpace = true;
    }
    if (hasToilets === 'true') {
      where.hasToilets = true;
    }
    if (hasShowers === 'true') {
      where.hasShowers = true;
    }
    if (hasAccessibility === 'true') {
      where.hasAccessibility = true;
    }
    if (hasWorkshops === 'true') {
      where.hasWorkshops = true;
    }

    // Essayer d'inclure les collaborateurs, fallback sans si la table n'existe pas
    let includeCollaborators = false;
    try {
      // Test si la table EditionCollaborator existe
      await prisma.editionCollaborator.findFirst();
      includeCollaborators = true;
    } catch (error) {
      console.log('Table EditionCollaborator pas encore créée, ignorer les collaborateurs');
    }

    const editions = await prisma.edition.findMany({
      where,
      include: {
        creator: {
          select: { id: true, email: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
        convention: {
          select: { id: true, name: true, description: true, logo: true },
        },
        ...(includeCollaborators && {
          collaborators: {
            include: {
              user: {
                select: { id: true, email: true, pseudo: true, prenom: true, nom: true, profilePicture: true, updatedAt: true }
              },
              addedBy: {
                select: { id: true, pseudo: true }
              }
            }
          }
        }),
      },
    });

    return editions;
  } catch (error) {
    console.error('Erreur API editions:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});