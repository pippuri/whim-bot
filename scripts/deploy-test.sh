#!/bin/bash

SOURCE_BRANCH="sandbox"
TARGET_BRANCH="alpha"

echo "run"
echo $TRAVIS_PULL_REQUEST

#
if [ \(" $TRAVIS_PULL_REQUEST" == false \) -o \(" $TRAVIS_BRANCH" == "$SOURCE_BRANCH "\) ]; then
  echo $TRAVIS_PULL_REQUEST
  sh scripts/deploy-authorizer-test.sh  
  npm run deploy-test:all
fi
