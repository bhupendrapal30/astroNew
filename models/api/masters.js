var upperCase = require("upper-case");
var moment = require('moment');

var masters = {
	common_insert: async function(table, postData) {
		var response = 0;

        await knex(table).insert(postData).then((result) => {
            response = result[0];
        });

  		return response;
	},
    common_update: async function(table, updateData, whereData) {
        var response = 0;
        
        await knex(table).update(updateData).where(whereData).then((result) => {
            response = result;
        });

        return response;
    },
    common_delete: async function(table, whereData) {
        var response = 0;
        
        await knex(table).delete().where(whereData).then((result) => {
            response = result;
        });

        return response;
    },
    get_joins_records: async function(table, columns, joins, where, order_col) {

        var response = [];

        //SELECT STATEMENT
        var query = knex.select(columns).from(table);
        
        //JOINT STATEMENT
        if(Array.isArray(joins) && (joins.length > 0))
        {
            for(let item of joins)
            {
                var condData = item.condition;
                var condLeftSide = condData[0];
                var condMiddle = condData[1];
                var condRightSide = condData[2];

                if(upperCase(item.jointype) == 'INNER') {
                    query.innerJoin(item.table, condLeftSide, condMiddle, condRightSide);
                }
                else if(upperCase(item.jointype) == 'LEFT') {
                    query.leftJoin(item.table, condLeftSide, condMiddle, condRightSide);
                }
                else if(upperCase(item.jointype) == 'RIGHT') {
                    query.rightJoin(item.table, condLeftSide, condMiddle, condRightSide);
                }            
            }
        } 

        //WHERE STATEMENT
        if(Object.keys(where).length > 0) {
            query.where(where);
        }

        //ORDER BY STATEMENT
        if(order_col != '') {
           var orderByData = order_col.split(',');
           for(let item of orderByData) {
               item = item.trim().split(' ');
               var orderByName = item[0];
               var orderByType = item[1];
               query.orderBy(orderByName, orderByType);
           }          
        }

        //EXECUTE STATEMENT
        await query.then((result) => {
            response = result;           
        });
          
        return response;
    },
    getdata_by_table_cond: async function(table, where) {
        var response = [];
        
        await knex(table).select('*').where(where).then((result) => {
            response = result;
        });

        return response;
    },
    getdata_by_table_nostatus: async function(table) {
        var response = [];
        
        await knex(table).select('*').then((result) => {
            response = result;
        });

        return response;
    },
    getdata_by_table_sorting: async function(table, order_col) {
        var response = [];
        
        var query = knex(table).select('*');

        var orderByData = order_col.split(',');
        for(let item of orderByData) {
            item = item.trim().split(' ');
            var orderByName = item[0];
            var orderByType = item[1];
            query.orderBy(orderByName, orderByType);
        }  

        await query.then((result) => {
            response = result;
        });

        return response;
    },
    getSingleRecord: async function(table,column, where) {
        var response = [];
        
        await knex(table).select(column).where(where).limit(1).offset(0).then((result) => {
            response = (result.length > 0) ? result[0] : false;
        });

        return response;
    },
    get_valuebycol: async function(table, ret_col, where) {
        var response = [];
        
        await knex(table).select(ret_col).where(where).limit(1).offset(0).then((result) => {
            response = (result.length > 0) ? result[0][ret_col] : false;
        });

        return response;
    },
    get_definecol_bytbl: async function(col_fields, table) {
        var response = [];
        
        await knex(table).select(col_fields).then((result) => {
            response = (result.length > 0) ? result : false;
        });

        return response;
    },
    get_definecol_bytbl_cond: async function(col_fields, table, where) {
        var response = [];
        
        await knex(table).select(col_fields).where(where).then((result) => {
            response = (result.length > 0) ? result : false;
        });

        return response;
    },
    get_definecol_bytbl_cond_sorting: async function(col_fields, table, where, order_col) {
        var response = [];

        var query = knex(table).select(col_fields);

        query.where(where);

        var orderByData = order_col.split(',');
        for(let item of orderByData) {
            item = item.trim().split(' ');
            var orderByName = item[0];
            var orderByType = item[1];
            query.orderBy(orderByName, orderByType);
        }  
        
        await query.then((result) => {
            response = (result.length > 0) ? result : false;
        });

        return response;
    },
    check_exist: async function(table, where) {
        var response = null;
        await knex(table).select("id").where(where).then((result) => {
            response = (result.length > 0) ? true : false;
        });
       console.log(response);
        return response;
    },
    check_exist_pk: async function(table, where, ret_col) {
        var response = '';
        
        await knex(table).select("*").where(where).then((result) => {
            response = (result.length > 0) ? result[0][ret_col] : false;
        });

        return response;
    },
    common_insert_batch: async function(table, postData) {
        var response = 0;

        await knex(table).insert(postData).then((result) => {
            response = result[0];
        });

        return response;
    },
   
    getdata_by_table_cond_limit_sorting: async function(table, where, order_col, start, limit) {
        var response = [];
        
        var query = knex(table).select('*').where(where);

        var orderByData = order_col.split(',');
        for(let item of orderByData) {
            item = item.trim().split(' ');
            var orderByName = item[0];
            var orderByType = item[1];
            query.orderBy(orderByName, orderByType);
        }  

        query.limit(limit);
        query.offset(start);

        await query.then((result) => {
            response = (result.length > 0) ? result: false;
        });

        return response;
    },
    getnumrow_by_table_cond: async function(table, where) {
        var response = [];
        var query = knex(table).where(where);
        await query.count('id as total_records').then((result) => {
            var totalRecords = result[0].total_records
            response = (totalRecords != 0) ? totalRecords: false;
        });

        return response;
    },
    get_definecol_bytbl_groupby: async function(col_fields, table, where,catData,group_by) {
        var response = [];
        var query = knex(table).select(col_fields).whereIn('qid',where).whereIn('catId',catData);
        query.groupBy(knex.raw(group_by));
        await query.then((result) => {           
            response = (result.length > 0) ? result: false;
        });

        return response;
    },
    get_definecol_bytbl_groupbynew: async function(col_fields, table, whereIn,where,group_by) {
        var response = [];
        var query = knex(table).select(col_fields).whereIn('qid',whereIn).where(where);;
        await query.then((result) => { 
            response = (result.length > 0) ? result: false;
          
        });
         return response;
    },
    getRows_using_IN: async function(table, where_in, col_fields = '', where = '') {
        var response = [];
        var query = knex(table);
        if(col_fields != '') {
            query.select(col_fields);
        }
        if(where != '') {
            query.where(where);
        }
        query.whereIn('id', where_in);

        await query.then((result) => {           
            response = result;
        });

        return response;
    },
    getHolidayList: async function() {
        var response = [];
        var holidaydata = await this.getdata_by_table_nostatus('Holiday');

        var all_list = {};
        all_list['IND'] = [];
        all_list['US'] = [];
        for(let item of holidaydata) {
            
            if(item.type == 'IND'){

                var hdate = await dmY(item.holiday_date);
                all_list['IND'].push(hdate);
            }else{

                var hdate = await dmY(item.holiday_date);
                all_list['US'].push(hdate);
            }          
        }
        
        response = all_list;

        return response;
    },
    getdata_by_table_cond_order: async function(table, where, order_col, order) {
        var response = [];
        var query = knex(table).where(where);
        query.orderBy(order_col, order);

        await query.then((result) => {           
            response = result;
        });

        return response;
    },
    get_data_using_field_in: async function(table, where_in, col_fields = '', field = 'id', where = '') {
        var response = [];
        var query = knex(table);
        if(col_fields != '') {
            query.select(col_fields);
        }
        if(where != '') {
            query.where(where);
        }
        query.whereIn(field, where_in);

        await query.then((result) => {           
            response = result;
        });

        return response;
    }
}

var dmY = async function(dt)
{
    if(dt == '1970-01-01' || dt == null || dt == '' || dt == '0000-00-00'){
        return '';
    }else{
        return await moment(dt).format('DD-MM-YYYY');
    }
}

module.exports = masters;
