#!/bin/bash
# James Nguyen
# Auto deploy to "test" stage on master branch build

echo "Using autodeployment to test stage script ..."

if [[ $TRAVIS_PULL_REQUEST == "false" ]];
  then if [[ $TRAVIS_BRANCH == "master" ]];
    then
      # Migrate databases to latest the DB schemas
      cd ./scripts;
      npm install -g knex;
      SERVERLESS_STAGE=test knex migrate:latest;

      # Auto-deploy to test
      npm run deploy-docs;
      npm run deploy-test:all;

      echo "Finished running autodeployment to test stage script ..."
  else
    echo "Stopping ... Not on master branch"
  fi
else
  echo "Stopping ... Script not available on pull requests"
fi
