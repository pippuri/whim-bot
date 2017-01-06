'use strict';

const webpack = require('webpack');

module.exports = {
  target: 'node',
  externals: [
    'aws-sdk',
    'pg',
    'knex',
    'objection',
  ],
  resolve: {
    extensions: ['', '.js'],
  },
  devtool: '',
  plugins: [
    //new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),

    // Unnecessary AJV deps
    new webpack.IgnorePlugin(/(regenerator|nodent|js-beautify)$/),

    // Our internal shims
    new webpack.IgnorePlugin(/(mockLambda\.js|mockDynamo\.js)$/),

    // Unnecessary Knex deps
    //new webpack.IgnorePlugin(/(commander|liftoff)/),
  ],
  module: {
    loaders: [
      {
        test: /\.json$/,
        loader: 'json-loader',
      },
    ],
  },
};
