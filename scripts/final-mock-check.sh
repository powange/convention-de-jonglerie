#!/bin/bash

echo "🔍 Vérification finale des chemins __mocks__/prisma..."

# Fonction pour vérifier et corriger selon la profondeur réelle
check_and_fix() {
    local file="$1"
    local expected_depth="$2"
    local expected_path="$3"
    
    # Vérifier si le fichier contient un import de mock
    if grep -q "__mocks__/prisma" "$file"; then
        current_import=$(grep "__mocks__/prisma" "$file")
        
        if [[ "$current_import" != *"$expected_path"* ]]; then
            echo "  ❌ $file utilise un mauvais chemin:"
            echo "     Actuel: $(echo "$current_import" | sed 's/.*from //g')"
            echo "     Attendu: \"$expected_path\""
            
            # Corriger le chemin
            sed -i "s|from \"[^\"]*__mocks__/prisma\"|from \"$expected_path\"|g" "$file"
            sed -i "s|from '[^']*__mocks__/prisma'|from '$expected_path'|g" "$file"
            echo "     ✅ Corrigé !"
        else
            echo "  ✅ $file - chemin correct"
        fi
    fi
}

echo ""
echo "📁 Profondeur 3 (../../__mocks__/prisma):"
find tests/nuxt/features tests/nuxt/middleware -name "*.test.ts" 2>/dev/null | while read -r file; do
    check_and_fix "$file" 3 "../../__mocks__/prisma"
done

echo ""
echo "📁 Profondeur 4 (../../../__mocks__/prisma):"
find tests/nuxt/server/utils -name "*.test.ts" 2>/dev/null | while read -r file; do
    check_and_fix "$file" 4 "../../../__mocks__/prisma"
done

# admin.test.ts cas spécial
if [ -f "tests/nuxt/server/api/admin.test.ts" ]; then
    check_and_fix "tests/nuxt/server/api/admin.test.ts" 4 "../../../__mocks__/prisma"
fi

echo ""
echo "📁 Profondeur 5 (../../../../__mocks__/prisma):"
find tests/nuxt/server/api -mindepth 2 -maxdepth 2 -name "*.test.ts" | while read -r file; do
    check_and_fix "$file" 5 "../../../../__mocks__/prisma"
done

echo ""
echo "📁 Profondeur 6 (../../../../../__mocks__/prisma):"
find tests/nuxt/server/api -mindepth 3 -maxdepth 3 -name "*.test.ts" | while read -r file; do
    check_and_fix "$file" 6 "../../../../../__mocks__/prisma"
done

echo ""
echo "✅ Vérification finale terminée"