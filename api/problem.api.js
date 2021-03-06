var express = require('express');
var app = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = mongoose.model('user');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const Problem = mongoose.model('problem');
const schedule = require('node-schedule');

let RefreshData = schedule.scheduleJob("00 00 00 * * *",() => {
    RefillData();
})

function RefillData() {
    

    fetch("https://codeforces.com/api/problemset.problems").then(res=>res.json()).then((data)=>{
        if(data.status == "OK"){
            
            data.result.problems.map(el=>{
                el.hash = el.name+el.contestId+el.index;
            })
            Problem.insertMany(data.result.problems);
        }
        
    })
}

app.get('/list',(req,res)=>{
    Problem.find({},'name ratings tags contestId index',{skip: parseInt(req.query.skip) || 0,limit: parseInt(req.query.limit) || 10}).then((doc)=>{
        Problem.count().then((count) => {res.json({status:true, data: doc,count})});        
    }).catch(err => {
        res.json({status:false});
        console.log(err);
    })
})

function findAndFilter(res, solved, ratingStart,ratingEnd){
    Problem.find({rating: {$gte: ratingStart, $lte: ratingEnd}}).lean().then((docs)=>{
        const dc=[]
        for(let i = 0; i < docs.length; i++){
            let el = docs[i];
            delete el.hash;
            if(!solved.get(el.name)){
                dc.push(el);
                break;
            }
        }
        dc[0].link =`https://codeforces.com/problemset/problem/${dc[0].contestId}/${dc[0].index}`;
        res.json(dc ? dc[0] : "invalid");
    })
}

app.get('/upsolve/:username', (req,res)=>{
    let solved = null;
    fetch("https://codeforces.com/api/user.status?handle="+req.params.username).then(res=>res.json()).then((data)=>{
        solved = new Map();
        data.result.forEach((el,i)=>{
            if(el.verdict==="OK"){
                
                solved.set(el.problem.name,true);
            }
        });
        fetch("https://codeforces.com/api/user.rating?handle="+req.params.username).then(res => res.json()).then((rates)=>{
            let rating = rates.result[rates.result.length-1].newRating || 800;
            if(rating >= 2700){
                rating = 2300;
            }
            let ratingStart = rating+200,ratingEnd = rating+400;
            findAndFilter(res, solved,  ratingStart,ratingEnd);
        }).catch(err => {
            let rating = 800;
            let ratingStart = rating+200,ratingEnd = rating+400;
            findAndFilter(res, solved, ratingStart,ratingEnd);
        });
    }).catch(err => {res.json(false)});
    
})

app.get('/dailyques/:username', (req,res)=>{
    let solved = null;
    fetch("https://codeforces.com/api/user.status?handle="+req.params.username).then(res => res.json()).then((data)=>{
        solved = new Map();
        data.result.forEach((el,i)=>{
            if(el.verdict==="OK"){
                
                solved.set(el.problem.name,true);
            }
        });
        fetch("https://codeforces.com/api/user.rating?handle="+req.params.username).then(res=>res.json()).then((rates)=>{
            let rating = rates.result[rates.result.length-1].newRating || 800;
            if(rating >= 2700){
                rating = 2300;
            }
            let ratingStart = rating-100,ratingEnd = rating+100;
            findAndFilter(res, solved, ratingStart,ratingEnd);
        }).catch(err => {
            let rating = 800;
            let ratingStart = rating,ratingEnd = rating+100;
            findAndFilter(res, solved, ratingStart,ratingEnd);
        });
    }).catch(err => {res.json(false)});
    
})

app.get('/check/:type',(req,res)=>{
    
    fetch("https://codeforces.com/api/user.status?handle="+req.query.username).then(res => res.json()).then(async (data)=>{
        let problem = {
            contestId:req.query.contestId,
            name:req.query.name,
            index:req.query.index,

        };
        let temp = await Problem.findOne({hash: problem.name+problem.contestId+problem.index});
        if(temp){
            problem._id = temp._id;
            problem.rating = temp.rating;
        }
        let result = data.result;
        for(let i=0;i<result.length;i++){
            if((problem.contestId == result[i].problem.contestId || problem.name == result[i].problem.name) && problem.index == result[i].problem.index && result[i].verdict === "OK"){
                
                if(req.params.type === "upsolve"){
                    let today = new Date();
                    let date = `${today.getDate()}`+"-"+`${(parseInt(today.getMonth()+1))}`+"-"+`${today.getFullYear()}`;
                    date = "UpsolveStreak."+date;
                    
                    User.updateOne({username: req.query.username},{
                        
                        
                        $inc:{
                            
                            
                            UpsolveQuestion: 1 
                        },
                        $push:{
                            [date]: problem
                        }
                            
                        
                    
                    }).then((result,err) => {})
                }
                else{
                    User.updateOne({username: req.query.username},{
                        
                        $set:{    
                          
                            dailyQuestion: true


                        },
                        $inc:{
                                
                            streak: 1 
                        }
                            
                        
                    
                    }).then((result,err) => {})
                }
                res.json(true);
                break;
            }
        }
        res.json(false);
    }).catch(err => {res.json(false)})
})



module.exports = app;