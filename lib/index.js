'use strict';

var http = require('http');
var https = require('https');
var async = require('async');

function RpcClient(opts) {
    opts = opts || {};
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 9998;
    this.user = opts.user || 'user';
    this.pass = opts.pass || 'pass';
    this.protocol = opts.protocol === 'http' ? http : https;
    this.batchedCalls = null;
    this.disableAgent = opts.disableAgent || false;
    var queueSize = opts.queue || 16;

    var isRejectUnauthorized = typeof opts.rejectUnauthorized !== 'undefined';
    this.rejectUnauthorized = isRejectUnauthorized ? opts.rejectUnauthorized : true;

    if (RpcClient.config.log) {
        this.log = RpcClient.config.log;
    } else {
        this.log = RpcClient.loggers[RpcClient.config.logger || 'normal'];
    }

    this.queue = async.queue(function(task, callback) {
        task(callback);
    }, queueSize);
}

var cl = console.log.bind(console);

var noop = function () {
};

RpcClient.loggers = {
    none: {info: noop, warn: noop, err: noop, debug: noop},
    normal: {info: cl, warn: cl, err: cl, debug: noop},
    debug: {info: cl, warn: cl, err: cl, debug: cl}
};

RpcClient.config = {
    logger: 'normal', // none, normal, debug,
};

function rpc(request, callback) {
  var self = this;
  var task = function(taskCallback) {
    var newCallback = function() {
      callback.apply(undefined, arguments);
      taskCallback();
    };
    innerRpc.call(self, request, newCallback);
  };

  this.queue.push(task);
}
function innerRpc(request, callback) {

    var self = this;
    request = JSON.stringify(request);
    var auth = new Buffer(self.user + ':' + self.pass).toString('base64');

    var options = {
        host: self.host,
        path: '/',
        method: 'POST',
        port: self.port,
        rejectUnauthorized: self.rejectUnauthorized,
        agent: self.disableAgent ? false : undefined
    };

    if (self.httpOptions) {
        for (var k in self.httpOptions) {
            options[k] = self.httpOptions[k];
        }
    }

    var called = false;

    var errorMessage = 'Dash JSON-RPC: ';

    var req = this.protocol.request(options, function (res) {

        var buf = '';
        res.on('data', function (data) {
            buf += data;
        });

        res.on('end', function () {

            if (called) {
                return;
            }
            called = true;

            if (res.statusCode === 401) {
                callback(new Error(errorMessage + 'Connection Rejected: 401 Unnauthorized'));
                return;
            }
            if (res.statusCode === 403) {
                callback(new Error(errorMessage + 'Connection Rejected: 403 Forbidden'));
                return;
            }
            if (res.statusCode === 500 && buf.toString('utf8') === 'Work queue depth exceeded') {
                var exceededError = new Error('Dash JSON-RPC: ' + buf.toString('utf8'));
                exceededError.code = 429; // Too many requests
                callback(exceededError);
                return;
            }

            var parsedBuf;
            try {
                parsedBuf = JSON.parse(buf);
            } catch (e) {
                self.log.err(e.stack);
                self.log.err(buf);
                self.log.err('HTTP Status code:' + res.statusCode);
                var err = new Error(errorMessage + 'Error Parsing JSON: ' + e.message);
                callback(err);
                return;
            }

            callback(parsedBuf.error, parsedBuf);

        });
    });

    req.on('error', function (e) {
        var err = new Error(errorMessage + 'Request Error: ' + e.message);
        if (!called) {
            called = true;
            callback(err);
        }
    });

    req.setHeader('Content-Length', request.length);
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('Authorization', 'Basic ' + auth);
    req.write(request);
    req.end();
}

RpcClient.prototype.batch = function (batchCallback, resultCallback) {
    this.batchedCalls = [];
    batchCallback();
    rpc.call(this, this.batchedCalls, resultCallback);
    this.batchedCalls = null;
};

RpcClient.callspec = {
    abandonTransaction: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1896
    addMultiSigAddress: 'int str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1142
    addNode: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L205
    backupWallet: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1931
    clearBanned: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L617
    createMultiSig: 'int str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L400
    createRawTransaction: 'str str int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L353
    debug: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L122
    decodeRawTransaction: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L455
    decodeScript: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L521
    disconnectNode: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L251
    dumpPrivKey: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcdump.cpp#L553
    dumpWallet: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcdump.cpp#L636
    encryptWallet: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2153
    estimateFee: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L818
    estimatePriority: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L849
    estimateSmartFee: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L876
    estimateSmartPriority: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L912
    fundRawTransaction: 'str bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2640
    generate: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L126
    getAccount: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L312
    getAccountAddress: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L199
    getAddressMempool: 'obj',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L586
    getAddressUtxos: 'obj',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L657
    getAddressBalance: 'obj',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L811
    getAddressDeltas: 'obj',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L724
    getAddressTxids: 'obj',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L867
    getAddressesByAccount: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L344
    getAddedNodeInfo: 'bool str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L273
    getBalance: 'str int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L792
    getBestBlockHash: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L152
    getBlock: 'str bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L487
    getBlockchainInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L747
    getBlockCount: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L135
    getBlockHashes: 'int int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L281
    getBlockHash: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L315
    getBlockHeader: 'str bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L340
    getBlockHeaders: 'str int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L398
    getBlockTemplate: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L342
    getConnectionCount: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L31
    getChainTips: 'int int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L840
    getDifficulty: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L169
    getGenerate: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L107
    getGovernanceInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/governance.cpp#L901
    getInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L51
    getMemPoolInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L964
    getMiningInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L240
    getNewAddress: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L120
    getNetTotals: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L389
    getNetworkInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L453
    getNetworkHashps: 'int int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L85
    getPeerInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L85
    getPoolInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/masternode.cpp#L68
    getRawMemPool: 'bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L238
    getRawChangeAddress: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L231
    getRawTransaction: 'str int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L148
    getReceivedByAccount: 'str int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L703
    getReceivedByAddress: 'str int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L645
    getSpentInfo: 'obj',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L951
    getSuperBlockBudget: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/governance.cpp#L959
    getTransaction: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1815
    getTxOut: 'str int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L595
    getTxOutProof: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L239
    getTxOutSetInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L557
    getWalletInfo: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2370
    help: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/server.cpp#L224
    importAddress: 'str str bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcdump.cpp#L83
    instantSendToAddress: 'str int str str bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L480
    gobject: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/governance.cpp#L36
    invalidateBlock: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L986
    importPrivKey: 'str str bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcdump.cpp#L83
    importPubKey: 'str str bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcdump.cpp#L254
    importElectrumWallet: 'str int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcdump.cpp#L419
    importWallet: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcdump.cpp#L312
    keyPoolRefill: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1957
    listAccounts: 'int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1641
    listAddressGroupings: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L538
    listBanned: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L587
    listReceivedByAccount: 'int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1374
    listReceivedByAddress: 'int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1335
    listSinceBlock: 'str int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1720
    listTransactions: 'str int int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1512
    listUnspent: 'int int str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2524
    listLockUnspent: 'bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2294
    lockUnspent: 'bool str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2210
    masternode: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/masternode.cpp#L111
    masternodeBroadcast: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/masternode.cpp#L596
    masternodelist: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/masternode.cpp#L446
    mnsync: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L146
    move: 'str str float int str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L883
    ping: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L49
    prioritiseTransaction: 'str float int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L284
    privateSend: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/masternode.cpp#L28,
    protx: 'str str str',//https://github.com/dashevo/dash/blob/73ed410715e70d43214400cfdce0186ad31468be/src/rpc/rpcevo.cpp#L616
    reconsiderBlock: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L1024
    resendWalletTransactions: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2499
    sendFrom: 'str str float int str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L956
    sendMany: 'str obj int str str bool bool',  //https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L1020
    sendRawTransaction: 'str bool bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L825
    sendToAddress: 'str float str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L413
    sentinelPing: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/masternode.cpp#L820
    setAccount: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L266
    setBan: 'str str int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/net.cpp#L524
    setGenerate: 'bool int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L196
    setTxFee: 'float',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2343
    setMockTime: 'int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L497
    spork: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L259
    signMessage: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L589
    signRawTransaction: 'str str str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L583
    stop: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/server.cpp#L245
    submitBlock: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/mining.cpp#L757,
    validateAddress: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L269
    verifyMessage: 'str str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/misc.cpp#L443
    verifyChain: 'int int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/blockchain.cpp#L677
    verifyTxOutProof: 'str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/rawtransaction.cpp#L320
    voteRaw: 'str int',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/rpc/governance.cpp#L840
    waitForNewBlock: 'int', //https://github.com/dashpay/dash/blob/develop/src/rpc/blockchain.cpp#L204
    walletLock: '',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2114
    walletPassPhrase: 'str int bool',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2001
    walletPassphraseChange: 'str str',//https://github.com/dashpay/dash/blob/v0.12.2.x/src/wallet/rpcwallet.cpp#L2068
};

var slice = function (arr, start, end) {
    return Array.prototype.slice.call(arr, start, end);
};

function generateRPCMethods(constructor, apiCalls, rpc) {
    function createRPCMethod(methodName, argMap) {
        return function () {
            var limit = arguments.length - 1;

            if (this.batchedCalls) {
                limit = arguments.length;
            }

            for (var i = 0; i < limit; i++) {
                if (argMap[i]) {
                    arguments[i] = argMap[i](arguments[i]);
                }
            }

            if (this.batchedCalls) {
                this.batchedCalls.push({
                    jsonrpc: '2.0',
                    method: methodName,
                    params: slice(arguments),
                    id: getRandomId()
                });
            } else {
                rpc.call(this, {
                    method: methodName,
                    params: slice(arguments, 0, arguments.length - 1),
                    id: getRandomId()
                }, arguments[arguments.length - 1]);
            }

        };
    };

    var types = {
        str: function (arg) {
            return arg.toString();
        },
        int: function (arg) {
            return parseFloat(arg);
        },
        float: function (arg) {
            return parseFloat(arg);
        },
        bool: function (arg) {
            return (arg === true || arg == '1' || arg == 'true' || arg.toString().toLowerCase() == 'true');
        },
        obj: function (arg) {
            if (typeof arg === 'string') {
                return JSON.parse(arg);
            }
            return arg;
        }
    };

    for (var k in apiCalls) {
        var spec = apiCalls[k].split(' ');
        for (var i = 0; i < spec.length; i++) {
            if (types[spec[i]]) {
                spec[i] = types[spec[i]];
            } else {
                spec[i] = types.str;
            }
        }
        var methodName = k.toLowerCase();
        constructor.prototype[k] = createRPCMethod(methodName, spec);
        constructor.prototype[methodName] = constructor.prototype[k];
    }

    constructor.prototype['apiCalls'] = apiCalls;

}

function getRandomId() {
    return parseInt(Math.random() * 100000);
}

generateRPCMethods(RpcClient, RpcClient.callspec, rpc);

module.exports = RpcClient;
