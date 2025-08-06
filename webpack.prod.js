const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

module.exports = (env, argv) => {
  const analyze = env && env.analyze;
  const version = require('./package.json').version;
  
  return {
    mode: 'production',
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/[name].[contenthash:8].js',
      chunkFilename: 'js/[name].[contenthash:8].chunk.js',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
      clean: true,
      publicPath: '/',
      crossOriginLoading: 'anonymous',
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  useBuiltIns: 'usage',
                  corejs: 3,
                  targets: {
                    browsers: ['> 1%', 'last 2 versions', 'not dead']
                  }
                }]
              ],
              plugins: [
                '@babel/plugin-proposal-class-properties',
                '@babel/plugin-syntax-dynamic-import'
              ],
              cacheDirectory: true,
              cacheCompression: false,
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                sourceMap: false,
              }
            }
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8kb
            },
          },
          generator: {
            filename: 'assets/images/[name].[contenthash:8][ext]',
          },
          use: [
            {
              loader: 'image-webpack-loader',
              options: {
                mozjpeg: {
                  progressive: true,
                  quality: 85,
                },
                optipng: {
                  enabled: true,
                  optimizationLevel: 7,
                },
                pngquant: {
                  quality: [0.8, 0.9],
                  speed: 4,
                },
                gifsicle: {
                  interlaced: false,
                  optimizationLevel: 3,
                },
                webp: {
                  quality: 85,
                },
              },
            },
          ],
        },
        {
          test: /\.(mp3|wav|ogg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/sounds/[name].[contenthash:8][ext]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/fonts/[name].[contenthash:8][ext]',
          },
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        title: 'Memex Racing Game',
        favicon: './public/favicon.ico',
        minify: {
          removeComments: true,
          collapseWhitespace: true,
          removeAttributeQuotes: true,
          removeEmptyAttributes: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
        },
        meta: {
          'version': version,
          'build-time': new Date().toISOString(),
          'description': 'A chaotic multiplayer racing betting game with retro pixel art style',
          'author': 'Memex Racing Team',
          'keywords': 'game,racing,betting,multiplayer,phaser,pixel-art',
          'viewport': 'width=device-width, initial-scale=1.0',
          'og:title': 'Memex Racing Game',
          'og:description': 'Experience chaotic multiplayer racing with AI-controlled cars and real-time betting',
          'og:type': 'website',
        },
      }),

      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/assets',
            to: 'assets',
            noErrorOnMissing: true,
            globOptions: {
              ignore: ['**/*.md', '**/*.txt'],
            },
          },
          {
            from: 'data',
            to: 'data',
            noErrorOnMissing: true,
            globOptions: {
              ignore: ['**/node_modules/**', '**/*.log'],
            },
          },
        ],
      }),

      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.VERSION': JSON.stringify(version),
        'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
        'process.env.PHASER_DEBUG': JSON.stringify(false),
        'process.env.ENABLE_ANALYTICS': JSON.stringify(true),
      }),

      // Gzip compression for assets
      new CompressionPlugin({
        filename: '[path][base].gz',
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8,
      }),

      // Brotli compression for modern browsers
      new CompressionPlugin({
        filename: '[path][base].br',
        algorithm: 'brotliCompress',
        test: /\.(js|css|html|svg)$/,
        compressionOptions: {
          level: 11,
        },
        threshold: 8192,
        minRatio: 0.8,
      }),

      // Subresource integrity for security
      new SubresourceIntegrityPlugin({
        hashFuncNames: ['sha256', 'sha384'],
        enabled: true,
      }),

      // Performance monitoring
      new webpack.ProgressPlugin(),

      // Bundle analysis (only when analyze flag is set)
      ...(analyze ? [new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: 'bundle-analysis.html',
        openAnalyzer: true,
      })] : []),

      // Performance hints plugin
      new webpack.optimize.ModuleConcatenationPlugin(),
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
        '@auth': path.resolve(__dirname, 'src/auth'),
      },
      fallback: {
        "crypto": false,
        "fs": false,
        "path": false,
        "os": false,
      },
    },

    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.debug'],
              passes: 2,
            },
            mangle: {
              safari10: true,
            },
            output: {
              comments: false,
              ascii_only: true,
            },
          },
          extractComments: false,
        }),
      ],
      
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        cacheGroups: {
          // Phaser.js in its own chunk for better caching
          phaser: {
            test: /[\\/]node_modules[\\/]phaser[\\/]/,
            name: 'phaser',
            priority: 30,
            reuseExistingChunk: true,
          },
          
          // Game engine core
          gameEngine: {
            test: /[\\/]src[\\/]game[\\/]engine[\\/]/,
            name: 'engine',
            priority: 25,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Game systems
          gameSystems: {
            test: /[\\/]src[\\/]game[\\/]systems[\\/]/,
            name: 'systems',
            priority: 24,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Game entities
          gameEntities: {
            test: /[\\/]src[\\/]game[\\/]entities[\\/]/,
            name: 'entities',
            priority: 23,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Game scenes
          gameScenes: {
            test: /[\\/]src[\\/]game[\\/]scenes[\\/]/,
            name: 'scenes',
            priority: 22,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // UI components
          ui: {
            test: /[\\/]src[\\/]ui[\\/]/,
            name: 'ui',
            priority: 21,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Authentication system
          auth: {
            test: /[\\/]src[\\/]auth[\\/]/,
            name: 'auth',
            priority: 20,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Multiplayer functionality
          multiplayer: {
            test: /[\\/]src[\\/]multiplayer[\\/]/,
            name: 'multiplayer',
            priority: 19,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Third-party vendors (excluding Phaser)
          vendors: {
            test: /[\\/]node_modules[\\/](?!phaser[\\/])/,
            name: 'vendors',
            priority: 15,
            reuseExistingChunk: true,
          },
          
          // Common utilities
          common: {
            name: 'common',
            minChunks: 2,
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      },
      
      runtimeChunk: {
        name: 'runtime',
      },
      
      usedExports: true,
      sideEffects: false,
      
      // Performance-critical optimizations for 60 FPS target
      concatenateModules: true,
      flagIncludedChunks: true,
      mergeDuplicateChunks: true,
      removeAvailableModules: true,
      removeEmptyChunks: true,
    },

    performance: {
      hints: 'warning',
      maxEntrypointSize: 400000, // 400kb - optimized for game performance
      maxAssetSize: 300000, // 300kb per asset
      assetFilter: (assetFilename) => {
        // Ignore source maps and compressed files from performance hints
        return !/\.(map|gz|br)$/.test(assetFilename);
      },
    },

    // Source maps for production debugging
    devtool: 'source-map',

    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false,
      entrypoints: false,
      assets: true,
      assetsSort: 'size',
      builtAt: true,
      env: true,
      errors: true,
      warnings: true,
      version: true,
      timings: true,
      performance: true,
    },

    // Node.js polyfills (disabled for browser bundle size optimization)
    node: false,

    // Cache configuration for faster rebuilds
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/webpack'),
      buildDependencies: {
        config: [__filename],
      },
    },

    // Experimental features for performance
    experiments: {
      topLevelAwait: true,
    },
  };
};