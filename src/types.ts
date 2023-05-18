/**
 * Types used throughout application
 */

/**
 * Data struct representing a single track
 */
export type trackData = {
    uri : string;
    name : string;
    artists : string[];
};

/**
 * Data struct representing the information of a playlist
 */
export type playlistData = {
    uri : string;
    name : string;
    ownerName : string;
};