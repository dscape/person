var Writable = require('stream').Writable;
var Rapportive = require('./rapportive');

module.exports = function PersonStream() {
  var ws = Writable();
  var rClient = new Rapportive();

  ws._write = function (chunk, enc, next) {
    rClient.get_profile_no_rate_limit(chunk, function (person) {
      console.log(JSON.stringify(person));
    });
    next();
  };

  return ws;
};
