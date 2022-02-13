import axios, { AxiosError } from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as path from 'path';

// Initialise Config
dotenv.config();

// Express App Config
const expressApp = express();
expressApp.use(cors());
const stateKey = 'spotify_auth_state';
const port = process.env.EXPRESS_SERVER_PORT || 5050;
const redirectURI = 'http://localhost:3000/app/callback';

type trackData = {
    uri : string;
    name : string;
    artists : string[];
};

type playlistData = {
    id : string;
    uri : string;
    name : string;
    owner_id : string;
    num_tracks : number;
    tracks_api_ref : string;
}

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
  const responseParams = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: redirectURI,            
      state: state
    }).toString();
  const responseURL = 'https://accounts.spotify.com/authorize?' + responseParams;

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
  const authorizationCode = req.query.code || null;  
  const state = req.query.state || null;
  
  // TODO Figure out how to use state properly  
  if (state == null) {
      // TODO Later: Figure out the best way to check state
      console.log('ERR: No State')
      const errorParams = new URLSearchParams({
        error: 'state_mismatch'
      }).toString();
      res.redirect('/#' + errorParams);
  } else {
      // TODO Clear state?      
        // Request tokens          
        axios({
            url: '/token',
            method: 'post',
            baseURL: 'https://accounts.spotify.com/api',
            params: { // All paremeters here are required for Authorization Code Flow
                grant_type: 'authorization_code',
                code: authorizationCode,
                redirect_uri: redirectURI
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
            console.log("Received response to token request")
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
                console.log("Recieved response to user data request")
                console.log(response)
            })

            console.log("Sending tokens as response to /callback/")
            res.json({
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token
            })

        }).catch(function (error) {
            console.error("Error requesting tokens")
            handleAxiosError(error);
        });
    }
});

// Get Most Played Songs endpoint
expressApp.get('/get-most-played', function(req, res) {
    console.log("Requesting songs");

    const timeRange : string = req.query.length as string || "long_term" // Will be short_term, medium_term or long_term
    const access_token : string = req.query.access_token as string
    
    const requestParams = new URLSearchParams({
        time_range: timeRange,
        limit: "50"
    }).toString();

    // Request User's Most-Played Tracks for the given length
    axios({
        url: 'https://api.spotify.com/v1/me/top/tracks?' + requestParams,
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
        const trackList : trackData[] = [];
        for (let trackNum = 0; trackNum < numTracks; trackNum++) {
            console.log("Up to Track Num ", trackNum);
            const track : trackData = {
                uri     : response.data.items[trackNum].uri,                    
                name    : response.data.items[trackNum].name,
                artists : response.data.items[trackNum].artists
            };            
            trackList.push(track);
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
            }
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

// Get User's Playlists endpoint
// TODO currently untested
expressApp.get('/get-user-playlists', function(req, res) {

    const playlistLimit : string = req.query.limit as string || "10"
    const playlistOffset : string = req.query.offset as string || "0"
    const access_token : string = req.query.access_token as string

    const requestParams = new URLSearchParams({
        limit: playlistLimit,
        offset: playlistOffset
    }).toString();

    axios({
        url: 'https://api.spotify.com/v1/me/playlists?' + requestParams,
        method: 'get',
        headers: {
            'Accept'        : 'application/json',
            'Content-Type'  : 'application/json',
            'Authorization' : 'Bearer ' + access_token
        }
    }).then(function (response) {
        console.log("GET Response ", response.status);
        console.log("Successfully retrieved current user's playlists")
        const numPlaylists : number = response.data.items.length;
        const playlistList : playlistData[] = [];
        // TODO the Spotify API endpoint can only retrieve max 50 playlists. Create a do-while loop with nextRequest != null as the condition to get all the user's playlists.
        // const nextRequest : string = response.data.next;
        for (let playlistNum = 0; playlistNum < numPlaylists; playlistNum++) {
            console.log("Up to Playlist Num ", playlistNum);
            const track : playlistData = {
                id      : response.data.items[playlistNum].id,
                uri     : response.data.items[playlistNum].uri,
                name    : response.data.items[playlistNum].name,
                owner_id: response.data.items[playlistNum].owner.id,
                num_tracks: response.data.items[playlistNum].tracks.total,
                tracks_api_ref : response.data.items[playlistNum].tracks.href
            };
            playlistList.push(track);
        }
        console.log(playlistList);
        res.send({
            playlistData: playlistList
        });
    }).catch(function(error) {
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