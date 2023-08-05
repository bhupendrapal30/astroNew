//var models  =  require('../../../../models');
//var User = models.userdetails;
//require("dotenv").config();
var md5 = require('md5');
var jwt = require('jsonwebtoken');
const env = require('../../../config/config');
var masters = require(process.cwd() + '/models/api/masters');
var apiModel = require(process.cwd() +'/models/api/apiModel');
module.exports = {
	getUserById: async function(req, res) {   
    var password = md5(req.body.data.password); 
    var mobileNo =req.body.data.mobileNo; 
                       var result = await masters.get_definecol_bytbl_cond(['id','fname','lname','mobileNo','email','usertype','status','password'], 'users', { mobileNo: mobileNo, status: 1 ,password:password});
                       if(result.length > 0 && result[0].password===password){
                        var usertype = result[0].usertype;
                        var userData= {
                            id: result
                        }
                var token = jwt.sign(userData, env.secretKey, {
                    expiresIn: 86400 // expires in 24 hours
                });
                    var joins = [
                      {
                          table: 'roles as roles',
                          condition: ['permission.roleid', '=', 'roles.id'],
                          jointype: 'LEFT'
                      },
                      {
                        table: 'modules',
                        condition: ['permission.moduleid', '=', 'modules.id'],
                        jointype: 'LEFT'
                    }
                  ];
                  var orderby = 'permission.createddate DESC';
                  var where = {'permission.status':1,'roleid':usertype};
                  var extra_whr = '';
                  var limit_arr = '';
                  var columns = ['permission.id','permission.roleid','permission.moduleid','permission.addedit','permission.view','permission.deleteflag','permission.status','roles.name as rolename','modules.name as modulesname'];
                 // var limit_arr = { 'limit': 10, 'offset': 1 };
                 var limit_arr = {}
                  var result1 = await apiModel.get_joins_records('permission', columns, joins, where, orderby, extra_whr, limit_arr);
                    userData.id[0].per=result1;
                  
                res.status(200).json({status: true, message: 'records successfully fetched', data: token, userData:userData,permissionlist:result1});
            }
            else{
                res.status(422).json({status: false, error: 'Please check the mobile or password'}); 
           }            
   
    }
};