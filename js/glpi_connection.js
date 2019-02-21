/*
 * Configure Glpi server parameters for connecting the REST API
 * -----
 * Note that all these parameters may also be provided in the application home pahe parameters
 */
let g_scheme = "http";
let g_server = "localhost";
let g_port = "80";
let g_path = "";

// Default is not to use WS plugin - set true to change this
let g_plugin_webservices = false;
// g_plugin_webservices = false;

/*
* Utility function to build WS url
* -----
* Nginx configuration for the core REST URI
   location /api {
      more_set_headers 'Access-Control-Allow-Origin: *';
      more_set_headers 'Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE';
      more_set_headers 'Access-Control-Allow-Credentials: true';
      more_set_headers 'Access-Control-Allow-Headers: Origin,Content-Type,Accept,Authorization,App-Token,Session-Token';

      if ($request_method = OPTIONS ) {
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 200;
      }

      rewrite ^/api/(.*)$ /glpi-9.3/apirest.php/$1 last;
   }

* Nginx configuration for the Web services plugin URI
   location /api_plugin {
      more_set_headers 'Access-Control-Allow-Origin: *';
      more_set_headers 'Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE';
      more_set_headers 'Access-Control-Allow-Credentials: true';
      more_set_headers 'Access-Control-Allow-Headers: Origin,Content-Type,Accept,Authorization,App-Token,Session-Token';

      if ($request_method = OPTIONS ) {
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 200;
      }

      rewrite ^/api_plugin$ /glpi-9.3/plugins/webservices/rest.php last;
   }
*/

// According to this nginx configuration, set the appropriate path
if (g_plugin_webservices) {
    g_path = g_path + '/api_plugin';
} else {
    // g_path = g_path + '/api';
    g_path = g_path + '/apirest.php';
}

// Application token got from Glpi setup
// Overriden with app_token as application URL parameter
let g_app_token = 'KcsQNgF0V7is0sn5jouoAupIm94clhkvcEBDSN4m';       // An example for localhost
// let g_app_token = "GJaOmD2ckevwB4vTIJvgynlzrY71id2wQYHRgdgs";       // Another example
g_app_token = "SWKPyFWDDIbi9vFjtD4UUa3qNbZMx5p0GsOR2iQi";

// User token got from Glpi user settings
// Overriden with user_token as application URL parameter
let g_user_token = null;        // No user token to activate user login
// let g_user_token = "jZGjP7YBsFfEqkl2CRJq9Q2jJ5sz8uwMCQ4gvhIU";      // An example of user token to avoid login...
g_user_token = "rqQThuImhyMIZllF4UcTpcutxac8SS7LDyyt7moN";
