require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const cors = require("cors");
const express = require("express");
const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
app.use(express.json());

const veryfyToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decodedEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@dipol-database-cluster.fbp5e4u.mongodb.net/?appName=DIPOL-DATABASE-CLUSTER`;

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
    const requestsCollection = database.collection("requests");
    // const bookingsCollection = database.collection("bookings");

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "doner";
      userInfo.status = "active";
      userInfo.createdAt = new Date();
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    app.get("/users/role/:email", async (req, res) => {
      const { email } = req.params;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
      console.log(result);
    });

    // blood request ApI
    app.post("/requests",veryfyToken, async (req, res) => {
      const data = req.body;
      
      data.createdAt = new Date();
      const result = await requestsCollection.insertOne(data);
      res.send(result);
    });
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
