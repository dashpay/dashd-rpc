/* eslint-disable */

const http = require('http');
const https = require('https');
const async = require('async');

function RpcClient(opts) {
  opts = opts || {};
  this.host = opts.host || '127.0.0.1';
  this.port = opts.port || 9998;
  this.user = opts.user || 'user';
  this.pass = opts.pass || 'pass';
  this.timeout = opts.timeout;
  this.protocol = opts.protocol === 'http' ? http : https;
  this.batchedCalls = null;
  this.disableAgent = opts.disableAgent || false;
  const queueSize = opts.queue || 16;

  const isRejectUnauthorized = typeof opts.rejectUnauthorized !== 'undefined';
  this.rejectUnauthorized = isRejectUnauthorized ? opts.rejectUnauthorized : true;

  if (RpcClient.config.log) {
    this.log = RpcClient.config.log;
  } else {
    this.log = RpcClient.loggers[RpcClient.config.logger || 'normal'];
  }

  this.queue = async.queue((task, callback) => {
    task(callback);
  }, queueSize);
}

const cl = console.log.bind(console);

const noop = function () {
};

RpcClient.loggers = {
  none: {
    info: noop, warn: noop, err: noop, debug: noop,
  },
  normal: {
    info: cl, warn: cl, err: cl, debug: noop,
  },
  debug: {
    info: cl, warn: cl, err: cl, debug: cl,
  },
};

RpcClient.config = {
  logger: 'normal', // none, normal, debug,
};

function rpc(request, callback) {
  const self = this;
  const task = function (taskCallback) {
    const newCallback = function () {
      callback.apply(undefined, arguments);
      taskCallback();
    };
    innerRpc.call(self, request, newCallback);
  };

  this.queue.push(task);
}
function innerRpc(request, callback) {
  const self = this;
  const path = request.path;
  delete request.path;
  request = JSON.stringify(request);
  const auth = Buffer.from(`${self.user}:${self.pass}`).toString('base64');

  const options = {
    host: self.host,
    path,
    method: 'POST',
    port: self.port,
    rejectUnauthorized: self.rejectUnauthorized,
    agent: self.disableAgent ? false : undefined,
  };

  if (self.timeout) {
    options.timeout = self.timeout;
  };

  if (self.httpOptions) {
    for (const k in self.httpOptions) {
      options[k] = self.httpOptions[k];
    }
  }

  let called = false;

  const errorMessage = 'Dash JSON-RPC: ';

  const req = this.protocol.request(options, (res) => {
    let buf = '';
    res.on('data', (data) => {
      buf += data;
    });

    res.on('end', () => {
      if (called) {
        return;
      }
      called = true;

      if (res.statusCode === 401) {
        callback(new Error(`${errorMessage}Connection Rejected: 401 Unnauthorized`));
        return;
      }
      if (res.statusCode === 403) {
        callback(new Error(`${errorMessage}Connection Rejected: 403 Forbidden`));
        return;
      }
      if (res.statusCode === 403) {
        callback(new Error(`${errorMessage}Connection Rejected: 403 Forbidden`));
        return;
      }

      if (res.statusCode === 500 && buf.toString('utf8') === 'Work queue depth exceeded') {
        const exceededError = new Error(`Dash JSON-RPC: ${buf.toString('utf8')}`);
        exceededError.code = 429; // Too many requests
        callback(exceededError);
        return;
      }

      let parsedBuf;
      try {
        parsedBuf = JSON.parse(buf);
      } catch (e) {
        self.log.err(e.stack);
        self.log.err(buf);
        self.log.err(`HTTP Status code:${res.statusCode}`);
        const err = new Error(`${errorMessage}Error Parsing JSON: ${e.message}`);
        callback(err);
        return;
      }

      callback(parsedBuf.error, parsedBuf);
    });
  });

  req.on('error', (e) => {
    const err = new Error(`${errorMessage}Request Error: ${e.message}`);
    if (!called) {
      called = true;
      callback(err);
    }
  });

  req.on('timeout', () => {
    const err = new Error(`Timeout Error: ${options.timeout}ms exceeded`);
    called = true;
    callback(err);
  });

  req.setHeader('Content-Length', request.length);
  req.setHeader('Content-Type', 'application/json');
  req.setHeader('Authorization', `Basic ${auth}`);
  req.write(request);
  req.end();
}

RpcClient.prototype.batch = function (batchCallback, resultCallback) {
  this.batchedCalls = [];
  batchCallback();
  rpc.call(this, this.batchedCalls, resultCallback);
  this.batchedCalls = null;
};

RpcClient.prototype.setTimeout = function (timeout) {
  this.timeout = timeout;
}

// For definitions of RPC calls, see various files in: https://github.com/dashpay/dash/tree/master/src
RpcClient.callspec = {
  addNode: 'str str',
  clearBanned: '',
  createMultiSig: 'int str',
  createRawTransaction: 'str str int',
  createWallet: 'str bool bool str bool bool',
  debug: 'str',
  decodeRawTransaction: 'str',
  decodeScript: 'str',
  disconnectNode: 'str',
  estimateFee: 'int',
  estimatePriority: 'int',
  estimateSmartFee: 'int',
  estimateSmartPriority: 'int',
  fundRawTransaction: 'str bool',
  generate: 'int',
  generateToAddress: 'int str',
  getAccount: 'str',
  getAccountAddress: 'str',
  getAddressMempool: 'obj',
  getAddressUtxos: 'obj',
  getAddressBalance: 'obj',
  getAddressDeltas: 'obj',
  getAddressTxids: 'obj',
  getAddressesByAccount: '',
  getAddedNodeInfo: 'bool str',
  getBestBlockHash: '',
  getBestChainLock: '',
  getBlock: 'str bool',
  getBlockchainInfo: '',
  getBlockCount: '',
  getBlockHashes: 'int int',
  getBlockHash: 'int',
  getBlockHeader: 'str bool',
  getBlockHeaders: 'str int bool',
  getBlockStats: 'int_str obj',
  getBlockTemplate: '',
  getConnectionCount: '',
  getChainTips: 'int int',
  getDifficulty: '',
  getGenerate: '',
  getGovernanceInfo: '',
  getInfo: '',
  getMemPoolInfo: '',
  getMerkleBlocks: 'str str int',
  getMiningInfo: '',
  getNetTotals: '',
  getNetworkInfo: '',
  getNetworkHashps: 'int int',
  getPeerInfo: '',
  getPoolInfo: '',
  getRawMemPool: 'bool',
  getRawTransaction: 'str int',
  getReceivedByAccount: 'str int',
  getSpentInfo: 'obj',
  getSuperBlockBudget: 'int',
  getTxOut: 'str int bool',
  getTxOutProof: 'str str',
  getTxOutSetInfo: '',
  help: 'str',
  gobject: 'str str',
  invalidateBlock: 'str',
  listAccounts: 'int bool',
  listBanned: '',
  listReceivedByAccount: 'int bool',
  masternodeBroadcast: 'str',
  masternodelist: 'str str',
  mnsync: '',
  move: 'str str float int str',
  ping: '',
  prioritiseTransaction: 'str float int',
  privateSend: 'str',
  quorum: 'str int str str str str int',
  reconsiderBlock: 'str',
  resendWalletTransactions: '',
  sendFrom: 'str str float int str str',
  sendRawTransaction: 'str float bool',
  sentinelPing: 'str',
  setAccount: '',
  setBan: 'str str int bool',
  setGenerate: 'bool int',
  setMockTime: 'int',
  spork: 'str',
  sporkupdate: 'str int',
  signRawTransaction: 'str str str str',
  stop: '',
  submitBlock: 'str str',
  validateAddress: 'str',
  verifyMessage: 'str str str',
  verifyChain: 'int int',
  verifyChainLock: 'str str int',
  verifyIsLock: 'str str str int',
  verifyTxOutProof: 'str',
  voteRaw: 'str int',
  waitForNewBlock: 'int',
  waitForBlockHeight: 'int int',
  getUser: 'str',

  abandonTransaction: 'str',
  addMultiSigAddress: 'int str str',
  backupWallet: 'str',
  dumpPrivKey: 'str',
  dumpWallet: 'str',
  encryptWallet: 'str',
  getBalance: 'str int bool',
  getNewAddress: '',
  getRawChangeAddress: '',
  getReceivedByAddress: 'str int',
  getTransaction: '',
  getWalletInfo: '',
  importAddress: 'str str bool',
  importElectrumWallet: 'str int',
  importPrivKey: 'str str bool',
  importPubKey: 'str str bool',
  importWallet: 'str',
  keyPoolRefill: 'int',
  listAddressGroupings: '',
  listUnspent: 'int int str',
  listLockUnspent: 'bool',
  listReceivedByAddress: 'int bool',
  listSinceBlock: 'str int',
  listTransactions: 'str int int bool',
  lockUnspent: 'bool obj',
  masternode: 'str',
  protx: 'str str str',
  sendMany: 'str obj int str str bool bool',
  sendToAddress: 'str float str str',
  setTxFee: 'float',
  signMessage: 'str str',
  walletLock: '',
  walletPassPhrase: 'str int bool',
  walletPassphraseChange: 'str str',
  instantSendToAddress: 'str int str str bool',
};

const slice = function (arr, start, end) {
  return Array.prototype.slice.call(arr, start, end);
};

function generateRPCMethods(constructor, apiCalls, rpc) {
  // const lowerCasedWalletCalls = [];
  // for(const k in RpcClient.walletcallspec) {
  //   lowerCasedWalletCalls.push(k.toLowerCase());
  // }

  function createRPCMethod(methodName, argMap) {
    return function () {
      let path = '/';
      let slicedArguments = slice(arguments);

      const length = slicedArguments.length;

      if (length > 0 && typeof slicedArguments[length - 1] === 'object' && slicedArguments[length - 1].wallet) {
        path = '/wallet/' + slicedArguments[length - 1].wallet;
        slicedArguments.pop();
      }

      let limit = slicedArguments.length - 1;

      if (this.batchedCalls) {
        limit = slicedArguments.length;
      }

      for (let i = 0; i < limit; i++) {
        if (argMap[i]) {
          slicedArguments[i] = argMap[i](slicedArguments[i]);
        }
      }

      if (this.batchedCalls) {
        this.batchedCalls.push({
          path,
          jsonrpc: '2.0',
          method: methodName,
          params: slice(slicedArguments),
          id: getRandomId(),
        });
      } else {
        rpc.call(this, {
          path,
          method: methodName,
          params: slice(slicedArguments, 0, slicedArguments.length - 1),
          id: getRandomId(),
        }, arguments[arguments.length - 1]);
      }
    };
  }

  const types = {
    str(arg) {
      return arg.toString();
    },
    int(arg) {
      return parseFloat(arg);
    },
    int_str(arg) {
      if (typeof arg === 'number') {
        return parseFloat(arg)
      }

      return arg.toString()
    },
    float(arg) {
      return parseFloat(arg);
    },
    bool(arg) {
      return (arg === true || arg == '1' || arg == 'true' || arg.toString().toLowerCase() == 'true');
    },
    obj(arg) {
      if (typeof arg === 'string') {
        return JSON.parse(arg);
      }
      return arg;
    },
  };

  for (const k in apiCalls) {
    const spec = apiCalls[k].split(' ');
    for (let i = 0; i < spec.length; i++) {
      if (types[spec[i]]) {
        spec[i] = types[spec[i]];
      } else {
        spec[i] = types.str;
      }
    }
    const methodName = k.toLowerCase();
    constructor.prototype[k] = createRPCMethod(methodName, spec);
    constructor.prototype[methodName] = constructor.prototype[k];
  }

  constructor.prototype.apiCalls = apiCalls;
}

function getRandomId() {
  return parseInt(Math.random() * 100000);
}

generateRPCMethods(RpcClient, RpcClient.callspec, rpc);

module.exports = RpcClient;
