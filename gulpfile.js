'use strict';

const del = require('del');
const eslint = require('gulp-eslint');
const gmocha = require('gulp-mocha');
const gulpSequence = require('gulp-sequence');
const gulp = require('gulp');
//const istanbul = require('gulp-istanbul');
const jsonlint = require('gulp-jsonlint');
const jsonclint = require('gulp-json-lint');

// Required for gulp-mocha to recognise async-await
require('harmonize')([
  'harmony',
  'harmony_async-await',
]);

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

gulp.task('clean:swagger', () => {
  return del([
    'www/apidocs.maas.global/**/*',
    '!www/apidocs.maas.global/index.html',
  ]);
});

gulp.task('copy:swagger-ui', () => {
  // Copies everything
  return gulp.src(['node_modules/swagger-ui/dist/**/*', '!node_modules/swagger-ui/dist/index.html'])
    .pipe(gulp.dest('www/apidocs.maas.global/'));
});

gulp.task('copy:json-schemas', () => {
  return gulp.src('node_modules/maas-schemas/prebuilt/maas-backend/**/*')
    .pipe(gulp.dest('www/apidocs.maas.global/api/maas-backend/'));
});

/*gulp.task('pre-mocha', () => {
  return gulp.src(jsFiles)
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
});*/

gulp.task('mocha'/*, ['pre-mocha']*/, () => {
  return gulp.src('test/test.js', { read: false })
    .pipe(gmocha({ timeout: 20000 }));
    //.on('error', gutil.log);
    //.pipe(istanbul.writeReports())
    // Skip thresholds until we have more coverage
    //.pipe(istanbul.enforceThresholds({ thresholds: { global: 50 } }));
});

gulp.task('validate', ['jsonclint', 'jsonlint', 'eslint']);
gulp.task('test', gulpSequence('validate', 'mocha'));
gulp.task('build:swagger', gulpSequence('clean:swagger', ['copy:swagger-ui', 'copy:json-schemas']));

gulp.task('default');
