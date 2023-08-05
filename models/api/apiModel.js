
var apiModel = {
	get_joins_records: async function(table, columns, joins, where, order_col, extra_where = "", limit_arr = {}, group_by = '') {

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

            	if(item.jointype == 'INNER') {
            		query.innerJoin(item.table, condLeftSide, condMiddle, condRightSide);
            	}
            	else if(item.jointype == 'LEFT') {
            		query.leftJoin(item.table, condLeftSide, condMiddle, condRightSide);
            	}
            	else if(item.jointype == 'RIGHT') {
            		query.rightJoin(item.table, condLeftSide, condMiddle, condRightSide);
            	}            
            }
        } 

        //WHERE STATEMENT
        if(Object.keys(where).length > 0) {
            query.where(where);
        }

        //RAW WHERE STATEMENT
        if(extra_where != '') {
            query.whereRaw(extra_where);
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

        //GROUP BY STATEMENT
        if(group_by != '') {
            query.groupBy(knex.raw(group_by));
        }

        //LIMIT STATEMENT
        if(Object.keys(limit_arr).length > 0) {
            query.limit(limit_arr.limit).offset(limit_arr.offset);
        }

        //EXECUTE STATEMENT
        await query.then((result) => {
            response = result;           
        });
          
  		return response;
	}
}

module.exports = apiModel;
