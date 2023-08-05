const express = require('express');
const router = express.Router();

//Middle ware that is specific to this router
router.use(function(req, res, next) {
  //console.log('middleware');
  next();
});

// Define the home page route
router.get('/', function(req, res) {
  res.send('home page');
});

router.get('/about-us', function(req, res) {
	res.send('this is about us page.');
});

router.get('/contact-us', function(req, res) {
	res.send('this is contact us page.');
});

module.exports = router;