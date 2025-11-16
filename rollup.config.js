import riot from 'rollup-plugin-riot';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { emptyDirectories } from 'rollup-plugin-app-utils';
import { babel } from '@rollup/plugin-babel';
import scss from 'rollup-plugin-scss';
import serve from 'rollup-plugin-serve';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import html from '@rollup/plugin-html';
import htmlUseref from './rollup/html-useref.js';
import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';
import copyTransform from './rollup/copy-transform.js';
import license from './rollup/license.js';
import checkOutput from './rollup/check-output.js';
import importSVG from './rollup/import-svg.js';
import fs from 'fs';
const version = JSON.parse(fs.readFileSync('./package.json', 'utf-8')).version;

const useServe = process.env.ROLLUP_SERVE === 'true';
const output = useServe ? '.serve' : 'dist';

const getVersion = (version) => {
  const parts = version.split('.').map((e) => parseInt(e));
  if (useServe || process.env.DEVELOPMENT_BUILD) {
    parts[1]++;
    parts[2] = 0;
    return parts.join('.') + (useServe ? '-dev' : `-${process.env.DEVELOPMENT_BUILD.slice(0, 10)}`);
  }
  return version;
};

fs.writeFileSync('.version.json', JSON.stringify({ version: getVersion(version), latest: version }));

const plugins = [
  riot(),
  json(),
  importSVG(),
  nodeResolve(),
  commonjs(),
  scss({ fileName: `docker-registry-ui.css`, outputStyle: 'compressed' }),
  babel({ babelHelpers: 'bundled', presets: [['@babel/env', { useBuiltIns: 'usage', corejs: { version: '2' } }]] }),
  copy({
    targets: [
      { src: 'src/fonts', dest: `${output}` },
      { src: '.version.json', dest: `${output}`, rename: 'version.json' },
      { src: 'src/images/*', dest: `${output}/images`, transform: copyTransform },
    ],
  }),
];

if (useServe) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.resolve(__dirname, output);

  // Registry 代理目标（可以通过环境变量配置）
  const REGISTRY_URL = process.env.REGISTRY_URL || 'https://registry.superslash.cn';

  // 添加开发服务器（带代理功能）
  plugins.push(
    serve({
      host: 'localhost',
      port: 8000,
      contentBase: [outputPath, __dirname],
      onListening: function (server) {
        // 设置代理
        const proxyMiddleware = createProxyMiddleware({
          target: REGISTRY_URL,
          changeOrigin: true,
          secure: true,
          logLevel: 'info',
          onProxyReq: (proxyReq, req, res) => {
            const targetUrl = new URL(REGISTRY_URL);
            proxyReq.setHeader('Host', targetUrl.host);
            console.log(`[Proxy] ${req.method} ${req.url} -> ${REGISTRY_URL}${req.url}`);
          },
          onProxyRes: (proxyRes, req, res) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'HEAD, GET, OPTIONS, DELETE';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Authorization, Accept, Cache-Control';
            proxyRes.headers['Access-Control-Expose-Headers'] = 'Docker-Content-Digest';
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
          },
          onError: (err, req, res) => {
            console.error('[Proxy Error]', err.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Proxy error: ' + err.message);
            }
          },
        });

        // 拦截 /v2 路径的请求
        // 保存原始的 request 监听器
        const originalListeners = server.listeners('request').slice();
        server.removeAllListeners('request');

        // 添加我们的代理处理器（必须在最前面）
        server.on('request', (req, res) => {
          if (req.url && req.url.startsWith('/v2')) {
            return proxyMiddleware(req, res, () => {
              // 如果代理失败，调用原始处理器
              originalListeners.forEach((listener) => {
                try {
                  listener(req, res);
                } catch (e) {
                  console.error('[Proxy] Error in original listener:', e);
                }
              });
            });
          }
          // 非 /v2 请求，使用原始处理器
          originalListeners.forEach((listener) => {
            try {
              listener(req, res);
            } catch (e) {
              console.error('[Proxy] Error in original listener:', e);
            }
          });
        });

        console.log(`[Dev Server] Running on http://localhost:8000`);
        console.log(`[Dev Proxy] Registry proxy: /v2 -> ${REGISTRY_URL}/v2`);
      },
    }),
  );
} else {
  plugins.push(terser({ format: { preamble: license } }));
}

export default [
  {
    input: { 'docker-registry-ui': 'src/index.js' },
    output: {
      dir: output,
      name: 'DockerRegistryUI',
      format: 'iife',
      sourcemap: useServe,
    },
    plugins: [emptyDirectories(output)].concat(
      plugins,
      html({ template: () => htmlUseref('./src/index.html', { developement: useServe, production: !useServe }) }),
      checkOutput(output),
    ),
  },
];
