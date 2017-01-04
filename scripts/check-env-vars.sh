#!/bin/bash

STAGE="$1"
if [ -z "$STAGE" ]; then
    echo "No stage specified. Aborting."
    exit 1
fi

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

extract_code_vars() {
    grep -RIoh --exclude-dir=node_modules --exclude-dir=www --exclude-dir=coverage process\\.env\\.\[A-Z0-9_\]* * | cut -d. -f3 | sort | uniq
}

extract_stage_vars() {
    cat _meta/variables/s-variables-$STAGE.json | cut -d: -f1 | grep \".*\" | sed 's/\s*"//g' | sort | uniq
}

extract_template_vars() {
    cat s-templates.json | grep -v ' [\{]' | cut -d: -f1 | grep \".*\" | sed 's/\s*"//g' | sort | uniq
}

echo
echo "Code variables missing from template"
echo "----------------------------------------------------------------------"
comm -23  <(extract_code_vars) <(extract_template_vars) | xargs printf "${RED}%s${NC}\n"

echo
echo "Template variables missing from stage variables ($STAGE)"
echo "----------------------------------------------------------------------"
comm -23  <(extract_template_vars) <(extract_stage_vars) | xargs printf "${RED}%s${NC}\n"

echo
echo "Stage variables ($STAGE) missing from template"
echo "----------------------------------------------------------------------"
comm -23  <(extract_stage_vars) <(extract_template_vars) | xargs printf "${CYAN}%s${NC}\n"

echo
echo "Template variables not used in code"
echo "----------------------------------------------------------------------"
comm -23  <(extract_template_vars) <(extract_code_vars) | xargs printf "${GREEN}%s${NC}\n"

#echo
#echo "Stage variables ($STAGE) not used in code"
#echo "----------------------------------------------------------------------"
#comm -23  <(extract_stage_vars) <(extract_code_vars) | xargs printf "${CYAN}%s${NC}\n"


