RPCClient = require('./lib');
Bluebird = require('bluebird')

class PromisifyModule {
    constructor(options) {
        const client = new RPCClient(options);

        for (let method in client.apiCalls) {
            let promise = Bluebird.promisify(client[method]);
            client[method] = promise;
            client[method.toLowerCase()] = promise;
        }

        return client;
    }
}
module.exports = PromisifyModule