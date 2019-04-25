/**
 * This setup allows automatic recording and replaying of http(s) requests.
 * How to:
 * - Mark a test to be recorded/replayed with `it.nock(...)`
 * - Set JEST_NOCK_RECORD=true and run the tests you want to record
 */
const nock = require('nock');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const subPathName = '__nocks__';

function beforeTest (nockFilePath, nockOptions) {
  let altName = (nockOptions && nockOptions.nockFileName) ? nockOptions.nockFileName : null;
  
  if (!altName && (process.env.JEST_NOCK_RECORD === 'true')) { // if alt-name don't record => read-only
    nock.recorder.rec({
      /* eslint-disable camelcase */
      dont_print: true,
      output_objects: true,
      /* eslint-enable camelcase */
    });
  } else {
    const nfp = nockFilePath(altName);
    console.log(`reading nock test: ${nfp}`);
    if (fs.existsSync(nfp)) {
      const defs = nock.loadDefs(nfp);
      nock.define(defs);
    }
    nock.disableNetConnect();

    if (nockOptions && Array.isArray(nockOptions.enableNetConnect)) {
      nockOptions.enableNetConnect.forEach(stringOrRegEx => nock.enableNetConnect(stringOrRegEx));
    }
  }
}

function afterTest (nockFileDir, nockFilePath, nockOptions, { relativeTestPath, title }) {
  let altName = (nockOptions && nockOptions.nockFileName) ? nockOptions.nockFileName : null;
  
  if (!altName && (process.env.JEST_NOCK_RECORD === 'true')) { // if alt-name we didn't record => read-only
    let recording = nock.recorder.play();
    nock.recorder.clear();
    nock.restore();

    if (nockOptions && Array.isArray(nockOptions.enableNetConnect)) {
      recording = recording
        .filter((item) => nockOptions.enableNetConnect
          .find((enabled) => !item.scope.match(enabled))
        )
    }

    if (recording.length === 0) {
      console.warn(`jest-nock: Empty recording for "${title}" in "${relativeTestPath}".`)
      return;
    }

    if (!fs.existsSync(nockFileDir)) {
      mkdirp.sync(nockFileDir);
    }
    const nfp = nockFilePath();
    fs.writeFileSync(nfp, JSON.stringify(recording, null, 2));
  }

  nock.cleanAll();
  nock.enableNetConnect();
}

const getNockOptions = (args) => {
  return args[args.length - 1];
}

const bindNock = (fn, testPath, overrideTitle) => {
  return function (...args) {
    let title = args[0];
    let testFn = args[1];
    let timeout = args[2];
    const fnArgs = [];

    if (typeof args[0] === 'function') {
      title = overrideTitle || 'default';
      testFn = args[0];
      timeout = args[1];
    } else {
      fnArgs.push(title);
    }

    const { dir, name } = path.parse(testPath);
    const afterTestInfo = {
      relativeTestPath: path.relative(process.cwd(), testPath),
      title
    };

    const nockFileName = (altName) => `${name}_${altName || djb2(title)}.nock.json`;
    const nockFileDir = path.resolve(dir, subPathName);
    const nockFilePath = (altName) => path.join(nockFileDir, nockFileName(altName));

    let wrappedTest = null;

    if (testFn.length >= 1) {
      wrappedTest = done => {
        const nockOptions = getNockOptions(args);

        beforeTest(nockFilePath, nockOptions);
        const wrappedDone = err => {
          afterTest(nockFileDir, nockFilePath, nockOptions, afterTestInfo);
          done(err);
        };

        return testFn(wrappedDone);
      };
    } else {
      wrappedTest = async (...testArgs) => {
        const nockOptions = getNockOptions(args);

        beforeTest(nockFilePath, nockOptions);
        try {
          const result = await testFn(...testArgs);

          afterTest(nockFileDir, nockFilePath, nockOptions, afterTestInfo);
          return result;
        } catch (err) {
          afterTest(nockFileDir, nockFilePath, nockOptions, afterTestInfo);
          throw err;
        }
      };
    }

    fnArgs.push(wrappedTest);
    if (typeof timeout === 'number') {
      fnArgs.push(timeout);
    }

    return fn(...fnArgs);
  };
};

function djb2 (str) {
  let hash = 5381;

  for (let i = str.length; i >= 0; --i) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }

  return hash >>> 0;
}

function upgradeJasmine (jsmn, glb) {
  const env = jsmn.getEnv();
  const testPath = jsmn.testPath;

  glb.it.nock = bindNock(env.it, testPath);
  glb.fit.nock = bindNock(env.fit, testPath);
  glb.beforeAll.nock = bindNock(env.beforeAll, testPath, 'beforeAll');
  glb.afterAll.nock = bindNock(env.afterAll, testPath, 'afterAll');
}

module.exports = {
  upgradeJasmine,
};
