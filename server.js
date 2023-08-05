var app = require('./appstart');
const { port } = require('./app/config/config');

// Defining variables
var SERVER_PORT = port || 3030;

// this wrapper is only for testing purpose
if(!module.parent){
    // staring the express server
    app.listen(SERVER_PORT,function(){
        console.log("Server is listening at port : ",SERVER_PORT);
    });
}

module.exports = app;
