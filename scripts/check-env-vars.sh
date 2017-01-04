#!/bin/bash


# ------------------------------------------------------------------------
# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color


# ------------------------------------------------------------------------
# Read in command line args
while [[ "$#" > 1 ]]; do case $1 in
    -s) stage="$2";;
    --stage) stage="$2";;
    *) break;;
  esac; shift; shift
done

if [ -z "$stage" ]; then
    echo "No stage specified, will not check stage variables."
fi

# ------------------------------------------------------------------------
# Helper functions
extract_code_vars() {
    grep -RIoh --exclude-dir=node_modules --exclude-dir=www --exclude-dir=coverage process\\.env\\.\[A-Z0-9_\]* * | cut -d. -f3 | sort | uniq
}

extract_template_vars() {
    cat s-templates.json | grep -v ' [\{]' | cut -d: -f1 | grep \".*\" | sed 's/\s*"//g' | sort | uniq
}

extract_stage_vars() {
    cat _meta/variables/s-variables-$stage.json | cut -d: -f1 | grep \".*\" | sed 's/\s*"//g' | sort | uniq
}


# ------------------------------------------------------------------------
# Main
echo
echo "Code variables missing from template"
echo "----------------------------------------------------------------------"
comm -23  <(extract_code_vars) <(extract_template_vars) | xargs printf "${RED}%s${NC}\n"

echo
echo "Template variables not used in code"
echo "----------------------------------------------------------------------"
comm -23  <(extract_template_vars) <(extract_code_vars) | xargs printf "${GREEN}%s${NC}\n"

if [ -n "$stage" ]; then
    echo
    echo "Template variables missing from stage variables ($stage)"
    echo "----------------------------------------------------------------------"
    comm -23  <(extract_template_vars) <(extract_stage_vars) | xargs printf "${RED}%s${NC}\n"

    echo
    echo "Stage variables ($stage) missing from template"
    echo "----------------------------------------------------------------------"
    comm -23  <(extract_stage_vars) <(extract_template_vars) | xargs printf "${CYAN}%s${NC}\n"

    #echo
    #echo "Stage variables ($stage) not used in code"
    #echo "----------------------------------------------------------------------"
    #comm -23  <(extract_stage_vars) <(extract_code_vars) | xargs printf "${CYAN}%s${NC}\n"
fi

