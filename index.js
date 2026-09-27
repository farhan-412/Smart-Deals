const express = require('express');
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, Collection, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express()
const port = process.env.PORT || 3000

const admin = require("firebase-admin");
const serviceAccount = require("./smart-deals-pro-c4458-firebase-adminkey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//MiddelWire 

app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  // console.log('logging information')
  next()
}

// custom middlewire
const verifyFirebaseToken = async (req, res, next) => {
  // console.log('in the verify middlewire', req.headers.authorization)

  if (!req.headers.authorization) {
    return res.status(401).send({ messeage: 'unauthorized access' })
  }

  const token = req.headers.authorization.split(' ')[1]

  if (!token) {
    return res.status(401).send({ messeage: 'unauthorized access11' })
  }

  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    // console.log('after token validation', userInfo)
    req.token_email = userInfo.email
    next()
  }
  catch (error) {
    console.log('Firebase verify error:', error.code, error.message)
    return res.status(401).send({ messeage: 'unauthorized access' })
  }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kmmj9yw.mongodb.net/?appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res) => {
  res.send('Smat server is running!')
})

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db('smart_deal_db');
    const productCollection = db.collection('products');
    const bidCollection = db.collection('bid');
    const usersCollection = db.collection('users')

    //jwt related apis
    app.post('/getToken', (req, res)=>{
      const loggedUser = req.body;
      const token = jwt.sign({loggedUser}, process.env.JWT_SECRET, {expiresIn : '1hr'})
      res.send({token: token})
    })


    // USER API
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const email = newUser.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query)

      if (existingUser) {
        res.send({ messeage: 'User already exits.do not need to add' })
      }
      else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result)
      }

    })

    // PRODUCTS APLs
    app.get('/products', async (req, res) => {

      const email = req.query.email;
      const query = {}
      if (email) {
        query.email = email
      }

      const data = productCollection.find(query)
      const result = await data.toArray();
      res.send(result)
    })

    app.get('/latest-products', async (req, res) => {
      const cursor = productCollection.find().sort({ created_at: -1 }).limit(6)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await productCollection.findOne(query)
      res.send(result);
    })

    app.post('/products', async (req, res) => {
      const newproduct = req.body;
      const result = await productCollection.insertOne(newproduct)
      res.send(result);
    })

    app.patch('/products/:id', async (req, res) => {
      const id = req.params.id;
      const updatedBody = req.body;
      const query = { _id: id }
      const update = {
        $set: {
          name: updatedBody.name,
          price: updatedBody.price
        }
      }
      const result = await productCollection.updateOne(query, update)
      res.send(result)
    })

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await productCollection.deleteOne(query)
      res.send(result)
    })

    // bid related api
    app.get('/bids', logger, verifyFirebaseToken, async (req, res) => {
      console.log('header', req)
      const email = req.query.email;
      const query = {}
      if (email) {
        if(email !== req.token_email){
          return res.status(403).send({message: 'unauthorized access'})
        }
        query.buyer_email = email;
      }

      const cursor = bidCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/products/bids/:productId',verifyFirebaseToken, async (req, res) => {
      const productId = req.params.productId;
      const query = { productId: productId };
      const cursor = bidCollection.find(query).sort({ bid_price: -1 })
      const result = await cursor.toArray();
      res.send(result)
    })

    app.post('/bids', async (req, res) => {
      const newBid = req.body;
      const result = await bidCollection.insertOne(newBid);
      res.send(result);
    })

    app.delete('/bids/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bidCollection.deleteOne(query);
      res.send(result)
    })




    app.listen(port, () => {
      console.log(`Smart server is running in port ${port}`)
    })
  }
  finally {

  }
}
run().catch(console.dir);

