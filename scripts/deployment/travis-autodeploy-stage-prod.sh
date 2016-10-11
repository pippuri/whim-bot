#!/bin/bash
# James Nguyen
# Auto deploy to "prod" stage on prod branch build with release tag

echo "Using autodeployment to prod stage script ..."
if [[ $TRAVIS_PULL_REQUEST == "false" ]];
  then if [[ $TRAVIS_BRANCH == "prod" ]];
    then
      # Generate replease tag for prod branch build
      export NPM_PACKAGE_VERSION=$(node -p -e "require('./package.json').version")
      export RELEASE_TAG="$NPM_PACKAGE_VERSION-prod-$TRAVIS_BUILD_NUMBER";

      git config --global user.email "tech@maas.fi";
      git config --global user.name "travis";

      # Tag the release - we would want to do this even for failing builds
      git tag -a "$RELEASE_TAG" $(echo $TRAVIS_COMMIT | cut -c1-7) -m "$CURRENT_TIMESTAMP";
      git push --tags origin;

      # Migrate databases to latest the DB schemas
      cd ./scripts;
      npm install -g knex;
      SERVERLESS_STAGE=prod knex migrate:latest;

      # Trigger build & deploy
      npm run deploy-prod:all;

      echo "Finished running autodeployment to prod stage script ..."
  else
    echo "Stopping ... Not on prod branch"
  fi
else
  echo "Stopping ... Script not available on pull requests"
fi
