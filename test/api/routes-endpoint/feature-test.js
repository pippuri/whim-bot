'use strict';

const expect = require('chai').expect;
const moment = require('moment');
const _ = require('lodash');
const bus = require('../../../lib/service-bus');

const validator = require('../../../lib/validator');

module.exports = options => {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        to: '60.170779,24.7721584', // Gallows Bird Pub
        leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '',
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    xit('should trigger a valid response', () => {
      return validator.validate('maas-backend:routes-query-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    it('response should not have legs from the past', () => {
      const waitingTimes = [];
      response.plan.itineraries.forEach(itinerary => {
        itinerary.legs.forEach(leg => {
          const waitingTime = (leg.startTime - parseInt(event.payload.leaveAt, 10));
          waitingTimes.push(waitingTime);
        });
      });
      const shortest = Math.min.apply(null, waitingTimes);
      const inMinutes = ((shortest / 1000) / 60);
      const margin = 1;
      expect(inMinutes).to.be.above(-margin);
    });

    it('response should have direct Valopilkku taxi route', () => {

      const allowed = ['TAXI', 'WALK', 'WAIT', 'TRANSFER', 'LEG_SWITCH'];

      const itinerariesWithAllowedModes = response.plan.itineraries.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');

        for (let mode of modes) { // eslint-disable-line prefer-const

          if (!_.includes(allowed, mode)) {
            return false;
          }

        }

        return true;
      });

      const directTaxiRoutes = itinerariesWithAllowedModes.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');
        if (_.includes(modes, 'TAXI')) {
          return true;
        }

        return false;
      });
      const valopilkkuTaxiRoutes = directTaxiRoutes.filter(itinerary => {
        const agencyIds = _.map(itinerary.legs, 'agencyId');
        if (_.includes(agencyIds, 'Valopilkku')) {
          return true;
        }

        return false;

      });

      expect(valopilkkuTaxiRoutes).to.not.be.empty;
    });

    it('all response itineraries should contain fare', () => {
      const itinerariesWithoutFare = response.plan.itineraries.filter(itinerary => {
        if (itinerary.hasOwnProperty('fare')) {
          return false;
        }

        return true;
      });

      expect(itinerariesWithoutFare).to.be.empty;
    });

    it('filter response itineraries should contain point cost', () => {

      // It is OK for filter routes to have null cost but we should be able to provide
      // filter route from SC5 Office to Gallows Bird Pub for a point cost.

      const itinerariesWithPointsCost = response.plan.itineraries.filter(itinerary => {
        if (itinerary.fare.points !== null) {
          return true;
        }

        return false;
      });

      expect(itinerariesWithPointsCost).to.not.be.empty;
    });

  });

  describe.skip('request for a route to Rovaniemi', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office, Helsinki
        to: '66.5436144,25.8470606', // Santa Claus Village, Rovaniemi
        leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '',
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.null;
    });

    xit('should trigger a valid response', () => {
      return validator.validate('maas-backend:routes-query-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

  });

  describe('route request from Orsa to Mora', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '61.0104906,14.5614225', // Hotell Kung Gösta, Mora
        to: '61.1192448,14.6194989', // Systembolaget, Orsa
        leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '',
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    xit('should trigger a valid response', () => {
      return validator.validate('maas-backend:routes-query-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    it('response should have direct taxi route', () => {

      const allowed = ['TAXI', 'WALK', 'WAIT', 'TRANSFER', 'LEG_SWITCH'];

      const itinerariesWithAllowedModes = response.plan.itineraries.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');

        for (let mode of modes) { // eslint-disable-line prefer-const

          if (!_.includes(allowed, mode)) {
            return false;
          }

        }

        return true;
      });

      const directTaxiRoutes = itinerariesWithAllowedModes.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');
        if (_.includes(modes, 'TAXI')) {
          return true;
        }

        return false;
      });

      expect(directTaxiRoutes).to.not.be.empty;
    });

    it('itineraries with taxi legs should not have agencyId Valopilkku', () => {

      // Valopilkku does not provide taxis in Sweden at the moment

      const taxiLegs = _.flatten(response.plan.itineraries.map(itinerary => {
        return itinerary.legs.filter(leg => {
          if (leg.mode === 'TAXI') {
            return true;
          }

          return false;
        });
      }));

      const valopilkkuTaxiLegs = taxiLegs.filter(leg => {
        if (leg.agencyId === 'Valopilkku') {
          return true;
        }

        return false;
      });

      expect(valopilkkuTaxiLegs).to.be.empty;
    });

  });

  describe('request for a route from Helsinki to Delhi', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office, Helsinki
        to: '77.2388263,28.6561592',   // Red Fort, New Delhi
        leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '',
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    xit('should trigger a valid response', () => {
      return validator.validate('maas-backend:routes-query-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should not have route', () => {
      expect(response.plan.itineraries).to.be.empty;
    });

  });

};
