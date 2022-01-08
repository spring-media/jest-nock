const { upgradeJasmine } = require('./');
if (global.jasmine.testPath.includes('global2')) {
  upgradeJasmine(global, {
    writeAfterEach: true,
    loadAfterEach: true,
    nockOptions: {
      removeHeaders: true,
    },
  });
} else if (global.jasmine.testPath.includes('global')) {
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
