// Require dependency
var SubscriptionMgr = require('../../lib/subscription-manager');
function formatResponse(input) {

  var output = {
    plans: [],
    addons: [],
  };

  // Parse plans
  for (var i = 0; i < input[0].list.length; i++) {
    var planContext = input[0].list[i].plan;

    planContext.price =  planContext.price / 100;
    output.plans.push({
      id: planContext.id,
      name: planContext.name,
      invoiceName: planContext.invoice_name,
      price: planContext.price / 100,
      currency: planContext.meta_data.currency,
      formattedPrice: planContext.meta_data.currency + planContext.price,
      description: planContext.meta_data.description,
      pointGrant: planContext.meta_data.pointGrant,
      period: planContext.period,
      periodUnit: planContext.period_unit,
      chargeModel: planContext.charge_model,
      feature: planContext.meta_data.features,
      provider: planContext.meta_data.provider,
    });
  }

  // Parse addons
  for (var j = 0; j < input[1].list.length; j++) {
    var addonContext = input[1].list[j].addon;

    output.addons.push({
      id: addonContext.id,
      name: addonContext.name,
      invoiceName: addonContext.invoice_name,
      price: addonContext.price / 100,
      period: addonContext.period,
      periodUnit: addonContext.period_unit,
      chargeModel: addonContext.charge_model,
    });
  }

  return output;
}

module.exports.respond = function (event, callback) {
  SubscriptionMgr.getProducts()
  .then(function (response) {
    callback(null, formatResponse(response));
  })
  .catch(function (error) {
    callback(error);
  });
};
