const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDevelopment ? '[name].bundle.js' : '[name].[contenthash].bundle.js',
      clean: true,
      publicPath: '/',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              cacheDirectory: true,
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name].[hash][ext]',
          },
        },
        {
          test: /\.(mp3|wav|ogg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/sounds/[name].[hash][ext]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/fonts/[name].[hash][ext]',
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        title: 'Memex Racing Game',
        favicon: './public/favicon.ico',
        minify: false, // Disable HTML minification to fix clean-css dependency issue
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/assets',
            to: 'assets',
            noErrorOnMissing: true,
          },
          {
            from: 'data',
            to: 'data',
            noErrorOnMissing: true,
          },
        ],
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(argv.mode || 'production'),
        'process.env.VERSION': JSON.stringify(require('./package.json').version),
        'process.env.BROWSER': JSON.stringify(true),
        'process.env.DEBUG': JSON.stringify(isDevelopment),
      }),
      ...(isDevelopment ? [new webpack.HotModuleReplacementPlugin()] : []),
    ],
    resolve: {
      extensions: ['.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@game': path.resolve(__dirname, 'src/game'),
        '@engine': path.resolve(__dirname, 'src/game/engine'),
        '@systems': path.resolve(__dirname, 'src/game/systems'),
        '@entities': path.resolve(__dirname, 'src/game/entities'),
        '@scenes': path.resolve(__dirname, 'src/game/scenes'),
        '@ui': path.resolve(__dirname, 'src/ui'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@multiplayer': path.resolve(__dirname, 'src/multiplayer'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@config': path.resolve(__dirname, 'src/config'),
      },
      fallback: {
        crypto: require.resolve('crypto-browserify'),
        events: require.resolve('events/'),
        stream: false,
        buffer: false,
        util: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
        path: false,
        fs: false,
        vm: false,
      },
    },
    devServer: {
      static: [
        {
          directory: path.join(__dirname, 'public'),
        },
        {
          directory: path.join(__dirname, 'data'),
          publicPath: '/data',
        },
      ],
      hot: true,
      port: process.env.PORT || 3000,
      open: true,
      historyApiFallback: true,
      compress: true,
      allowedHosts: 'all',
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
        progress: true,
      },
      watchFiles: ['src/**/*', 'public/**/*', 'data/**/*'],
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true,
          },
          phaser: {
            test: /[\\/]node_modules[\\/]phaser[\\/]/,
            name: 'phaser',
            priority: 20,
          },
          gameEngine: {
            test: /[\\/]src[\\/]game[\\/]engine[\\/]/,
            name: 'game-engine',
            priority: 15,
            minChunks: 1,
          },
          gameSystems: {
            test: /[\\/]src[\\/]game[\\/]systems[\\/]/,
            name: 'game-systems',
            priority: 14,
            minChunks: 1,
          },
          common: {
            minChunks: 2,
            priority: -10,
            reuseExistingChunk: true,
          },
        },
      },
      runtimeChunk: 'single',
      ...(isProduction && {
        minimize: true,
        usedExports: true,
        sideEffects: false,
      }),
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
    devtool: isDevelopment ? 'eval-source-map' : 'source-map',
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false,
    },
  };
};