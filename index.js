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
  if (process.env.JEST_NOCK_RECORD === 'true') {
    nock.recorder.rec({
      /* eslint-disable camelcase */
      dont_print: true,
      output_objects: true,
      /* eslint-enable camelcase */
    });
  } else {
    if (fs.existsSync(nockFilePath)) {
      const defs = nock.loadDefs(nockFilePath);

      nock.define(defs);
    }
    nock.disableNetConnect();
    if (nockOptions && Array.isArray(nockOptions.enableNetConnect)) {
      nockOptions.enableNetConnect.forEach(stringOrRegEx => nock.enableNetConnect(stringOrRegEx));
    }
  }
}

function afterTest (nockFileDir, nockFilePath) {
  if (process.env.JEST_NOCK_RECORD === 'true') {
    const recording = nock.recorder.play();

    if (recording.length === 0) {
      nock.restore();
      return;
    }

    if (!fs.existsSync(nockFileDir)) {
      mkdirp.sync(nockFileDir);
    }
    fs.writeFileSync(nockFilePath, JSON.stringify(recording, null, 2));

    nock.restore();
  }
  nock.enableNetConnect();
}

const bindNock = (fn, testPath, overrideTitle) => {
  return function (...args) {
    let title = args[0];
    let testFn = args[1];
    let nockOptions = args[2];
    const fnArgs = [];

    if (typeof args[0] === 'function') {
      title = overrideTitle || 'default';
      testFn = args[0];
      nockOptions = args[1];
    } else {
      fnArgs.push(title);
    }

    const { dir, name } = path.parse(testPath);

    const nockFileName = `${name}_${djb2(title)}.nock.json`;
    const nockFileDir = path.resolve(dir, subPathName);
    const nockFilePath = path.join(nockFileDir, nockFileName);

    let wrappedTest = null;

    if (testFn.length >= 1) {
      wrappedTest = done => {
        beforeTest(nockFilePath, nockOptions);
        const wrappedDone = err => {
          afterTest(nockFileDir, nockFilePath);
          done(err);
        };

        return testFn(wrappedDone);
      };
    } else {
      wrappedTest = async (...testArgs) => {
        beforeTest(nockFilePath, nockOptions);
        try {
          const result = await testFn(...testArgs);

          afterTest(nockFileDir, nockFilePath);
          return result;
        } catch (err) {
          afterTest(nockFileDir, nockFilePath);
          throw err;
        }
      };
    }

    fnArgs.push(wrappedTest);

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
}

module.exports = {
  upgradeJasmine,
};
