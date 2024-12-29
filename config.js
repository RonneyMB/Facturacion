// config.js
const express = require("express");
const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "facturacion",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const app = express();

module.exports = { db, app, express };
