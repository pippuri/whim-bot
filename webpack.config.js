'use strict';

const webpack = require('webpack');
const CompressionPlugin = require('compression-webpack-plugin');

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
      { test: /\.json$/, loader: 'json-loader' },
      { test: /\.ts$|\.md$|\.jst$|\.def$/, loader: 'ignore-loader' },
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel',
        query: {
          presets: ['es2015', 'es2016', 'es2017', 'stage-0'],
        },
      },
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
    // }),

    new CompressionPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: /\.js$|\.json$/,
      minRatio: 0,
    }),
  ],
};
