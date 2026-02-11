const { Client } = require('pg');

const client = new Client({
  connectionString: 'your_neon_database_connection_string',
});

async function connectDB() {
  await client.connect();
  console.log("Connected to Neon database");
}

async function addUser(email, password) {
  await client.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, password]);
}

async function findUser(email) {
  const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);
  return res.rows[0];
}

async function addPost(content) {
  await client.query('INSERT INTO posts (content) VALUES ($1)', [content]);
}

async function getPosts() {
  const res = await client.query('SELECT * FROM posts');
  return res.rows;
}

module.exports = {
  connectDB,
  addUser,
  findUser,
  addPost,
  getPosts,
};
