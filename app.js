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
//middleware function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeads = request.headers["authorization"];
  if (authHeads !== undefined) {
    jwtToken = authHeads.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghj", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//register User
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;

    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//Login user
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetails = `
    SELECT * 
    FROM user
    WHERE username = '${username}';
    `;
  const dbUser = await db.get(getUserDetails);
  console.log(username);
  console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "asdfghj");
      response.send({
        jwtToken,
      });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get all states
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;
    `;
  const dbStates = await db.all(getStatesQuery);
  const convertSnakeCaseToCamelCase = (dbObj) => {
    return {
      stateId: dbObj.state_id,
      stateName: dbObj.state_name,
      population: dbObj.population,
    };
  };

  let arr = [];
  for (let each of dbStates) {
    const a = convertSnakeCaseToCamelCase(each);
    arr.push(a);
  }
  response.send(arr);
});

//get state by stateId
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetails = `
    SELECT * FROM state WHERE state_id = ${stateId};
    `;
  const dbResponse = await db.get(getStateDetails);

  const convertSnakeCaseToCamelCase = (dbObject) => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    };
  };
  response.send(convertSnakeCaseToCamelCase(dbResponse));
});

//create a district
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictDetails = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );
    `;
  const dbResponse = await db.run(postDistrictDetails);
  response.send("District Successfully Added");
});

//get a particular district by it's Id
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetails = `
    SELECT * FROM district WHERE district_id = ${districtId};
    `;
    const dbResponse = await db.get(getDistrictDetails);

    const convertSnakeCaseTOCamelCase = (dbObj) => {
      return {
        districtId: dbObj.district_id,
        districtName: dbObj.district_name,
        stateId: dbObj.state_id,
        cases: dbObj.cases,
        cured: dbObj.cured,
        active: dbObj.active,
        deaths: dbObj.deaths,
      };
    };

    response.send(convertSnakeCaseTOCamelCase(dbResponse));
  }
);

//delete a district
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDetails = `
    DELETE FROM district 
    WHERE district_id = ${districtId};
    `;
    const dbResponse = await db.run(deleteDetails);
    response.send("District Removed");
  }
);

//update the district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE district
    SET district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};
    `;
    const dbResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//get statistics
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatisticsQuery = `
    SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM state INNER JOIN district ON state.state_id = district.state_id 
    WHERE state.state_id = ${stateId}
    ORDER BY state.state_id;
    `;
    const dbResponse = await db.get(getStatisticsQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
