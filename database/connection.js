const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
var moment = require('moment');
const Op = Sequelize.Op;

//var sequelize = new Sequelize(config.database, config.username, config.password, config);
var sequelize = new Sequelize(config.database, config.username, config.password, config, {
  pool: {
    max: 99,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

sequelize.authenticate().then(() => {
  console.log('Connection established successfully.');
}).catch(err => {
  console.error('Unable to connect to the database:', err);
});

module.exports = sequelize;
global.sequelize = sequelize;
global.Op = Op;

//knexjs
var knex = require('knex')({
  client: 'mysql',
  connection: {
    host : config.host,
    user : config.username,
    password : config.password,
    database: config.database,
    connectTimeout: 90000,
    typeCast: function (field, next) {
      if (field.type == 'DATETIME' || field.type == 'TIMESTAMP') {              
        var convertedDateTime = moment(field.string()).format('YYYY-MM-DD HH:mm:ss');
        return convertedDateTime != "Invalid date" ? convertedDateTime: null;
      }
      else if (field.type == 'DATE') {
        var convertedDate = moment(field.string()).format('YYYY-MM-DD');
        return convertedDate != "Invalid date" ? convertedDate: null;
      }
      return next();
    }
  }
  ,
  pool: { min: 0, max: 99 }
});

// knex.on('query', function(query) {
// 	console.log(query.sql);
// });

global.knex = knex;
