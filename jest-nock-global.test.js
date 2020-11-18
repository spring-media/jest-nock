const axios = require('axios');
const path = require('path');
const { init } = require('./jest-nock.event-server');

describe('Global Settings (recording)', () => {
  let server = null;

  beforeAll(async () => {
    process.env.JEST_NOCK_RECORD = 'true';
    server = await init(30010);
  });

  afterAll(async () => {
    await server.stop();
  });

  test.nock('allows to remove headers for API recordings globally', () => async () => {
    const res = await axios.get('http://localhost:30010/data');
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

  test.nock('should not replay globally removed headers', () => async () => {
    const res = await axios.get('http://localhost:30010/data');

    expect(res.headers).not.toHaveProperty('date');
  }, {
    title: 'record api 3'
  });
});
