#!/bin/bash

echo "🧹 Nettoyage des chemins d'alias incorrects..."

# Fonction pour nettoyer les chemins d'alias mal formés
cleanup_paths() {
    local file="$1"
    echo "  📝 Nettoyage de $file"
    
    # Corriger les chemins avec des préfixes relatifs incorrects
    sed -i 's|from "../../@server-|from "@server-|g' "$file"
    sed -i "s|from '../../@server-|from '@server-|g" "$file"
    sed -i 's|from "../@server-|from "@server-|g' "$file"
    sed -i "s|from '../@server-|from '@server-|g" "$file"
    
    # Corriger les chemins directs sans alias
    sed -i 's|from "server/|from "../../../server/|g' "$file"
    sed -i "s|from 'server/|from '../../../server/|g" "$file"
}

# Nettoyer tous les fichiers de test qui contiennent des alias
find tests/nuxt -name "*.test.ts" -type f | while read -r test_file; do
    if grep -q "@server-" "$test_file"; then
        cleanup_paths "$test_file"
    fi
done

echo "✅ Nettoyage des chemins d'alias terminé"