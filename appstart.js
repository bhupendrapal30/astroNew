var express = require('express');
var app = express();
var path = require('path');
var http = require('http').Server(app);
var authRoutes = require('./app/modules/auth/auth-routes/authRoutes');
var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

require('./database/connection');
global.__basedir = __dirname;
// allow static files
app.use(express.static(path.join(__dirname, 'public')));

const cors = require('cors');

app.use(cors({ origin: 'http://localhost:3000' }));

app.get('/', (req, res) => {
	return res.send("home page"+__dirname);
});
app.use('/api/user', authRoutes);
module.exports = http;