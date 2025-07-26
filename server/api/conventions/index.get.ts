import { PrismaClient } from '@prisma/client';

import type { Convention } from '~/types';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { 
      name, 
      startDate, 
      endDate, 
      countries,
      hasFastfood,
      hasKidsZone,
      acceptsPets,
      hasTentCamping,
      hasTruckCamping,
      hasGym
    } = query;

    const where: {
      name?: { contains: string };
      startDate?: { gte: Date };
      endDate?: { lte: Date };
      country?: { in: string[] };
      hasFastfood?: boolean;
      hasKidsZone?: boolean;
      acceptsPets?: boolean;
      hasTentCamping?: boolean;
      hasTruckCamping?: boolean;
      hasGym?: boolean;
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
    if (hasFastfood === 'true') {
      where.hasFastfood = true;
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
    if (hasGym === 'true') {
      where.hasGym = true;
    }

    // Essayer d'inclure les collaborateurs, fallback sans si la table n'existe pas
    let includeCollaborators = false;
    try {
      // Test si la table ConventionCollaborator existe
      await prisma.conventionCollaborator.findFirst();
      includeCollaborators = true;
    } catch (error) {
      console.log('Table ConventionCollaborator pas encore créée, ignorer les collaborateurs');
    }

    const conventions = await prisma.convention.findMany({
      where,
      include: {
        creator: {
          select: { id: true, email: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
        ...(includeCollaborators && {
          collaborators: {
            include: {
              user: {
                select: { id: true, email: true, pseudo: true, prenom: true, nom: true }
              },
              addedBy: {
                select: { id: true, pseudo: true }
              }
            }
          }
        }),
      },
    });

    return conventions;
  } catch (error) {
    console.error('Erreur API conventions:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});