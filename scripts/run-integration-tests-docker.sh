#!/bin/sh

sleep 5
mkdir -p /app/public/uploads
npx prisma migrate deploy >/dev/null 2>&1 || true
npx prisma generate >/dev/null 2>&1

# Script simple pour lancer les tests d'intégration dans Docker (sortie concise)

# Variable d'environnement pour activer les tests DB
export TEST_WITH_DB=true

# Lancer les tests avec la configuration d'intégration
if [ -f vitest.config.integration.ts ]; then
	npx vitest run --config vitest.config.integration.ts --reporter=dot --silent
else
	# fallback
	TEST_WITH_DB=true npx vitest run --config vitest.config.ts --reporter=dot --silent
fi
