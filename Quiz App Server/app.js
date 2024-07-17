const bodyParser = require('body-parser')
const cors = require('cors');
const express = require('express');

const app = express();
const port = process.env.PORT || 5000;

const questionsRouter = require('./routes/questions')

app.use(cors({
    origin: 'http://localhost:3000'
}));
app.use(bodyParser.json());
app.use('/api/questions', questionsRouter);

app.listen(port, () => {
    console.log(`Server is running on ${port}`)
})