const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SK)
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middlewere


app.use(cors({
  origin:['https://talent-hunt-project.netlify.app','http://localhost:5173'],
  credentials:true
}));

app.use(express.json());
app.use(cookieParser())

const secretKey = process.env.SCERET_KEY

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER}@cluster0.dsq3s3c.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const contestdb = client.db("talent-hunt");
    const allContestCollection = contestdb.collection("allContest");
    const userCollection = contestdb.collection("user");
    const participentCollection = contestdb.collection("participent");

    // JWT

    const middleman = (req,res,next)=>{
      const {token} = req.cookies;
      // console.log('man',token);
      if(!token){
        return res.status(401).send({message:"not Authrized"})
      }
      jwt.verify(token,secretKey,(err,decoded)=>{
        if(err){
          return res.status(401).send({message:"not Authrized"})
        }
        console.log('decoded',decoded);
        req.user = decoded
        next()

      })
      


    }


    app.post("/api/v1/jwt", async (req, res) => {
      const {email} = req.body;
      console.log(email);
      const token = jwt.sign(email,secretKey)
      res.cookie('token',token,{
        httpOnly:true,
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({success:true})
    })

    app.post("/api/v1/logout", async (req, res) => {
      res.clearCookie('token',{maxAge:0}).send('token gayeb')

    })

    app.post("/api/v1/user", async (req, res) => {
      const user = req.body;
      console.log(user);
      const find = {email:user?.email};
      const IfExist = await userCollection.findOne(find)
      if(IfExist){
        return res.send('Alredy Exist')
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

     app.get('/api/v1/user', async (req,res)=>{
      const result = await userCollection.find().toArray()
      res.send(result);
    })

    app.get("/api/v1/usercount", async (req, res) => {
      const result = await userCollection.estimatedDocumentCount();
      res.send({ result });
      // console.log(result);
    });

     app.get('/api/v1/user/:email',middleman, async (req,res)=>{
      const {email} = req.params;
      const filter = {email:email}
      const result = await userCollection.findOne(filter)
      res.send(result);
    })
     app.put('/api/v1/user', async (req,res)=>{
      const {email} = req.query;
      const {role} = req.body;
      const filter = {email:email}
      console.log(email);
      // const options = { upsert: true };
      const update = {
            $set: {
              role:role
            },
          };
      const result = await userCollection.updateOne(filter,update)
      res.send(result);
    })

    app.post("/api/v1/allcontest", async (req, res) => {
      const {contest} = req.body;
      console.log(contest);
      const result = await allContestCollection.insertOne(contest);
      res.send(result);
    });

    app.get('/api/v1/allcontest/:email',middleman, async (req,res)=>{
      const {email} = req.params;
      const filter = {email:email}
      const result = await allContestCollection.find(filter).toArray()
      res.send(result);
    })

    app.delete("/api/v1/allcontest/:id",middleman, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const find = { _id: new ObjectId(id) };
      const result = await allContestCollection.deleteOne(find);
      res.send(result);
    });

    app.get('/api/v1/allcontestadmin', async (req,res)=>{
      const filter = {status:'pending'}
      const result = await allContestCollection.find(filter).toArray()
      res.send(result);
    })
    app.get('/api/v1/allcontesthome', async (req,res)=>{
      const result = await allContestCollection.find().toArray()
      res.send(result);
    })
    app.get('/api/v1/bestcontest', async (req,res)=>{
      const result = await allContestCollection.find().sort({ participator : "desc" }).limit(6).toArray();
      res.send(result);
    })


    app.get("/api/v1/contestcount", async (req, res) => {
      const result = await allContestCollection.estimatedDocumentCount();
      res.send({ result });
      // console.log(result);
    });

    app.put('/api/v1/allcontestadmin/:id',middleman, async (req,res)=>{
      const {id} = req.params;
      const UpdatedInfo = req.body;
      const filter = {_id: new ObjectId(id)}
      console.log(UpdatedInfo);
      // const options = { upsert: true };
      const update = {
            $set: {
              status:UpdatedInfo.status
            },
          };
      const result = await allContestCollection.updateOne(filter,update)
      res.send(result);
    })

    app.get("/api/v1/contest/:id",middleman, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const find = { _id: new ObjectId(id) };
      const result = await allContestCollection.findOne(find);
      res.send(result);
    });
    // payment 
    app.post('/api/v1/payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount')
      if(amount<1){
        return
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    app.post("/api/v1/save-participent",middleman, async (req, res) => {
      const {info} = req.body;
      console.log(info);
      const result = await participentCollection.insertOne(info);
      res.send(result);
    });

    app.put('/api/v1/contestup/:id',middleman, async (req,res)=>{
      const {id} = req.params;
      const {participator} = req.body;
      const filter = {_id: new ObjectId(id)}
      console.log(participator);
      // const options = { upsert: true };
      const update = {
            $set: {
              participator:participator
            },
          };
      const result = await allContestCollection.updateOne(filter,update)
      res.send(result);
    })

    app.get('/api/v1/winner/:id',middleman, async (req,res)=>{
      const {id} = req.params;
      console.log(id);
      const filter = {winner:id}
      const result = await participentCollection.find(filter).toArray()
      res.send(result);
    })
    app.get('/api/v1/perticipat/:id',middleman, async (req,res)=>{
      const {id} = req.params;
      console.log(id);
      const filter = {participentEmail:id}
      const result = await participentCollection.find(filter).toArray()
      res.send(result);
    })
    app.get('/api/v1/contestwinner/:id',middleman, async (req,res)=>{
      const {id} = req.params;
      console.log(id);
      const filter = {mainId:id}
      const result = await participentCollection.find(filter).toArray()
      res.send(result);
    })

    app.put('/api/v1/contestwinneremail/:id',middleman, async (req,res)=>{
      const {id} = req.params;
      const {email} = req.body;
      console.log('up',id,email);
      const filter = {mainId:id}
      // const options = { upsert: true };
      const update = {
            $set: {winner:email}
          };
      const result = await allContestCollection.updateMany(filter,update)
      res.send(result);
    })

    

    console.log("successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`Talent Hunt is Running ${port}`);
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
