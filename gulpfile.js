
var gulp = require('gulp');
var jsonlint = require('gulp-jsonlint');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var gmocha = require('gulp-mocha');
var gulpSequence = require('gulp-sequence');

gulp.task('jsonlint', function () {
  return gulp.src(['**/*.json', '!**/node_modules/**/*.json', '!www/**/*.json', '!_meta/**/*.json'])
    .pipe(jsonlint())
    .pipe(jsonlint.reporter())
    .pipe(jsonlint.failOnError());
});

gulp.task('jshint', function () {
  return gulp.src(['**/*.js', '!**/node_modules/**/*.js', '!www/**/*.js', '!_meta/**/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('jscs', function () {
  return gulp.src(['**/*.js', '!**/node_modules/**/*.js', '!www/**/*.js', '!_meta/**/*.js'])
    .pipe(jscs())
    .pipe(jscs.reporter())
    .pipe(jscs.reporter('fail'));
});

gulp.task('mocha', function () {
  return gulp.src('test/test.js', { read: false })
    .pipe(gmocha());
});

gulp.task('validate', ['jsonlint', 'jshint', 'jscs']);

gulp.task('test', gulpSequence('validate', 'mocha'));

gulp.task('default');
