#!/bin/bash
# James Nguyen
# Auto deploy to "alpha" stage on alpha branch build with release tag

echo "Using autodeployment to alpha stage script ..."
if [[ $TRAVIS_PULL_REQUEST == "false" ]];
  then if [[ $TRAVIS_BRANCH == "alpha" ]];
    then
      # Generate replease tag for alpha branch build
      export NPM_PACKAGE_VERSION=$(node -p -e "require('./package.json').version")
      export RELEASE_TAG="$NPM_PACKAGE_VERSION-alpha-$TRAVIS_BUILD_NUMBER";

      git config --global user.email "tech@maas.fi";
      git config --global user.name "travis";

      # Tag the release - we would want to do this even for failing builds
      git tag -a "$RELEASE_TAG" $(echo $TRAVIS_COMMIT | cut -c1-7) -m "$CURRENT_TIMESTAMP";
      git push --tags origin;

      # Migrate databases to latest the DB schemas
      cd ./scripts;
      npm install -g knex;
      SERVERLESS_STAGE=alpha knex migrate:latest;

      # Trigger build & deploy
      npm run build:alpha;
      npm run deploy-alpha:all;

      echo "Finished running autodeployment to alpha stage script ..."
  else
    echo "Stopping ... Not on alpha branch"
  fi
else
  echo "Stopping ... Script not available on pull requests"
fi
