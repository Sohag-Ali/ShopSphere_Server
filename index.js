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
    const orderCollection = db.collection('orders');
    const reviewCollection =db.collection("reviews");
    const blogsCollection = db.collection('blogs');
    const cartCollection = db.collection("cart");
    const wishlistCollection = db.collection("wishlist");
    const totalReviews =await reviewCollection.countDocuments();






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
      user.phone = "";
      user.address = "";
      user.city = "";
      user.postalCode = "";
      user.createdAt = new Date();
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

// ...............................API endpoint to get all users, only for admin
 app.get("/users",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const result =
    await usersCollection
      .find()
      .toArray();

  res.send(result);

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



app.patch('/users/admin/:id',verifyFirebaseToken,verifyAdmin,async (req, res) => {

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
app.delete('/users/:id',verifyFirebaseToken,verifyAdmin,async(req, res) => {

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

      

      res.send(result);
});

app.patch("/users/ban/:id",verifyFirebaseToken,verifyAdmin,async (req, res) => {

    const user =
      await usersCollection.findOne({

        _id:
          new ObjectId(
            req.params.id
          ),

      });

    const result =
      await usersCollection.updateOne(

        {
          _id:
            new ObjectId(
              req.params.id
            ),
        },

        {
          $set: {

            isBanned:
              !user.isBanned,

            status:
              user.status ===
              "banned"
                ? "active"
                : "banned",

          },
        }

      );

    res.send(result);

});

app.get("/users/profile/:email",verifyFirebaseToken,async (req, res) => {

    const email =
      req.params.email;

    const result =
      await usersCollection.findOne({
        email
      });

    res.send(result);

});

app.patch("/users/profile/:email",verifyFirebaseToken,async (req, res) => {

    const email =
      req.params.email;

    const updatedData =
      req.body;

    const result =
      await usersCollection.updateOne(
        {
          email
        },
        {
          $set: {

            name:
              updatedData.name,

            phone:
              updatedData.phone,

            address:
              updatedData.address,

            city:
              updatedData.city,

            postalCode:
              updatedData.postalCode,

            photoURL:
              updatedData.photoURL,

          }
        }
      );

    res.send(result);

});

app.get("/profile-stats/:email",verifyFirebaseToken,async (req, res) => {

    const email =
      req.params.email;

    const totalOrders =
      await orderCollection.countDocuments({
        userEmail: email
      });

    const totalWishlist =
      await wishlistCollection.countDocuments({
        userEmail: email
      });

    const totalReviews =
      await reviewCollection.countDocuments({
        customerEmail: email
      });

    const recentOrders =
      await orderCollection
        .find({
          userEmail: email
        })
        .sort({
          orderDate: -1
        })
        .limit(5)
        .toArray();

    res.send({

      totalOrders,

      totalWishlist,

      totalReviews,

      recentOrders,

    });

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
      // .limit(8)
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
      await orderCollection.countDocuments();

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

    const result = await reviewCollection
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
      .toArray();

    res.send(result);

  } catch (error) {

    res.status(500).send({
      message: "Failed to fetch blogs"
    });

  }
});

//................................product detalis.............................




//............................product reviews.............................

// app.get("/reviews/:productId", async (req, res) => {

//   const result = await reviewsCollection
//     .find({
//       productId: req.params.productId,
//     })
//     .toArray();

//   res.send(result);
// });

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
    deal = "",
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

  if (deal === "true") {
    query.isDeal = true;
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

//.........................dashboadrd user orders.............................

app.get("/my-orders/:email",verifyFirebaseToken, async (req, res) => {

  const email = req.params.email;

  const result =
    await orderCollection
      .find({
        userEmail: email
      })
      .toArray();

  res.send(result);

});

//............................overview user profile.............................
app.get("/user-overview/:email",verifyFirebaseToken, async (req, res) => {

  const email = req.params.email;

  const totalOrders =
    await orderCollection.countDocuments({
      userEmail: email,
    });

  const totalWishlist =
    await wishlistCollection.countDocuments({
      userEmail: email,
    });

  const totalReviews =
    await reviewCollection.countDocuments({
      customerEmail: email,
    });

  const recentOrders =
    await orderCollection
      .find({
        userEmail: email,
      })
      .sort({ orderDate: -1 })
      .limit(5)
      .toArray();

  res.send({
    totalOrders,
    totalWishlist,
    totalReviews,
    accountStatus: "Active",
    recentOrders,
  });

});

//.............................wishlist API endpoints.............................

app.post("/wishlist",verifyFirebaseToken, async (req, res) => {

  const wishlistItem = req.body;

  const exists =
    await wishlistCollection.findOne({
      userEmail: wishlistItem.userEmail,
      productId: wishlistItem.productId,
    });

  if (exists) {

    return res.send({
      inserted: false,
      message:
        "Already Added",
    });

  }

  const result =
    await wishlistCollection.insertOne(
      wishlistItem
    );

  res.send(result);

});


//.......................get wishlist items.............................

app.get("/wishlist/:email",verifyFirebaseToken, async (req, res) => {

  const email =
    req.params.email;

  const result =
    await wishlistCollection
      .find({
        userEmail: email,
      })
      .toArray();

  res.send(result);

});

//......................delete wishlist item.............................

app.delete("/wishlist/:id",verifyFirebaseToken, async (req, res) => {

  const id =
    req.params.id;

  const result =
    await wishlistCollection.deleteOne({
      _id: new ObjectId(id),
    });

  res.send(result);

});


















//..........................my reviews API endpoints.............................
app.get("/my-reviews/:email",verifyFirebaseToken, async (req, res) => {

  const email = req.params.email;

  const result =
    await reviewCollection
      .find({
        customerEmail: email
      })
      .sort({
        createdAt: -1
      })
      .toArray();

  res.send(result);

});

//................delete review API endpoint.............................

app.delete("/reviews/:id",verifyFirebaseToken, async (req, res) => {

  const id = req.params.id;

  const result =
    await reviewCollection.deleteOne({
      _id: new ObjectId(id)
    });

  res.send(result);

});


//..........................admin dashboard API endpoints.............................

app.get("/admin-overview", verifyFirebaseToken,verifyAdmin, async (req, res) => {
  try {

    const totalProducts =
      await productsCollection.countDocuments();

    const totalUsers =
      await usersCollection.countDocuments();

    const totalOrders =
      await orderCollection.countDocuments();

    const totalCategories =
      await categoriesCollection.countDocuments();

    const recentOrders =
      await orderCollection
        .find()
        .sort({ orderDate: -1 })
        .limit(5)
        .toArray();

    res.send({
      totalProducts,
      totalUsers,
      totalOrders,
      totalCategories,
      recentOrders,
    });

  } catch (error) {

    console.log(error);

    res.status(500).send({
      message: "Failed to load dashboard"
    });

  }
});
//..............................ad product API endpoint.............................

app.post("/products",verifyFirebaseToken,verifyAdmin, async (req, res) => {
  try {

    const product = req.body;

    const result =
      await productsCollection.insertOne(
        product
      );

    res.send({
      insertedId:
        result.insertedId,
      success: true,
    });

  } catch (error) {

    console.log(error);

    res.status(500).send({
      success: false,
      message:
        "Failed to add product",
    });

  }
});

//.........................grt single product API endpoint.............................

app.get("/products/:id", async (req, res) => {

  try {

    const id =
      req.params.id;

    const result =
      await productsCollection.findOne({
        _id:
          new ObjectId(id)
      });

    res.send(result);

  } catch (error) {

    console.log(error);

    res.status(500).send({
      message:
        "Failed to fetch product"
    });

  }

});

//.......................delete product API endpoint.............................

app.delete("/products/:id",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  try {

    const id =
      req.params.id;

    const result =
      await productsCollection.deleteOne({
        _id:
          new ObjectId(id)
      });

    res.send(result);

  } catch (error) {

    console.log(error);

    res.status(500).send({
      message:
        "Failed to delete product"
    });

  }

});

//...........................make deal API endpoint.............................

app.patch("/products/deal/:id",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  try {

    const id =
      req.params.id;

    const {
      discountPrice
    } = req.body;

    const result =
      await productsCollection.updateOne(

        {
          _id:
            new ObjectId(id)
        },

        {
          $set: {

            isDeal: true,

            discountPrice:
              Number(
                discountPrice
              )

          }
        }

      );

    res.send(result);

  } catch (error) {

    console.log(error);

    res.status(500).send({
      message:
        "Failed to make deal"
    });

  }

});

//................................remove deal API endpoint.............................

app.patch("/products/remove-deal/:id",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  try {

    const id =
      req.params.id;

    const result =
      await productsCollection.updateOne(

        {
          _id:
            new ObjectId(id)
        },

        {
          $set: {
            isDeal: false
          },

          $unset: {
            discountPrice: ""
          }
        }

      );

    res.send(result);

  } catch (error) {

    console.log(error);

    res.status(500).send({
      message:
        "Failed to remove deal"
    });

  }

});

//.............................update product API endpoint.............................

app.patch("/products/:id", verifyFirebaseToken,verifyAdmin, async (req, res) => {

  try {

    const id =
      req.params.id;

    const updatedData =
      req.body;

    const result =
      await productsCollection.updateOne(

        {
          _id:
            new ObjectId(id)
        },

        {
          $set:
            updatedData
        }

      );

    res.send(result);

  } catch (error) {

    console.log(error);

    res.status(500).send({
      message:
        "Failed to update product"
    });

  }

});

//............................admin get products API endpoint.............................
app.get("/admin/products",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  try {

    const result =
      await productsCollection
        .find()
        .sort({
          createdAt: -1
        })
        .toArray();

    res.send(result);

  } catch (error) {

    console.log(error);

    res.status(500).send({
      message:
        "Failed to fetch products"
    });

  }

});

//............................. Get all categories API endpoint.............................

// app.get("/categories", async (req, res) => {

//   const result =
//     await categoriesCollection
//       .find()
//       .toArray();

//   res.send(result);

// });

//............................. Add category API endpoint.............................
app.post("/categories", verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const category =
    req.body;

  const result =
    await categoriesCollection.insertOne(
      category
    );

  res.send(result);

});

//............................update category API endpoint.............................

app.patch("/categories/:id", verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const id =
    req.params.id;

  const updatedData =
    req.body;

  const result =
    await categoriesCollection.updateOne(

      {
        _id:
          new ObjectId(id)
      },

      {
        $set:
          updatedData
      }

    );

  res.send(result);

});

//............................delete category API endpoint.............................

app.delete("/categories/:id",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const id =
    req.params.id;

  const result =
    await categoriesCollection.deleteOne({
      _id:
        new ObjectId(id)
    });

  res.send(result);

});

//........................get order API endpoint.............................


app.get("/orders",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const result =
    await orderCollection
      .find()
      .sort({
        orderDate: -1
      })
      .toArray();

  res.send(result);

});

//...............................update order status API endpoint.............................


app.patch("/orders/:id", verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const id =
    req.params.id;

  const { status } =
    req.body;

  const result =
    await orderCollection.updateOne(

      {
        _id:
          new ObjectId(id)
      },

      {
        $set: {
          status
        }
      }

    );

  res.send(result);

});

//..........................delete order API endpoint.............................

app.delete("/orders/:id",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const id =
    req.params.id;

  const result =
    await orderCollection.deleteOne({
      _id:
        new ObjectId(id)
    });

  res.send(result);

});

//.............................get all revirews API endpoint.............................

app.get("/admin/reviews",verifyFirebaseToken,verifyAdmin, async (req, res) => {

  const result =
    await reviewCollection
      .find()
      .sort({
        createdAt: -1
      })
      .toArray();

  res.send(result);

});

//..............................delete review API endpoint.............................

// app.delete("/reviews/:id", async (req, res) => {

//   const id =
//     req.params.id;

//   const result =
//     await reviewsCollection.deleteOne({
//       _id:
//         new ObjectId(id)
//     });

//   res.send(result);

// });

//............................cart API endpoints.............................

app.post("/cart",verifyFirebaseToken, async (req, res) => {
  try {

    const cartItem = req.body;

    const existing =
      await cartCollection.findOne({
        userEmail: cartItem.userEmail,
        productId: cartItem.productId,
      });

    if (existing) {

      const updateResult =
        await cartCollection.updateOne(
          {
            userEmail:
              cartItem.userEmail,
            productId:
              cartItem.productId,
          },
          {
            $inc: {
              quantity:
                cartItem.quantity,
            },
          }
        );

      return res.send({
        updated: true,
        modifiedCount:
          updateResult.modifiedCount,
      });

    }

    const result =
      await cartCollection.insertOne(
        cartItem
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      message:
        "Failed to add cart",
    });

  }
});
//........................get cart items API endpoint.............................

app.get("/cart/:email",verifyFirebaseToken, async (req, res) => {
  try {
    const result =
      await cartCollection
        .find({
          userEmail: req.params.email,
        })
        .toArray();

    res.send(result);

  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch cart",
    });
  }
});

//........................delete cart item API endpoint.............................

app.delete("/cart/:id",verifyFirebaseToken, async (req, res) => {
  const result =
    await cartCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

  res.send(result);
});

//.......................increment cart item quantity API endpoint.............................

app.patch("/cart/increase/:id",verifyFirebaseToken, async (req, res) => {
  const id = req.params.id;

  const result = await cartCollection.updateOne(
    {
      _id: new ObjectId(id),
    },
    {
      $inc: {
        quantity: 1,
      },
    }
  );

  res.send(result);
});

//.......................decrement cart item quantity API endpoint.............................

app.patch("/cart/decrease/:id",verifyFirebaseToken, async (req, res) => {
  const id = req.params.id;

  const item =
    await cartCollection.findOne({
      _id: new ObjectId(id),
    });

  if (item.quantity <= 1) {
    return res.send({
      message: "Minimum quantity reached",
    });
  }

  const result = await cartCollection.updateOne(
    {
      _id: new ObjectId(id),
    },
    {
      $inc: {
        quantity: -1,
      },
    }
  );

  res.send(result);
});

//.........................post wishlist API endpoint.............................

// app.post("/wishlist",verifyFirebaseToken, async (req, res) => {

//   const wishlistItem = req.body;

//   const exists =
//     await wishlistCollection.findOne({
//       userEmail: wishlistItem.userEmail,
//       productId: wishlistItem.productId,
//     });

//   if (exists) {
//     return res.send({
//       inserted: false,
//       message: "Already Added",
//     });
//   }

//   const result =
//     await wishlistCollection.insertOne(
//       wishlistItem
//     );

//   res.send(result);
// });

//........................review API endpoint.............................

app.post("/reviews",verifyFirebaseToken, async (req, res) => {

    try {

      const review =
        req.body;

      if (
        !review.productId ||
        !review.customerEmail
      ) {

        return res
          .status(400)
          .send({
            message:
              "Missing required fields",
          });

      }

//       const existingReview =
//   await reviewCollection.findOne({

//     productId:
//       review.productId,

//     customerEmail:
//       review.customerEmail,

//   });

// if (existingReview) {

//   return res
//     .status(400)
//     .send({
//       message:
//         "You already reviewed this product",
//     });

// }

      const result =
        await reviewCollection.insertOne(
          review
        );

      res.send(result);

    } catch (error) {

      console.log(error);

      res.status(500).send({
        message:
          "Failed to submit review",
      });

    }

  }
);

app.get("/reviews/:productId", async (req, res) => {
  try {

    const productId =
      req.params.productId;

    const result =
      await reviewCollection
        .find({ productId })
        .sort({ createdAt: -1 })
        .toArray();

    res.send(result);

  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.patch("/reviews/:id",verifyFirebaseToken,async (req, res) => {

    const id =
      req.params.id;

    const {
      rating,
      comment,
    } = req.body;

    const result =
      await reviewCollection.updateOne(

        {
          _id:
            new ObjectId(id)
        },

        {
          $set: {
            rating,
            comment,
          }
        }

      );

    res.send(result);

});

app.delete("/reviews/:id",verifyFirebaseToken,
  async (req, res) => {

    const id =
      req.params.id;

    const result =
      await reviewCollection.deleteOne({

        _id:
          new ObjectId(id)

      });

    res.send(result);

});

app.post("/save-order/:sessionId",verifyFirebaseToken,async (req, res) => {

    try {

      const session =
        await stripe.checkout.sessions.retrieve(
          req.params.sessionId
        );

      const existingOrder =
        await orderCollection.findOne({
          sessionId: session.id,
        });

      if (existingOrder) {

        return res.send({
          message:
            "Order Already Saved",
        });

      }

      const checkoutType =
        session.metadata.checkoutType;

      // CART CHECKOUT
      if (
        checkoutType === "cart"
      ) {

        const cartItems =
          await cartCollection
            .find({

              userEmail:
                session.metadata.userEmail,

            })
            .toArray();

        for (const item of cartItems) {

          await orderCollection.insertOne({

            sessionId:
              session.id,

            userEmail:
              session.metadata.userEmail,

            userName:
              session.metadata.userName,

            productId:
              item.productId,

            productTitle:
              item.title,

            productImage:
              item.image,

            quantity:
              item.quantity,

            price:
              item.price,

            totalPrice:
              item.price *
              item.quantity,

            status:
              "pending",

            orderDate:
              new Date(),

          });

          await productsCollection.updateOne(

            {
              _id:
                new ObjectId(
                  item.productId
                ),
            },

            {
              $inc: {
                stock:
                  -item.quantity,
              },
            }

          );

        }

        await cartCollection.deleteMany({

          userEmail:
            session.metadata.userEmail,

        });

        return res.send({

          success: true,

          message:
            "Cart Order Saved",

        });

      }

      // BUY NOW CHECKOUT

      const {

        userEmail,

        userName,

        productId,

        productTitle,

        productImage,

        price,

        quantity,

      } = session.metadata;

      const quantityNumber =
        Number(quantity);

      const orderData = {

        sessionId:
          session.id,

        userEmail,

        userName,

        productId,

        productTitle,

        productImage,

        price:
          Number(price),

        quantity:
          quantityNumber,

        totalPrice:
          Number(price) *
          quantityNumber,

        status:
          "pending",

        orderDate:
          new Date(),

      };

      const result =
        await orderCollection.insertOne(
          orderData
        );

      await productsCollection.updateOne(

        {
          _id:
            new ObjectId(
              productId
            ),
        },

        {
          $inc: {
            stock:
              -quantityNumber,
          },
        }

      );

      res.send(result);

    } catch (error) {

      console.log(error);

      res.status(500).send({

        message:
          "Failed To Save Order",

      });

    }

  }
);



app.get("/admin/profile/:email",verifyFirebaseToken,verifyAdmin,async (req, res) => {

    const email = req.params.email;

    const user =
      await usersCollection.findOne({
        email,
      });

    const totalProducts =
      await productsCollection.countDocuments();

    const totalUsers =
      await usersCollection.countDocuments();

    const totalOrders =
      await orderCollection.countDocuments();

    const totalReviews =
      await reviewCollection.countDocuments();

    const orders =
      await orderCollection.find().toArray();

    const totalRevenue = orders.reduce(
  (sum, order) => {

    const price =
      Number(order.price) || 0;

    const quantity =
      Number(order.quantity) || 1;

    const total =
      Number(order.totalPrice) ||
      price * quantity;

    return sum + total;

  },
  0
);

    res.send({
      user,
      totalProducts,
      totalUsers,
      totalOrders,
      totalReviews,
      totalRevenue,
    });

  }
);









    // Payment related API endpoints can be added here, for example:

    //Stipe checkout session create API
  app.post("/create-checkout-session", verifyFirebaseToken, async (req, res) => {

  try {

    const paymentInfo = req.body;

    let lineItems = [];

    // Cart Checkout
    if (paymentInfo.cartItems) {

      lineItems =
        paymentInfo.cartItems.map((item) => ({

          price_data: {

            currency: "bdt",

            unit_amount:
              item.price * 100,

            product_data: {
              name: item.title,
            },

          },

          quantity:
            item.quantity,

        }));

    }

    // Buy Now
    else {

      lineItems = [

        {
          price_data: {

            currency: "bdt",

            unit_amount:
              paymentInfo.price * 100,

            product_data: {
              name:
                paymentInfo.productTitle,
            },

          },

          quantity:
            paymentInfo.quantity,

        },

      ];

    }

    const session =
      await stripe.checkout.sessions.create({

        payment_method_types: [
          "card",
        ],

        line_items:
          lineItems,

        mode: "payment",

        metadata: {

          userEmail:
            paymentInfo.email,

          userName:
            paymentInfo.userName,

          checkoutType:
            paymentInfo.cartItems
              ? "cart"
              : "single",

          productId:
            paymentInfo.productId || "",

          productTitle:
            paymentInfo.productTitle || "",

          productImage:
            paymentInfo.productImage || "",

          price:
            paymentInfo.price?.toString() || "",

          quantity:
            paymentInfo.quantity?.toString() || "",

        },

        success_url:
          `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${process.env.SITE_DOMAIN}/payment-cancel`,

      });

    res.send({
      url: session.url,
    });

  } catch (error) {

    console.log(error);

    res.status(500).send({
      error: error.message,
    });

  }

});













    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('ShopEase API is running')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
