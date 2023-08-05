//var models  =  require('../../../../models');
//var User = models.userdetails;
//require("dotenv").config();
var md5 = require('md5');
var jwt = require('jsonwebtoken');
const env = require('../../../config/config');
var apiModel = require(process.cwd() +'/models/api/apiModel');
var masters = require(process.cwd() + '/models/api/masters');
var multer  =   require('multer'); 
//var location = require(process.cwd()+'/upload/');
var moment = require('moment');
var httprequest = require('request-promise');
const Razorpay = require("razorpay");
const instance = new Razorpay({
    key_id: 'rzp_test_PX2vJ9ubej1UGc',
    key_secret: 'veloXiNLdQmcrfFqJUDxFeUN',
});
var PDFURL ="https://astrooffice.in:3300/api/horoscop/preduction";
var questionURL="https://astrooffice.in:3300/api/callcenter";

var storage =   multer.diskStorage({  
  destination: function (req, file, callback) {  
    callback(null, './uploads');  
  },  
  filename: function (req, file, callback) {  
    callback(null, file.originalname);  
  }  
});  

function removeTags(str) {
    if ((str===null) || (str===''))
        return false;
    else
        str = str.toString();
          
    // Regular expression to identify HTML tags in
    // the input string. Replacing the identified
    // HTML tag with a null string.
    return str.replace( /(<([^>]+)>)/ig, '');
}
module.exports = {
	addUser: async function(req, res) {  
       console.log(req.body); 
       var mobileNo =req.body.mobileNo; 
       var atype =req.body.atype;  
       var latlong = req.body.latlong;
       var latlongData =latlong.split("--");
       var ctData = req.body.placeNew; 
       var placeData= ctData.split("--");

       let insertData = {
        mobileNo : mobileNo,
        name:req.body.name, 
        dob:req.body.dob, 
        tob:req.body.tob, 
        lat:latlongData[0],
        lng:latlongData[1],
        countryName:placeData[0],
        stateName:placeData[1],
        atype:atype,
        city:placeData[2],
        createdDate:moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
      }
      var ins = await masters.common_insert('users', insertData);
      if(ins){
        let checkId = await masters.getSingleRecord('users','*', {user_id:ins});
        return res.status(200).json({ status: true, message: 'data get successfully', data:checkId,statusCode:200});
      } else {
       res.status(422).json({status: false, error: 'Please check the mobile or password'}); 
      }
    },
    questionsInsert: async function(req, res) {  
        let URL = questionURL;
        let catId =req.body.catId;
        let userId =req.body.user_id;
        let token =req.body.token;
        let userData = await masters.getSingleRecord('users','*', {user_id:userId});
        let catData = await masters.getSingleRecord('category','*', {apiId:catId});
        let questionData = await masters.getSingleRecord('questionans','*', {userid:userId,catId:catId});
        if(questionData)
        {
          return res.status(200).json({ status: true, message: 'already exist', data:"ok",statusCode:200}); 

        }else{
        let dob = userData['dob'].split("-");
        let headers = {
        'Content-Type': 'application/json',
        'authorization': 'Bearer ' + token,
        'Cache-Control': 'no-cache'
        };
      
      var options = {
          method: 'POST',
          uri: URL,
          headers:headers,
          json:true
      };
       
      options.body ={"langitutde":userData['lng'],"gender":"male","kundalitype":"kp","birthDate":{"day":dob[2],"month":dob[1] ,"year":dob[0]},
      "timezone":"5.5","language":"1","product":"143","latitude":userData['lat'],"name":userData['name'],"dst":false,"generate":true,"pob":{"placeName":userData['city'],"StateName":userData['stateName'],"countryName":"India","latitude":userData['lng'],"longitude":userData['lat'],"gmtoffset":"5.5","dstoffset":"5.5","timezone":"5.5"},"birthTime":{"hour":"8","minute":"15"},"rotatekundali":"1","currentDate":moment(new Date()).format('DD/MM/YYYY'),"currentTime":"14:03","showpdf"
:false,"showgochar":false,"ageRange":{"fromAge":"","toAge":""},"acharyaid":26083,"btntype":"viewkundali","finalyear":31,"message":"","generateKundaliProduct":"","category":catId};
     var result='';
     var resData='';
    let response = await httprequest(options).then((result)=>{
         resData =result['data']['questions1']['questions']; 
         console.log(result);
    }).catch(function (err){
        console.log(` ERROR =`,err.message);
        return err;
    });
     
     if(resData){
      i=0;
      var pdata={};
      var arr =[];
     
       for(let que of resData) {
            pdata['qid']=que['qid'];
            pdata['aid']=que['id'];
            pdata['ques']=removeTags(que['que']);
            pdata['ans']=que['ans'];
            pdata['catId']=catId;
            pdata['userid']=userId;
            pdata['catName']=catData['Name'];
            var ins = await masters.common_insert('questionans', pdata);
            i++;
            
        };

     return res.status(200).json({ status: true, message: 'data get successfully', data:"ok",statusCode:200}); 
     }else{
           return res.status(200).json({ status: true, message: 'api has given the error', data:"ok",statusCode:200}); 
     }

      return res.status(200).json({ status: true, message: 'error', data:"ok",statusCode:200}); 
    }
     
      
    },
    logout : async function(req, res) {
    },
    questions: async function(req,res){
    //   var joins = [
    //     {
    //         table: 'roles as roles',
    //         condition: ['users.usertype', '=', 'roles.id'],
    //         jointype: 'LEFT'
    //     }
    // ];
   let catId =req.body.catId;
   var finalData = {};
    var where = {};
    where['catId'] = catId;
    var extra_whr = '';
    var limit_arr = '';
    var orderby = 'id ASC';
    var columns = ['id','qid','ques'];
    var result = await masters.get_definecol_bytbl_cond_sorting(columns,'questions', where, orderby);
    return res.status(200).json({ status: true, message: 'Questions List fetched successfully', data: result, statusCode: 200});

    },
    
    questionsList:async function(req,res){
      let questionData =req.body.ques.questions;
      let catData =req.body.catIds;
      var finalData = {};
      var where ={};
      var whereIn = questionData;
     // where['deletestatus'] = 0;
      var groupby = 'catName';
      var columns = ['catId','catName'];
      var col = ['id','qid','ques','catName'];
      var response = await masters.get_definecol_bytbl_groupby(columns,'questionans', whereIn,catData,groupby );
      console.log(response);
      finalData.data = response; 
      await Promise.all(response.map(async (value) => {
        where['catId']=value.catId;
        //this.questionsData(req,res);
         var qesresponse = await masters.get_definecol_bytbl_groupbynew(col,'questionans', whereIn,where, groupby );
         Object.assign(value, {ques: qesresponse});
      }));

     
      
      return res.status(200).json({status: true, message: 'Questions list fetched successfully', data: response});

    },

    answerList:async function(req,res){
      let questionData =req.body.ques.questions;
      let catData =req.body.catIds;
      console.log(catData);
      var finalData = {};
      var where ={};
      var whereIn = questionData;
     // where['deletestatus'] = 0;
      var groupby = 'catName';
      var columns = ['catId','catName'];
      var col = ['id','qid','ques','ans','catName'];
      var response = await masters.get_definecol_bytbl_groupby(columns,'questionans', whereIn,catData,groupby );
      finalData.data = response; 
      await Promise.all(response.map(async (value) => {
        where['catId']=value.catId;
        //this.questionsData(req,res);
         var qesresponse = await masters.get_definecol_bytbl_groupbynew(col,'questionans', whereIn,where, groupby );
         Object.assign(value, {ques: qesresponse});
      }));

     
      
      return res.status(200).json({status: true, message: 'Answer list fetched successfully', data: response});

    },
    pdflist: async function(req,res){
    //   var joins = [
    //     {
    //         table: 'roles as roles',
    //         condition: ['users.usertype', '=', 'roles.id'],
    //         jointype: 'LEFT'
    //     }
    // ];
   let catId =req.body.catId;
   let userId =req.body.user_id;
   var finalData = {};
    var where = {};
    where['catId'] = catId;
    where['user_id'] = userId;
    var extra_whr = '';
    var limit_arr = '';
    var orderby = 'id ASC';
    var columns = ['id','qid','ques'];
    var result = await masters.get_definecol_bytbl_cond_sorting('*','pdffile', where, orderby);
    return res.status(200).json({ status: true, message: 'Pdf file fetched successfully', data: result, statusCode: 200});

    },

    pdfDataInsert: async function(req,res){
        let catId =req.body.catId;
        let userId =req.body.user_id;
        let token =req.body.token;
        let userData = await masters.getSingleRecord('users','*', {user_id:userId});
        let catData = await masters.getSingleRecord('pdffile','*', {user_id:userId,catId:catId});
        let dob = userData['dob'].split("-");

        var jsonData= {"langitutde":userData['lng'],"gender":"male","kundalitype":"kp","birthDate":{"day":dob[2],"month":dob[1] ,"year":dob[0]},
        "timezone":"5.5","language":"1","product":"143","latitude":userData['lat'],"name":userData['name'],"dst":false,"generate":true,
        "pob":{"placeName":userData['city'],"StateName":userData['stateName'],"countryName":"India","latitude":userData['lng'],"longitude":userData['lat'],"gmtoffset":"5.5","dstoffset":"5.5","timezone":"5.5"},
        "birthTime":{"hour":"8","minute":"15"},"rotatekundali":"1","currentDate":moment(new Date()).format('DD/MM/YYYY'),"currentTime":"14:11","showpdf":true,"showgochar":false,"ageRange":{"fromAge":"","toAge":""},
        "acharyaid":26083,"btntype":"viewkundali","finalyear":31,
        "message":"",
         "generateKundaliProduct":"",
         "category":catId};
         var result='';
         if(catData){
            return res.status(200).json({ status: true, message: 'already exist ', data: 'error', statusCode: 200});
         }else{
          
            let headers = {
            'Content-Type': 'application/json',
            'authorization': 'Bearer ' + token,
            'Cache-Control': 'no-cache'
            };
      
          var options = {
              method: 'POST',
              uri: PDFURL,
              headers:headers,
              json:true
          };
          options.body =jsonData;

          var resultData ='';
          let response = await httprequest(options).then((result)=>{
            resultData =result['data'];
             
          }).catch(function (err){
              console.log(` ERROR =`,err.message);
               return res.status(200).json({ status: true, message: 'error in api ', data: 'error', statusCode: 200});
          });

          let questList =resultData;
             let pdata={};
             if(questList){
                   pdata['pdfpath']=questList['pdflink'];
                   pdata['catId']=catId;
                   pdata['user_id']=userId;
                   //$data['catName']=$name;
                var ins = await masters.common_insert('pdffile', pdata);
                return res.status(200).json({ status: true, message: 'Pdf data inserted successfully', data: 'ok', statusCode: 200});
              }else{
                return res.status(200).json({ status: true, message: 'empty pdf data ', data: 'error', statusCode: 200});
            }
         

         }
        
        return res.status(200).json({ status: true, message: 'empty pdf data ', data: 'error', statusCode: 200});
       

    },

  order: async function(req,res){
   let amount =req.body.amount;
   let userId =req.body.user_id;
  try {
    const options = {
      amount: amount * 1000, // amount == Rs 10
      currency: "INR",
      receipt: "receipt#1",
      payment_capture: 0,
    };
     let data={};
    instance.orders.create(options, async function (err, order) {
    if (err) {
       data['amount']=amount;
       data['user_id']=userId;
       data['status']=0;
       data['order_log']='';
       var ins = await masters.common_insert('ordertable', data);
       return res.status(200).json({ status: true, message: 'FAILED', data:'', statusCode: 200});
    }   console.log(order);
        data['amount']=amount;
        data['user_id']=userId;
        data['order_id']=order['id']
        data['status']=1;
        data['order_log']=order;
       var ins = await masters.common_insert('ordertable', data);
    return res.status(200).json({ status: true, message: 'SUCCESS', data:order, statusCode: 200});
  });
} catch (err) {
   return res.status(200).json({ status: true, message: 'FAILED', data:'' , statusCode: 200});
 }
},

paymentVerify: async function(req,res){
  let paymentId = req.body.paymentId;
  let amount =req.body.amount;
  let userId =req.body.user_id;
  let orderId =req.body.order_id;
  let URL = 'https://rzp_test_PX2vJ9ubej1UGc:veloXiNLdQmcrfFqJUDxFeUN@api.razorpay.com/v1/payments/'+paymentId+'/capture';

        var options = {
              method: 'POST',
              uri: URL,
              form: {
               amount: amount * 100, // amount == Rs 10 // Same As Order amount
               currency: "INR",
              },
              json:true
          };
          data={};
          var resultData ='';
          let response = await httprequest(options).then((result)=>{
             resultData =result;
              
             
          }).catch(function (err){
               
          });

          if(resultData) {
              data['amount']=amount;
              data['user_id']=userId;
              data['order_id']=orderId;
              data['payment_id']=resultData.id;
              data['status']=1;
              data['payment_log']=resultData;
              var ins = await masters.common_insert('payments', data);
             return res.status(200).json({ status: true, message: 'success', data: resultData, statusCode: 200});
          }else {

               data['amount']=amount;
               data['user_id']=userId;
               data['order_id']=orderId;
               data['payment_id']=0;
               data['status']=0;
               data['payment_log']='';
               var ins = await masters.common_insert('payments', data);
              return res.status(200).json({ status: true, message: 'error in api ', data: 'error', statusCode: 200});
            }

          

  
},
    
    

};