const { upgradeJasmine } = require('./');
if (global.jasmine.testPath.includes('global')) {
  upgradeJasmine(global, {
    writeAfterEach: true,
    loadAfterEach: true,
    nockOptions: {
      removeHeaders: ['Date'],
    },
  });
} else {
  upgradeJasmine(global, {
    writeAfterEach: true,
    loadAfterEach: true,
  });
}
