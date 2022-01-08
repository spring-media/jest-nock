const axios = require('axios');
const path = require('path');
const { init } = require('./jest-nock.event-server');

describe('Jest Nock Record', () => {
  let server = null;

  beforeAll(async () => {
    process.env.JEST_NOCK_RECORD = 'true';
    server = await init();
  });

  // Test beforeAll hook recording
  beforeAll.nock(() => async () => {
    const res = await axios.get('http://localhost:30009/data');
    const data = await res.data;

    expect(data).toEqual('datastring');
  }, {
    title: 'beforeAll 1'
  });
  
  afterAll(async () => {
    await server.stop();
  });

  test.nock('should record server sent events (SSE)', ({ SSE }) => async (done) => {
    const source = new EventSource('http://localhost:30009');
    source.addEventListener('message', (event) => {
      expect(event.data).toEqual('111');
      done();
    });
    await SSE.replay();
  }, {
    title: 'record sse 1'
  });

  test.nock('should record API requests', () => async () => {
    const res = await axios.get('http://localhost:30009/data');
    const data = await res.data;

    expect(data).toEqual('datastring');
  }, {
    title: 'record api 1'
  });

  test.nock('should allow to filter recorded API request headers', () => async () => {
    const res = await axios.get('http://localhost:30009/data');
    const data = await res.data;

    expect(data).toEqual('datastring');
  }, {
    title: 'record api 2',
    removeHeaders: ['Date']
  });

  test.nock('should allow to deactivate recorded API request headers', () => async () => {
    const res = await axios.get('http://localhost:30009/data');
    const data = await res.data;

    expect(data).toEqual('datastring');
  }, {
    title: 'record api 3',
    removeHeaders: true
  });
});

describe('Jest Nock Replay', () => {
  process.env.JEST_NOCK_RECORD = 'false';
  beforeAll(() => {
    process.env.JEST_NOCK_RECORD = 'false';

    const recording = require('./__nocks__/jest-nock.test.nock.json');
  });

  // Test beforeAll hook replay
  beforeAll.nock(() => async () => {
    const res = await axios.get('http://localhost:30009/data');
    const data = await res.data;

    expect(data).toEqual('datastring');
  }, {
    title: 'beforeAll 1'
  });  

  test.nock('should replay server sent events (SSE)', ({ SSE }) => async (done) => {
    const source = new EventSource('http://localhost:30009');
    source.addEventListener('message', (event) => {
      expect(event.data).toEqual('111');
      done();
    });
    await SSE.replay();
  }, {
    title: 'record sse 1'
  });

  test.nock('can replay SSE with custom delay', ({ SSE }) => async (done) => {
    const now = Date.now();
    const source = new EventSource('http://localhost:30009');
    source.addEventListener('message', (event) => {
      const duration = Date.now() - now;

      Promise.resolve()
        .then(() => {
          expect(duration).toBeGreaterThanOrEqual(99);
          expect(event.data).toEqual('111');
        })
        .then(done)
        .catch(done);
    });
    await SSE.replay({
      delay: 100,
    });
  }, {
    title: 'record sse 1'
  });

  test.nock('should replay API requests', () => async () => {
    const res = await axios.get('http://localhost:30009/data');
    const data = await res.data;

    expect(data).toEqual('datastring');
  }, {
    title: 'record api 1'
  });

  test.nock('should not replay removed headers', () => async () => {
    const res = await axios.get('http://localhost:30009/data');

    expect(res.headers).not.toHaveProperty('date');
  }, {
    title: 'record api 2'
  });

  test.nock('should not replay deactivated headers', () => async () => {
    const res = await axios.get('http://localhost:30009/data');

    expect(res.headers).not.toHaveProperty('date');
  }, {
    title: 'record api 2'
  });

  test.todo('removes API recordings which were not replayed');
});

describe('Jest Nock Replay no recording', () => {
  beforeAll(() => {
    process.env.JEST_NOCK_RECORD = 'false';
  });

  test.nock('throws an error if there is no SSE recording to replay', ({ SSE }) => async () => {
    await expect(SSE.replay()).rejects.toEqual(new Error('No recorded Events to replay'));
  });
});

describe('Jest Nock Record API + SEE', () => {
  let server = null;

  beforeAll(async () => {
    process.env.JEST_NOCK_RECORD = 'true';
    server = await init(30010);
  });

  afterAll(async () => {
    await server.stop();
  });

  test.nock('should record both API requests and SSE', ({ SSE }) => async () => {
    const source = new EventSource('http://localhost:30010');
    const eventPromise = getWrappedPromise();
    source.addEventListener('message', (event) => {
      expect(event.data).toEqual('111');
      eventPromise.resolve();
    });

    const res = await axios.get('http://localhost:30010/data');
    expect(res.data).toEqual('datastring');

    await SSE.replay();
    await eventPromise.p;
  }, {
    title: 'record both 1'
  });
});

describe('Jest Nock Replay API + SEE', () => {
  beforeAll(async () => {
    process.env.JEST_NOCK_RECORD = 'false';
  });

  test.nock('should replay both API requests and SSE', ({ SSE }) => async () => {
    const source = new EventSource('http://localhost:30010');
    const eventPromise = getWrappedPromise();
    source.addEventListener('message', (event) => {
      expect(event.data).toEqual('111');
      eventPromise.resolve();
    });

    const res = await axios.get('http://localhost:30010/data');
    expect(res.data).toEqual('datastring');

    await SSE.replay();
    await eventPromise.p;
  }, {
    title: 'record both 1'
  });
});

describe('Jest Nock Record Multi API + SEE', () => {
  let server = null;

  beforeAll(async () => {
    process.env.JEST_NOCK_RECORD = 'true';
    server = await init(30011);
  });

  afterAll(async () => {
    await server.stop();
  });

  test.nock('should record both API requests and SSE', ({ SSE }) => async () => {
    const source = new EventSource('http://localhost:30011');
    const eventPromise = getWrappedPromise();
    const eventData = [];
    source.addEventListener('message', (event) => {
      eventData.push(event.data);
      if (eventData.length === 2) {
        expect(eventData).toEqual(['111', '222']);
        eventPromise.resolve();
      }
    });

    const [res1, res2] = await Promise.all([
      axios.get('http://localhost:30011/data'),
      axios.get('http://localhost:30011/data2'),
    ]);
    expect(res1.data).toEqual('datastring');
    expect(res2.data).toEqual('datastring2');

    await SSE.replay();
    await SSE.replay();
    await eventPromise.p;
  }, {
    title: 'record both 2'
  });
});

describe('Jest Nock Replay Multi API + SEE', () => {
  beforeAll(async () => {
    process.env.JEST_NOCK_RECORD = 'false';
  });

  test.nock('should replay both API requests and SSE', ({ SSE }) => async () => {
    const source = new EventSource('http://localhost:30011');
    const eventPromise = getWrappedPromise();
    const eventData = [];
    source.addEventListener('message', (event) => {
      eventData.push(event.data);
      if (eventData.length === 2) {
        expect(eventData).toEqual(['111', '222']);
        eventPromise.resolve();
      }
    });

    const [res1, res2] = await Promise.all([
      axios.get('http://localhost:30011/data'),
      axios.get('http://localhost:30011/data2'),
    ]);
    expect(res1.data).toEqual('datastring');
    expect(res2.data).toEqual('datastring2');

    await SSE.replay();
    await SSE.replay();
    await eventPromise.p;
  }, {
    title: 'record both 2'
  });
});

describe('Jest Nock interface', () => {
  it('extends existing jest interface', () => {
    expect(it.nock).toBeInstanceOf(Function);
    expect(test.nock).toBeInstanceOf(Function);
    expect(fit.nock).toBeInstanceOf(Function);
    expect(beforeAll.nock).toBeInstanceOf(Function);
    expect(afterAll.nock).toBeInstanceOf(Function);

    expect(() => {
      it.nock('should throw', () => {});
    }).toThrowError(
      'Using `.nock` you need to wrap your test in a function. Example:\n' +
        'test("should...", () => (done) => done())',
    );
  });

  it.todo('allows to use .skip with .nock');
  it.todo('allows to use .only with .nock');
  it.todo('allows to use .concurrently with .nock');

  it.nock('it -> it.nock', () => () => {
    expect(true).toBe(true);
  });

  test.nock('test -> test.nock', () => () => {
    expect(true).toBe(true);
  });
});

function getWrappedPromise() {
  const promise = {};
  const p = new Promise((resolve, reject) =>
    Object.assign(promise, {
      // eslint-disable-line no-new
      resolve,
      reject,
    }),
  );
  Object.assign(promise, { p });
  return promise;
}
