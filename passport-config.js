const { Strategy, ExtractJwt } = require('passport-jwt');

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: 'wongbiasamati'
};

module.exports = passport => {
  passport
    .use(new Strategy(options, (payload, done) => {
      return done(null, payload);
    }));
};
