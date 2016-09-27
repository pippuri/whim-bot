
# Rule: Get-routes

## Index

1) index.js

  > Is used to connects different subrule functions together. Those subrule are routing, pricing and filtering

2) routes.js

  > Is used to get multiple route from different provider based on the location of the request and provider's support region

3) pricing.js

  > Is used to price each itinerary returned from subrule "routes.js". Price are based on agencyId specification from MaaS. Prices in the end might be incorrect due to
    - No agencyId from a leg: MaaS has no support for purchasing the ticket for one or more leg of the itinerary
    - ~~more to come later~~

4) filter.js

  > Is used to filter out the "invalid" itinerary or to decide whether an itinerary is purchasable from the client or not. In short, either remove them or let the cost be null (unpurchasable)

## Subrule logic explaination
