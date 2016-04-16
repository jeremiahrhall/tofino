// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

import webpack from 'webpack';
import { transformFile } from 'babel-core';
import fs from 'fs-promise';
import path from 'path';

import webpackProdConfig from './webpack.config.prod';
import webpackDevConfig from './webpack.config.dev';
import { development } from '../build-config';

// Webpacks the UI used in the BrowserWindow
const webpackBuild = () => new Promise((resolve, reject) => {
  const config = development ? webpackDevConfig : webpackProdConfig;
  const compiler = webpack(config);
  compiler.run(resolve, err => {
    if (err) {
      reject(err);
    }
    resolve();
  });
});

const transpile = (filename, options = {}) => new Promise((resolve, reject) => {
  transformFile(filename, options, (err, result) => {
    if (err) {
      reject(err);
    } else {
      resolve(result);
    }
  });
});

async function buildFile({ path: sourceFile, stats: sourceStats }, targetFile) {
  try {
    const targetStats = await fs.stat(targetFile);
    if (targetStats.mtime > sourceStats.mtime) {
      return;
    }
  } catch (e) {
    // The target may not exist. For whatever reason just go and try to build it
  }

  const extension = path.extname(sourceFile);
  if (extension === '.js' || extension === '.jsx') {
    const { code } = await transpile(sourceFile);
    await fs.writeFile(targetFile, code);
  } else {
    await fs.copy(sourceFile, targetFile);
  }
}

async function babelBuild() {
  const source = path.resolve(path.join(__dirname, '..', 'app'));
  const target = path.resolve(path.join(__dirname, '..', 'lib'));

  const getTargetPath = (sourcePath) => path.resolve(target, path.relative(source, sourcePath));

  const paths = await fs.walk(source);

  // Find all the directories and sort by depth.
  const dirs = paths.filter(p => p.stats.isDirectory())
                  .sort((a, b) => a.length - b.length);

  // Make sure they all exist in the target directory.
  await Promise.all(dirs.map(p => fs.ensureDir(getTargetPath(p.path))));

  // Build all the files
  const files = paths.filter(p => p.stats.isFile());
  await Promise.all(files.map(p => buildFile(p, getTargetPath(p.path))));
}

export default () => Promise.all([webpackBuild(), babelBuild()]);
