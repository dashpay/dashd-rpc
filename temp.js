const client = require('./promise')

let x = new client({
    protocol: 'http',
    user: 'dash',
    pass: 'local321',
    host: '127.0.0.1',
    port: 3001,
    rejectUnauthorized : false
  })

x.getRawMemPool()
    .then(res => {
        console.log(res)
    })
    .catch(err => {
        console.log(err)
    })