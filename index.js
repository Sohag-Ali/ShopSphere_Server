const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const port = process.env.PORT || 3000

const admin = require("firebase-admin");

// const serviceAccount = require("./firebase-adminsdk.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});







// Middleware to parse JSON bodies

app.use(cors())

// app.use(
//    '/webhook',
//    express.raw({ type: 'application/json' })
// );
app.use(express.json());

const verifyFirebaseToken =
async(req, res, next) => {

   const authHeader =
   req.headers.authorization;

   if(!authHeader){

      return res.status(401).send({

         message: 'unauthorized access'
      });
   }

   const token =
   authHeader.split(' ')[1];

   try {

      const decoded =
      await admin.auth()

      .verifyIdToken(token);

      req.decoded = decoded;

      next();

   } catch(error){

      return res.status(401).send({

         message: 'unauthorized access'
      });
   }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tav8afj.mongodb.net/?appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('ShopSphere');
    const usersCollection = db.collection('users');
    const productsCollection = db.collection('products');
    const  categoriesCollection = db.collection('categories');
    const ordersCollection = db.collection('orders');
    const reviewsCollection = db.collection('reviews');
    const blogsCollection = db.collection('blogs');







   const verifyAdmin = async(req, res, next) => {

   const email =
   req.decoded.email;

   const user =
   await usersCollection.findOne({

      email
   });

   if(user?.role !== "admin"){

      return res.status(403).send({

         message: 'forbidden access'
      });
   }

   next();
};


// API endpoint to create a new user
// API endpoint to create a new user
    app.post('/users', async (req, res) => {
      
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.status(400).send({ 
          message: 'User already exists',
          inserted: false
         });
      }

      user.role = 'user';
      user.isPremium = false;
      user.isBanned = false;
      user.createdAt = new Date();
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

// ...API endpoint to get all users, only for admin
    app.get('/users', async(req, res) => {

   const users =
   await usersCollection.find().toArray();

   // add total lessons count
   const usersWithLessons =
   await Promise.all(

      users.map(async(user) => {

         const totalLessons =
         await lessonsCollection.countDocuments({

            creatorEmail: user.email
         });

         return {

            ...user,

            totalLessons
         };
      })
   );

   res.send(usersWithLessons);
});

//socailLogin check and create user if not exists
app.get('/users/email/:email', async(req, res) => {

   const email = req.params.email;

   const user =
   await usersCollection.findOne({

      email
   });

   res.send(user);
});



app.patch(
  '/users/admin/:id',
  verifyFirebaseToken,
  verifyAdmin,

  async (req, res) => {

    const id = req.params.id;

    // find target user first
    const targetUser = await usersCollection.findOne({
      _id: new ObjectId(id)
    });

    // update role
    const result = await usersCollection.updateOne(
      {
        _id: new ObjectId(id)
      },

      {
        $set: {
          role: 'admin'
        }
      }
    );

    // activity log
    await adminActivitiesCollection.insertOne({

      adminEmail: req.decoded.email,

      action: "Made Admin",

      targetUserEmail: targetUser?.email,

      targetUserName: targetUser?.name,

      timestamp: new Date()
    });

    // send updated user
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(id)
    });

    res.send({
      modifiedCount: result.modifiedCount,
      updatedUser
    });
  }
);

//...API endpoint to delete a user, only for admin
app.delete(

   '/users/:id',

   verifyFirebaseToken,

   verifyAdmin,

   async(req, res) => {

      const id =
      req.params.id;

      // find user first
      const user =
      await usersCollection.findOne({

         _id: new ObjectId(id)
      });

      // delete user
      const result =
      await usersCollection.deleteOne({

         _id: new ObjectId(id)
      });

      // save admin activity
      await adminActivitiesCollection.insertOne({

         adminEmail:
         req.decoded.email,

         action: "Deleted User",

         deletedUserEmail:
         user?.email,

         deletedUserName:
         user?.name,

         timestamp: new Date()
      });

      res.send(result);
});


//.................................product fe  ature API endpoints..............................
app.get("/featured-products", async (req, res) => {
  try {
    const result = await productsCollection
      .find()
      .limit(8)
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch products",
    });
  }
});


//...................................category API endpoints...............................

app.get("/categories", async (req, res) => {

  const categories = await categoriesCollection.find().toArray();

  const result = await Promise.all(

    categories.map(async (category) => {

      const count = await productsCollection.countDocuments({
        category: category.name,
      });

      return {
        ...category,
        productCount: count,
      };
    })
  );

  res.send(result);
});

//..............................speacial deal API endpoints................................

app.get("/special-deals", async (req, res) => {
  try {

    const result = await productsCollection
      .find({ isDeal: true })
      .limit(8)
      .toArray();

    res.send(result);

  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Failed to fetch special deals"
    });
  }
});


//..................statistics API endpoints................................

app.get("/statistics", async (req, res) => {
  try {

    const products =
      await productsCollection.countDocuments();

    const categories =
      await categoriesCollection.countDocuments();

    const customers =
      await usersCollection.countDocuments();

    const orders =
      await ordersCollection.countDocuments();

    res.send({
      products,
      categories,
      customers,
      orders,
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to load statistics",
    });
  }
});

//......................review API endpoints................................

app.get("/reviews", async (req, res) => {
  try {

    const result = await reviewsCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.send(result);

  } catch (error) {

    res.status(500).send({
      message: "Failed to load reviews"
    });

  }
});

//.............................blogs API endpoints................................

app.get("/blogs", async (req, res) => {
  try {

    const result = await blogsCollection
      .find()
      .sort({ publishDate: -1 })
      .limit(3)
      .toArray();

    res.send(result);

  } catch (error) {

    res.status(500).send({
      message: "Failed to fetch blogs"
    });

  }
});

//................................product detalis.............................

app.get("/products/:id", async (req, res) => {
  const id = req.params.id;

  const result = await productsCollection.findOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});


//............................product reviews.............................

app.get("/reviews/:productId", async (req, res) => {

  const result = await reviewsCollection
    .find({
      productId: req.params.productId,
    })
    .toArray();

  res.send(result);
});

//..........................related products.............................



app.get("/related-products/:category", async (req, res) => {

  const result = await productsCollection
    .find({
      category: req.params.category,
    })
    .limit(4)
    .toArray();

  res.send(result);
});


//.....................product shop.....................................

app.get("/products", async (req, res) => {
  const {
    search = "",
    category = "",
    sort = "",
    page = 1,
    limit = 8,
  } = req.query;

  const query = {};

  if (search) {
    query.title = {
      $regex: search,
      $options: "i",
    };
  }

  if (category) {
    query.category = category;
  }

  let sortOption = {};

  if (sort === "low-high") {
    sortOption.price = 1;
  }

  if (sort === "high-low") {
    sortOption.price = -1;
  }

  if (sort === "rating") {
    sortOption.rating = -1;
  }

  const skip =
    (parseInt(page) - 1) *
    parseInt(limit);

  const products =
    await productsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

  const total =
    await productsCollection.countDocuments(query);

  res.send({
    products,
    total,
  });
});















app.patch('/users/profile/:email', async(req, res) => {

   const email = req.params.email;

   const { name, photoURL } = req.body;

   const result =
   await usersCollection.updateOne(

      { email },

      {
         $set: {
            name,
            photoURL
         }
      }
   );

   res.send(result);
});
























    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Life Spark is Running!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
