const express = require('express');
const router = express.Router();
const db = require('../models/db');

// get all questions
router.get('/', (req, res) => {
    db.query('select * from javaquestions', (err, results) => {
        if(err) throw err;
        res.json(results);
    })
})

// post an answer
router.post('/answer', (req, res) => {
    console.log('request ->', req.body);
    const { userId, questionId, answer } = req.body;
    db.query('insert into javaanswers (userId, questionId, answer) values (?, ?, ?)', [userId, questionId, answer], (err, results) => {
        if(err) throw err;
        res.json({
            success: true,
            message: 'Answer Submitted!!'
        })
    })
})

module.exports = router;