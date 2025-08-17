#!/bin/bash

echo "🔧 Conversion des imports ~/server et ~/app en imports relatifs..."

# Fonction pour calculer le chemin relatif selon le dossier
convert_imports() {
    local test_file="$1"
    local depth="$2"
    
    echo "  📝 Traitement de $test_file (profondeur: $depth)"
    
    # Construire le préfixe relatif selon la profondeur
    relative_prefix=""
    for ((i=0; i<depth; i++)); do
        relative_prefix="../$relative_prefix"
    done
    
    # Convertir ~/server/ et ~/app/ en chemins relatifs
    sed -i "s|from '~/server/\([^']*\)'|from '${relative_prefix}server/\1'|g" "$test_file"
    sed -i "s|from '~/app/\([^']*\)'|from '${relative_prefix}app/\1'|g" "$test_file"
}

# Traiter les fichiers selon leur profondeur
find tests/nuxt -name "*.test.ts" -type f | while read -r test_file; do
    # Compter la profondeur du fichier par rapport à la racine
    depth=$(echo "$test_file" | tr -cd '/' | wc -c)
    depth=$((depth - 1))  # Ajuster car tests/nuxt est déjà 2 niveaux
    
    case "$test_file" in
        tests/nuxt/features/*) 
            convert_imports "$test_file" 3 ;;
        tests/nuxt/middleware/*) 
            convert_imports "$test_file" 3 ;;
        tests/nuxt/server/api/*/*) 
            convert_imports "$test_file" 5 ;;
        tests/nuxt/server/api/*/*/*) 
            convert_imports "$test_file" 6 ;;
        tests/nuxt/server/api/*/*/*/*) 
            convert_imports "$test_file" 7 ;;
        tests/nuxt/server/middleware/*) 
            convert_imports "$test_file" 4 ;;
        tests/nuxt/server/utils/*) 
            convert_imports "$test_file" 4 ;;
        tests/nuxt/server/*) 
            convert_imports "$test_file" 3 ;;
        *) 
            convert_imports "$test_file" 3 ;;
    esac
done

echo "✅ Conversion des imports relatifs terminée"