'use strict';

function parseProperties(result) {
  const properties = {
    name: result.formatted_address,
  };

  result.address_components.forEach(component => {
    component.types.forEach(type => {
      switch (type) {
        case 'country':
          properties.country = component.long_name;
          properties.countryCode = component.short_name;
          break;
        case 'postal_code':
          properties.zipCode = component.long_name;
          break;
        case 'street_number':
          properties.streetNumber = component.short_name;
          break;
        case 'route':
          properties.streetName = component.long_name;
          break;
        case 'administrative_area_level_3':
        case 'locality':
          properties.city = component.long_name;
          break;
        default:
      }
    });
  });

  return properties;
}

function parseGeometry(result) {
  return {
    type: 'Point',
    coordinates: [result.geometry.location.lat, result.geometry.location.lng],
  };
}

function parseFeature(result) {
  return {
    type: 'Feature',
    properties: parseProperties(result),
    geometry: parseGeometry(result),
  };
}

function parseFeatures(results) {
  return {
    type: 'FeatureCollection',
    features: results.map(parseFeature),
  };
}

module.exports = {
  parseFeatures: parseFeatures,
  parseFeature: parseFeature,
  parseProperties: parseProperties,
  parseGeometry: parseGeometry,
};
