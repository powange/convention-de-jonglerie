#!/bin/bash

echo "🔧 Suppression des extensions .ts incorrectes dans les imports..."

# Parcourir tous les fichiers de test dans tests/nuxt
find tests/nuxt -name "*.test.ts" -type f | while read -r test_file; do
    echo "  📝 Traitement de $test_file"
    
    # Enlever les extensions .ts des imports (uniquement pour les fichiers serveur/app)
    sed -i "s|from '~/server/\([^']*\)\.ts'|from '~/server/\1'|g" "$test_file"
    sed -i "s|from '~/app/\([^']*\)\.ts'|from '~/app/\1'|g" "$test_file"
done

echo "✅ Suppression des extensions .ts terminée"