#!/bin/sh
# James Nguyen
# Auto deploy to "test" stage on master branch build

echo "Using autodeployment to test stage script ..."

if [[ $TRAVIS_PULL_REQUEST == "false" ]];
  then if [[ $TRAVIS_BRANCH == "master" ]];
    then
      npm run deploy-test:all;
      cd ./scripts;
      npm install -g knex;
      SERVERLESS_STAGE=test knex migrate:latest;
      echo "Finished running autodeployment to test stage script ..."
  else
    echo "Stopping ... Not on master branch"
  fi
else
  echo "Stopping ... Script not available on pull requests"
fi
