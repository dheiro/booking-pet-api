const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host : '',
    user : '',
    password : '',
    database : ''
  }
});

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cors());

app.use(passport.initialize());
require('./passport-config')(passport);

app.set('json replacer', function (key, value) {
  if (this[key] instanceof Date) {
    // Your own custom date serialization
    value = this[key].toLocaleString('en-US', { hour12: false });
  }
  return value;
});

const port = 3000;

app.get('/', (req, res) => {
  res.send('Hellaw Cok');
});

app.post('/register', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const checkUser = await checkUsername(username);

  if (checkUser) {
    res.status(400).send('username already exists');
  } else {
    res.send('ok');
  }
  // const hash = await hashPassword(password);
  // knex('users')
  //   .insert({
  //     username: username,
  //     password: hash
  //   })
  //   .then(data => {
  //     res.json({
  //       id: data[0],
  //       username: username,
  //       password: hash
  //     });
  //   })
  //   .catch(err => {
  //     console.log(err);
  //   });
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  knex('users')
    .select('id', 'username', 'password')
    .where({
      username: username
    })
    .first()
    .then(async (user) => {
      if (user) {
        const match = await comparePassword(password, user.password);
        if (match) {
          const token = jwt.sign({ id: user.id }, 'wongbiasamati', { expiresIn: 3600 });
          res.status(200).json({
            user: user,
            token: token
          });
          // res.status(200).json({
          //   id: user.id,
          //   username: user.username,
          //   join_date: user.created_at,
          //   token: token
          // });
        } else {
          res.status(401).send('Unauthorize');
        }
      } else {
        res.status(404).send('User not found');
      }
    });
});

app.get('/me', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const id = req.user.id;
    const user = await knex('users')
                        .where('id', id)
                        .first();
    res.status(200).json(user);
  } catch (e) {
    console.log(e);
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await knex('users');
    console.table(users);
  } catch (e) {
    console.log(e);
  }
});

app.get('/pets', async (req, res) => {
  try {
    const pets = await knex('pets');
    res.status(200).json(pets);
  } catch (e) {
    console.log(e);
  }
});

app.get('/services', async (req, res) => {
  try {
    const services = await knex('services');
    res.status(200).json(services);
  } catch(e) {
    console.log(e);
  }
});

app.get('/orders', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  try {
    const orders = await knex('orders')
                            .where('user_id', userId);
    const data = await Promise.all(
      orders.map(async (order) => {
        const services = await orderService(order.id);
        const total = await totalPrice(order.id);
        return {
          id: order.id,
          date: order.date,
          services: services,
          total: total,
        };
      })
    );
    res.status(200).json(data);
  } catch(e) {
    console.log(e);
  }
});

app.get('/orders/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const order =  await knex('orders')
                            .where('id', id)
                            .first();
    
    const services = await orderService(id);
    res.status(200).json({
      ...order,
      services: services
    });
  } catch (e) {
    console.log(e);
  }
});

function totalPrice(orderId) {
  return new Promise(resolve => {
    knex('order_service')
    .leftJoin('services', 'services.id', '=', 'order_service.service_id')
    .where('order_service.order_id', orderId)
    .then(services => {
      let total = 0;
      services.forEach(service => {
        total = total + service.price;
      });
      resolve(total);
    });
  });
}

function orderService(orderId) {
  return new Promise(resolve => {
    knex('order_service')
      .leftJoin('services', 'services.id', '=', 'order_service.service_id')
      .where('order_service.order_id', orderId)
      .then(services => {
        resolve(services);
      });
  });
}

app.post('/orders', async (req, res) => {
  const userId = req.body.userId;
  const order = req.body.order;
  knex('orders')
    .insert({
      user_id: userId
    })
    .then(ids => {
      for (let service of Object.values(order.services)) {
        knex('order_service')
          .insert({
            order_id: ids[0],
            service_id: service.id
          })
          .catch(err => {
            console.log(err);
          });
      }
      res.status(201).json({
        orderId: ids[0]
      });
    })
    .catch(err => {
      console.log(err);
    });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const hashPassword = plain => {
  return new Promise((resolve, reject) => {
    bcrypt
      .hash(plain, 12)
      .then(hash => {
        resolve(hash);
      })
      .catch(err => {
        reject(err);
      });
  });
};

const comparePassword = (plain, hash) => {
  return new Promise((resolve, reject) => {
    bcrypt
      .compare(plain, hash)
      .then(match => {
        resolve(match);
      })
      .catch(err => {
        reject(err);
      });
  });
};

const checkUsername = username => {
  return new Promise((resolve, reject) => {
    knex('users')
      .select('username')
      .where('username', username)
      .first()
      .then(user => {
        if (user) {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .catch(err => {
        reject(err);
      })
  });
};
