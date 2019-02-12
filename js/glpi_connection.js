/*
 * Configure Glpi server parameters for connecting the REST API
 * -----
 * Note that all these parameters may also be provided in the application home pahe parameters
 */
let g_scheme = "http";
let g_server = "localhost";
let g_port = "80";
let g_path = "";

let g_plugin_webservices = true;

// Application token got from Glpi setup
// Overriden with app_token as application URL parameter
let g_app_token = 'KcsQNgF0V7is0sn5jouoAupIm94clhkvcEBDSN4m';       // An example for localhost
// let g_app_token = "GJaOmD2ckevwB4vTIJvgynlzrY71id2wQYHRgdgs";       // Another example

// User token got from Glpi user settings
// Overriden with user_token as application URL parameter
let g_user_token = null;        // No user token to activate user login
// let g_user_token = "jZGjP7YBsFfEqkl2CRJq9Q2jJ5sz8uwMCQ4gvhIU";      // An example of user token to avoid login...
