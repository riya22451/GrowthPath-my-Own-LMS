import express from 'express';
import cors from 'cors'
import 'dotenv/config'
import connectDB from './configs/mongodb.js';
import { clerkWebHooks, stripeWebhooks } from './controllers/webhooks.js';
import educatorRouter from './routes/educatorRoutes.js';
import { clerkMiddleware } from '@clerk/express';
import connectCloudinary from './configs/cloudinary.js';
import courseRouter from './routes/courseRoute.js';
import userRouter from './routes/userRoutes.js';
await connectDB()
await connectCloudinary()
const app=express()

app.use(cors())
app.use(clerkMiddleware())
app.get('/',(req,res)=> res.send("api working"))
app.post('/clerk', express.raw({ type: "application/json" }),clerkWebHooks)
app.use('/api/educator',express.json(),educatorRouter)
app.use('/api/course',express.json(),courseRouter)
app.use('/api/user',express.json(),userRouter)
app.post('/stripe',express.raw({type:'application/json'}),stripeWebhooks)
const port=process.env.PORT || 5000
app.listen(port,()=>{
    console.log(`server running on port ${port}`)
})