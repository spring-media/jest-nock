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
const { inspect } = require('util');
const { default: EventSourceMock, sources: globalEventSources } = require('eventsourcemock');
// SSE Recording
const EventSource = require('eventsource');

global.EventSource = EventSource;
if (typeof global.window === 'object') {
  global.window.EventSource = EventSource;
}

const subPathName = process.env.NOCK_PATH_NAME || '__nocks__';
const OriginalEventSource = global.EventSource;
const isRecordMode = () => process.env.JEST_NOCK_RECORD === 'true';

const usedTitles = {};
const capturedRecords = {};
let currentRecords = {};

function createSSEInstance() {
  const SSE = {
    eventSources: {
      sources: [],
      capturedEvents: [],
      recordedEvents: [],
      resolveNextEvent: null,
      addSource(url, source) {
        this.sources.push(source);

        if (isRecordMode()) {
          source.addEventListener('message', (evt) => {
            this.capturedEvents.push(evt);
            if (this.resolveNextEvent) {
              this.resolveNextEvent();
            }
          });
          source.addEventListener('error', (err) => {
            const error = new Error(`SSE Recording error for ${url}: ${err.message || inspect(err)}`);
            console.error(error); // eslint-disable-line no-console
          });
        } else {
          source.emitOpen();
        }
      },
      waitForEvent() {
        return new Promise((resolve) => {
          if (this.capturedEvents.length === 0) {
            this.resolveNextEvent = () => {
              this.recordedEvents.push(this.capturedEvents.shift());
              this.resolveNextEvent = null;
              resolve();
            };
            return;
          }
          this.recordedEvents.push(this.capturedEvents.shift());
          resolve();
        });
      },
      replayNext({ delay = 0 }) {
        if (this.recordedEvents.length === 0) {
          const err = new Error('No recorded Events to replay');
          const newStack = err.stack.split('\n');
          newStack.splice(1, 1);
          err.stack = newStack.join('\n');
          return Promise.reject(err);
        }

        const event = this.recordedEvents.shift();

        return new Promise((resolve, reject) => {
          try {
            const { type, data, origin } = event;
            
            setTimeout(() => {
              try {
                resolve();
                globalEventSources[origin].emit(type, {
                  data,
                });
              } catch (err) {
                reject(err);
              }
            }, delay);
          } catch (err) {
            reject(err);
          }
        });
      },
    },
    destroy() {
      if (isRecordMode()) {
        for (const source of this.eventSources.sources) {
          source.close();
        }
      }
    },
    replay(options = {}) {
      if (isRecordMode()) {
        const possibleErr = new Error('Timeout waiting for SSE to record');

        return new Promise((resolve, reject) => {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (resolved) {
              return;
            }
            resolved = true;
            const newStack = possibleErr.stack.split('\n');
            newStack.splice(1, 1);
            possibleErr.stack = newStack.join('\n');
            reject(possibleErr);
          }, 3000);
          const done = (err) => {
            if (resolved) {
              return;
            }
            resolved = true;
            if (err) {
              reject(err);
              return;
            }
            clearTimeout(timeout);
            resolve();
          };
          this.eventSources
            .waitForEvent()
            .then(done)
            .catch(done);
        });
      }
      return this.eventSources.replayNext(options);
    },
  };

  return SSE;
}

function beforeTest(SSE, nockOptions, { title }) {
  function MockEventSource(sourceUrl, opts) {
    let source = null;

    if (isRecordMode()) {
      source = new OriginalEventSource(sourceUrl, opts);
    } else {
      source = new EventSourceMock(sourceUrl, opts);
    }

    SSE.eventSources.addSource(sourceUrl, source);
    return source;
  }

  global.EventSource = MockEventSource;
  
  if (isRecordMode()) {
    nock.recorder.rec({
      /* eslint-disable camelcase */
      dont_print: true,
      output_objects: true,
      /* eslint-enable camelcase */
    });
  } else {
    if (currentRecords[title]) {
      const { API: recordedAPI, SSE: recordedSSE } = currentRecords[title];

      // Make recorded SSE available in replay mode
      Object.assign(SSE.eventSources, {
        recordedEvents: [...recordedSSE],
      });
      
      // Make recorded API available in replay mode
      nock.define(recordedAPI);
    }
      
    nock.disableNetConnect();

    if (!nock.isActive()) {
      nock.activate();
    }

    if (Array.isArray(nockOptions.enableNetConnect)) {
      nockOptions.enableNetConnect.forEach((stringOrRegEx) => nock.enableNetConnect(stringOrRegEx));
    }
  }
}

function afterTest(SSE, nockOptions, { relativeTestPath, title }) {
  if (isRecordMode()) {
    let recording = nock.recorder.play();
    nock.recorder.clear();
    nock.restore();

    if (Array.isArray(nockOptions.enableNetConnect)) {
      recording = recording.filter((item) =>
        nockOptions.enableNetConnect.find((enabled) => !item.scope.match(enabled)),
      );
    }

    capturedRecords[title] = { API: [], SSE: [] };

    if (recording.length > 0) {
      if (Array.isArray(nockOptions.removeHeaders)) {
        recording.forEach((scope) => {
          for (const removal of nockOptions.removeHeaders) {
            const index = scope.rawHeaders.indexOf(removal)
            if (index !== -1) { 
              scope.rawHeaders.splice(index, 2)
            }
          }
        })
      }

      capturedRecords[title].API = recording;
    }

    if (SSE.eventSources.recordedEvents.length > 0) {
      capturedRecords[title].SSE = SSE.eventSources.recordedEvents;
    }

    if (recording.length === 0 && SSE.eventSources.recordedEvents.length === 0) {
      console.warn(`jest-nock: Empty recording for "${title}" in "${relativeTestPath}".`); // eslint-disable-line no-console
    }
  }
  // TODO: Warn when there were SSE not being recorded
  // TODO: Warn when there were events recorded, not being replayed during test run
  SSE.destroy();
  nock.cleanAll();
  nock.enableNetConnect();
}

const getNockOptions = (args) => {
  let opts = {}
  if (typeof args[args.length - 1] === 'object') {
    opts = args[args.length - 1]
  }
  return opts;
};

const bindNock = (fn, overrideTitle, defaultNockOptions) => {
  return function test(...args) {
    let title = args[0];
    let testFnWrapper = args[1];
    let timeout = args[2];
    const nockOptions = {
      ...defaultNockOptions,
      ...getNockOptions(args)
    };
    const fnArgs = [];

    if (typeof args[0] === 'function') {
      title = overrideTitle || 'default';
      [testFnWrapper, timeout] = args;
    } else {
      fnArgs.push(title);
    }

    if (nockOptions.title) {
      title = nockOptions.title;
    }

    if (usedTitles[title] && !nockOptions.title) {
      usedTitles[title] += 1;
    } else {
      usedTitles[title] = 1;
    }

    const testInfo = {
      relativeTestPath: path.relative(process.cwd(), global.__TESTPATH),
      title: `${title} - ${usedTitles[title]}`,
    };

    let testFn = null;
    const SSE = createSSEInstance();

    try {
      testFn = testFnWrapper({ SSE });
    } catch (err) {
      testFn = null;
    }

    if (typeof testFn !== 'function') {
      const msg =
        'Using `.nock` you need to wrap your test in a function. Example:\n' +
        'test("should...", () => (done) => done())';
      const err = new TypeError(msg);
      const newStack = err.stack.split('\n');
      newStack.splice(2, 1);
      err.stack = newStack.join('\n');
      throw err;
    }

    let wrappedTest = null;

    if (testFn.length >= 1) {
      wrappedTest = async (done) => {
        let testDone = false;

        beforeTest(SSE, nockOptions, testInfo);
        const wrappedDone = (err) => {
          if (testDone) {
            throw new Error('Done called in async test or called multiple times');
          }
          testDone = true;
          afterTest(SSE, nockOptions, testInfo);
          done(err);
        };

        try {
          const result = await testFn(wrappedDone);
          return result;
        } catch (err) {
          afterTest(SSE, nockOptions, testInfo);
          throw err;
        }
      };
    } else {
      wrappedTest = async () => {
        beforeTest(SSE, nockOptions, testInfo);
        try {
          const result = await testFn();
          afterTest(SSE, nockOptions, testInfo);

          return result;
        } catch (err) {
          afterTest(SSE, nockOptions, testInfo);
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

function writeOutRecording() {
  const { name, dir } = path.parse(global.__TESTPATH);
  const nockFileName = `${name}.nock.json`;
  const nockFileDir = path.resolve(dir, subPathName);
  const nockFilePath = process.env.NOCK_FILE_PATH || path.join(nockFileDir, nockFileName);
  
  if (isRecordMode()) {
    mkdirp.sync(nockFileDir);
    const out = { ...currentRecords, ...capturedRecords };
    
    // TODO: use --update to delete unused records
    fs.writeFileSync(nockFilePath, JSON.stringify(out, null, 2));
  }
}

function loadRecording() {
  const { name, dir } = path.parse(global.__TESTPATH);
  const nockFileName = `${name}.nock.json`;
  const nockFileDir = path.resolve(dir, subPathName);
  const nockFilePath = process.env.NOCK_FILE_PATH || path.join(nockFileDir, nockFileName);

  if (fs.existsSync(nockFilePath)) {
    const fileContents = fs.readFileSync(nockFilePath);
    currentRecords = JSON.parse(fileContents); 
  }
}

function initRecording({ beforeAll, afterAll }, { writeAfterEach, loadAfterEach }) {
  // Note: To test the tool itself, we need to be able to optionally write/load recordings
  // after/before every test, to use them in follow up tests.
  if (writeAfterEach) {
    beforeEach(() => {
      loadRecording();
    });
  } else {
    beforeAll(() => {
      loadRecording();
    });
  }

  if (writeAfterEach) {
    afterEach(() => {
      writeOutRecording();
    });
  } else {
    afterAll(() => {
      writeOutRecording();
    });
  }
}

// Note: Circus does not expose a test file path like `jasmine.testPath`,
// using this method `global.__TESTPATH` needs to be set manually.
function upgradeCircus(glb, options = {}) {
  const { test, it, fit, beforeAll, afterAll } = glb;
  const { nockOptions = {} } = options;

  test.nock = bindNock(test, null, nockOptions);
  it.nock = bindNock(it, null, nockOptions);
  fit.nock = bindNock(fit, null, nockOptions);
  beforeAll.nock = bindNock(beforeAll, 'beforeAll', nockOptions);
  afterAll.nock = bindNock(afterAll, 'afterAll', nockOptions);

  initRecording(glb, options);

  Object.assign(glb, { it, fit, beforeAll, afterAll });
}

function upgradeJasmine(glb, options = {}) {
	const env = glb.jasmine.getEnv();
	const { nockOptions = {} } = options;
  
  global.__TESTPATH = glb.jasmine.testPath;
	glb.it.nock = bindNock(env.it, null, nockOptions);
	glb.fit.nock = bindNock(env.fit, null, nockOptions);
	glb.beforeAll.nock = bindNock(env.beforeAll, 'beforeAll', nockOptions);
  glb.afterAll.nock = bindNock(env.afterAll, 'afterAll', nockOptions);
  
  initRecording(glb, options);
}

module.exports = {
  upgradeCircus,
  upgradeJasmine,
  isRecordMode,
  nock,
};
