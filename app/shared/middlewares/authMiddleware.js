let jwt = require('jsonwebtoken');
const config = require('../../config/config');

let checkToken = (req, res, next) => {
  let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase
  if(token) {
    if (token.startsWith('Bearer ')) {
      // Remove Bearer from string
      token = token.slice(7, token.length);
    }
    else {
       return res.status(401).json({status: false, error: 'Auth token is not Bearer token'});
    }
  }
  else {
    return res.status(401).json({status: false, error: 'Auth token is not supplied'});
  }
  
  if (token) {
    let referer = '';
    if(req.headers.referer) {
      referer = req.headers.referer;
    }
    let key = config.secretKey;
    req.originType = 'enduser';
    if(referer.indexOf('admin/mfeadmin') != -1) {
      key = config.secretKeyAdmin;
      req.originType = 'mfeadmin';
    }
    jwt.verify(token, key, (err, decoded) => {
      if (err) {
        return res.status(401).json({status: false, error: 'Token is not valid'});
      } else {
        req.decoded = decoded.data;
        if(req.originType == 'mfeadmin') {
          if(req.decoded.usertype != 2) {
            return res.status(401).json({status: false, error: 'Oops! You are not authorized to access this service.'});
          }
        }
        next();
      }
    });
  } else {
    return res.status(401).json({status: false, error: 'Auth token is not supplied'});
  }
};

module.exports = {
  checkToken: checkToken
}
