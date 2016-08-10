#!/bin/sh
# James Nguyen

# Try to deploy authorizer, not fail even on error
set +e
export API_ID="9hmh5en1ch"
export AUTHORIZER_ID="r94b5z"
export AWS_REGION="eu-west-1"
export AWS_ACCOUNT="756207178743"
export STAGE="alpha"
export LAMBDA="MaaS-auth-custom-authorizer"


## Install awscli
pip install --user awscli
export PATH=$PATH:$HOME/.local/bin

## First we update the authorizer to call the right lambda function including the qualifier :xxx at the end of the function ARN
aws apigateway update-authorizer --rest-api-id $API_ID --authorizer-id $AUTHORIZER_ID --patch-operations op=replace,path=/authorizerUri,value=arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$AWS_REGION:$AWS_ACCOUNT:function:$LAMBDA:$STAGE/invocations

## Then we give API Gateway permission to invoke the authorizer using resource policies on the Lambda function
aws lambda add-permission --function-name $LAMBDA --statement-id Stmt1 --action lambda:InvokeFunction --principal apigateway.amazonaws.com --qualifier $STAGE --source-arn arn:aws:execute-api:$AWS_REGION:$AWS_ACCOUNT:$API_ID/authorizers/$AUTHORIZER_ID

## You can check the structure of your authorizer with
aws apigateway get-authorizer --rest-api-id $API_ID --authorizer-id $AUTHORIZER_ID

## You can also check the policy against the lambda function with
aws lambda get-policy --function-name $LAMBDA --qualifier $STAGE

## re-enable fail-safe
set -e

# Deploy all endpoint + lambda to alpha stage on every master merge
npm run deploy-alpha:all
