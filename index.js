const express = require("express");
const cors = require("cors");
var jwt = require("jsonwebtoken");
var cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

console.log("Mongo started successfully");
const app = express();
const port = process.env.port || 5000;


const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(
  {
    origin : ['http://localhost:5173'],
    credentials : true
  }));  

app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser())
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.t241ufd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//middleware

const logger = async (req, res,  next) => {
  console.log('logger' , req.originalUrl)
  next()
}

//create middleware primary step
const verifyToken = async (req, res , next) => {
  const token = req.cookies.token
  console.log('verifyToken', token);
  if (!token) {
    return res.status(401).send({message : 'Unauthorized token'})
  }
  //// verify a token symmetric from jwt.io
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
    if (err) {
      return res.status(401).send({message : 'Unauthorized access token'})
    }
      console.log('decoded value of token' , decoded)
      req.user = decoded
  })
  next()
}



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const serviceCollection = client.db("carClinic").collection("services");
    const bookingCollection = client.db("carClinic").collection("bookings");
    app.get("/services", logger, async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        projection: { _id: 0, service_id: 1, title: 1, price: 1, img: 1 },
      };

      const result = await serviceCollection.findOne(query, options);
      console.log(result);
      res.send(result);
    });

    //booking specific data
    app.get("/booking", logger, verifyToken, async (req, res) => {
      let email = req.query.email
      console.log(email)
      console.log('user information from verify token' , req.user.email)
      if (email !== req.user.email) {
        return res.status(401).send({message : 'Unauthorized token email'})
      }
      //console.log('Coming  from token' , req.cookies.token)
      let query = {};
      if (req.query?.email) {
        query = { email: email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });


    //delete a specific booking
    app.delete("/booking/:id", async (req, res) => {
      let id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/booking/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateBooking = req.body;
      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };
      console.log(updateBooking);
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //post data for booking
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    //--------------------------------auth related api
    //step 1 - create token
    app.post("/jwt", logger,  async (req, res) => {
      const user = req.body;
      //user is coming from client
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" })
      //generate a token
      console.log("come from jwt", token);
      res.cookie('token', token, {httpOnly: true, secure: false}).send({ success: true })
      //set token in cookie , to set a cookie need to ensure cors option and {withCredentials: true} in client site
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB "
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("doctor is running");
});

app.listen(port, () => {
  console.log(`car doctor server is running on ${port}`);
});
