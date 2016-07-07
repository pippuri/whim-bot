'use strict';

const units = require('./priceUnits.js');

// jscs:disable disallowSpacesInsideBrackets
// jscs:disable disallowSpacesInsideArrayBrackets

// TODO business people should be able to add new plans to the database.

module.exports = {

  pricelist0: {
    title: 'Base pricelist.',
    prices: [
      {
        agency: 'HSL',
        name: 'Helsinki',
        bookableUntil: 0,               // Bookable until 0 minutes before startTime
        payableUntil: 0,                // Payable until 0 minutes before startTime
        value: 65,
        type: units.U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.2549956, 24.8277603], // 4. Shell, Torpantie 4, Vantaa
              [60.3005963, 25.2829841], // 5. Arla, Kotkantie 34, Söderkulla
              [60.1533034, 25.2836792], // 8. Trutlande island
              [60.1245699, 24.8466468], // 7. Harmaakari island
            ],
          ],
        ],
      },
      {
        agency: 'HSL',
        name: 'Espoo',
        bookableUntil: 0,               // Bookable until 0 minutes before startTime
        payableUntil: 0,                // Payable until 0 minutes before startTime
        value: 65,
        type: units.U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.3371203, 24.8258768], // 2. Betomix Oy, Vanha Nurmijärventie 188, Vantaa
              [60.1245699, 24.8466468], // 7. Harmaakari island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
      {
        agency: 'HSL',
        name: 'Vantaa',
        bookableUntil: 0,               // Bookable until 0 minutes before startTime
        payableUntil: 0,                // Payable until 0 minutes before startTime
        value: 65,
        type: units.U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.3371203, 24.8258768], // 2. Betomix Oy, Vanha Nurmijärventie 188, Vantaa
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.3005963, 25.2829841], // 5. Arla, Kotkantie 34, Söderkulla
              [60.2549956, 24.8277603], // 4. Shell, Torpantie 4, Vantaa
            ],
          ],
        ],
      },
      {
        agency: 'HSL',
        name: 'Seutu',
        bookableUntil: 0,               // Bookable until 0 minutes before startTime
        payableUntil: 0,                // Payable until 0 minutes before startTime
        value: 112,
        type: units.U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
      {
        agency: 'Valopilkku',
        name: 'Taksi',
        bookableUntil: 30 * 60 * 1000,  // Bookable until 30 minutes before startTime
        payableUntil: 10 * 60 * 1000,   // Payable until 10 minutes before startTime
        value: 15,
        type: units.U_PMIN,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
    ],
  },

  pricelist1: {
    title: 'Helsinki plan prices.',
    prices: [
      {
        agency: 'HSL',
        name: 'Helsinki',
        bookableUntil: 0,               // Bookable until 0 minutes before startTime
        payableUntil: 0,                // Payable until 0 minutes before startTime
        value: 0,
        type: units.U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.2549956, 24.8277603], // 4. Shell, Torpantie 4, Vantaa
              [60.3005963, 25.2829841], // 5. Arla, Kotkantie 34, Söderkulla
              [60.1533034, 25.2836792], // 8. Trutlande island
              [60.1245699, 24.8466468], // 7. Harmaakari island
            ],
          ],
        ],
      },
      {
        agency: 'Valopilkku',
        name: 'Taksi',
        bookableUntil: 0,               // Bookable until 0 minutes before startTime
        payableUntil: 0,                // Payable until 0 minutes before startTime
        value: 15,
        type: units.U_PMIN,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
    ],
  },

  pricelist2: {
    title: 'Seutu plan prices.',
    prices: [
      {
        agency: 'HSL',
        name: 'Seutu Plan',
        bookableUntil: 0,               // Bookable until 0 minutes before startTime
        payableUntil: 0,                // Payable until 0 minutes before startTime
        value: 0,
        type: units.U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
      {
        agency: 'Valopilkku',
        name: 'Taksi',
        bookableUntil: 30 * 60 * 1000,  // Bookable until 30 minutes before startTime
        payableUntil: 10 * 60 * 1000,   // Payable until 10 minutes before startTime
        value: 15,
        type: units.U_PMIN,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
    ],
  },

};

// jscs:enable disallowSpacesInsideArrayBrackets
// jscs:enable disallowSpacesInsideBrackets
