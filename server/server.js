import express from 'express';
import cors from 'cors'
import 'dotenv/config'
import connectDB from './configs/mongodb.js';
import { clerkWebHooks } from './controllers/webhooks.js';
await connectDB()

const app=express()
app.use(express.json())
app.use(cors())
app.get('/',(req,res)=> res.send("api working"))
app.post('/clerk', express.raw({ type: "application/json" }),clerkWebHooks)
const port=process.env.PORT || 5000
app.listen(port,()=>{
    console.log(`server running on port ${port}`)
})