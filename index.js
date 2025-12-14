const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@dipol-database-cluster.fbp5e4u.mongodb.net/?appName=DIPOL-DATABASE-CLUSTER`;

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
    await client.connect();
    const database = client.db("blood-donate");

    const usersCollection = database.collection("users");

    // const bookingsCollection = database.collection("bookings");
    app.post("/users",async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "user";
      userInfo.createdAt = new Date();
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });
      // console.log(user);  
  

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
