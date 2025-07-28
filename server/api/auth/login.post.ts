import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma';


export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { identifier, password } = body; // 'identifier' can be email or pseudo

  if (!identifier || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identifier (email or pseudo) and password are required',
    });
  }

  let user = null;

  // Try to find user by email
  user = await prisma.user.findUnique({
    where: {
      email: identifier,
    },
  });

  // If not found by email, try to find by pseudo
  if (!user) {
    user = await prisma.user.findUnique({
      where: {
        pseudo: identifier,
      },
    });
  }

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
    });
  }

  // Generate JWT token
  const config = useRuntimeConfig();
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '1h' });

  return { 
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      pseudo: user.pseudo, 
      nom: user.nom, 
      prenom: user.prenom,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    } 
  };
});
