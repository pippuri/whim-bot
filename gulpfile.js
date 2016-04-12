
var gulp = require('gulp');
var install = require('gulp-install');
var exec = require('child_process').exec;
var jscs = require('gulp-jscs');
var mocha = require('gulp-mocha');
var jsonlint = require('gulp-jsonlint');

// the two dependency retrievers fail if combined to one

gulp.task('get-main-deps', function () {
  gulp.src(['package.json'])
    .pipe(install());
});

// the two dependency retrievers fail if combined to one

gulp.task('get-component-deps', function () {
  gulp.src(['*/package.json'])
    .pipe(install());
});

gulp.task('get-deps', ['get-main-deps', 'get-component-deps']);

gulp.task('jscs', function () {
  return gulp.src(['**/*.js', '!**/node_modules/**/*.js', '!www/**/*.js', '!_meta/**/*.js'])
    .pipe(jscs())
    .pipe(jscs.reporter())
    .pipe(jscs.reporter('fail'));
});

gulp.task('mocha', function () {
  return gulp.src('test/test.js', { read: false })
    .pipe(mocha());
});

gulp.task('jsonlint', function () {
  return gulp.src(['**/*.json', '!**/node_modules/**/*.json', '!www/**/*.json', '!_meta/**/*.json'])
    .pipe(jsonlint())
    .pipe(jsonlint.reporter())
    .pipe(jsonlint.failOnError());
});

gulp.task('test', ['jscs', 'mocha', 'jsonlint']);

gulp.task('default');

