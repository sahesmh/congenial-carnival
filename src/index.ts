import express from 'express';
import dotenv from "dotenv"
import cors from "cors";

// Initialise Config
dotenv.config();

// Express App Config
const expressApp = express();

console.log("Initialising Express Endpoints");

expressApp.get('/api/placeholder', cors(), (req, res) => {
  const list = ["Hello", "World!"];
  res.json(list);
  console.log('Sent Hello World');
})

const port = process.env.EXPRESS_SERVER_PORT || 5050;
expressApp.listen(port);
console.log("Express Server Listening on Port " + port);