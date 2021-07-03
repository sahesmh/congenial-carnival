import axios, { AxiosError } from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as path from 'path';
import queryString from 'querystring';

// Initialise Config
dotenv.config();

// Express App Config
const expressApp = express();
expressApp.use(cors());
const stateKey = 'spotify_auth_state';
const port = process.env.EXPRESS_SERVER_PORT || 5050;

type trackData = {
    uri : string;
    name : string;
    artists : string[];
};

function generateRandomString(length: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function handleAxiosError(error : Error | AxiosError) {
    if (axios.isAxiosError(error)){
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(error.response.data);
            console.error(error.response.status);
            console.error(error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.error(error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
        }
        console.error(error.config);
    } else {
        // Stock Error - log and move on
        console.error(error);        
    }
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
      redirect_uri: 'http://localhost:3000/app/callback',            
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
            handleAxiosError(error);
        });
    }
});

// Get Most Played Songs endpoint
expressApp.get('/get-most-played', function(req, res) {
    console.log("Requesting songs");

    const timeRange : string = req.query.length as string || "long_term" // Will be short_term, medium_term or long_term
    const access_token : string = req.query.access_token as string
    
    // Request User's Most-Played Tracks for the given length
    axios({
        url: 'https://api.spotify.com/v1/me/top/tracks?' +
            queryString.stringify({
                time_range: timeRange,
                limit: 50
            }),
        method: 'get', 
        headers: {
            'Accept'       : 'application/json',
            'Content-Type' : 'application/json',
            'Authorization': 'Bearer ' + access_token
        }
    }).then(function (response) {
        console.log("GET Response ", response.status);                
        console.log("Successfully retrieved tracks")
        const numTracks : number = response.data.items.length;        
        let trackList : trackData[];
        for (let trackNum = 0; trackNum < numTracks; trackNum++) {
            const track : trackData= {
                uri     : response.data.items[trackNum].uri,                    
                name    : response.data.items[trackNum].name,
                artists : response.data.items[trackNum].artists
            };
            trackList[trackNum] = track;
        }        
        console.log(trackList);
        res.send({
            trackData: trackList
        });        
    // }).catch(function (error) {
    }).catch(function(error) {
        handleAxiosError(error);
    });
});

// Create Playlist endpoint
expressApp.get('/create-playlist', function(req, res) {    
    let playlistID = "UNPOPULATED"    
    console.log("Making a playlist")

    // Lets make the bold assumption that making a new playlist
    // will overwrite an old one by the same name. Or at least
    // not break things

    const timeRange : string = req.query.length as string || "long_term"
    const access_token : string = req.query.access_token as string
    const songList : string[] = req.query.songList as string[]

    // Get User's ID
    axios({
        url : 'https://api.spotify.com/v1/me',
        method : 'get',
        headers : {
            'Accept'        : 'application/json',
            'Content-Type'  : 'application/json',
            'Authorization' : 'Bearer ' + access_token
        }        
    }).then (function(response) {
        console.log("GET Response ", response.status);
        const userID : string = response.data.id;
        console.log("Obtained User ID: " + userID);
        
        axios({
            url: 'https://api.spotify.com/v1/users/' + userID + '/playlists',
            headers: {
                'Accept'        : 'application/json',
                'Content-Type'  : 'application/json',
                'Authorization' : 'Bearer ' + access_token
            },
            method : 'post',
            data : {
                name: "Most Played - " + timeRange,
                public: false,
                collaborative: false,
                description: "Courtesy of Shane :D"
            },
            transformRequest: [function (data) {
                return data.json;
            }]
        }).then (function (response) {
            console.log("POST Response ", response.status);
            playlistID = response.data.id

            // Add songs to this new playlist
            console.log("User ID: " + userID);
            console.log("Playlist ID: " + playlistID)
            console.log("Song List: " + songList)
            
            axios({
                url: 'https://api.spotify.com/v1/playlists/' + playlistID + '/tracks?uris=' + songList,
                method : "post",
                headers: {
                    'Accept'        : 'application/json',
                    'Content-Type'  : 'application/json',
                    'Authorization' : 'Bearer ' + access_token
                }                
            }).then (function(response) {
                console.log("POST Response: ", response.status);
                console.log("Successfully added songs to Playlist " + playlistID)
                res.send({
                    successful: true,
                    playlistID: playlistID
                })
            }).catch (function(error){
                // Playlist Update Failed
                handleAxiosError(error);                
                res.json({
                    successful: false,
                    playlistID: playlistID
                });
            });            
        }).catch (function(error){
            // Playlist Creation Failed
            handleAxiosError(error);
        });
    }).catch (function(error){
        // User ID Get Failed
        handleAxiosError(error);
    });    
});

// 'Any Other Request' endpoint
expressApp.get('*', (req,res) =>{
    console.log("User reached Any Other Requests endpoint with URL ", req.originalUrl)
    res.sendFile(path.join(__dirname+'/client/public/index.html'));
});

expressApp.listen(port);
console.log("Express Server Listening on Port " + port);