const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//User Register

app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(hashedPassword);
  const getUserDetails = `
  SELECT * FROM user WHERE username = '${username}';
  `;
  const dbUser = await db.get(getUserDetails);
  if (dbUser === undefined) {
    const createUser = `
    INSERT INTO user(username, name, password, gender, location)
    VALUES(
        '${username}',
        '${name}',
        '${hashedPassword}',
        '${gender}',
        '${location}'
    );`;
    const dbResponse = await db.run(createUser);
    response.send(dbResponse);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});
