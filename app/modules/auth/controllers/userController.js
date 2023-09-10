//var models  =  require('../../../../models');
//var User = models.userdetails;
require("dotenv").config();
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
    key_id: process.env.ROZAR_API_KEY,
    key_secret: process.env.ROZAR_API_SECRET,
});
var PDFURL =process.env.PDFURL;
var questionURL=process.env.QUESTIONLISTURL;
var questionpdfURL=process.env.QUESTIONPDFURL;

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


sendmessage = async (data,tokenData,type) => {
  
  var ph = "+91"+data['mobileNo'];
  var orderId = "Order"+data['user_id'];
  if(type =='q'){ 
   var pdffile=tokenData['pdffile'];
  }else{
   let PdfData = await masters.getSingleRecord('pdffile','*', {user_id:data['user_id'],catId:tokenData['catId']});
   var pdffile = PdfData['pdfpath'];
  }
  
  let headers = {
        'Content-Type': 'application/json',
        'authorization': tokenData.token,
        'Cache-Control': 'no-cache'
        };
      
      var options = {
          method: 'POST',
          uri: 'https://apis.rmlconnect.net/wba/v1/messages',
          headers:headers,
          json:true
      };
     
      options.body = {
    "phone": ph,
    "enable_acculync": true,
    "media": {
        "type": "media_template",
        "template_name": "download_lal_kitab",
        "lang_code": "en",
        "body": [
            {
                "text": data['name']
            },
            {
                "text": "LAL KITAB AMRIT"
            },
            {
                "text": orderId
            },
            {
                "text":pdffile
            },
            {
                "text": " "
            }
        ]
    }
}

     var resData='';
     let response = await httprequest(options).then((result)=>{
      }).catch(function (err){
       res.status(200).json({status: true,data:'', message: err});
      });

}
module.exports = {
	addUser: async function(req, res) {  
       
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
        let time = userData['tob'].split(":");
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
     var  $jsnCat = '';
      if(catId==1){
        $jsnCat='date';
      }else if(catId==75){
         $jsnCat=66;
      }else{
        $jsnCat=catId;
      }
       
      options.body ={"langitutde":userData['lng'],"gender":"male","kundalitype":"kp","birthDate":{"day":dob[2],"month":dob[1] ,"year":dob[0]},
      "timezone":"5.5","language":"1","product":"143","latitude":userData['lat'],"name":userData['name'],"dst":false,"generate":true,"pob":{"placeName":userData['city'],"StateName":userData['stateName'],"countryName":"India","latitude":userData['lng'],"longitude":userData['lat'],"gmtoffset":"5.5","dstoffset":"5.5","timezone":"5.5"},"birthTime":{"hour":time[0],"minute":time[1]},"rotatekundali":"1","currentDate":moment(new Date()).format('DD/MM/YYYY'),"currentTime":"14:03","showpdf"
:false,"showgochar":false,"ageRange":{"fromAge":"","toAge":""},"acharyaid":26083,"btntype":"viewkundali","finalyear":31,"message":"","generateKundaliProduct":"","category":$jsnCat};
     var result='';
     var resData='';
     let response = await httprequest(options).then((result)=>{
         resData =result['data']['questions1']['questions']; 
         
     }).catch(function (err){
         res.status(200).json({status: true, data:'',message: err});
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
            pdata['price']=100;
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
   let userId =req.body.user_id;
   let catId =req.body.catId;
   var finalData = {};
    var where = {};
    where['catId'] = catId;
    where['userid'] = userId;
    var extra_whr = '';
    var limit_arr = '';
    var orderby = 'id ASC';
    var columns = ['id','qid','ques'];
    var result = await masters.get_definecol_bytbl_cond_sorting(columns,'questionans', where, orderby);

    return res.status(200).json({ status: true, message: 'Questions List fetched successfully', data: result, statusCode: 200});

    },
    
    questionsList:async function(req,res){
      let questionData =req.body.ques;
      let catData =req.body.catIds;
      let userId =req.body.user_id;
      var finalData = {};
      var where ={};
      var whereIn = questionData;
     // where['deletestatus'] = 0;
      var groupby = 'catName';
      var columns = ['catId','catName'];
      var col = ['id','qid','ques','catName','userid','price'];
      var response = await masters.get_definecol_bytbl_groupby(columns,'questionans', whereIn,catData,userId,groupby );
      finalData.data = response; 
      await Promise.all(response.map(async (value) => {
        where['catId']=value.catId;
        // where['userid']=userId;
        //this.questionsData(req,res);
         var qesresponse = await masters.get_definecol_bytbl_groupbynew(col,'questionans', whereIn,where,userId,groupby );
         Object.assign(value, {ques: qesresponse});
      }));

     
      
      return res.status(200).json({status: true, message: 'Questions list fetched successfully', data: response});

    },

    answerList:async function(req,res){
      let questionData =req.body.ques;
      let catData =req.body.catIds;
      let userId =req.body.user_id;
      var finalData = {};
      var where ={};
      var whereIn = questionData;
     // where['deletestatus'] = 0;
      var groupby = 'catName';
      var columns = ['catId','catName'];
      var col = ['id','qid','ques','ans','catName','userid'];
      var response = await masters.get_definecol_bytbl_groupby(columns,'questionans', whereIn,catData,userId,groupby );
      finalData.data = response; 
      await Promise.all(response.map(async (value) => {
        where['catId']=value.catId;
        // where['userid']=userId;
        //this.questionsData(req,res);
         var qesresponse = await masters.get_definecol_bytbl_groupbynew(col,'questionans', whereIn,where,userId,groupby );
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
        let time = userData['tob'].split(":");

        var jsonData= {"langitutde":userData['lng'],"gender":"male","kundalitype":"kp","birthDate":{"day":dob[2],"month":dob[1] ,"year":dob[0]},
        "timezone":"5.5","language":"1","product":catId,"latitude":userData['lat'],"name":userData['name'],"dst":false,"generate":true,
        "pob":{"placeName":userData['city'],"StateName":userData['stateName'],"countryName":"India","latitude":userData['lng'],"longitude":userData['lat'],"gmtoffset":"5.5","dstoffset":"5.5","timezone":"5.5"},
        "birthTime":{"hour":time[0],"minute":time[1]},"rotatekundali":"1","currentDate":moment(new Date()).format('DD/MM/YYYY'),"currentTime":"14:11","showpdf":true,"showgochar":false,"ageRange":{"fromAge":"","toAge":""},
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
    }   
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
  let catId =req.body.catId;
  let wptoken =req.body.whtoken;

  let userData = await masters.getSingleRecord('users','*', {user_id:userId});
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
              data['order_id']="Order"+userId;
              data['payment_id']=resultData.id;
              data['status']=1;
              data['payment_log']=resultData;
              var ins = await masters.common_insert('payments', data);
              let tokenData = {token:wptoken,catId:catId};
              if(userData['atype']=='pdf'){
               sendmessage(userData,tokenData,'p');
              }
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
orderdeatils: async function(req,res){
     let userId =req.body.user_id;
      var joins = [
        {
            table: 'payments as payments',
            condition: ['users.user_id', '=', 'payments.user_id'],
            jointype: 'LEFT'
        }
    ];
    var orderby = '';
    var where = {'users.user_id':userId};
    var extra_whr = '';
    var limit_arr = '';
    var columns = ['users.user_id ', 'users.name','users.dob','users.tob','users.mobileNo','users.city','users.stateName','users.countryName','payments.order_id','payments.order_id','payments.amount'];
    var limit_arr = {};
    var result = await apiModel.get_joins_records('users', columns, joins, where, orderby, extra_whr, limit_arr);
    return res.status(200).json({ status: true, message: 'Orders details successfully', data: result, statusCode: 200});

    },
questionsPdf: async function(req, res) {  
        let URL = questionpdfURL;
        let catId =req.body.catIds;
        let userId =req.body.user_id;
        let questionData =req.body.ques;
        let token =req.body.token;
        let whtoken =req.body.whtoken;
        let userData = await masters.getSingleRecord('users','*', {user_id:userId});
        //let catData = await masters.getSingleRecord('category','*', {apiId:catId});
        var finalData = {};
        var where ={};
        let dob = userData['dob'].split("-");
        let time = userData['tob'].split(":");
        var whereIn = questionData;
     // where['deletestatus'] = 0;
        var groupby = 'id';
        var columns = ['aid as id','qid','ques as que','ans','userid'];
      // var col = ['id','qid','ques','catName','userid'];
     var questionListData = await masters.get_definecol_bytbl_groupby(columns,'questionans', whereIn,catId,userId,groupby);
      let headers = {
        'Content-Type': 'application/json',
        'authorization': 'Bearer ' +token,
        'Cache-Control': 'no-cache'
        };
      
      var options = {
          method: 'POST',
          uri: URL,
          headers:headers,
          json:true
      };
    
      options.body ={
       "userdetails":{"langitutde":userData['lng'],"gender":"male","kundalitype":"kp","birthDate":{"day":dob[2],"month":dob[1] ,"year":dob[0]},
      "timezone":"5.5","language":"1","product":"143","latitude":userData['lat'],"name":userData['name'],"dst":false,"generate":true,"pob":{"placeName":userData['city'],"StateName":userData['stateName'],"countryName":"India","latitude":userData['lng'],"longitude":userData['lat'],"gmtoffset":"5.5","dstoffset":"5.5","timezone":"5.5"},"birthTime":{"hour":time[0],"minute":time[1]},"rotatekundali":"1","currentDate":moment(new Date()).format('DD/MM/YYYY'),"currentTime":"14:03","showpdf"
:false,"showgochar":false,"ageRange":{"fromAge":"","toAge":""},"name":userData['name'],"acharyaid":26083,"btntype":"viewkundali","finalyear":31,"message":"","generateKundaliProduct":"","mobile":userData['mobileNo'],"email":"","relation":"Your Self","source":"bhagwancheck1","userId":250},"questions":questionListData };
     var result='';
     var resData='';
     let response = await httprequest(options).then((result)=>{
         resData =result;
         
     }).catch(function (err){
      return res.status(200).json({ status: true,messagestatus:false, message: 'error in api ', data: '', statusCode: 200});
     });
     if(resData){
        let pdFile=resData['data']['pdfurl'];
        let tokenData = {token:whtoken,pdffile:pdFile};
        sendmessage(userData,tokenData,'q');
        return res.status(200).json({ status: true,messagestatus:true, message: 'fetch result successfully', data: resData, statusCode: 200});
     
     }
     
    },
    getCategory :async function(req, res) {  
         let catId =req.body.catId;
         let catData = await masters.getSingleRecord('category','*', {apiId:catId});
         if(catData){
          return res.status(200).json({ status: true,messagestatus:true, message: 'fetch result successfully', data: catData, statusCode: 200});
          }else{
            return res.status(200).json({ status: true,messagestatus:false, message: 'error', data:'', statusCode: 200});
           }

    },
    getQuesCategory :async function(req, res) {  

      
        var finalData = {};
        var where = {};
        where['qtype'] = 'q';
        var extra_whr = '';
        var limit_arr = '';
        var orderby = 'id ASC';
        var columns = ['id','qid','ques'];
        var result = await masters.get_definecol_bytbl_cond_sorting('*','category', where, orderby);
       
            if(result){
                   return res.status(200).json({ status: true, message: 'Category fetched successfully', data: result, statusCode: 200});
             }else{
                 return res.status(200).json({ status: true,messagestatus:false, message: 'error', data:'', statusCode: 200});
            }

        },

    getPdfCategory :async function(req, res) {  

      
        var finalData = {};
        var where = {};
        where['qtype'] = 'p';
        var extra_whr = '';
        var limit_arr = '';
        var orderby = 'id ASC';
        var columns = ['id','qid','ques'];
        var result = await masters.get_definecol_bytbl_cond_sorting('*','category', where, orderby);
       
            if(result){
                   return res.status(200).json({ status: true, message: 'Category fetched successfully', data: result, statusCode: 200});
             }else{
                 return res.status(200).json({ status: true,messagestatus:false, message: 'error', data:'', statusCode: 200});
            }

        },
    
    

};