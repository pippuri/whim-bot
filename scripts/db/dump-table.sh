# !/bin/bash
#
# This utility dumps a Postgres DB table into a SQL file that can be run e.g.
# by a Knex migration script.
#
# Note: Requires 'pgcli' installed, install by "brew install pgcli" on OS/X
#
# Author: Lauri Svan (lauri.svan@gmail.com)


function readVar {
  echo $(node -p -e "require('../../_meta/variables/s-variables-$2.json').$1")
}

# Allow this script to run only in this folder
if [[ ! $PWD =~ "maas-backend/scripts/db" ]]
  then
    echo "This script can be run only in /maas-backend/scripts/db" && exit 0
fi

# -d for day - MAAS_TICKET_CYCLE_DAY days
# -s for STAGE - stage in which this script deploy to
while getopts "hs:t:" opt; do
  case $opt in
    h  ) echo "Usage: bash dump-table.sh -s <STAGE> -t <SCHEMA> >dump.sql"; exit 1;;
    s  ) export STAGE=$OPTARG;;
    t  ) export SCHEMA=$OPTARG;;
    \? ) echo "Usage: bash dump-table.sh -s <STAGE> -t <SCHEMA> >dump.sql"; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
    *  ) echo "Invalid option: -$OPTARG" >&2; exit 1;;
  esac
done

# Validate stage
if [[ -z $STAGE ]] && [[ "$STAGE" != "dev" ]] && [[ "$STAGE" != "test" ]] && [[ "$STAGE" != "prod" ]] && [[ "$STAGE" != "alpha" ]];
  then
    echo "No stage set or invalid stage (should be dev, test, alpha or prod)."
    echo "Usage: bash dump-table.sh -s <STAGE> -t <SCHEMA> >dump.sql"; exit 1;
fi

# Check if s-variables-$STAGE exists or not
# TODO implement more stages to this
if [[ ! -f ../../_meta/variables/s-variables-$STAGE.json ]]
then
  echo "No s-variables-$STAGE found"
  exit 1
fi

# Extract necessary variable from s-variables-$STAGE. Set PGPASSWORD var, because
# pg_dump reads it from env
MAAS_PGDATABASE=$(readVar "MAAS_PGDATABASE" $STAGE)
MAAS_PGHOST=$(readVar "MAAS_PGHOST" $STAGE)
MAAS_PGPORT=$(readVar "MAAS_PGPORT" $STAGE)
MAAS_PGUSER=$(readVar "MAAS_PGUSER" $STAGE)
MAAS_PGPASSWORD=$(readVar "MAAS_PGPASSWORD" $STAGE)

PGPASSWORD=$MAAS_PGPASSWORD pg_dump -h $MAAS_PGHOST -d $MAAS_PGDATABASE -p $MAAS_PGPORT -U $MAAS_PGUSER -w -t \"$SCHEMA\"

#PGPASSWORD=$MAAS_PGPASSWORD pgcli -h $MAAS_PGHOST -d $MAAS_PGDATABASE -p $MAAS_PGPORT -U $MAAS_PGUSER -w
