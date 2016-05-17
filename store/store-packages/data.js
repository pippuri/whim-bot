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
  ],
};
