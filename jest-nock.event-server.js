// Only used for testing the jest-nock setup

const Hapi = require('@hapi/hapi');
const susie = require('susie');

const init = async (port = 30009) => {
  const server = Hapi.server({
    port,
    host: 'localhost',
  });
  await server.register(susie);

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      const response = h.event({ id: 1, data: '111' });

      setTimeout(() => {
        h.event({ id: 2, data: '222' });
      }, 100);

      return response;
    },
  });

  server.route({
    method: 'GET',
    path: '/data',
    handler: () => {
      return 'datastring';
    },
  });

  server.route({
    method: 'GET',
    path: '/data2',
    handler: () => {
      return 'datastring2';
    },
  });

  await server.start();

  return server;
};

module.exports = {
  init,
};
