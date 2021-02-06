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

  const code = req.query.code || null;  
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
      // Construct Authorisation options
      const authOptions = {
          url: 'https://accounts.spotify.com/api/token',
          form: {
              code: code,
              redirect_uri: 'http://localhost:3000/app/callback',
              grant_type: 'authorization_code'
          },
          headers: {
              'Authorization': 'Basic ' + 
                // TODO Buffer is deprecated
                  (new Buffer(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
          },
          json: true
      };

      console.log(authOptions)
      // Request tokens
      // request.post(authOptions, function(error, response, body) {
      //     console.log("Response Status Code: ", response.statusCode)
      //     const reqSuccess = !error && response.statusCode === 200
      //     if (reqSuccess) {                
      //         var access_token = body.access_token,
      //             refresh_token = body.refresh_token;
              
      //         var options = {
      //             url: 'https://api.spotify.com/v1/me',
      //             headers: { 'Authorization': 'Bearer ' + access_token },
      //             json: true
      //         };

      //         // Use the access token to access the Spotify Web API
      //         request.get(options, function(error, response, body) {
      //             console.log(body);
      //         });
              
      //         console.log("Access Token: ", access_token)
      //         console.log("Refresh Token: ", refresh_token)
      //         res.json({
      //             access_token: access_token,
      //             refresh_token: refresh_token
      //         })
              
      //     } else {
      //         console.log("ERROR!" , error);                
      //     }
      // });
      // TODO Re-implement with Axios
      axios.post(authOptions, function(error, response, body) {
        console.log("Response Status Code: ", response.statusCode)
        const reqSuccess = !error && response.statusCode === 200
        if (reqSuccess) {                
            var access_token = body.access_token,
                refresh_token = body.refresh_token;
            
            var options = {
                url: 'https://api.spotify.com/v1/me',
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };

            // Use the access token to access the Spotify Web API
            request.get(options, function(error, response, body) {
                console.log(body);
            });
            
            console.log("Access Token: ", access_token)
            console.log("Refresh Token: ", refresh_token)
            res.json({
                access_token: access_token,
                refresh_token: refresh_token
            })
            
        } else {
            console.log("ERROR!" , error);                
        }
    });
  }
});


expressApp.listen(port);
console.log("Express Server Listening on Port " + port);