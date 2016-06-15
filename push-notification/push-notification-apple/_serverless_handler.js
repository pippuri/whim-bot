
          var envVars = {
  "SERVERLESS_PROJECT": "MaaS",
  "SERVERLESS_STAGE": "dev",
  "SERVERLESS_REGION": "eu-west-1",
  "SERVERLESS_DATA_MODEL_STAGE": "dev",
  "SERVERLESS_PROJECT_NAME": "MaaS",
  "AWS_REGION": "eu-west-1",
  "IOT_ENDPOINT": "a3lehuix0sl1ku.iot.eu-west-1.amazonaws.com",
  "SMS_CODE_SECRET": "tUXLMiKHPJL1viDT",
  "JWT_SECRET": "wj9yIz6P78iQf1cw",
  "TRIPGO_API_KEY": "bc7bf96e-22bd-43b9-b370-8a11758c29c0",
  "HERE_APP_ID": "ELxITilYsy0jd8Fq9QwT",
  "HERE_APP_CODE": "Z3Aa0K09XQPOhVTT5GTFYw",
  "TWILIO_ACCOUNT_SID": "ACd670ab6ff4432a6e703f8ede882dc15b",
  "TWILIO_ACCOUNT_TOKEN": "acebd5edcdb19f1967484b94b1655f3d",
  "TWILIO_FROM_NUMBER": "3584573975566",
  "API_BASE_URL": "https://api.dev.maas.global",
  "WWW_BASE_URL": "https://dev.maas.global",
  "HSL_PASSPHRASE": "Htm6WgvJLdQsSnXl",
  "HSL_USERTOKEN": "sc5maas",
  "MATKA_USERTOKEN": "sc5maas",
  "MATKA_PASSPHRASE": "nRvjSJd8Qe1mwv5C",
  "COGNITO_POOL_ID": "eu-west-1:c9d92b33-b55b-468a-9ec4-5fc7799cdf43",
  "COGNITO_DEVELOPER_PROVIDER": "maas",
  "COGNITO_PROFILE_DATASET": "profile",
  "COGNITO_USER_DEVICES_DATASET": "devices",
  "GOOGLE_API_KEY": "AIzaSyDoItUq6y7LTrZLQy-t7aXbfajgdBgRyco",
  "DYNAMO_USER_PROFILE": "MaaS-user-profile-dev",
  "DYNAMO_USER_TRAVEL_LOG": "MaaS-user-travel-log-dev",
  "DYNAMO_USER_TRANSACTION_HISTORY": "MaaS-user-transaction-history-dev",
  "CHARGEBEE_API_KEY": "test_1C7nCxniaFbsqOoOcubv9N22LXogN98DL:",
  "CHARGEBEE_SITE": "whim-test",
  "DEFAULT_WHIM_PLAN": "fi-whim-payg",
  "MAAS_SCHEDULER": "MaaS-scheduled-functions-dev",
  "MAAS_SIGNING_SECRET": "MaaS super-secret phrase",
  "MAAS_PGHOST": "maas.cnmiaslngrwd.eu-west-1.rds.amazonaws.com",
  "MAAS_PGUSER": "provisiondev",
  "MAAS_PGPASSWORD": "PDuxy21vaJNc2weO",
  "MAAS_PGPORT": "5432",
  "MAAS_PGDATABASE": "provisiondev",
  "APNS_ARN": "arn:aws:sns:eu-west-1:756207178743:app/APNS_SANDBOX/MaaS-dev"
};
          for (var key in envVars) {
            process.env[key] = envVars[key];
          }
          exports.handler = require("./handler")["handler"];
        