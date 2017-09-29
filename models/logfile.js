'use strict';
module.exports = (sequelize, DataTypes) => {
  var Logfile = sequelize.define('Logfile', {
    src: DataTypes.STRING,
    url: DataTypes.STRING,
    type: DataTypes.STRING,
    offset: DataTypes.BIGINT,
    period: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Logfile;
};
