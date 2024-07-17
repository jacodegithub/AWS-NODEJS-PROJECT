const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'awseb-e-s5n7zuwhmd-stack-awsebrdsdatabase-cxzb7sqydlec.cl40q8es0o1n.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: 'admin123',
    database: 'java_quiz'
})

connection.connect((err) => {
    if(err) {
        console.log("This is connection error ->", err);
        throw err;
    }
    console.log("Connected Successfully to MySQL Server...");
})

module.exports = connection;