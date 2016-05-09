
var gulp = require('gulp');
var install = require('gulp-install');
var jsonlint = require('gulp-jsonlint');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var gmocha = require('gulp-mocha');

// We can not properly use wildcards until https://github.com/slushjs/gulp-install/issues/38 is fixed

// jscs:disable requirePaddingNewLinesAfterBlocks

gulp.task('get-deps-auth-custom-authorizer', function () { gulp.src('auth/auth-custom-authorizer/package.json').pipe(install());});
gulp.task('get-deps-auth-me', function () { gulp.src('auth/auth-me/package.json').pipe(install());});
gulp.task('get-deps-auth-mqtt', function () { gulp.src('auth/auth-mqtt/package.json').pipe(install());});
gulp.task('get-deps-auth-sms-login', function () { gulp.src('auth/auth-sms-login/package.json').pipe(install());});
gulp.task('get-deps-auth-sms-request-code', function () { gulp.src('auth/auth-sms-request-code/package.json').pipe(install());});
gulp.task('get-deps-autocomplete-query', function () { gulp.src('autocomplete/autocomplete-query/package.json').pipe(install());});
gulp.task('get-deps-geocoding-query', function () { gulp.src('geocoding/geocoding-query/package.json').pipe(install());});
gulp.task('get-deps-locations-query', function () { gulp.src('locations/locations-query/package.json').pipe(install());});
gulp.task('get-deps-monitor-query', function () { gulp.src('monitor/monitor-query/package.json').pipe(install());});
gulp.task('get-deps-profile-activeroute', function () { gulp.src('profile/profile-activeroute/package.json').pipe(install());});
gulp.task('get-deps-provider-digitransit-routes', function () { gulp.src('provider-digitransit/provider-digitransit-routes/package.json').pipe(install());});
gulp.task('get-deps-provider-google-autocomplete', function () { gulp.src('provider-google/provider-google-autocomplete/package.json').pipe(install());});
gulp.task('get-deps-provider-google-geocoding', function () { gulp.src('provider-google/provider-google-geocoding/package.json').pipe(install());});
gulp.task('get-deps-provider-google-reverse-geocoding', function () { gulp.src('provider-google/provider-google-reverse-geocoding/package.json').pipe(install());});
gulp.task('get-deps-provider-here-autocomplete', function () { gulp.src('provider-here/provider-here-autocomplete/package.json').pipe(install());});
gulp.task('get-deps-provider-here-geocoding', function () { gulp.src('provider-here/provider-here-geocoding/package.json').pipe(install());});
gulp.task('get-deps-provider-here-locations', function () { gulp.src('provider-here/provider-here-locations/package.json').pipe(install());});
gulp.task('get-deps-provider-here-routes', function () { gulp.src('provider-here/provider-here-routes/package.json').pipe(install());});
gulp.task('get-deps-provider-hsl-routes', function () { gulp.src('provider-hsl/provider-hsl-routes/package.json').pipe(install());});
gulp.task('get-deps-provider-matka-routes', function () { gulp.src('provider-matka/provider-matka-routes/package.json').pipe(install());});
gulp.task('get-deps-provider-nominatim-locations', function () { gulp.src('provider-nominatim/provider-nominatim-locations/package.json').pipe(install());});
gulp.task('get-deps-provider-tripgo-regions', function () { gulp.src('provider-tripgo/provider-tripgo-regions/package.json').pipe(install());});
gulp.task('get-deps-provider-tripgo-routes-middlefinland', function () { gulp.src('provider-tripgo/provider-tripgo-routes-middlefinland/package.json').pipe(install());});
gulp.task('get-deps-provider-tripgo-routes-northfinland', function () { gulp.src('provider-tripgo/provider-tripgo-routes-northfinland/package.json').pipe(install());});
gulp.task('get-deps-provider-tripgo-routes-southfinland', function () { gulp.src('provider-tripgo/provider-tripgo-routes-southfinland/package.json').pipe(install());});
gulp.task('get-deps-provider-twilio-receive-sms', function () { gulp.src('provider-twilio/provider-twilio-receive-sms/package.json').pipe(install());});
gulp.task('get-deps-provider-twilio-send-sms', function () { gulp.src('provider-twilio/provider-twilio-send-sms/package.json').pipe(install());});
gulp.task('get-deps-root-query', function () { gulp.src('root/root-query/package.json').pipe(install());});
gulp.task('get-deps-routes-query', function () { gulp.src('routes/routes-query/package.json').pipe(install());});
gulp.task('get-deps-simulator-navigate-user-routes', function () { gulp.src('simulator/simulator-navigate-user-routes/package.json').pipe(install());});
gulp.task('get-deps-store-packages', function () { gulp.src('store/store-packages/package.json').pipe(install());});
gulp.task('get-deps-swagger-maas-api-json', function () { gulp.src('swagger/swagger-maas-api-json/package.json').pipe(install());});
gulp.task('get-deps-tracking-cancel-active-route', function () { gulp.src('tracking/tracking-cancel-active-route/package.json').pipe(install());});
gulp.task('get-deps-tracking-get-active-route', function () { gulp.src('tracking/tracking-get-active-route/package.json').pipe(install());});
gulp.task('get-deps-tracking-set-active-leg', function () { gulp.src('tracking/tracking-set-active-leg/package.json').pipe(install());});
gulp.task('get-deps-tracking-set-active-route', function () { gulp.src('tracking/tracking-set-active-route/package.json').pipe(install());});
gulp.task('get-deps-tracking-update-user-location', function () { gulp.src('tracking/tracking-update-user-location/package.json').pipe(install());});
gulp.task('get-deps-main', function () { gulp.src('package.json').pipe(install());});

// jscs:enable requirePaddingNewLinesAfterBlocks

gulp.task('get-deps', ['get-deps-auth-custom-authorizer', 'get-deps-auth-me', 'get-deps-auth-mqtt', 'get-deps-auth-sms-login', 'get-deps-auth-sms-request-code', 'get-deps-autocomplete-query', 'get-deps-geocoding-query', 'get-deps-locations-query', 'get-deps-monitor-query', 'get-deps-profile-activeroute', 'get-deps-provider-digitransit-routes', 'get-deps-provider-google-autocomplete', 'get-deps-provider-google-geocoding', 'get-deps-provider-google-reverse-geocoding', 'get-deps-provider-here-autocomplete', 'get-deps-provider-here-geocoding', 'get-deps-provider-here-locations', 'get-deps-provider-here-routes', 'get-deps-provider-hsl-routes', 'get-deps-provider-matka-routes', 'get-deps-provider-nominatim-locations', 'get-deps-provider-tripgo-regions', 'get-deps-provider-tripgo-routes-middlefinland', 'get-deps-provider-tripgo-routes-northfinland', 'get-deps-provider-tripgo-routes-southfinland', 'get-deps-provider-twilio-receive-sms', 'get-deps-provider-twilio-send-sms', 'get-deps-root-query', 'get-deps-routes-query', 'get-deps-simulator-navigate-user-routes', 'get-deps-store-packages', 'get-deps-swagger-maas-api-json', 'get-deps-tracking-cancel-active-route', 'get-deps-tracking-get-active-route', 'get-deps-tracking-set-active-leg', 'get-deps-tracking-set-active-route', 'get-deps-tracking-update-user-location', 'get-deps-main']); // jscs:ignore maximumLineLength

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

