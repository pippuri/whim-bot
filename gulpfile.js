
var gulp = require('gulp');
var install = require('gulp-install');
var jsonlint = require('gulp-jsonlint');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var gmocha = require('gulp-mocha');

// We can not properly use wildcards until https://github.com/slushjs/gulp-install/issues/38 is fixed

// jscs:disable requirePaddingNewLinesAfterBlocks

gulp.task('get-deps-auth', function () { gulp.src('auth/package.json').pipe(install());});
gulp.task('get-deps-autocomplete', function () { gulp.src('autocomplete/package.json').pipe(install());});
gulp.task('get-deps-geocoding', function () { gulp.src('geocoding/package.json').pipe(install());});
gulp.task('get-deps-locations', function () { gulp.src('locations/package.json').pipe(install());});
gulp.task('get-deps-monitor', function () { gulp.src('monitor/package.json').pipe(install());});
gulp.task('get-deps-profile', function () { gulp.src('profile/package.json').pipe(install());});
gulp.task('get-deps-provider-digitransit', function () { gulp.src('provider-digitransit/package.json').pipe(install());});
gulp.task('get-deps-provider-google', function () { gulp.src('provider-google/package.json').pipe(install());});
gulp.task('get-deps-provider-here', function () { gulp.src('provider-here/package.json').pipe(install());});
gulp.task('get-deps-provider-hsl', function () { gulp.src('provider-hsl/package.json').pipe(install());});
gulp.task('get-deps-provider-matka', function () { gulp.src('provider-matka/package.json').pipe(install());});
gulp.task('get-deps-provider-nominatim', function () { gulp.src('provider-nominatim/package.json').pipe(install());});
gulp.task('get-deps-provider-tripgo', function () { gulp.src('provider-tripgo/package.json').pipe(install());});
gulp.task('get-deps-provider-twilio', function () { gulp.src('provider-twilio/package.json').pipe(install());});
gulp.task('get-deps-root', function () { gulp.src('root/package.json').pipe(install());});
gulp.task('get-deps-routes', function () { gulp.src('routes/package.json').pipe(install());});
gulp.task('get-deps-simulator', function () { gulp.src('simulator/package.json').pipe(install());});
gulp.task('get-deps-store', function () { gulp.src('store/package.json').pipe(install());});
gulp.task('get-deps-swagger', function () { gulp.src('swagger/package.json').pipe(install());});
gulp.task('get-deps-tracking', function () { gulp.src('tracking/package.json').pipe(install());});
gulp.task('get-deps-main', function () { gulp.src('package.json').pipe(install());});

// jscs:enable requirePaddingNewLinesAfterBlocks

gulp.task('get-deps', ['get-deps-auth', 'get-deps-autocomplete', 'get-deps-geocoding', 'get-deps-locations', 'get-deps-monitor', 'get-deps-provider-digitransit', 'get-deps-provider-google', 'get-deps-provider-here', 'get-deps-provider-hsl', 'get-deps-provider-matka', 'get-deps-provider-nominatim', 'get-deps-provider-tripgo', 'get-deps-provider-twilio', 'get-deps-root', 'get-deps-routes', 'get-deps-simulator', 'get-deps-swagger', 'get-deps-tracking', 'get-deps-main']); // jscs:ignore maximumLineLength

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

gulp.task('test', ['jsonlint', 'jshint', 'jscs', 'mocha']);

gulp.task('default');
