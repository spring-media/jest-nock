const { upgradeJasmine } = require('./');

upgradeJasmine(global, {
  writeAfterEach: true,
  loadAfterEach: true,
});
