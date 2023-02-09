require('dotenv').config('.env');
const cors = require('cors');
const express = require('express');
const app = express();
const morgan = require('morgan');
const { PORT = 3000 } = process.env;
const jwt = require('jsonwebtoken');
const {JWT_SECRET} = process.env;
// TODO - require express-openid-connect and destructure auth from it
const { auth } = require('express-openid-connect');
const { User, Cupcake } = require('./db');

// middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

/* *********** YOUR CODE HERE *********** */
// follow the module instructions: destructure config environment variables from process.env
// follow the docs:
  // define the config object
  // attach Auth0 OIDC auth router
  // create a GET / route handler that sends back Logged in or Logged out

  const {
    AUTH0_SECRET, // generate one by using: `openssl rand -base64 32`
    AUTH0_AUDIENCE,
    AUTH0_CLIENT_ID,
    AUTH0_BASE_URL,
  } = process.env;
  
  const config = {
    authRequired: false, // this is different from the documentation
    auth0Logout: true,
    secret: AUTH0_SECRET,
    baseURL: AUTH0_AUDIENCE,
    clientID: AUTH0_CLIENT_ID,
    issuerBaseURL: AUTH0_BASE_URL,
  };

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));


// auth middleware to use JWT and set the returned data as req.user
const setUser = async (req, res, next) => {
  const auth = req.header("Authorization");
  console.log(auth)
  if(!auth){
    console.log("auth does not exist")
      next();
  } else {
      const [, token] = auth.split(' ');
      const user = jwt.verify(token, JWT_SECRET);
      console.log("This is my token: ", token)
      req.user = user;
      next();
  }
}

// middleware to find or create a user and save the user data in the db
app.use(async (req, res, next) => {
  console.log("findorCreate")
  console.log("req.oidc:", req.oidc)
  const [user] = await User.findOrCreate({
    where: {
      username: req.oidc.user.nickname,
      name: req.oidc.user.name,
      email: req.oidc.user.email
    }
  });
  console.log("user: ", user);
  next();
});

// req.isAuthenticated is provided from the auth router
app.get('/', setUser, (req, res) => {
  console.log("req.oidc.user: ", req.oidc.user);
  res.send(req.oidc.isAuthenticated() ? 
  `<h1>My Web App, Inc.</h1> 
  <h2>Welcome, ${req.oidc.user.name}</h2> 
  <h3>Username: ${req.oidc.user.nickname}</h3>
  <h3>${req.oidc.user.email}</h3>
  <img src="${req.oidc.user.picture}" alt="Kharmalina profile picture" width="150" height="150">
  ` 
  : 'Logged out');
  // res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});


app.get('/cupcakes', setUser, async (req, res, next) => {
  try {
    const cupcakes = await Cupcake.findAll();
    res.send(cupcakes);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// GET /me sends back user data and token
app.get('/me', setUser, async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: {
        username: req.oidc.user.nickname
      }
      ,
      raw: true
  });
  if (user) {
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1w' });
    res.send({user, token})
  }
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post('/cupcakes', setUser, async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).send("Request Denied: expect valid token")
    } else {
      const {title, flavor, stars} = req.body;
      const createdCupcake = await Cupcake.create({title, flavor, stars, userId: req.user.id});
      res.send(createdCupcake);
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// error handling middleware
app.use((error, req, res, next) => {
  console.error('SERVER ERROR: ', error);
  if(res.statusCode < 400) res.status(500);
  res.send({error: error.message, name: error.name, message: error.message});
});

app.listen(PORT, () => {
  console.log(`Cupcakes are ready at http://localhost:${PORT}`);
});

