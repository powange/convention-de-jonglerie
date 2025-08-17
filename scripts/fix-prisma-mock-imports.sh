#!/bin/bash

# Script pour corriger les imports prismaMock pour qu'ils pointent vers tests/__mocks__

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔧 Correction des imports prismaMock dans tests/nuxt..."
echo ""

TESTS_NUXT_DIR="tests/nuxt"
fixed_files=0

# Fonction pour calculer le chemin relatif correct
calculate_relative_path() {
    local file_path="$1"
    local file_dir=$(dirname "$file_path")
    
    # Compter le nombre de niveaux depuis tests/nuxt
    local relative_to_nuxt=${file_dir#tests/nuxt}
    
    # Si on est directement dans tests/nuxt, pas de sous-dossier
    if [ "$relative_to_nuxt" = "" ] || [ "$relative_to_nuxt" = "/" ]; then
        echo "../__mocks__/prisma"
        return
    fi
    
    # Enlever le slash de début s'il existe
    relative_to_nuxt=${relative_to_nuxt#/}
    
    # Compter le nombre de sous-dossiers (nombre de slashes + 1)
    if [ -n "$relative_to_nuxt" ]; then
        local depth=$(echo "$relative_to_nuxt" | tr '/' '\n' | wc -l)
    else
        local depth=0
    fi
    
    # Construire le chemin relatif: un ../ pour chaque sous-dossier + un ../ pour remonter de nuxt à tests
    local dots=""
    local i=0
    while [ $i -lt $depth ]; do
        dots="../$dots"
        i=$((i + 1))
    done
    
    echo "${dots}../__mocks__/prisma"
}

# Trouver tous les fichiers avec des imports prismaMock
files_with_imports=$(grep -r "import.*prismaMock.*from" "$TESTS_NUXT_DIR" --include="*.ts" --include="*.js" -l 2>/dev/null || true)

if [[ -z "$files_with_imports" ]]; then
    echo "✅ Aucun import prismaMock trouvé dans $TESTS_NUXT_DIR"
    exit 0
fi

echo "🔍 Traitement des fichiers..."
echo ""

# Traiter chaque fichier
while IFS= read -r file; do
    if [[ -z "$file" ]]; then
        continue
    fi
    
    echo "📄 Traitement de $file"
    
    # Calculer le chemin relatif correct
    correct_path=$(calculate_relative_path "$file")
    
    # Vérifier si l'import est déjà correct
    if grep -q "from ['\"]$correct_path['\"]" "$file" || \
       grep -q "from ['\"]tests/__mocks__/prisma['\"]" "$file"; then
        echo -e "  ${GREEN}✅ Import déjà correct${NC}"
    else
        # Remplacer l'import incorrect par le correct
        # Gérer différents patterns d'import
        if sed -i "s|from ['\"]@tests-mocks/prisma['\"]|from '$correct_path'|g" "$file" 2>/dev/null; then
            echo -e "  ${YELLOW}🔧 Corrigé alias @tests-mocks/prisma${NC}"
            ((fixed_files++))
        fi
        
        if sed -i "s|from ['\"][^'\"]*__mocks__/prisma['\"];*|from '$correct_path';|g" "$file" 2>/dev/null; then
            echo -e "  ${YELLOW}🔧 Corrigé chemin relatif incorrect${NC}"
            ((fixed_files++))
        fi
        
        # Vérifier le résultat
        if grep -q "from ['\"]$correct_path['\"]" "$file"; then
            echo -e "  ${GREEN}✅ Import corrigé avec succès${NC}"
        else
            echo -e "  ${RED}❌ Échec de la correction${NC}"
        fi
    fi
    
    echo ""
done <<< "$files_with_imports"

echo "📊 Résumé:"
echo "  Fichiers traités: $fixed_files"

if [[ $fixed_files -gt 0 ]]; then
    echo ""
    echo -e "${GREEN}✅ $fixed_files fichier(s) corrigé(s) avec succès !${NC}"
    echo -e "${YELLOW}💡 Vérifiez les changements avec: git diff${NC}"
else
    echo ""
    echo -e "${GREEN}✅ Tous les imports étaient déjà corrects !${NC}"
fi