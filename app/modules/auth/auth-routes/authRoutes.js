const express = require('express');
const router = express.Router();
var authController = require('../controllers/authController');
let authMiddleware = require('../../../shared/middlewares/authMiddleware');

var userController = require('../controllers/userController');
const multer  = require('multer')
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
	  cb(null, './uploads/')
	},
	filename: function (req, file, cb) {
	  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
	  cb(null, file.originalname + '-' + uniqueSuffix)
	}
  })
  
  const upload = multer({ storage: storage })
//const upload = multer({ dest: 'uploads/' });
//ar cpUpload = upload.fields([{ name: 'image', maxCount: 1 }]);
router.post('/', function(req, res) {
	console.log(req.body.email);
	//var eventList =  knex.select('id').from('users').where('id',1)
	//console.log(eventList);
	res.status(200).json({message: 'this is login page.'});
});
router.post('/login', authController.getUserById);
router.post('/adduser',userController.addUser);
router.post('/questionsList', userController.questionsList);
router.post('/logout', userController.logout);
router.post('/questions',userController.questions);
router.post('/answers',userController.answerList);
router.post('/pdflist',userController.pdflist);
router.post('/pdfinsert',userController.pdfDataInsert);
router.post('/questionsinsert',userController.questionsInsert);
router.post('/order',userController.order);
router.post('/capture',userController.paymentVerify);
router.post('/orderdeatils',userController.orderdeatils);
router.post('/questionspdf',userController.questionsPdf);
router.post('/getcategory',userController.getCategory);


module.exports = router;
