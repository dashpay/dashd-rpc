function promisify(callbackFn) {

    return function (...args) {
        return new Promise((resolve, reject) => {

            // Append the callback bound to the context
            args.push(function callback(err, ...values) {

                if (err) {
                    reject(err);
                }
                else{
                    resolve(values);
                }
            });

            // Call the function.
            callbackFn.call(this, ...args);
        });
    };
}

module.exports = promisify