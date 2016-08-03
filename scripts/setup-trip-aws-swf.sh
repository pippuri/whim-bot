#!/bin/sh
# Setup Maas AWS Simple Work Flow (SWF)
# Juha Lehtomäki

export AWS_PROFILE="maas"
#export API_ID="9hmh5en1ch"
#export AUTHORIZER_ID="r94b5z"
#export AWS_REGION="eu-west-1"
#export AWS_ACCOUNT="756207178743"
#export STAGE="dev"
#export LAMBDA="MaaS-auth-custom-authorizer"

export DOMAIN_NAME="maas-trip-stage-dev"
export FLOW_NAME="maas-trip"
export FLOW_VERSION="test-v3"
export ACTIVITY_NAME="maas-trip"
export ACTIVITY_VERSION="v1"

# register domain
aws swf register-domain --name $DOMAIN_NAME --description "MaaS SWF for managing user's trips (itenary followup & actions)" --workflow-execution-retention-period-in-days 90

# list registered domains
aws swf list-domains --registration-status REGISTERED

# register workflow
aws swf register-workflow-type --domain $DOMAIN_NAME --name $FLOW_NAME --workflow-version $FLOW_VERSION --description "Maas SWF trip follow workflow type" --default-task-start-to-close-timeout "60" --default-child-policy "TERMINATE"

# list registered flows
aws swf list-workflow-types --domain $DOMAIN_NAME --registration-status REGISTERED

# register activity
aws swf register-activity-type --domain $DOMAIN_NAME --name $ACTIVITY_NAME --activity-version $ACTIVITY_VERSION --description "Maas SWF activity for booking tickets in trip follow flow" --default-task-start-to-close-timeout "60" --default-task-schedule-to-start-timeout "20"

# register activity
aws swf list-activity-types --domain $DOMAIN_NAME --registration-status REGISTERED

# First we update the authorizer to call the right lambda function including the qualifier :xxx at the end of the function ARN
#aws apigateway update-authorizer --rest-api-id $API_ID --authorizer-id $AUTHORIZER_ID --patch-operations op=replace,path=/authorizerUri,value=arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$AWS_REGION:$AWS_ACCOUNT:function:$LAMBDA:$STAGE/invocations

# Then we give API Gateway permission to invoke the authorizer using resource policies on the Lambda function
#aws lambda add-permission --function-name $LAMBDA --statement-id Stmt1 --action lambda:InvokeFunction --principal apigateway.amazonaws.com --qualifier $STAGE --source-arn arn:aws:execute-api:$AWS_REGION:$AWS_ACCOUNT:$API_ID/authorizers/$AUTHORIZER_ID

# You can check the structure of your authorizer with
#aws apigateway get-authorizer --rest-api-id $API_ID --authorizer-id $AUTHORIZER_ID

# You can also check the policy against the lambda function with
#aws lambda get-policy --function-name $LAMBDA --qualifier $STAGE

