const axios = require('axios');
const path = require('path');
const { init } = require('./jest-nock.event-server');

describe('Global Settings 2 (recording)', () => {
  let server = null;

  beforeAll(async () => {
    process.env.JEST_NOCK_RECORD = 'true';
    server = await init(30011);
  });

  afterAll(async () => {
    await server.stop();
  });

  test.nock('allows to remove all headers for API recordings globally', () => async () => {
    const res = await axios.get('http://localhost:30011/data');
    const data = await res.data;

    expect(data).toEqual('datastring');
  }, {
    title: 'record api 3',
  });
});

describe('Global Settings (replay)', () => {
  beforeAll(() => {
    process.env.JEST_NOCK_RECORD = 'false';
  });

  test.nock('should not replay any globally removed headers', () => async () => {
    const res = await axios.get('http://localhost:30011/data');

    expect(res.headers).not.toHaveProperty('date');
  }, {
    title: 'record api 3'
  });
});
