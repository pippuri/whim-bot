'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const Promise = require('bluebird');
const moment = require('moment');
const optionsLambda = require('../../../bookings/bookings-agency-options/handler.js');
const createLambda = require('../../../bookings/bookings-create/handler.js');
const retrieveLambda = require('../../../bookings/bookings-retrieve/handler.js');
const listLambda = require('../../../bookings/bookings-list/handler.js');
const cancelLambda = require('../../../bookings/bookings-cancel/handler.js');

module.exports = function (lambda) {

  describe('create a Sixt booking for a day in Helsinki on the next weeks Tuesday starting from 12:00 UTC+2, and cancel it afterwards', () => {

    const tueMoment = moment().utcOffset(120).day(7 + 2).hour(12).minute(0).second(0).millisecond(0);
    const wedMoment = moment().utcOffset(120).day(7 + 3).hour(12).minute(0).second(0).millisecond(0);
    const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';


    // First we need to make sure the user actually has enough points to complete the transaction
    // TODO: ADD 10000 points to the user account

    let optionsResponse;
    let optionsError;
    let createResponse;
    let createError;
    let retrieveResponse;
    let retrieveError;
    let listResponse;
    let listError;
    let cancelResponse;
    let cancelError;

    let bookingId;

    before(done => {

      return new Promise( ( resolve, reject ) => {

        // First we need to make sure the user actually has enough points to complete the transaction
        // TODO: ADD 10000 points to the user account

        resolve();
      } )

        .then( () => new Promise( ( resolve, reject ) => {
          const optionsEvent = {
            agencyId: 'Sixt',
            mode: 'CAR',
            from: '60.3210549,24.9506771',
            to: '',
            startTime: tueMoment.valueOf(),
            endTime: wedMoment.valueOf(),
            fromRadius: 10000,
          };
          wrap(optionsLambda).run( optionsEvent, (err, res) => {
            optionsResponse = res;
            optionsError = err;
            if ( err ) reject( err );
            else resolve( res );
          } );
        } ) )

        .then( optionsData => new Promise( ( resolve, reject ) => {
          const createEvent = {
            identityId: testUserIdentity,
            payload: optionsData.options[0],
          };
          wrap(createLambda).run( createEvent, (err, res) => {
            createResponse = res;
            createError = err;
            if ( err ) reject( err );
            else resolve( res );
          } );
        } ) )

        .then( booking => new Promise( ( resolve, reject ) => {
          bookingId = booking.id;

          const listEvent = {
            identityId: testUserIdentity,
          };
          wrap(listLambda).run( listEvent, (err, res) => {
            listResponse = res;
            listError = err;
            if ( err ) reject( err );
            else resolve( res );
          } );
        } ) )

        .then( bookingList => new Promise( ( resolve, reject ) => {
          const retrieveEvent = {
            identityId: testUserIdentity,
            bookingId: bookingId,
          };
          wrap(retrieveLambda).run( retrieveEvent, (err, res) => {
            retrieveResponse = res;
            retrieveError = err;
            if ( err ) reject( err );
            else resolve( res );
          } );
        } ) )

        .then( booking => new Promise( ( resolve, reject ) => {
          const cancelEvent = {
            identityId: testUserIdentity,
            bookingId: bookingId,
          };
          wrap(cancelLambda).run( cancelEvent, (err, res) => {
            cancelResponse = res;
            cancelError = err;
            if ( err ) reject( err );
            else resolve( res );
          } );
        } ) )

        .then( () => new Promise( ( resolve, reject ) => {
          // We also want the points not to get accumulating for the test user
          // TODO: REMOVE 10000 points to the user account

          resolve();
        } ) )

        .then( () => done() )

        .catch( err => {
          done( err );
        } );
    } );

    it('options fetching should succeed without error', () => {
      expect(optionsError).to.be.null;
    });
    it('create should succeed without error', () => {
      expect(createError).to.be.null;
    });
    it('listing should succeed without error', () => {
      expect(listError).to.be.null;
    });
    it('retrieve should succeed without error', () => {
      expect(retrieveError).to.be.null;
    });
    it('cancel should succeed without error', () => {
      expect(cancelError).to.be.null;
    });

    it('none of the responses should be null', () => {
      expect(optionsResponse).to.be.not.null;
      expect(createResponse).to.be.not.null;
      expect(listResponse).to.be.not.null;
      expect(retrieveResponse).to.be.not.null;
      expect(cancelResponse).to.be.not.null;
    });
  });
};
