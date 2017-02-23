'use strict';

const webpack = require('webpack');
const BabiliPlugin = require('babili-webpack-plugin');

module.exports = {
  target: 'node',
  externals: [
    'aws-sdk',
    'pg',
    'knex',
    'objection',
  ],
  resolve: {
    extensions: ['', '.js', 'json'],
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      { test: /\.json$/, loader: 'json-loader' },
      { test: /\.ts$|\.md$|\.jst$|\.def$/, loader: 'ignore-loader' },
    ],
  },
  plugins: [
    new webpack.IgnorePlugin(/(regenerator|nodent|js-beautify)$/), // Unnecessary AJV deps
    new webpack.IgnorePlugin(/(mockLambda\.js)$/), // Our internal shims
    new webpack.IgnorePlugin(/(commander|liftoff)/), // Unnecessary UI deps

    // Assign the module and chunk ids by occurrence count
    new webpack.optimize.OccurrenceOrderPlugin(),

    // Remove duplication
    new webpack.optimize.DedupePlugin(),

    // chunk merging strategy
    new webpack.optimize.AggressiveMergingPlugin(),

    // Babili babel minification
    new BabiliPlugin({ comments: false }),
  ],
};
