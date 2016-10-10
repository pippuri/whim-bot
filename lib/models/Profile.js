'use strict';

const Model = require('objection').Model;
const validator = require('../../lib/validator');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError');

const awsUnitsSchema = require('maas-schemas/prebuilt/core/aws-units.json');
// const profileSchema = require('maas-schemas/prebuilt/core/profile.json');

class Profile extends Model {

  static get tableName() {
    return 'Profile';
  }

  static get idColumn() {
    return 'identityId';
  }

    /**
     * Create and persist new profile data
     * @param {UUID} identityId - user ID
     * @param {String} phone - user phone number
     */
  static create(identityId, phone) {

    return validator.validate(awsUnitsSchema.definitions.identityId, identityId)
      .then(() => Profile.exists(identityId))
      .then(existed => {
        if (existed === true) {
          return Promise.reject(new MaaSError('[Profile create] Profile existed', 400));
        }
        return bus.call('MaaS-store-single-package', {
          id: process.env.DEFAULT_WHIM_PLAN,
          type: 'plan',
        });
      })
      .then(plan => {
        return Profile.query()
          .insert({
            identityId,
            balance: plan.pointGrant,
            phone,
            planLevel: plan.level,
            plans: [plan],
            favoriteLocations: [],
          })
          .returning('*');
      })
      .then(profile => Profile.stripNullProperties(profile));
  }

  static retrieve(identityId, attributes) {
    return validator.validate(awsUnitsSchema.definitions.identityId, identityId)
      .then(() => {
        return Profile.query().findById(identityId);
      })
      .then(profile => {

        if (attributes) {
          const returning = {};
          returning.identityId = profile.identityId; // always return identityId
          attributes = attributes.split(',');
          attributes.forEach(attr => {
            returning[attr] = profile[attr];
          });
          profile = returning;
        }

        return Profile.stripNullProperties(profile, attributes);
      });
  }

  static update(identityId, params) {
    return Profile.exists(identityId)
      .then(existed => {
        if (existed === false) {
          return Promise.reject(new MaaSError('[Profile update] Profile doesn\'t exist', 400));
        }

        return Profile.query()
          .patchAndFetchById(identityId, params);
      })
      .then(profile => Profile.stripNullProperties(profile));
  }

  static addFavoriteLocation(identityId, location) {
    return Profile.exists(identityId)
      .then(existed => {
        if (existed === false) {
          return Promise.reject(new MaaSError('[Profile favoriteLocations add] Profile doesn\'t exist', 400));
        }

        return Profile.retrieve(identityId, 'favoriteLocations');
      })
      .then(profile => {
        if (profile.favoriteLocations.some(item => item.name === location.name)) {
          return Promise.reject('[Profile favoriteLocations add] Location already exists');
        }

        profile.favoriteLocations.push(location);
        return Profile.query().patchAndFetchById(identityId, { favoriteLocations: profile.favoriteLocations });
      })
      .then(profile => Profile.stripNullProperties(profile));
  }

  static removeFavoriteLocation(identityId, name) {
    return Profile.exists(identityId)
      .then(existed => {
        if (existed === false) {
          return Promise.reject(new MaaSError('[Profile update] Profile doesn\'t exist', 400));
        }

        return Profile.retrieve(identityId, 'favoriteLocations');
      })
      .then(profile => {
        if (profile.favoriteLocations.every(item => item.name !== name)) {
          return Promise.reject('[Profile favoriteLocations remove] Location not exists');
        }

        profile.favoriteLocations = profile.favoriteLocations.filter(item => item.name !== name);
        return Profile.query().patchAndFetchById(identityId, { favoriteLocations: profile.favoriteLocations });
      })
      .then(profile => Profile.stripNullProperties(profile));
  }

  static exists(identityId) {
    return Profile.retrieve(identityId)
      .then(profile => {
        if (profile && profile.identityId) {
          return Promise.resolve(true);
        }
        console.log(profile);
        return Promise.resolve(false);
      });
  }

  static stripNullProperties(profile, skipAttributes) {
    for (let propName in profile) { // eslint-disable-line
      if (profile[propName] === null) {
        if (skipAttributes && !skipAttributes.split(',').some(attribute => attribute === propName)) { // eslint-disable-line
          // Don't delete the attribute even if it is null
        } else {
          delete profile[propName];
        }
      }
    }

    return profile;
  }
}

module.exports = Profile;
