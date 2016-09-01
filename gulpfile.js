'use strict';

const gulp = require('gulp');
const jsonlint = require('gulp-jsonlint');
const jsonclint = require('gulp-json-lint');
const eslint = require('gulp-eslint');
const gmocha = require('gulp-mocha');
const gulpSequence = require('gulp-sequence');
const gutil = require('gulp-util');
const istanbul = require('gulp-istanbul');

const jsoncFiles = ['.eslintrc']; // json with comments
const jsonFiles = ['**/*.json', '!**/node_modules/**/*.json', '!www/**/*.json', '!_meta/**/*.json'];
const jsFiles = ['**/*.js', '!**/node_modules/**/*.js', '!www/**/*.js', '!_meta/**/*.js'];

gulp.task('jsonclint', () => {

  // Unfortunately does not support failOnError at the moment
  // See https://github.com/panuhorsmalahti/gulp-json-lint/issues/2

  return gulp.src(jsoncFiles)
    .pipe(jsonclint({ comments: true }))
    .pipe(jsonclint.report('verbose'));
});

gulp.task('jsonlint', () => {
  return gulp.src(jsonFiles)
    .pipe(jsonlint())
    .pipe(jsonlint.reporter())
    .pipe(jsonlint.failOnError());
});

gulp.task('eslint', () => {
  return gulp.src(jsFiles)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('mocha', () => {
  return gulp.src(jsFiles)
  .pipe(istanbul())
  .pipe(istanbul.hookRequire())
  .on('finish', () => {
    return gulp.src('test/test.js', { read: false })
      .pipe(gmocha())
      .pipe(istanbul.writeReports())
      // Skip thresholds until we have more coverage
      //.pipe(istanbul.enforceThresholds({ thresholds: { global: 90 } }))
      .on('error', gutil.log);
  });
});

gulp.task('validate', ['jsonclint', 'jsonlint', 'eslint']);

gulp.task('test', gulpSequence('validate', 'mocha'));

gulp.task('default');
