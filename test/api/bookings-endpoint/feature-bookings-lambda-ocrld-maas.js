'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const Promise = require('bluebird');
const optionsLambda = require('../../../bookings/bookings-agency-options/handler.js');
const createLambda = require('../../../bookings/bookings-create/handler.js');
const listLambda = require('../../../bookings/bookings-list/handler.js');
const models = require('../../../lib/models');
const Database = models.Database;

module.exports = function (lambda) {

  describe('create a MaaS Ticket booking for a day', () => {
    const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    let optionsResponse;
    let optionsError;
    let createResponse;
    let createError;
    let listResponse;
    let listError;

    let bookingId;

    before(done => {

      return Promise.resolve()
        .then( () => new Promise( ( resolve, reject ) => {
          const optionsEvent = {
            agencyId: 'MaaS',
            mode: 'MAAS_PERSONAL',
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

        .then( () => done() )

        .catch( err => {
          done( err );
        } );
    } );

    after( done => {
      return Database.init()
        .then(() => {
          if ( bookingId ) {
            return models.Booking.query().delete().where( 'id', bookingId );
          }
          return Promise.resolve();
        } )
        .then(() => Database.cleanup())
        .then(() => done());
    });

    it('options fetching should succeed without error', () => {
      expect(optionsError).to.be.null;
    });
    it('create should succeed without error', () => {
      expect(createError).to.be.null;
    });
    it('listing should succeed without error', () => {
      expect(listError).to.be.null;
    });

    it('booking list should contain created booking as cancelled', () => {
      const matchingBookings = listResponse.bookings.filter( b => b.id === bookingId );
      expect(matchingBookings).to.have.lengthOf(1);
      expect(matchingBookings[0].state).to.equal('RESERVED');
    } );

    it('none of the responses should be null', () => {
      expect(optionsResponse).to.be.not.null;
      expect(createResponse).to.be.not.null;
      expect(listResponse).to.be.not.null;
    });
  });
};
