'use strict';

const chalk = require('chalk');
const exec = require('child_process').exec;

const STAGE = process.env.SERVERLESS_STAGE || 'dev';
const stageVars = Object.keys(require(`../_meta/variables/s-variables-${STAGE}.json`));
let stageVarsInUse = [];

exec('grep -RIoh --exclude-dir=node_modules --exclude-dir=www --exclude-dir=coverage process\\.env\\.[A-Z0-9_]* * | cut -d. -f3 | sort | uniq', (err, stdout) => {
  if (err) {
    console.log(chalk.red.bold(JSON.stringify(err, null, 2)));
    return;
  }

  console.log(chalk.red.bold(`Stage variables (${STAGE}) not used in code`));
  console.log(chalk.red.bold('----------------------------------------------------------------------'));
  stageVarsInUse = stdout.split('\n').filter(item => item !== '');
  const stageVarsNotInUse = stageVars.filter(stageVar => {
    return !stageVarsInUse.some(item => item === stageVar);
  });
  console.log(stageVarsNotInUse);
});
