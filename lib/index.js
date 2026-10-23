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
  abandonTransaction: 'str',
  addMultiSigAddress: 'int obj str',
  addNode: 'str str bool',
  backupWallet: 'str',
  clearBanned: '',
  createMultiSig: 'int obj',
  createRawTransaction: 'obj obj int',
  createWallet: 'str bool bool str bool bool bool bool',
  debug: 'str',
  decodeRawTransaction: 'str',
  decodeScript: 'str',
  disconnectNode: 'str int',
  dumpPrivKey: 'str',
  dumpWallet: 'str',
  encryptWallet: 'str',
  estimateFee: 'int',
  estimatePriority: 'int',
  estimateSmartFee: 'int str',
  estimateSmartPriority: 'int',
  fundRawTransaction: 'str obj',
  generate: 'int',
  generateToAddress: 'int str int',
  getAccount: 'str',
  getAccountAddress: 'str',
  getAddressMempool: 'obj',
  getAddressUtxos: 'obj',
  getAddressBalance: 'obj',
  getAddressDeltas: 'obj',
  getAddressTxids: 'obj',
  getAddressesByAccount: '',
  getAddedNodeInfo: 'str',
  getBalance: 'str int bool bool bool',
  getBestBlockHash: '',
  getBestChainLock: '',
  getBlock: 'str int_bool',
  getBlockchainInfo: '',
  getBlockCount: '',
  getBlockHashes: 'int int',
  getBlockHash: 'int',
  getBlockHeader: 'str bool',
  getBlockHeaders: 'str int bool',
  getBlockStats: 'int_str obj',
  getBlockTemplate: 'obj',
  getConnectionCount: '',
  getChainTips: 'int int',
  getDifficulty: '',
  getGenerate: '',
  getGovernanceInfo: '',
  getInfo: '',
  getMemPoolInfo: '',
  getMerkleBlocks: 'str str int',
  getMiningInfo: '',
  getNewAddress: 'str',
  getNetTotals: '',
  getNetworkInfo: '',
  getNetworkHashps: 'int int',
  getPeerInfo: '',
  getPoolInfo: '',
  getRawMemPool: 'bool bool',
  getRawChangeAddress: '',
  getRawTransaction: 'str int_bool str',
  getRawTransactionMulti: 'obj int_bool',
  getReceivedByAccount: 'str int',
  getReceivedByAddress: 'str int bool bool',
  getSpentInfo: 'obj',
  getSuperBlockBudget: 'int',
  getTransaction: 'str bool bool',
  getTxOut: 'str int bool',
  getTxOutProof: 'obj str',
  getTxOutSetInfo: 'str int_str bool',
  getWalletInfo: '',
  help: 'str str',
  importAddress: 'str str bool bool',
  instantSendToAddress: 'str int str str bool',
  gobject: {
    check: 'str str',
    count: 'str str',
    deserialize: 'str str',
    diff: 'str str str',
    get: 'str str',
    getcurrentvotes: 'str str str str',
    list: 'str str str',
    'list-prepared': 'str int',
    prepare: 'str str int int str bool str int',
    submit: 'str str int int str str',
    'vote-alias': 'str str str str str',
    'vote-many': 'str str str str',
  },
  invalidateBlock: 'str',
  importPrivKey: 'str str bool',
  importPubKey: 'str str bool',
  importElectrumWallet: 'str int',
  importWallet: 'str',
  keyPoolRefill: 'int',
  listAccounts: 'int bool',
  listAddressGroupings: '',
  listBanned: '',
  listReceivedByAccount: 'int bool',
  listReceivedByAddress: 'int bool bool bool str bool',
  listSinceBlock: 'str int bool bool bool str',
  listTransactions: 'str int int bool',
  listUnspent: 'int int obj bool obj',
  listLockUnspent: '',
  lockUnspent: 'bool obj bool',
  masternode: {
    connect: 'str str bool',
    count: 'str',
    list: 'str str str',
    outputs: 'str',
    payments: 'str str int',
    status: 'str',
    winners: 'str int str',
  },
  masternodeBroadcast: 'str',
  masternodelist: 'str str',
  mnsync: 'str',
  move: 'str str float int str',
  ping: '',
  prioritiseTransaction: 'str int',
  privateSend: 'str',
  protx: {
    diff: 'str str str bool',
    info: 'str str str',
    list: 'str str bool int',
    listdiff: 'str str str',
    register: 'str str int any str str str str any str bool',
    register_evo: 'str str int any str str str str any str any any str bool',
    register_fund: 'str str any str str str str any str bool',
    register_fund_evo: 'str str any str str str str any str any any str bool',
    register_fund_legacy: 'str str any str str str str any str bool',
    register_legacy: 'str str int any str str str str any str bool',
    register_prepare: 'str str int any str str str str any str',
    register_prepare_evo: 'str str int any str str str str any str any any str',
    register_prepare_legacy: 'str str int any str str str str any str',
    register_submit: 'str str str',
    revoke: 'str str str int str bool',
    update_registrar: 'str str str str any str bool',
    update_registrar_legacy: 'str str str str any str bool',
    update_service: 'str str any str str str bool',
    update_service_evo: 'str str any str str any any str str bool',
  },
  quorum: {
    dkginfo: 'str str',
    dkgsimerror: 'str str float',
    dkgstatus: 'str int',
    getdata: 'str int int str int str',
    getrecsig: 'str int str str',
    hasrecsig: 'str int str str',
    info: 'str int str bool',
    isconflicting: 'str int str str',
    list: 'str int',
    listextended: 'str int',
    memberof: 'str str int',
    platformsign: 'str str str str bool',
    rotationinfo: 'str str bool obj',
    selectquorum: 'str int str',
    sign: 'str int str str str bool',
    verify: 'str int str str str str int',
  },
  reconsiderBlock: 'str bool',
  resendWalletTransactions: '',
  sendFrom: 'str str float int str str',
  sendMany: 'str obj int bool str obj bool bool int str float bool',
  sendRawTransaction: 'str float bool bool',
  sendToAddress: 'str float str str bool bool bool int str bool float bool',
  sentinelPing: 'str',
  setAccount: '',
  setBan: 'str str int bool',
  setGenerate: 'bool int',
  setTxFee: 'float',
  setMockTime: 'int',
  spork: 'str',
  sporkupdate: 'str int',
  signMessage: 'str str',
  signRawTransaction: 'str str str str',
  stop: 'int',
  submitBlock: 'str str',
  validateAddress: 'str',
  verifyMessage: 'str str str',
  verifyChain: 'int int',
  verifyChainLock: 'str str int',
  verifyIsLock: 'str str str int',
  verifyTxOutProof: 'str',
  voteRaw: 'str int str str str int str',
  waitForNewBlock: 'int',
  waitForBlockHeight: 'int int',
  walletLock: '',
  walletPassPhrase: 'str int bool',
  walletPassphraseChange: 'str str',
  getUser: 'str',
};

const slice = function (arr, start, end) {
  return Array.prototype.slice.call(arr, start, end);
};

function generateRPCMethods(constructor, apiCalls, rpc) {
  function createRPCMethod(methodName, argSpec) {
    return function () {
      let path = '/';
      let slicedArguments = slice(arguments);

      const length = slicedArguments.length;

      // The last optional parameter of requested method is a wallet name. We don't want to pass it to core,
      // that's why we remove it. And since the latest parameter here is a callback, we use length - 2,
      // instead of length - 1
      if (length > 0 && typeof slicedArguments[length - 2] === 'object' && slicedArguments[length - 2].wallet) {
        path = '/wallet/' + slicedArguments[length - 2].wallet;
        slicedArguments.splice(length - 2, 1);
      }

      let limit = slicedArguments.length - 1;

      if (this.batchedCalls) {
        limit = slicedArguments.length;
      }

      // Composite commands (quorum, protx, ...) have argument types that depend on the subcommand.
      // Unknown subcommands only get the subcommand name converted, the rest is passed as is.
      let argMap = argSpec;
      if (!Array.isArray(argSpec)) {
        const subcommand = typeof slicedArguments[0] === 'string' ? slicedArguments[0].toLowerCase() : '';
        argMap = Object.prototype.hasOwnProperty.call(argSpec, subcommand) ? argSpec[subcommand] : [types.str];
      }

      for (let i = 0; i < limit; i++) {
        // null and undefined are left as is, so optional arguments can be skipped
        if (argMap[i] && slicedArguments[i] !== null && slicedArguments[i] !== undefined) {
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
    int_bool(arg) {
      if (typeof arg === 'boolean') {
        return arg;
      }

      if (arg === 'true' || arg === 'false') {
        return arg === 'true';
      }

      return parseFloat(arg);
    },
    float(arg) {
      return parseFloat(arg);
    },
    any(arg) {
      return arg;
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

  function parseSpec(specString) {
    const spec = specString.split(' ');
    for (let i = 0; i < spec.length; i++) {
      if (types[spec[i]]) {
        spec[i] = types[spec[i]];
      } else {
        spec[i] = types.str;
      }
    }
    return spec;
  }

  for (const k in apiCalls) {
    let spec;
    if (typeof apiCalls[k] === 'string') {
      spec = parseSpec(apiCalls[k]);
    } else {
      spec = {};
      for (const subcommand in apiCalls[k]) {
        spec[subcommand] = parseSpec(apiCalls[k][subcommand]);
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
