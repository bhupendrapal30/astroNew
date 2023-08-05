'use strict';
module.exports = (sequelize, DataTypes) => {
  const userdetails = sequelize.define('userdetails', {
    Name: DataTypes.STRING
  }, {});
  userdetails.associate = function(models) {
    // associations can be defined here
  };
  return userdetails;
};