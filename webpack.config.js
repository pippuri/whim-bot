'use strict';

const webpack = require('webpack');

module.exports = {
  // entry: provided by serverless
  // output: provided by serverless
  target: 'node',
  externals: [
    'aws-sdk',
    'pg',
  ],
  resolve: {
    extensions: ['', '.js'],
  },
  resolveLoader: {
    modulesDirectories: ['node_modules'],
  },
  devtool: '',
  plugins: [
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),

    // Unnecessary Objection deps
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),

    // Unnecessary Knex deps
    new webpack.IgnorePlugin(/(commander|liftoff)/),
  ],
  module: {
    loaders: [
      {
        test: /\.json$/,
        loader: 'json',
      },
    ],
  },
};
