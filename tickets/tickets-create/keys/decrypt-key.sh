# !/bin/bash
# James Nguyen
# This script allows running in only dev and prod stage TODO add more

# Allow this script to run only in this folder
if [[ ! $PWD =~ "maas-backend/tickets/tickets-create/keys" ]]
  then
    echo "This script can be run only in /maas-backend/tickets/tickets-create/keys" && exit 0
fi

# -d for day - MAAS_TICKET_CYCLE_DAY days
# -s for STAGE - stage in which this script deploy to
while getopts "hd:s:" opt; do
  case $opt in
    h  ) echo "Usage: bash decrypt-key.sh -s <STAGE>"; exit 1;;
    s  ) export STAGE=$OPTARG;;
    \? ) echo "Usage: bash decrypt-key.sh -s <STAGE>"; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
    *  ) echo "Unimplemented option: -$OPTARG" >&2; exit 1;;
  esac
done

# Default stage to dev if input stage missing
if [[ -z $STAGE ]] && [[ "$STAGE" != "prod" ]] && [[ "$STAGE" != "dev" ]];
  then
    echo $STAGE
    echo "No stage set or invalid stage (!prod && !dev), using dev"
    unset STAGE
    export STAGE=dev
  else
    echo "Using stage $STAGE"
fi

# Check if s-variables-$STAGE existed or not TODO implement more stages to this
if [[ ! -f ../../../_meta/variables/s-variables-$STAGE.json ]]
  then
    echo "No s-variables-$STAGE found"
    exit 1
  else
    # Extract necessary variable from s-variables-$STAGE
    echo "Extracting deploy secret"
    MAAS_TICKET_DEPLOY_SECRET=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_DEPLOY_SECRET")

    # Decrypt the file with the secret

    echo "Decrypting files"
    openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in ./$STAGE-latest.js.asc -out ./$STAGE-latest.js -d -a
    openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in ./$STAGE-transitional.js.asc -out ./$STAGE-transitional.js -d -a

    echo "Please remember to remove changes on $STAGE-latest.js and $STAGE-transitional.js from git after deployment"
    # Checkout file changes
    # git checkout $STAGE-latest.js
    # git checkout $STAGE-transitional.js

fi
