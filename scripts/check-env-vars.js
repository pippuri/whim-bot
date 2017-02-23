#! /usr/bin/env node

'use strict';

const chalk = require('chalk');
const exec = require('child_process').exec;

require('load-environment.js').loadEnvironment();

const STAGE = process.env.STAGE;
const stageVars = Object.keys(require(`../_meta/variables/s-variables-${STAGE}.json`));
const templatesKey = Object.keys(require('../s-templates.json').environment);

function checkUnusedEnvVars() {
  let stageVarsInUse = [];
  exec('grep -RIoh --exclude-dir=node_modules --exclude-dir=www --exclude-dir=coverage process\\.env\\.[A-Z0-9_]* * | cut -d. -f3 | sort | uniq', (err, stdout) => {
    if (err) {
      console.log(chalk.red.bold(JSON.stringify(err, null, 2)));
      return;
    }

    console.log(chalk.green.bold(`Stage variables (${STAGE}) not used in code`));
    console.log(chalk.green.bold('----------------------------------------------------------------------'));
    stageVarsInUse = stdout.split('\n').filter(item => item !== '');
    const stageVarsNotInUse = stageVars.filter(stageVar => {
      return !stageVarsInUse.some(item => item === stageVar);
    });
    console.log(chalk.red.bold(JSON.stringify(stageVarsNotInUse, null, 2)));
  });
}

function checkMisingTemplate() {
  console.log(chalk.green.bold(`Stage variables without template (${STAGE})`));
  console.log(chalk.green.bold('----------------------------------------------------------------------'));
  const missingTemplates = stageVars.filter(stageVar => {
    return !templatesKey.some(item => item === stageVar);
  });
  console.log(chalk.red.bold(JSON.stringify(missingTemplates, null, 2)));
}

function checkMissingEnvVars() {
  console.log(chalk.green.bold(`Template variables without stage variables (${STAGE})`));
  console.log(chalk.green.bold('----------------------------------------------------------------------'));
  const missingVariables = templatesKey.filter(stageVar => {
    return !stageVars.some(item => item === stageVar);
  });
  console.log(chalk.red.bold(JSON.stringify(missingVariables, null, 2)));
}

checkUnusedEnvVars();
checkMisingTemplate();
checkMissingEnvVars();
