#!/bin/sh

# Script pour vérifier que tous les imports server dans tests/nuxt pointent correctement

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Vérification des imports server dans tests/nuxt..."
echo ""

TESTS_NUXT_DIR="tests/nuxt"
total_files=0
problematic_files=0

# Fonction pour calculer le chemin relatif correct vers server/
calculate_server_path() {
    file_path="$1"
    file_dir=$(dirname "$file_path")
    
    # Compter le nombre de niveaux depuis tests/nuxt
    relative_to_nuxt=${file_dir#tests/nuxt}
    
    # Si on est directement dans tests/nuxt, pas de sous-dossier
    if [ "$relative_to_nuxt" = "" ] || [ "$relative_to_nuxt" = "/" ]; then
        echo "../server"
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
    
    # Construire le chemin relatif: un ../ pour chaque sous-dossier + deux ../ pour remonter de nuxt à racine
    dots=""
    i=0
    while [ $i -lt $depth ]; do
        dots="../$dots"
        i=$((i + 1))
    done
    
    echo "${dots}../../server"
}

# Trouver tous les fichiers avec des imports server (await import ET imports directs)
echo "📁 Recherche des fichiers avec des imports server..."
files_with_await_imports=$(grep -r "await import.*server" "$TESTS_NUXT_DIR" --include="*.ts" --include="*.js" -l 2>/dev/null || true)
files_with_direct_imports=$(grep -r "import.*from.*server" "$TESTS_NUXT_DIR" --include="*.ts" --include="*.js" -l 2>/dev/null || true)
files_with_imports=$(echo -e "$files_with_await_imports\n$files_with_direct_imports" | sort -u | grep -v "^$")

if [ -z "$files_with_imports" ]; then
    echo "✅ Aucun import server trouvé dans $TESTS_NUXT_DIR"
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
    
    # Extraire toutes les lignes d'import server (await import ET imports directs)
    await_imports=$(grep "await import.*server" "$file" 2>/dev/null || true)
    direct_imports=$(grep "import.*from.*server" "$file" 2>/dev/null || true)
    import_lines=$(echo -e "$await_imports\n$direct_imports" | grep -v "^$")
    
    if [ -n "$import_lines" ]; then
        # Calculer le chemin relatif correct
        correct_base_path=$(calculate_server_path "$file")
        
        echo "$import_lines" | while IFS= read -r import_line; do
            echo "  Import actuel: $import_line"
            
            # Extraire le chemin dans l'import (pour await import ET imports directs)
            import_path=""
            if echo "$import_line" | grep -q "await import"; then
                # Cas: await import('path')
                import_path=$(echo "$import_line" | sed -n "s/.*import(['\"]\\([^'\"]*\\)['\"].*/\\1/p")
            else
                # Cas: import ... from 'path'
                import_path=$(echo "$import_line" | sed -n "s/.*from ['\"]\\([^'\"]*\\)['\"].*/\\1/p")
            fi
            
            if [ -n "$import_path" ]; then
                # Vérifier si l'import commence par le bon chemin
                if echo "$import_path" | grep -q "^$correct_base_path/" || \
                   (echo "$import_path" | grep -q "^server/" && [ "$correct_base_path" = "../server" ]); then
                    printf "  ${GREEN}✅ Import correct${NC}\n"
                else
                    printf "  ${RED}❌ Import incorrect${NC}\n"
                    # Proposer une correction
                    if echo "$import_path" | grep -q "^server/"; then
                        # Cas où il utilise juste "server/" au lieu du chemin relatif
                        suggested_path=$(echo "$import_path" | sed "s|^server/|$correct_base_path/|")
                    else
                        # Autres cas, remplacer le début par le bon chemin
                        relative_part=$(echo "$import_path" | sed 's|^.*/server||')
                        suggested_path="$correct_base_path$relative_part"
                    fi
                    printf "  ${YELLOW}   Devrait être: $suggested_path${NC}\n"
                    problematic_files=$((problematic_files + 1))
                    
                    echo "  🔧 Correction suggérée:"
                    echo "     Remplacer '$import_path' par '$suggested_path'"
                fi
            fi
        done
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
    printf "${YELLOW}💡 Pour corriger automatiquement, vous pouvez utiliser le script fix-server-imports.sh${NC}\n"
    exit 1
else
    echo ""
    printf "${GREEN}✅ Tous les imports server sont corrects !${NC}\n"
    exit 0
fi