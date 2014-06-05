var request = require('request'),
  Faker = require('faker'),
  debug = require('debug')('person:rapportive'),
  url = require('url');

var RAPPORTIVE_BASE_URL = 'https://rapportive.com',
  RAPPORTIVE_PROFILES_BASE_URL = 'https://profiles.rapportive.com',
  BETWEEN_ATTEMPTS = 60000,
  RATE_LIMIT_MAX = 599;

module.exports = Rapportive;

function Rapportive(opt) {
  this._init(opt);
}

var fn = Rapportive.prototype;

fn._init = function (opt) {
  opt = opt || {};
  this.endpoint = opt.endpoint || RAPPORTIVE_BASE_URL;
  this.profiles_endpoint = opt.profiles_endpoint || RAPPORTIVE_PROFILES_BASE_URL;
  this.sessions = [];
};

fn._request = function (req, cb) {
  req.uri = url.resolve(
    (req.endpoint = 'profiles' ? this.profiles_endpoint : this.endpoint), req.uri);
  req.json = true;
  return request(req, cb);
};

fn.login = function (person, cb) {
  var self = this;
  self._request({uri: '/login_status?user_email=' + person.email}, function (e, r, b) {
    if (!e && r.statusCode === 200) {
      debug('+ ' + b.session_token + ' (' + person.email + ')');
      self.sessions.push({
        email: person.email,
        first_name: person.first_name,
        last_name: person.last_name,
        session_token: b.session_token,
        rate_limit_uses: 0,
        last_use: Date.now() - BETWEEN_ATTEMPTS // one minute
      });
      return cb();
    }
    cb(new Error('Login failed with status code ' + r.statusCode));
  });
};

fn.get_profile = function (email, session_token, cb) {
  var self = this;
  self._request({
    endpoint: 'profiles',
    uri: '/contacts/email/' + email,
    headers : {'X-Session-Token' : session_token}
  }, function (e, r, b) {
    if (!e && r.statusCode === 200) {
      var contact = b.contact;
      return cb({
        email: email,
        ok: true,
        rapportive: contact
      });
    }
    cb({ error: (e && e.message || true) });
  });
};

fn.get_profile_no_rate_limit = function (email, cb) {
  var self = this;
  var i = Math.floor(Math.random() * self.sessions.length);
  var session = self.sessions[i];

  if(session && session.session_token && session.rate_limit_uses !== RATE_LIMIT_MAX &&
    Date.now() - session.last_use > BETWEEN_ATTEMPTS) {
    debug('> ' + session.session_token + ' (' + session.rate_limit_uses +
      ', ' + session.email + ')');
    self.get_profile(email, session.session_token, cb);
  } else {
    if(session && session.rate_limit_uses === RATE_LIMIT_MAX) {
      debug('- ' + session.session_token);
      delete self.sessions[i];
    }

    var fakePerson = {
      first_name: Faker.Name.firstName().replace(/\W+/g, ''),
      last_name: Faker.Name.lastName().replace(/\W+/g, ''),
    };

    fakePerson.email = (fakePerson.first_name + '.' + fakePerson.last_name +
      '@gmail.com').toLowerCase();

    debug('login attempt with ' + fakePerson.email);
    self.login(fakePerson, function (err) {
      if(err) {
        debug(err);
        return cb(err);
      }
      self.get_profile_no_rate_limit(email, cb);
    });
  }
};

