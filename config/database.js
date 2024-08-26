const mongoose = require('mongoose');

const { MONGO_DB_URI } = process.env;

const dbConnection = () => {
  mongoose
    .connect(MONGO_DB_URI)
    .then((conn) => {
      console.log(`Database Connected on host: ${conn.connection.host}`);
    })
    .catch((err) => {
      console.error(`Database Error: ${err}`);
      process.exit(1);
    });
};

module.exports = dbConnection;
