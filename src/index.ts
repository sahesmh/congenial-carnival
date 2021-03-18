import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import queryString from 'querystring';

// Initialise Config
dotenv.config();

// Express App Config
const expressApp = express();
const stateKey = 'spotify_auth_state';
const port = process.env.EXPRESS_SERVER_PORT || 5050;

function generateRandomString(length: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

console.log("Initialising Express Endpoints");

expressApp.get('/api/placeholder', cors(), (req, res) => {
  const list = ["Hello", "World!"];
  res.json(list);
  console.log('Sent Hello World');
})

// Spotify Login endpoint
expressApp.get('/auth/spotify', function(req, res) {
  console.log('/auth/spotify - Auth request received')

  // Send State Key
  const state = generateRandomString(16);
  res.cookie(stateKey, state);
  console.log(stateKey, state);
  
  // Construct Redirect URL
  const scope = 'user-read-private user-read-email user-top-read playlist-modify-private';  
  const responseURL = 'https://accounts.spotify.com/authorize?' +
  queryString.stringify({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: 'http://localhost:' + port + '/app/callback',            
      state: state
  });

  // Send Response
  console.log("Response will be ", responseURL);
  res.json({
      redirect_url: responseURL
  })    
});

// Spotify Callback enpoint
expressApp.get('/callback/', function(req, res) {
  console.log("Requesting Tokens")
  // Request refresh and access tokens after checking the state parameter

  // TODO No longer required?
  //const code = req.query.code || null;  
  const state = req.query.state || null;
  
  // TODO Figure out how to use state properly  
  if (state == null) {
      // TODO Later: Figure out the best way to check state
      console.log('ERR: No State')
      res.redirect('/#' +
          queryString.stringify({
          error: 'state_mismatch'
      }));
  } else {
      // TODO Clear state?      
        // Request tokens          
        axios({
            url: '/token',
            method: 'post',
            baseURL: 'https://accounts.spotify.com/api',
            params: {
                grant_type: 'client-credentials'
            },
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            auth: {
                username: process.env.CLIENT_ID,
                password: process.env.CLIENT_SECRET
            }
        }).then(function (response) {
            console.log({
                'data': response.data,
                'status' : response.status,
                'statusText' : response.statusText,
                'headers' : response.headers,
                'config' : response.config
            })
            axios({
                url: 'https://api.spotify.com/v1/me',
                method: 'get', 
                headers: {
                    'Authorization': 'Bearer ' + response.data.access_token
                }
            }).then(function (response) {
                console.log(response)
            })

            res.json({
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token
            })

        }).catch(function (error) {
            if (error.response) {
              // The request was made and the server responded with a status code
              // that falls out of the range of 2xx
              console.log(error.response.data);
              console.log(error.response.status);
              console.log(error.response.headers);
            } else if (error.request) {
              // The request was made but no response was received
              // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
              // http.ClientRequest in node.js
              console.log(error.request);
            } else {
              // Something happened in setting up the request that triggered an Error
              console.log('Error', error.message);
            }
            console.log(error.config);
          });
    }
});


expressApp.listen(port);
console.log("Express Server Listening on Port " + port);