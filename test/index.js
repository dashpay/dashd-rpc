'use strict';

var chai = require('chai');
var RpcClient = require('../');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var should = chai.should();
var http = require('http');
var https = require('https');
var async = require('async');

if(!setImmediate) setImmediate = setTimeout;

describe('RpcClient', function() {

  it('should initialize the main object', function() {
    should.exist(RpcClient);
  });

  it('should be able to create instance', function() {
    var s = new RpcClient();
    should.exist(s);
  });

  it('default to rejectUnauthorized as true', function() {
    var s = new RpcClient();
    should.exist(s);
    s.rejectUnauthorized.should.equal(true);
  });

  it('should be able to define a custom logger', function() {
    var customLogger = {
      info: function(){},
      warn: function(){},
      err: function(){},
      debug: function(){}
    };
    RpcClient.config.log = customLogger;
    var s = new RpcClient();
    s.log.should.equal(customLogger);
    RpcClient.config.log = false;
  });

  it('should be able to define the logger to normal', function() {
    RpcClient.config.logger = 'normal';
    var s = new RpcClient();
    s.log.should.equal(RpcClient.loggers.normal);
  });

  it('should be able to define the logger to none', function() {
    RpcClient.config.logger = 'none';
    var s = new RpcClient();
    s.log.should.equal(RpcClient.loggers.none);
  });

  function FakeResponse(){
    EventEmitter.call(this);
  }
  util.inherits(FakeResponse, EventEmitter);

  function FakeRequest(){
    EventEmitter.call(this);
    return this;
  }
  util.inherits(FakeRequest, EventEmitter);
  FakeRequest.prototype.setHeader = function() {};
  FakeRequest.prototype.write = function(data) {
    this.data = data;
  };
  FakeRequest.prototype.end = function() {};

  it('should use https', function() {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      port: 8332,
    });
    client.protocol.should.equal(https);

  });

  it('should use http', function() {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      protocol: 'http'
    });
    client.protocol.should.equal(http);

  });

  it('should call a method and receive response', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      var req =  new FakeRequest();
      setImmediate(function(){
        res.emit('data', '{}');
        res.emit('end');
      });
      callback(res);
      return req;
    });

    client.setTxFee(0.01, function(error, parsedBuf) {
      requestStub.restore();
      should.not.exist(error);
      should.exist(parsedBuf);
      done();
    });

  });

  it('accept many values for bool', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: false
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      var req = new FakeRequest();
      setImmediate(function(){
        res.emit('data', req.data);
        res.emit('end');
      });
      callback(res);
      return req;
    });

    async.eachSeries([true, 'true', 1, '1', 'True'], function(i, next) {
      client.importAddress('n28S35tqEMbt6vNad7A5K3mZ7vdn8dZ86X', '', i, function(error, parsedBuf) {
        should.not.exist(error);
        should.exist(parsedBuf);
        parsedBuf.params[2].should.equal(true);
        next();
      });
    }, function(err) {
      requestStub.restore();
      done();
    });

  });

  it('should process int_str arguments', async () => {
    const client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: false,
    });

    const requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      const res = new FakeResponse();
      const req = new FakeRequest();
      setImmediate(() => {
        res.emit('data', req.data);
        res.emit('end');
      });
      callback(res);
      return req;
    });

    const blockByHeight = await (new Promise((res) => client.getBlockStats(1, ['height'], (err, data) => res(data))));

    should.exist(blockByHeight);
    blockByHeight.params[0].should.equal(1);
    blockByHeight.params[1].should.deep.equal(['height']);

    const blockByHash = await (new Promise((res) => client.getBlockStats('fake_hash', ['height'], (err, data) => res(data))));

    should.exist(blockByHash);
    blockByHash.params[0].should.equal('fake_hash');
    blockByHash.params[1].should.deep.equal(['height']);

    requestStub.restore();
  });

  describe('argument types', function() {
    var client;
    var requestStub;

    beforeEach(function() {
      client = new RpcClient({
        user: 'user',
        pass: 'pass',
        host: 'localhost',
        port: 8332,
      });

      requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
        var res = new FakeResponse();
        var req = new FakeRequest();
        setImmediate(function(){
          res.emit('data', req.data);
          res.emit('end');
        });
        callback(res);
        return req;
      });
    });

    afterEach(function() {
      requestStub.restore();
    });

    function call(method) {
      var args = Array.prototype.slice.call(arguments, 1);
      return new Promise(function(resolve, reject) {
        client[method].apply(client, args.concat(function(err, data) {
          if (err) return reject(err);
          resolve(data.params);
        }));
      });
    }

    it('should convert quorum arguments by subcommand', async function() {
      (await call('quorum', 'info', '6', 'hash', 'true')).should.deep.equal(['info', 6, 'hash', true]);
      (await call('quorum', 'list', '5')).should.deep.equal(['list', 5]);
      (await call('quorum', 'memberof', 'protx', '3')).should.deep.equal(['memberof', 'protx', 3]);
      (await call('quorum', 'verify', 4, 'id', 'msg', 'sig', 'hash', '100'))
        .should.deep.equal(['verify', 4, 'id', 'msg', 'sig', 'hash', 100]);
    });

    it('should convert protx, gobject and masternode arguments by subcommand', async function() {
      (await call('protx', 'list', 'valid', 'true', '1000')).should.deep.equal(['list', 'valid', true, 1000]);
      (await call('protx', 'register', 'hash', '1', ['1.2.3.4:9999'], 'owner', 'op', 'vote', '0', 'payout', 'fee', 'false'))
        .should.deep.equal(['register', 'hash', 1, ['1.2.3.4:9999'], 'owner', 'op', 'vote', '0', 'payout', 'fee', false]);
      (await call('gobject', 'prepare', '0', '1', '1700000000', 'hex'))
        .should.deep.equal(['prepare', '0', 1, 1700000000, 'hex']);
      (await call('masternode', 'winners', '10')).should.deep.equal(['winners', 10]);
    });

    it('should pass arguments of unknown subcommands as is', async function() {
      (await call('protx', 'shared_sign', 'hex', true)).should.deep.equal(['shared_sign', 'hex', true]);
    });

    it('should accept verbosity as number or bool', async function() {
      (await call('getBlock', 'hash', 2)).should.deep.equal(['hash', 2]);
      (await call('getBlock', 'hash', true)).should.deep.equal(['hash', true]);
      (await call('getRawTransaction', 'txid', true)).should.deep.equal(['txid', true]);
      (await call('getRawTransaction', 'txid', '1')).should.deep.equal(['txid', 1]);
    });

    it('should leave null arguments as is', async function() {
      (await call('sendToAddress', 'addr', 1, null, null, true))
        .should.deep.equal(['addr', 1, null, null, true]);
    });
  });

  it('should batch calls for a method and receive a response', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: false
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      setImmediate(function(){
        res.emit('data', '[{}, {}, {}]');
        res.emit('end');
      });
      callback(res);
      return new FakeRequest();
    });

    client.batchedCalls = [];
    client.listReceivedByAccount(1, true);
    client.listReceivedByAccount(2, true);
    client.listReceivedByAccount(3, true);
    client.batchedCalls.length.should.equal(3);
    client.batch(function(){
      // batch started
    }, function(error, result){
      // batch ended
      requestStub.restore();
      should.not.exist(error);
      should.exist(result);
      result.length.should.equal(3);
      done();
    });

  });

  it('should handle connection rejected 401 unauthorized', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      res.statusCode = 401;
      setImmediate(function(){
        res.emit('end');
      });
      callback(res);
      return new FakeRequest();
    });

    client.getBalance('n28S35tqEMbt6vNad7A5K3mZ7vdn8dZ86X', 6, function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Dash JSON-RPC: Connection Rejected: 401 Unnauthorized');
      done();
    });

  });

  it('should handle connection rejected 401 forbidden', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      res.statusCode = 403;
      setImmediate(function(){
        res.emit('end');
      });
      callback(res);
      return new FakeRequest();
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Dash JSON-RPC: Connection Rejected: 403 Forbidden');
      done();
    });

  });

  it('should handle 500 work limit exceeded error', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      res.statusCode = 500;
      setImmediate(function(){
        res.emit('data', 'Work queue depth exceeded');
        res.emit('end');
      });
      callback(res);
      return new FakeRequest();
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Dash JSON-RPC: Work queue depth exceeded');
      done();
    });

  });

  it('should handle EPIPE error case 1', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var req = new FakeRequest();
      setImmediate(function(){
        req.emit('error', new Error('write EPIPE'));
      });
      var res = new FakeResponse();
      setImmediate(function(){
        res.emit('data', '{}');
        res.emit('end');
      });
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Dash JSON-RPC: Request Error: write EPIPE');
      done();
    });

  });

  it('should handle EPIPE error case 2', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      setImmediate(function(){
        res.emit('data', '{}');
        res.emit('end');
      });
      var req = new FakeRequest();
      setImmediate(function(){
        req.emit('error', new Error('write EPIPE'));
      });
      callback(res);
      req.on('error', function(err) {
        requestStub.restore();
        done();
      });
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {});

  });

  it('should handle ECONNREFUSED error', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      var req = new FakeRequest();
      setImmediate(function(){
        req.emit('error', new Error('connect ECONNREFUSED'));
      });
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Dash JSON-RPC: Request Error: connect ECONNREFUSED');
      done();
    });

  });

  it('should callback with error if invalid json', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      setImmediate(function(){
        res.emit('data', 'not a json string');
        res.emit('end');
      });
      var req = new FakeRequest();
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Dash JSON-RPC: Error Parsing JSON: Unexpected token o in JSON at position 1');
      done();
    });

  });

  it('should callback with error if blank response', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      setImmediate(function(){
        res.emit('data', '');
        res.emit('end');
      });
      var req = new FakeRequest();
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      requestStub.restore();
      should.exist(error);
      error.message.should.equal('Dash JSON-RPC: Error Parsing JSON: Unexpected end of JSON input');
      done();
    });

  });

  it('should add additional http options', function(done) {

    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    client.httpOptions = {
      port: 20001
    };

    var calledPort = false;

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      calledPort = options.port;
      var res = new FakeResponse();
      setImmediate(function(){
        res.emit('data', '{}');
        res.emit('end');
      });
      var req = new FakeRequest();
      callback(res);
      return req;
    });

    client.getDifficulty(function(error, parsedBuf) {
      should.not.exist(error);
      should.exist(parsedBuf);
      calledPort.should.equal(20001);
      requestStub.restore();
      done();
    });

  });

  it('should throw error when timeout is triggered', (done) => {
    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
    });

    client.httpOptions = {
      timeout: 100
    };

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function (options, callback) {
      var req = new FakeRequest();
      setTimeout(function () {
        req.emit('timeout');
      }, options.timeout);
      return req;
    });

    client.getDifficulty((error, parsedBuf) => {
      should.exist(error);
      should.not.exist(parsedBuf);
      error.message.should.equal(`Timeout Error: ${client.httpOptions.timeout}ms exceeded`);
      requestStub.restore();
      done();
    })
  });

  it('should call wallet method and receive the response', (done) => {
    var client = new RpcClient({
      user: 'user',
      pass: 'pass',
      host: 'localhost',
      port: 8332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    var requestStub = sinon.stub(client.protocol, 'request').callsFake(function(options, callback){
      var res = new FakeResponse();
      var req =  new FakeRequest();
      setImmediate(function(){
        res.emit('data', '{}');
        res.emit('end');
      });
      callback(res);
      return req;
    });

    client.getBalance('n28S35tqEMbt6vNad7A5K3mZ7vdn8dZ86X', 6, { wallet: 'default' }, function(error, parsedBuf) {
      requestStub.restore();
      should.not.exist(error);
      should.exist(parsedBuf);
      done();
    });
  });
})
