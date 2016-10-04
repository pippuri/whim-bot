# !/bin/bash
#
# Author: James Nguyen (james.nguyen@maas.fi)
# TODO Describe what is the purpose of this script

# Allow this script to run only in this folder
if [[ ! $PWD =~ "maas-backend/tickets/tickets-create/keys" ]]
  then
    echo "This script can be run only in /maas-backend/tickets/tickets-create/keys" && exit 0
fi

# -d for day - MAAS_TICKET_CYCLE_DAY days
# -s for STAGE - stage in which this script deploy to
while getopts "hd:s:" opt; do
  case $opt in
    h  ) echo "Usage: bash create-keys.sh -s <STAGE>"; exit 1;;
    s  ) export STAGE=$OPTARG;;
    \? ) echo "Usage: bash create-keys.sh -s <STAGE>"; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
    *  ) echo "Unimplemented option: -$OPTARG" >&2; exit 1;;
  esac
done

# Validate stage
if [[ -z $STAGE ]] && [[ "$STAGE" != "dev" ]] && [[ "$STAGE" != "test" ]] && [[ "$STAGE" != "prod" ]] && [[ "$STAGE" != "alpha" ]];
  then
    echo "No stage set or invalid stage (should be dev, test, alpha or prod)."
    echo "Usage: bash create-keys.sh -s <STAGE>"; exit 1;
  else
    echo "Using stage $STAGE"
fi

# Check if s-variables-$STAGE exists or not
# TODO implement more stages to this
if [[ ! -f ../../../_meta/variables/s-variables-$STAGE.json ]]
  then
    echo "No s-variables-$STAGE found"
    exit 2
fi

if [[ ! -f ./$STAGE-latest.js.asc ]]
  then
    echo "No key file ./$STAGE-latest.js.asc found"
    exit 2
fi

if [[ ! -f ./$STAGE-transitional.js.asc ]]
  then
    echo "No key file ./$STAGE-transitional.js.asc found"
    exit 2
fi

# Extract necessary variable from s-variables-$STAGE
echo "Extracting deploy secret"
MAAS_TICKET_DEPLOY_SECRET=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_DEPLOY_SECRET")

# Encrypt the file with the secret
echo "Encrypting files"
openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in ./$STAGE-latest.js.asc -out ./$STAGE-latest.js -d -a
openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in ./$STAGE-transitional.js.asc -out ./$STAGE-transitional.js -d -a

echo "Please remember to remove changes on $STAGE-latest.js and $STAGE-transitional.js from git after deployment"
