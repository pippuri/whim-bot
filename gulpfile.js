'use strict';

const gulp = require('gulp');
const jsonlint = require('gulp-jsonlint');
const jsonclint = require('gulp-json-lint');
const jshint = require('gulp-jshint');
const eslint = require('gulp-eslint');
const jscs = require('gulp-jscs');
const gmocha = require('gulp-mocha');
const gulpSequence = require('gulp-sequence');
const gutil = require('gulp-util');

const jsoncFiles = ['.jshintrc', '.eslintrc', '.jscsrc']; // json with comments
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

gulp.task('jshint', () => {
  return gulp.src(jsFiles)
  .pipe(jshint())
  .pipe(jshint.reporter('jshint-stylish'))
  .pipe(jshint.reporter('fail'));
});

gulp.task('eslint', () => {
  return gulp.src(jsFiles)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('jscs', () => {
  return gulp.src(jsFiles)
    .pipe(jscs())
    .pipe(jscs.reporter())
    .pipe(jscs.reporter('fail'));
});

gulp.task('mocha', () => {
  return gulp.src('test/test.js', { read: false })
    .pipe(gmocha())
    .on('error', gutil.log);
});

gulp.task('validate', ['jsonclint', 'jsonlint', 'jshint', 'eslint', 'jscs']);

gulp.task('test', gulpSequence('validate', 'mocha'));

gulp.task('default');
