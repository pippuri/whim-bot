'use strict';

const expect = require('chai').expect;
const moment = require('moment-timezone');
const _ = require('lodash');
const bus = require('../../../lib/service-bus');
const schema = require('maas-schemas/prebuilt//maas-backend/routes/routes-query/response.json');
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
        // Monday one week forward around five
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(),
      },
      headers: {},
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should trigger a valid response', () => {
      return validator.validate(schema, response);
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
      // Filter out everything else than taxi only route
      const itinerariesWithAllowedModes = response.plan.itineraries.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        // Try to find modes that are unallowed
        const unallowed = modes.find(mode => allowed.indexOf(mode) === -1);
        return (typeof unallowed === typeof undefined);
      });

      const directTaxiRoutes = itinerariesWithAllowedModes.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        return modes.indexOf('TAXI') !== -1;
      });

      const valopilkkuTaxiRoutes = directTaxiRoutes.filter(itinerary => {
        const agencyIds = itinerary.legs.map(leg => leg.agencyId);
        return _.includes(agencyIds, 'Valopilkku');
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

  describe('request for a route to Rovaniemi', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office, Helsinki
        to: '66.5436144,25.8470606', // Santa Claus Village, Rovaniemi
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '',
      },
      headers: {},
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should trigger a valid response', () => {
      return validator.validate(schema, response);
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
        leaveAt: '' + moment().tz('Europe/Stockholm').day(8).hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '',
      },
      headers: {},
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
          return Promise.resolve(response);
        })
        .catch(err => {
          error = err;
          return Promise.reject(error);
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should trigger a valid response', () => {
      return validator.validate(schema, response);
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    // FIXME Our current business bookingProviderRules engine does not support this case
    // (it picks the first provider matching the geometry)
    it.skip('response should have direct taxi route', () => {

      const allowed = ['TAXI', 'WALK', 'WAIT'];

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

    // TODO Enable the test again when our providers correctly apply geolocation
    xit('itineraries with taxi legs should not have agencyId Valopilkku', () => {
      // Valopilkku does not provide taxis in Sweden at the moment
      const taxiLegs = _.flatten(response.plan.itineraries.map(itinerary => {
        return itinerary.legs.filter(leg => (leg.mode === 'TAXI'));
      }));

      const valopilkkuTaxiLegs = taxiLegs.filter(leg => leg.agencyId === 'Valopilkku');
      expect(valopilkkuTaxiLegs).to.be.empty;
    });
  });

  describe('request for a route from Helsinki to New Delhi', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office, Helsinki
        to: '28.6561592,77.2388263',   // Red Fort, New Delhi
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '',
      },
      headers: {},
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        });
    });

    it('should not return an error', () => {
      expect(error).to.be.undefined;
    });

    it('should return empty routes', () => {
      expect(response).to.be.defined;
      expect(response).to.have.property('plan');
      expect(response.plan.itineraries).to.have.length(0);
    });
  });

  describe('routes query TAXI response `to` and `from` should have a name', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.165781,24.845139',
        to: '60.18176,24.95494',

        // Monday one week forward around five
        leaveAt: '' + moment().tz('Europe/Helsinki')
                              .day(8)
                              .hour(17).minute(0)
                              .second(0).millisecond(0)
                              .valueOf(),
      },
      headers: {},
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    it('response should have direct Valopilkku taxi route', () => {

      const allowed = ['TAXI', 'WALK', 'WAIT', 'TRANSFER', 'LEG_SWITCH'];
      // Filter out everything else than taxi only route
      const itinerariesWithAllowedModes = response.plan.itineraries.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        // Try to find modes that are unallowed
        const unallowed = modes.find(mode => allowed.indexOf(mode) === -1);
        return (typeof unallowed === typeof undefined);
      });

      const directTaxiRoutes = itinerariesWithAllowedModes.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        return modes.indexOf('TAXI') !== -1;
      });

      const valopilkkuTaxiRoutes = directTaxiRoutes.filter(itinerary => {
        const agencyIds = itinerary.legs.map(leg => leg.agencyId);
        return _.includes(agencyIds, 'Valopilkku');
      });

      expect(valopilkkuTaxiRoutes).to.not.be.empty;
    });

    it('`from` should have a name', () => {

      const allowed = ['TAXI', 'WALK', 'WAIT', 'TRANSFER', 'LEG_SWITCH'];
      // Filter out everything else than taxi only route
      const itinerariesWithAllowedModes = response.plan.itineraries.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        // Try to find modes that are unallowed
        const unallowed = modes.find(mode => allowed.indexOf(mode) === -1);
        return (typeof unallowed === typeof undefined);
      });

      const taxiRoutes = itinerariesWithAllowedModes.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        return modes.indexOf('TAXI') !== -1;
      });

      const valopilkkuTaxiRoutes = taxiRoutes.filter(itinerary => {
        const agencyIds = itinerary.legs.map(leg => leg.agencyId);
        return _.includes(agencyIds, 'Valopilkku');
      });

      const firstValopilkkuTaxiRoute = valopilkkuTaxiRoutes[0];
      const valopilkkuTaxiRouteTaxiLegs = firstValopilkkuTaxiRoute.legs.filter(leg => {
        return leg.mode === 'TAXI';
      });

      expect(firstValopilkkuTaxiRoute).to.not.be.undefined;
      expect(valopilkkuTaxiRouteTaxiLegs).to.not.be.empty;
      expect(valopilkkuTaxiRouteTaxiLegs[0].from).to.not.be.empty;
      expect(valopilkkuTaxiRouteTaxiLegs[0].from.name).to.not.be.empty;
    });

    it('`to` should have a name', () => {

      const allowed = ['TAXI', 'WALK', 'WAIT', 'TRANSFER', 'LEG_SWITCH'];
      // Filter out everything else than taxi only route
      const itinerariesWithAllowedModes = response.plan.itineraries.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        // Try to find modes that are unallowed
        const unallowed = modes.find(mode => allowed.indexOf(mode) === -1);
        return (typeof unallowed === typeof undefined);
      });

      const taxiRoutes = itinerariesWithAllowedModes.filter(itinerary => {
        const modes = itinerary.legs.map(leg => leg.mode);
        return modes.indexOf('TAXI') !== -1;
      });

      const valopilkkuTaxiRoutes = taxiRoutes.filter(itinerary => {
        const agencyIds = itinerary.legs.map(leg => leg.agencyId);
        return _.includes(agencyIds, 'Valopilkku');
      });

      const firstValopilkkuTaxiRoute = valopilkkuTaxiRoutes[0];
      const valopilkkuTaxiRouteTaxiLegs = firstValopilkkuTaxiRoute.legs.filter(leg => {
        return leg.mode === 'TAXI';
      });

      expect(firstValopilkkuTaxiRoute).to.not.be.undefined;
      expect(valopilkkuTaxiRouteTaxiLegs).to.not.be.empty;
      expect(valopilkkuTaxiRouteTaxiLegs[0].to).to.not.be.empty;
      expect(valopilkkuTaxiRouteTaxiLegs[0].to.name).to.not.be.empty;
    });
  });

  describe('Replace Origin/Destination names with ones given via API', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        to: '60.170779,24.7721584', // Gallows Bird Pub
        // Monday one week forward around five
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(),
        fromName: 'Ylä-Anttilan Katu 12',
        toName: 'Helsinki-Vantaa Airport (HEL)',
      },
      headers: {},
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should trigger a valid response', () => {
      return validator.validate(schema, response);
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    it('response should not include \'Origin\' or \'Destination\'', () => {
      const found = response.plan.itineraries.filter(itinerary => {
        return (itinerary.legs.filter(leg => {
          return (leg.from && leg.from.name === 'Origin' || leg.to && leg.to.name === 'Destination');
        }).length > 0);
      });
      expect(found.length).to.be.empty;
    });
  });
};
