# [DashRPC.js](https://github.com/dashhive/DashRPC.js)

[![NPM Package](https://img.shields.io/npm/v/dashrpc.svg)](https://www.npmjs.org/package/dashrpc)

Dash Client Library to connect to Dash Core (`dashd`) via RPC

## Install

dashd-rpc runs on [node](http://nodejs.org/), and can be installed via [npm](https://npmjs.org/):

```sh
npm install --save dashrpc
```

## Usage

You can examine `RpcClient.callspec` to see the list of supported RPCs:

```js
console.info('Supported RPCs:');
console.info(RpcClient.callspec);
```

If any of them are out of date with [Dash: Docs: RPCs: Quick Reference](https://docs.dash.org/projects/core/en/stable/docs/api/remote-procedure-call-quick-reference.html), feel free to open an issue or PR.

### RpcClient

Config parameters :

	- protocol : (string - optional) - (default: 'https') - Set the protocol to be used. Either `http` or `https`.
	- user : (string - optional) - (default: 'user') - Set the user credential.
	- pass : (string - optional) - (default: 'pass') - Set the password credential.
	- host : (string - optional) - (default: '127.0.0.1') - The host you want to connect with.
	- port : (integer - optional) - (default: 9998) - Set the port on which perform the RPC command.

### Examples

Config:

```js
var config = {
    protocol: 'http',
    user: 'dash',
    pass: 'local321',
    host: '127.0.0.1',
    port: 19998
};
```

```js
var RpcClient = require('dashrpc');
var rpc = new RpcClient(config);

async function main() {
    let rawMempool = await rpc.getRawMemPool();
    for (let result of rawMempool.result) {
        let rawTx = await rpc.getRawTransaction(r);
        console.info(`RawTX: ${rawTx.result}`);
    }
}

main.then(function () {
    process.exit(0);
}).catch(function (err) {
    console.error(err);
    process.exit(1);
})
```

### Help

You can dynamically access to the help of each method by doing

```
const RpcClient = require('dashrpc');
var client = new RPCclient({
    protocol:'http',
    user: 'dash',
    pass: 'local321',
    host: '127.0.0.1',
    port: 19998,
    timeout: 1000
});

// Get full help
{
    let help = client.help();
    console.log(help)
}

// Get help of specific method
{
    let getinfoHelp = client.help('getinfo');
    console.log(getinfoHelp)
}
```

## License

This was originally forked from <https://github.com/dashpay/dashd-rpc>, but has since become its own project.

&copy; 2024-Present Dash Incubator \
&copy; 2013-2022 Dash Core Group, Inc.

[MIT](./LICENSE)
