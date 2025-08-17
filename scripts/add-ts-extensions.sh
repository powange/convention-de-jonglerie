#!/bin/bash

echo "🔧 Ajout des extensions .ts aux imports dans les tests Nuxt..."

# Parcourir tous les fichiers de test dans tests/nuxt
find tests/nuxt -name "*.test.ts" -type f | while read -r test_file; do
    echo "  📝 Traitement de $test_file"
    
    # Créer un fichier temporaire
    temp_file=$(mktemp)
    
    # Copier le contenu original
    cp "$test_file" "$temp_file"
    
    # Ajouter .ts aux imports de fichiers serveur/app qui n'ont pas d'extension
    # Pattern: import ... from '~/server/...' (sans extension)
    sed -E "s|from '(~/server/[^']*[^.][^t][^s])'|from '\1.ts'|g" "$temp_file" > "$test_file.tmp1"
    
    # Pattern: import ... from '~/app/...' (sans extension)  
    sed -E "s|from '(~/app/[^']*[^.][^t][^s])'|from '\1.ts'|g" "$test_file.tmp1" > "$test_file.tmp2"
    
    # Remplacer le fichier original
    mv "$test_file.tmp2" "$test_file"
    
    # Nettoyer les fichiers temporaires
    rm -f "$test_file.tmp"* "$temp_file"
done

echo "✅ Ajout des extensions .ts terminé"