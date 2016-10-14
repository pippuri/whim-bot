'use strict';

const script = require('commander');
const fs = require('fs');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'eu-west-1' });
const documentClient = new AWS.DynamoDB.DocumentClient();
const models = require('../lib/models');

const Database = models.Database;
const Profile = models.Profile;

script.version('0.0.1')
.description('Dump to file if no postgre table specify')
.option('-s, --stage [stage]', 'Choose a stage *required*')
.option('-d, --dynamo [dynamo table]', 'Choose Dynamo table name')
.option('-p --postgre [postgre table]', 'Choose Postgre table name')
.parse(process.argv);

if (!script.stage) {
  console.log('You must specify a table');
  script.outputHelp();
  process.exit(1);
} else if (!script.dynamo) {
  console.log('You must specify a dynamo table');
  script.outputHelp();
  process.exit(1);
} else if (!script.postgre) {
  console.log('Specify postgre table name to attempt dumping dynamo table to Posgre');
  script.outputHelp();
  console.log('=======================================================');
  console.log('=                 Dumping to file                     =');
  console.log('=======================================================');
} else {
  console.log('=======================================================');
  console.log('=                 Dumping to postgre                  =');
  console.log('=======================================================');
}

const variableFile = require(`../_meta/variables/s-variables-${script.stage}.json`);
// eslint-disable-next-line
for (let props in variableFile) {
  process.env[props] = variableFile[props];
}

const params = { TableName: script.dynamo };

function scanDynamoDB(query) {

  documentClient.scan(query, (err, data) => {

    if (err) {
      console.dir(err);
      return;
    }

    if (typeof data.LastEvaluatedKey !== typeof undefined) {
      console.log('Scanning for more data from DynamoDB ...');
      params.ExclusiveStartKey = data.LastEvaluatedKey;
      scanDynamoDB(params);
      return;
    }

    if (!script.postgre) {
      try {
        const fileName = `dump-${script.dynamo.replace(/\s/g, '-')}.json`;
        fs.writeFileSync(`./migrations/${fileName}`, JSON.stringify(data.Items, null, 2));
        console.log(`Scan succeeded, output in ${fileName}`);
        return;
      } catch (error) {
        throw error;
      }
    }

    Database.init()
      .then(() => {
        data.Items.forEach(item => {
          // Adapt Dynamo faulty schema to Postgre's
          item.planLevel = item.planlevel || 0;
          item.profileImageUrl = item.profileImage || '';
          item.zipCode = item.zip;

          delete item.planlevel;
          delete item.profileImage;
          delete item.zip;
        });
        return Profile.query()
          .insert(data.Items);
      })
      .then(() => {
        return Database.cleanup()
          .then( _ => {
            console.log(`Successfully dump Dynamo data from ${script.dynamo} table to Postgre ${script.postgre} table!`);
            return Promise.resolve();
          });
      })
      .catch(_error => {
        console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
        console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
        console.warn(_error.stack);

        return Database.cleanup()
          .then( _ => {
            console.log('Failed to Dump data to Postgre!');
            return Promise.reject(_error);
          });
      });
  });

}

scanDynamoDB(params);
