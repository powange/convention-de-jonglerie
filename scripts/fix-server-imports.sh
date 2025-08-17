#!/bin/sh

# Script pour corriger les imports server pour qu'ils pointent correctement

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔧 Correction des imports server dans tests/nuxt..."
echo ""

TESTS_NUXT_DIR="tests/nuxt"
fixed_files=0

# Fonction pour calculer le chemin relatif correct vers server/
calculate_server_path() {
    local file_path="$1"
    local file_dir=$(dirname "$file_path")
    
    # Compter le nombre de niveaux depuis tests/nuxt
    local relative_to_nuxt=${file_dir#tests/nuxt}
    
    # Si on est directement dans tests/nuxt, pas de sous-dossier
    if [ "$relative_to_nuxt" = "" ] || [ "$relative_to_nuxt" = "/" ]; then
        echo "../server"
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
    
    # Construire le chemin relatif: un ../ pour chaque sous-dossier + deux ../ pour remonter de nuxt à racine
    local dots=""
    local i=0
    while [ $i -lt $depth ]; do
        dots="../$dots"
        i=$((i + 1))
    done
    
    echo "${dots}../../server"
}

# Trouver tous les fichiers avec des imports server (await import ET imports directs)
files_with_await_imports=$(grep -r "await import.*server" "$TESTS_NUXT_DIR" --include="*.ts" --include="*.js" -l 2>/dev/null || true)
files_with_direct_imports=$(grep -r "import.*from.*server" "$TESTS_NUXT_DIR" --include="*.ts" --include="*.js" -l 2>/dev/null || true)
files_with_imports=$(printf "%s\n%s\n" "$files_with_await_imports" "$files_with_direct_imports" | sort -u | grep -v "^$")

if [ -z "$files_with_imports" ]; then
    echo "✅ Aucun import server trouvé dans $TESTS_NUXT_DIR"
    exit 0
fi

echo "🔍 Traitement des fichiers..."
echo ""

# Utiliser un fichier temporaire pour compter les modifications
count_file=$(mktemp)
echo "0" > "$count_file"

# Traiter chaque fichier avec une boucle for au lieu de while avec pipe
for file in $files_with_imports; do
    if [ -z "$file" ]; then
        continue
    fi
    
    echo "📄 Traitement de $file"
    
    # Calculer le chemin relatif correct
    correct_base_path=$(calculate_server_path "$file")
    
    file_modified=false
    
    # Rechercher tous les imports server dans le fichier et les traiter
    temp_file=$(mktemp)
    cp "$file" "$temp_file"
    
    # Extraire tous les imports server (await import ET imports directs)
    await_imports=$(grep "await import.*server" "$file" 2>/dev/null || true)
    direct_imports=$(grep "import.*from.*server" "$file" 2>/dev/null || true)
    all_imports=$(printf "%s\n%s\n" "$await_imports" "$direct_imports" | grep -v "^$")
    
    # Extraire les chemins d'import
    imports=""
    if [ -n "$all_imports" ]; then
        while IFS= read -r import_line; do
            if echo "$import_line" | grep -q "await import"; then
                # Cas: await import('path')
                path=$(echo "$import_line" | sed -n "s/.*import(['\"]\\([^'\"]*\\)['\"].*/\\1/p")
            else
                # Cas: import ... from 'path'
                path=$(echo "$import_line" | sed -n "s/.*from ['\"]\\([^'\"]*\\)['\"].*/\\1/p")
            fi
            if [ -n "$path" ]; then
                imports="$imports $path"
            fi
        done <<< "$all_imports"
    fi
    
    for import_path in $imports; do
        if [ -n "$import_path" ]; then
            # Vérifier si l'import est déjà correct
            if echo "$import_path" | grep -q "^$correct_base_path/" || \
               (echo "$import_path" | grep -q "^server/" && [ "$correct_base_path" = "../server" ]); then
                # Import déjà correct, ne rien faire
                continue
            else
                # Import incorrect, le corriger
                if echo "$import_path" | grep -q "^server/"; then
                    # Cas: "server/utils/..." -> "correct_base_path/utils/..."
                    new_path=$(echo "$import_path" | sed "s|^server/|$correct_base_path/|")
                else
                    # Cas: mauvais chemin relatif -> extraire la partie après /server et reconstruire
                    server_suffix=$(echo "$import_path" | sed 's|^.*/server||')
                    new_path="$correct_base_path$server_suffix"
                fi
                
                # Effectuer le remplacement dans le fichier temporaire
                escaped_old=$(echo "$import_path" | sed 's|/|\\/|g')
                escaped_new=$(echo "$new_path" | sed 's|/|\\/|g')
                sed -i "s|$escaped_old|$escaped_new|g" "$temp_file" 2>/dev/null
                
                printf "  ${YELLOW}🔧 Corrigé '$import_path' → '$new_path'${NC}\n"
                file_modified=true
            fi
        fi
    done
    
    # Si des modifications ont été apportées, remplacer le fichier original
    if [ "$file_modified" = true ]; then
        mv "$temp_file" "$file"
        printf "  ${GREEN}✅ Import(s) corrigé(s) avec succès${NC}\n"
        # Incrémenter le compteur
        current_count=$(cat "$count_file")
        echo $((current_count + 1)) > "$count_file"
    else
        rm "$temp_file"
        printf "  ${GREEN}✅ Import déjà correct${NC}\n"
    fi
    
    echo ""
done

# Lire le nombre final de fichiers modifiés
fixed_files=$(cat "$count_file")
rm "$count_file"

echo "📊 Résumé:"
echo "  Fichiers traités: $fixed_files"

if [ $fixed_files -gt 0 ]; then
    echo ""
    printf "${GREEN}✅ $fixed_files fichier(s) corrigé(s) avec succès !${NC}\n"
    printf "${YELLOW}💡 Vérifiez les changements avec: git diff${NC}\n"
else
    echo ""
    printf "${GREEN}✅ Tous les imports étaient déjà corrects !${NC}\n"
fi