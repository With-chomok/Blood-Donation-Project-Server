require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SEC);
const crypto = require("crypto");
const cors = require("cors");
const express = require("express");
const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    req.decodedEmail = decoded.email;
    console.log("decoded info", decoded);
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_KEY, "base64").toString("utf8");
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
    const paymentsCollection = database.collection("payments");

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      console.log(userInfo);
      userInfo.role = "Donor";
      userInfo.status = "active";
      userInfo.createdAt = new Date();
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });
    // Profile Update API
    app.patch("/profile/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const updatedData = req.body;

      const result = await usersCollection.updateOne(
        { email },
        { $set: updatedData }
      );

      res.send(result);
    });

    //All USer Get API

    app.get("/users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.status(200).send(result);
    });

    app.get("/my-donation-requests", verifyToken, async (req, res) => {
      const email = req.decodedEmail;
      const query = { requesterEmail: email };
      const size = Number(req.query.size);
      const page = Number(req.query.page);
      const result = await requestsCollection
        .find(query)
        .limit(size)
        .skip(size * page)
        .toArray();

      const totalRequest = await requestsCollection.countDocuments(query);

      res.send({ result: result, totalRequest });
    });

    app.get("/users/role/:email", async (req, res) => {
      const { email } = req.params;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
      console.log(result);
    });
    app.patch("/update/user/status", verifyToken, async (req, res) => {
      const { email, status } = req.query;
      const query = { email: email };

      const updateStatus = {
        $set: {
          status: status,
        },
      };

      const result = await usersCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    // users Data API
    app.get("/users/:email", verifyToken, async (req, res) => {
      if (req.decodedEmail !== req.params.email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const user = await usersCollection.findOne({
        email: req.params.email,
      });

      res.send(user);
    });

    // PayMents REquest API
    app.post("/create-payment", async (req, res) => {
      const { donateAmount } = req.body.formData;
      const info = req.body;
      console.log("INFO IS BELOw", info);
      const amount = parseInt(donateAmount) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: "please Donate",
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          donorName: info?.donerName,
        },
        cutomer_email: info?.donerEmail,
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    app.post("/success-payment", async (req, res) => {
      const { session_id } = req.query;
      const session = await stripe.checkout.sessions.retrieve(session_id);
      console.log(session);
      const transationId = session.payment_intent;

      const isPaymentExist = await paymentsCollection.findOne({ transationId });

      if (isPaymentExist) {
        return;
      }

      if (session.payment_status == "paid") {
        const paymentInfo = {
          amount: session.amount_total / 100,
          currency: session.currency,
          donorEmail: session.customer_email,
          transationId,
          payment_status: session.payment_status,
          paidAt: new Date(),
        };

        const result = await paymentsCollection.insertOne(paymentInfo);
        return res.send(result);
      }
    });
    
// Search API
    app.get("/search-requests", async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;

        const query = {};

        if (bloodGroup) {
          const fixed = bloodGroup.replace(/ /g, "+").trim();
          query.bloodGroup = fixed;
        }
        if (district) {
          query.district = district;
        }
        if (upazila) {
          query.upazila = upazila;
        }

        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Search failed" });
      }
    });
    // blood request ApI
    app.post("/requests", verifyToken, async (req, res) => {
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
