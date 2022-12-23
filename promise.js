const Bluebird = require('bluebird');
const RPCClient = require('./lib');

class PromisifyModule {
  constructor(options) {
    const client = new RPCClient(options);

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const method in client.apiCalls) {
      const promise = Bluebird.promisify(client[method]);
      client[method] = promise;
      client[method.toLowerCase()] = promise;
    }

    return client;
  }
}
module.exports = PromisifyModule;
