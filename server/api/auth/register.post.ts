import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/prisma';


export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password, pseudo, nom, prenom } = body;

  if (!email || !password || !pseudo || !nom || !prenom) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email, password, pseudo, nom, and prenom are required',
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        pseudo,
        nom,
        prenom,
      },
    });
    return { message: 'User registered successfully', user: { id: user.id, email: user.email, pseudo: user.pseudo, nom: user.nom, prenom: user.prenom } };
  } catch (e: any) {
    if (e.code === 'P2002') { // Unique constraint failed
      throw createError({
        statusCode: 409,
        statusMessage: 'Email or pseudo already exists',
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});