'use strict';

const webpack = require('webpack');

module.exports = {
  entry: ['babel-polyfill'],
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
      { test: /\.js$/, loader: 'babel', exclude: /node_modules/ },
      { test: /\.json$/, loader: 'json-loader' },
      { test: /\.ts$|\.md$|\.jst$|\.def$/, loader: 'ignore-loader' },
    ],
  },
  plugins: [

    new webpack.IgnorePlugin(/(regenerator|nodent|js-beautify)$/), // Unnecessary AJV deps
    new webpack.IgnorePlugin(/(mockLambda\.js|mockDynamo\.js)$/), // Our internal shims
    new webpack.IgnorePlugin(/(commander|liftoff)/), // Unnecessary UI deps

    // Assign the module and chunk ids by occurrence count
    new webpack.optimize.OccurrenceOrderPlugin(),

    // Remove duplication
    new webpack.optimize.DedupePlugin(),

    // chunk merging strategy
    new webpack.optimize.AggressiveMergingPlugin(),

    // UglifyJS
    // new webpack.optimize.UglifyJsPlugin({
    //   mangle: true,
    //   compress: {
    //     warnings: true, // Suppress uglification warnings
    //     pure_getters: true,
    //     unsafe: true,
    //     unsafe_comps: true,
    //     screw_ie8: true,
    //   },
    //   output: {
    //     comments: false,
    //   },
    //   test: /\.js$/i,
    //   exclude: [/\.min\.js$/gi], // skip pre-minified libs
    // })
  ],
};
