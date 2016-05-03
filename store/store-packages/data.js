module.exports = {
  location: 'Europe',
  packages: [
    {
      name: 'Basic Consumer',
      price: 300,
      currency: 'euro',
      formattedPrice: '300 \u20AC',
      description: 'Unlimited use of public transport (buses, trains, trams, ferries, city bikes). Up to one (1) taxi ride per week. So car rental allowed',
      features: [
        {
          name: 'Bus',
          unlimited: true,
          description: 'Unlimited public transport',
        },
        {
          name: 'Taxi',
          unlimited: false,
          description: '1 ride per week',
          credit: 1,
          unit: 'ride',
        },
        {
          name: 'Rental',
          unlimited: false,
          credit: 2,
          unit: 'time',
        },
      ],
    },
    {
      name: 'Premium Package',
      price: 800,
      currency: 'euro',
      formattedPrice: '800 \u20AC',
      description: 'Unlimited use of public transport (buses, trains, trams, ferries, city bikes). Up to two (2) taxi ride per week. One (1) time per month for rental',
      features: [
        {
          name: 'Bus',
          unlimited: true,
          description: 'Unlimited public transport',
        },
        {
          name: 'Taxi',
          unlimited: false,
          description: '2 rides per week',
          credit: 2,
          unit: 'ride',
        },
        {
          name: 'Rental',
          unlimited: false,
          description: '1 time per month',
          credit: 1,
          unit: 'time',
        },
      ],
    },
    {
      name: 'Ultimate Mobility',
      price: 1200,
      currency: 'euro',
      formattedPrice: '1200 \u20AC',
      description: 'Unlimited use of public transport (buses, trains, trams, ferries, city bikes). Up to five (5) taxi ride per week. Two (2) time per month for rental',
      features: [
        {
          name: 'Bus',
          unlimited: true,
          description: 'Unlimited public transport',
        },
        {
          name: 'Taxi',
          unlimited: false,
          description: '5 rides per week',
          credit: 5,
          unit: 'ride',
        },
        {
          name: 'Rental',
          unlimited: false,
          description: '2 times per month',
          credit: 2,
          unit: 'time',
        },
      ],
    },
  ],
};
