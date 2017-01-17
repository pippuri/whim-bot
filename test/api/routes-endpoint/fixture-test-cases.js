'use strict';

const moment = require('moment-timezone');

module.exports = [
  {
    skip: false,
    identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
    fromName: 'Ludviginkatu, Helsinki',
    toName: 'Aapelinkatu, Espoo',
    minimumModes: ['BUS', 'TAXI'], // Have at least 1 route with each of these modes
    payload: {
      from: '60.1657520782836,24.9449517015989',
      to: '60.15539,24.75017',
      leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
    },
  },
  {
    skip: false,
    identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
    fromName: 'Ludviginkatu, Helsinki',
    toName: 'Hervanta, Tampere',
    minimumModes: ['BUS', 'TRAIN'], // Have at least 1 route with each of these modes
    payload: {
      from: '60.1657520782836,24.9449517015989',
      to: '61.4508838,23.8400544',
      leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
    },
  },
  {
    skip: false,
    identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
    fromName: 'Kivistö, Vantaa',
    toName: 'Länsiväylä, Helsinki',
    minimumModes: ['BUS', 'TAXI', 'TRAIN'], // Have at least 1 route with each of these modes
    payload: {
      from: '60.322758,24.840788',
      to: '60.165971,24.760282',
      leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
    },
  },
];
