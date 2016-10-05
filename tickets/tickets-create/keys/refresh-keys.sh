# !/bin/bash
#
# Author: James Nguyen (james.nguyen@maas.fi)

newKey() {
  # Generate a new private key (supply with a password - recommend using an empty password!)
  ssh-keygen -q -t rsa -b 768 -f latest.key -N ''
  # And a new public key from the previously generated private key
  openssl rsa -in latest.key -pubout -outform PEM -out latest.key.pub
  # Append public key to the end of tickets/tickets-validation-keys/index.js
  CONTENT=$(cat latest.key.pub)
  printf "\npublicKeysMap.$STAGE.push( {\n\tvalidityStartMilliEpoch: $MAAS_TICKET_PREVIOUS_CYCLE_TIME,\n\tvalidityEndMilliEpoch: $1,\n\tpublicKey: \`$CONTENT\`,\n} );\n" >> ../../tickets-validation-keys/index.js
}

refresh() {
  export NEXT_REFRESH_DATE=$(node -p -e "Date.now()+1000*60*60*24*$1") # Epoch

  echo "Writing key selection script to '$STAGE.js'"
  printf "'use strict';\n\nmodule.exports = ( Date.now() > $NEXT_REFRESH_DATE ) ? require('./$STAGE-latest') : require('./$STAGE-transitional');\n" > ./$STAGE.js

  # Move current key to transitional key
  echo "Moving old key '$STAGE-latest.js.asc' as transitional key '$STAGE-transitional.js.asc'"
  mv $STAGE-latest.js.asc $STAGE-transitional.js.asc

  newKey $NEXT_REFRESH_DATE

  # Copy dev-latest data as a template file for $STAGE-latest.clear.js file
  cp dev-latest.js $STAGE-latest.clear.js;

  # Append the new key script onto $STAGE-latest.clear.js
  printf "/* eslint-disable */\n'use strict';\n\nmodule.exports.getKey = () => [\n$(sed -i "" "s/$/',/" latest.key && sed -i "" "s/^/'/" latest.key && cat latest.key)\n].join('\\\n');\n" > $STAGE-latest.clear.js

  # Encrypt $STAGE-latest.clear.js
  echo "Encrypting the new key into '$STAGE-latest.js.asc'"
  openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in $STAGE-latest.clear.js -out $STAGE-latest.js.asc -a

  # Remove the clear text version
  rm latest.key.pub latest.key $STAGE-latest.clear.js

  # Edit MAAS_TICKET_PREVIOUS_CYCLE_TIME to equal newly created NEXT_REFRESH_DATE and save to s-variables-$STAGE
  node -p -e "const file=require('../../../_meta/variables/s-variables-$STAGE.json'); file.MAAS_TICKET_PREVIOUS_CYCLE_TIME=$NEXT_REFRESH_DATE;const result=require('fs').writeFileSync('../../../_meta/variables/s-variables-$STAGE.json',JSON.stringify(file, null, 2));'Keys successfully refreshed'"
}

# Allow this script to run only in this folder
if [[ ! $PWD =~ "maas-backend/tickets/tickets-create/keys" ]]
  then
    echo "This script can be run only in /maas-backend/tickets/tickets-create/keys" && exit 0
fi

# -d for day - MAAS_TICKET_CYCLE_DAY days
# -s for STAGE - stage in which this script deploy to
while getopts "hd:s:" opt; do
  case $opt in
    h  ) echo "Usage: bash refresh-keys.sh [-d <MAAS_TICKET_CYCLE_DAY>] -s <STAGE>"; exit 1;;
    d  ) export OPT_NEXT_CYCLE=$OPTARG;;
    s  ) export STAGE=$OPTARG;;
    \? ) echo "Usage: bash refresh-keys.sh [-d <MAAS_TICKET_CYCLE_DAY>] -s <STAGE>"; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
    *  ) echo "Unimplemented option: -$OPTARG" >&2; exit 1;;
  esac
done

# Validate stage
if [[ -z $STAGE ]] && [[ "$STAGE" != "dev" ]] && [[ "$STAGE" != "test" ]] && [[ "$STAGE" != "prod" ]] && [[ "$STAGE" != "alpha" ]];
  then
    echo "No stage set or invalid stage (should be dev, test, alpha or prod)."
    echo "Usage: bash refresh-keys.sh [-d <MAAS_TICKET_CYCLE_DAY>] -s <STAGE>"
    exit 1
  else
    echo "Using stage $STAGE."
fi

export MAAS_TICKET_DEPLOY_SECRET=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_DEPLOY_SECRET")
export MAAS_TICKET_PREVIOUS_CYCLE_TIME=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_PREVIOUS_CYCLE_TIME") # Epoch

# If the OPT_NEXT_CYCLE exists, refresh using the option, else use default
if [[ -z $OPT_NEXT_CYCLE ]];
  then
    echo "Cycle time not specified, using the default from s-variables-$STAGE.json/MAAS_TICKET_DEFAULT_CYCLE_DAY"
    export OPT_NEXT_CYCLE=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_DEFAULT_CYCLE_DAY")
fi

echo "This refresh ticket key will be available for the next $OPT_NEXT_CYCLE days"
refresh $OPT_NEXT_CYCLE

# TODO re-enable this when implementing it into auto deploy
# if [[ $(node -p -e "Date.now()") > MAAS_TICKET_PREVIOUS_CYCLE_TIME ]];
#   then
#     refresh;
# fi

echo "Previous cycle time time written into '../../../_meta/variables/s-variables-$STAGE.json'."
echo "Remember to push the changes to S3 by 'sls meta sync -s $STAGE'"
