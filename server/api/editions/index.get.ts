import { getEmailHash } from '../../utils/email-hash';
import { prisma } from '../../utils/prisma';

// import type { Edition } from '~/types';


export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { 
      name, 
      startDate, 
      endDate, 
      countries,
      showPast,
      showCurrent,
      showFuture,
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
      hasWorkshops,
      hasLongShow,
      hasATM,
      page = '1',
      limit = '12'
    } = query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);

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
      hasLongShow?: boolean;
      hasATM?: boolean;
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
          const parsed = JSON.parse(countries);
          if (Array.isArray(parsed)) {
            // Si c'est un array d'objets avec une propriété 'value', extraire les valeurs
            countryList = parsed.map(item => 
              typeof item === 'object' && item !== null && 'value' in item 
                ? item.value 
                : item
            );
          } else {
            countryList = [parsed];
          }
        } catch {
          countryList = [countries];
        }
      } else if (Array.isArray(countries)) {
        // Si c'est déjà un array, extraire les valeurs si ce sont des objets
        countryList = countries.map(item => 
          typeof item === 'object' && item !== null && 'value' in item 
            ? item.value 
            : item
        );
      }
      
      // Filtrer les valeurs vides et les doublons
      countryList = [...new Set(countryList.filter(Boolean))];
      
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
    if (hasLongShow === 'true') {
      where.hasLongShow = true;
    }
    if (hasATM === 'true') {
      where.hasATM = true;
    }

    // Construire la condition finale avec les filtres temporels
  // Prisma where clause; fallback to unknown and narrow to object
  let finalWhere: Record<string, unknown> = where;
    
    // Filtres temporels
    if (showPast !== undefined || showCurrent !== undefined || showFuture !== undefined) {
      const now = new Date();
      
      const timeFilters = [];
      
      if (showPast === 'true') {
        // Éditions terminées: endDate < maintenant
        timeFilters.push({ endDate: { lt: now } });
      }
      
      if (showCurrent === 'true') {
        // Éditions en cours: startDate <= maintenant AND endDate >= maintenant
        timeFilters.push({
          startDate: { lte: now },
          endDate: { gte: now }
        });
      }
      
      if (showFuture === 'true') {
        // Éditions à venir: startDate > maintenant
        timeFilters.push({ startDate: { gt: now } });
      }
      
      // Si au moins un filtre temporel est actif, créer un filtre AND avec les autres conditions
      if (timeFilters.length > 0) {
        // Si il y a d'autres conditions, combiner avec AND
        if (Object.keys(where).length > 0) {
          finalWhere = {
            AND: [
              where,
              { OR: timeFilters }
            ]
          };
        } else {
          // Si pas d'autres conditions, utiliser seulement le filtre temporel
          finalWhere = { OR: timeFilters };
        }
      }
      // Si aucun filtre temporel n'est coché, ne rien afficher
      else if (showPast === 'false' && showCurrent === 'false' && showFuture === 'false') {
        finalWhere = { id: -1 }; // Condition impossible pour ne rien retourner
      }
    }

    // Essayer d'inclure les collaborateurs, fallback sans si la table n'existe pas
    let includeCollaborators = false;
    try {
      // Test si la table EditionCollaborator existe
      await prisma.editionCollaborator.findFirst();
      includeCollaborators = true;
  } catch {
      console.log('Table EditionCollaborator pas encore créée, ignorer les collaborateurs');
    }

    // Calculer le skip et take pour la pagination
    const skip = (pageNumber - 1) * limitNumber;

    // Obtenir le total pour la pagination
    const totalCount = await prisma.edition.count({
      where: finalWhere
    });

    const editions = await prisma.edition.findMany({
      where: finalWhere,
      include: {
        creator: {
          select: { id: true, pseudo: true },
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
                select: { id: true, pseudo: true, profilePicture: true, updatedAt: true, email: true }
              },
              addedBy: {
                select: { id: true, pseudo: true }
              }
            }
          }
        }),
      },
      orderBy: {
        startDate: 'asc' // Tri croissant par date de début (plus proche en premier)
      },
      skip,
      take: limitNumber
    });

    // Transformer les emails en emailHash pour les collaborateurs
    const transformedEditions = editions.map(edition => {
      if (edition.collaborators) {
        edition.collaborators = edition.collaborators.map(collab => ({
          ...collab,
          user: {
            ...collab.user,
            emailHash: getEmailHash(collab.user.email),
            email: undefined
          } as unknown
        }));
      }
      return edition;
    });

    // Retourner les résultats avec les métadonnées de pagination
    return {
      data: transformedEditions,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalCount / limitNumber)
      }
    };
  } catch (error) {
    console.error('Erreur API editions:', error);
    console.error('Query params:', query);
    throw createError({
      statusCode: 500,
      statusMessage: `Erreur lors de la récupération des éditions: ${error.message}`,
    });
  }
});