#!/bin/sh

# Script pour vérifier que tous les imports prismaMock pointent vers tests/__mocks__

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Vérification des imports prismaMock dans tests/nuxt..."
echo ""

# Chemins attendus pour les imports prismaMock
EXPECTED_PATH="tests/__mocks__"
TESTS_NUXT_DIR="tests/nuxt"

# Compteurs
total_files=0
problematic_files=0

# Fonction pour calculer le chemin relatif correct
calculate_relative_path() {
    file_path="$1"
    file_dir=$(dirname "$file_path")
    
    # Compter le nombre de niveaux depuis tests/nuxt
    relative_to_nuxt=${file_dir#tests/nuxt}
    
    # Si on est directement dans tests/nuxt, pas de sous-dossier
    if [ "$relative_to_nuxt" = "" ] || [ "$relative_to_nuxt" = "/" ]; then
        echo "../__mocks__/prisma"
        return
    fi
    
    # Enlever le slash de début s'il existe
    relative_to_nuxt=${relative_to_nuxt#/}
    
    # Compter le nombre de sous-dossiers (nombre de slashes + 1)
    if [ -n "$relative_to_nuxt" ]; then
        depth=$(echo "$relative_to_nuxt" | tr '/' '\n' | wc -l)
    else
        depth=0
    fi
    
    # Construire le chemin relatif: un ../ pour chaque sous-dossier + un ../ pour remonter de nuxt à tests
    dots=""
    i=0
    while [ $i -lt $depth ]; do
        dots="../$dots"
        i=$((i + 1))
    done
    
    echo "${dots}../__mocks__/prisma"
}

# Trouver tous les fichiers avec des imports prismaMock
echo "📁 Recherche des fichiers avec des imports prismaMock..."
files_with_imports=$(grep -r "import.*prismaMock.*from" "$TESTS_NUXT_DIR" --include="*.ts" --include="*.js" -l 2>/dev/null || true)

if [ -z "$files_with_imports" ]; then
    echo "✅ Aucun import prismaMock trouvé dans $TESTS_NUXT_DIR"
    exit 0
fi

echo "📋 Fichiers trouvés:"
echo "$files_with_imports" | while IFS= read -r file; do
    if [ -n "$file" ]; then
        echo "  - $file"
        total_files=$((total_files + 1))
    fi
done

echo ""
echo "🔍 Analyse des imports..."
echo ""

# Analyser chaque fichier
echo "$files_with_imports" | while IFS= read -r file; do
    if [ -z "$file" ]; then
        continue
    fi
    
    echo "📄 Analyse de $file"
    
    # Extraire la ligne d'import prismaMock
    import_line=$(grep "import.*prismaMock.*from" "$file" | head -1)
    
    if [ -n "$import_line" ]; then
        echo "  Import actuel: $import_line"
        
        # Calculer le chemin relatif correct
        correct_path=$(calculate_relative_path "$file")
        
        # Vérifier si l'import est correct
        if echo "$import_line" | grep -q "from ['\"]$correct_path['\"]" || \
           echo "$import_line" | grep -q "from ['\"]tests/__mocks__/prisma['\"]" || \
           echo "$import_line" | grep -q "from ['\"]@tests-mocks/prisma['\"]"; then
            printf "  ${GREEN}✅ Import correct${NC}\n"
        else
            printf "  ${RED}❌ Import incorrect${NC}\n"
            printf "  ${YELLOW}   Devrait être: import { prismaMock } from '$correct_path'${NC}\n"
            problematic_files=$((problematic_files + 1))
            
            # Proposer la correction
            echo "  🔧 Correction suggérée:"
            echo "     Remplacer par: import { prismaMock } from '$correct_path'"
        fi
    fi
    
    echo ""
done

# Compter le total de fichiers
total_files=$(echo "$files_with_imports" | grep -c .)

# Résumé
echo "📊 Résumé:"
echo "  Total de fichiers analysés: $total_files"
echo "  Fichiers avec imports problématiques: $problematic_files"
echo "  Fichiers avec imports corrects: $((total_files - problematic_files))"

if [ $problematic_files -gt 0 ]; then
    echo ""
    printf "${RED}❌ $problematic_files fichier(s) ont des imports incorrects${NC}\n"
    printf "${YELLOW}💡 Pour corriger automatiquement, vous pouvez utiliser le script fix-prisma-mock-imports.sh${NC}\n"
    exit 1
else
    echo ""
    printf "${GREEN}✅ Tous les imports prismaMock sont corrects !${NC}\n"
    exit 0
fi