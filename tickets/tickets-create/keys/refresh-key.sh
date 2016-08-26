# !/bin/bash
# James Nguyen
# This script allows running in only dev and prod stage TODO add more

newKey() {
  # Generate a new private key (supply with a password - recommend using an empty password!)
  ssh-keygen -t rsa -b 768 -f latest.key
  # And a new public key from the previously generated private key
  openssl rsa -in latest.key -pubout -outform PEM -out latest.key.pub
  # Append public key to the end of tickets/tickets-validation-keys/index.js
  CONTENT=$(cat latest.key.pub)
  printf "\npublicKeysMap.$STAGE.push( {\n\tvalidityStartMilliEpoch: $MAAS_TICKET_PREVIOUS_CYCLE_TIME,\n\tvalidityEndMilliEpoch: $1,\n\tpublicKey: \`$CONTENT\`,\n} );\n" >> ../../tickets-validation-keys/index.js
}

refresh() {
  export NEXT_REFRESH_DATE=$(node -p -e "new Date().getTime()+1000*60*60*24*$1") # Epoch

  printf "'use strict';\n\nmodule.exports = ( new Date().getTime() > $NEXT_REFRESH_DATE ) ? require('./$STAGE-latest') : require('./$STAGE-transitional');\n" > ./$STAGE.js

  # Move current key to transitional key
  mv $STAGE-latest.js.asc $STAGE-transitional.js.asc

  newKey $NEXT_REFRESH_DATE

  # Copy dev-latest data as a template file for $STAGE-latest.clear.js file
  cp dev-latest.js $STAGE-latest.clear.js;

  # Append the file onto $STAGE-latest.clear.js
  printf "/* eslint-disable */\n'use strict';\n\nmodule.exports.getKey = () => [\n$(sed -i "" "s/$/',/" latest.key && sed -i "" "s/^/'/" latest.key && cat latest.key)\n].join('\\\n');\n" > $STAGE-latest.clear.js

  # Encrypt $STAGE-latest.clear.js
  openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in $STAGE-latest.clear.js -out $STAGE-latest.js.asc -a

  # Remove the clear text version
  rm latest.key.pub latest.key $STAGE-latest.clear.js

  # Edit MAAS_TICKET_PREVIOUS_CYCLE_TIME to equal newly created NEXT_REFRESH_DATE and save to s-variables-$STAGE
  node -p -e "const file=require('../../../_meta/variables/s-variables-$STAGE.json'); file.MAAS_TICKET_PREVIOUS_CYCLE_TIME=$NEXT_REFRESH_DATE;require('fs').writeFileSync('../../../_meta/variables/s-variables-$STAGE.json', JSON.stringify(file, null, 2));console.log('Undefined is the result of fs.writeFileSync(), no worry')"
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
    h  ) echo "Usage: bash refresh-key.sh -d <MAAS_TICKET_CYCLE_DAY> -s <STAGE>"; exit 1;;
    d  ) export OPT_NEXT_CYCLE=$OPTARG;;
    s  ) export STAGE=$OPTARG;;
    \? ) echo "Usage: bash refresh-key.sh -d <MAAS_TICKET_CYCLE_DAY> -s <STAGE>"; exit 1;;
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

export MAAS_TICKET_DEPLOY_SECRET=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_DEPLOY_SECRET")
export MAAS_TICKET_PREVIOUS_CYCLE_TIME=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_PREVIOUS_CYCLE_TIME") # Epoch

# If option exist, refresh using option, else use default
if [[ -z $OPT_NEXT_CYCLE ]]
  then
    MAAS_TICKET_DEFAULT_CYCLE_DAY=$(node -p -e "require('../../../_meta/variables/s-variables-$STAGE.json').MAAS_TICKET_DEFAULT_CYCLE_DAY")
    echo "This refresh ticket key will be available for the next $MAAS_TICKET_DEFAULT_CYCLE_DAY days"
    refresh $MAAS_TICKET_DEFAULT_CYCLE_DAY
  else
    echo "This refresh ticket key will be available for the next $OPT_NEXT_CYCLE days"
    refresh $OPT_NEXT_CYCLE
fi

# TODO re-enable this when implementing it into auto deploy
# if [[ $(node -p -e "new Date().getTime()") > MAAS_TICKET_PREVIOUS_CYCLE_TIME ]];
#   then
#     refresh;
# fi
