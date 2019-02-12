/*
 * Author: Frédéric MOHIER
 * Date: Jan 2017
 * ---
 * Description:
 *  Functions and variables to connect Glpi with the Web service interface
 * ---
 * Version:
 *  Upgrade to use the most recent Glpi REST API
 * ---------------------------------------------------------------------------
 *  Copyright (c) 2017-2018 : Frédéric Mohier
 */

/*
 * Application manifest
 */
let applicationManifest = {
    version: '0.0.1',
    copyright: '(c) 2019: Frédéric Mohier',
    license: 'tbd',
    release: ""
};


/*
 * Console logs debug variables
 *  g_debugJs: general information
 */
let g_debugJs = true;


/*
 * Server connection status and parameters
 */
let g_session_token = null;
let g_server_available = false;
let g_server_failed_connections_count = 0;
let g_server_failed_connections_max = 5;

// refresh period if connection is not established
let g_refreshPeriod = 60;

// Allow storage of a JSON object in a cookie ...
$.cookie.json = true;

/*
 * User settings
 * - JSON object
 * - updated with the content of the conf/default.json file
 */
let userSettings = {
    // Server's name
    server: '',

    pages: {
        home_page: "panel-server"
    },

    // Tickets counters
    tickets_counters: {
        // Extra information in conf/default.json
    },

    // Tickets table display
    tickets_table: {
        // Extra information in conf/default.json

        // Tables counts
        counts: {
            // For each table, dynamically built information
            // table: {
            //     range_min: 0,
            //     range_max: 0,
            //     count: 0,
            //     total_count: 0,
            // }
        },
        // Tables search parameters
        search_parameters: {

        },
        // Tables conversion methods
        convert: {
            // Examples
            "1": "boolean",
            // fa-check if true
            // fa-times if false
            "2": "boolean-color",
            // fa-check if true
            // fa-times if false
            "3": "boolean-warning",
            // fa-times + text-danger si true
            // fa-check + text-success si true
            "4": "seconds-duration",
            // convert 1 seconds to "1 day, 1 hour, 1 minute, 1 second"
        },
        translate: {}
    }
};
if ($.cookie('session')) {
    g_session_token = $.cookie('session');
    if (g_debugJs) console.debug('cookie, existing session: ', g_session_token);
}

/*
 * Get the application configuration file
 */
function getDefaultConfiguration(file_location) {
    if (g_debugJs) console.info('getDefaultConfiguration: ', file_location);

    return $.getJSON(file_location)
    .done( function(response) {
        if (g_debugJs) console.debug('Default configuration: ', response);

        // Update the userSettings variable with the received data
        $.each(response, function (key, value) {
            $.each(value, function (sub_key, value) {
                if (g_debugJs) console.debug("Configuration: ", key, sub_key, value);
                userSettings[key][sub_key] = value;
            })
        })
    })
    .fail(function( jqXHR, textStatus, errorThrown ) {
        console.error('Loading json ' + file_location + ', error: ', errorThrown);
        console.error(jqXHR);
    });
    /*
       Default configuration may be fetched from the server...
        As an example, it may be:
        wsCall('defaultConfiguration', {
            //debug: true,
            name: 'default'
        })
        .done( function( response) {
            console.log('Default configuration: ', response);
        })
        .fail(function( jqXHR, textStatus, errorThrown ) {
            console.error(userName+'.json -> error: ', errorThrown)
        })
    */
}

/*
* Utility function to build WS url
* -----
* Nginx configuration for the status URI
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

*/
function get_ws_url(sEndpoint) {
    let url = g_scheme + "://" + g_server + ":" + g_port + g_path;
    if (sEndpoint) {
        url = url + '/api/' + sEndpoint;
    } else {
        url = url + '/api_plugin';
    }
    return url;
}

/*
* Utility function to build status url
* -----
* Nginx configuration for the status URI
*    location /status {
      more_set_headers 'Access-Control-Allow-Origin: *';
      more_set_headers 'Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE';
      more_set_headers 'Access-Control-Allow-Credentials: true';
      more_set_headers 'Access-Control-Allow-Headers: Origin,Content-Type,Accept,Authorization,App-Token,Session-Token';

      if ($request_method = OPTIONS ) {
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 200;
      }

      rewrite ^/status$ /glpi-9.3/status.php last;
   }
*/
function get_status_url() {
  return g_scheme + "://" + g_server + ":" + g_port + '/status';
}

/*
* Utility function to get URL parameters
* -----
* Return the value of sParam if it exist in the URL query parameters
*/
function get_url_parameter(sParam) {
    let sPageURL = window.location.search.substring(1);
    let sURLVariables = sPageURL.split('&');
    for (let i = 0; i < sURLVariables.length; i++) {
        let sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] === sParam) {
            return sParameterName[1];
        }
    }
    return null;
}

/*
 * Update collapsible state
 * - read the local storage of the browser to find cs_category values
 * - set the collapsible state according to the value 1 or 0
 */
function _update_collapsible_state(category, key) {
    if (key !== undefined) {
        if (localStorage.getItem(key) === "1") {
            $("#" + category).collapse('show');
        } else {
            $("#" + category).collapse('hide');
        }
        return;
    }

    // Collapsed states
    for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).startsWith("cs_" + category)) {
            let key = localStorage.key(i);
            let item = key.replace('cs_', '');
            if (localStorage.getItem(key) === "1") {
                $("#" + item).collapse('show');
            } else {
                $("#" + item).collapse('hide');
            }
        }
    }

}

/*
 * Create a counter panel
 */
function _create_ticket_counter(target, counter, value, prepend){
    if (prepend === undefined) {
        prepend = false;
    }

    // Build table from the template
    let html_template = $("#tpl-counter").html();

    try {
        let cpt_config = userSettings.tickets_counters[counter];

        let o_counter = $(html_template
        .replace(/__table__/g, counter)
        .replace(/__value__/g, $.number(value, (cpt_config.decimals ? cpt_config.decimals : 0), ',', '.'))
        .replace(/__name__/g, cpt_config.name)
        .replace(/__order__/g, cpt_config.order)
        .replace(/__icon__/g, cpt_config.icon)
        .replace(/__class__/g, cpt_config.css_class)
        .replace(/__color__/g, cpt_config.color)
        .replace(/__style__/g, cpt_config.box_style)
        .replace(/__cvStyle__/g, cpt_config.value_style)
        .replace(/__ctStyle__/g, cpt_config.text_style));

        if (prepend) {
            $("#" + target).prepend(o_counter);
        } else {
            $("#" + target).append(o_counter);
        }

        if (cpt_config.hasOwnProperty('line_break_before') && cpt_config.line_break_before) {
            o_counter.prepend($($("#tpl-counter-line-break").html()));
        }

        if (cpt_config.hasOwnProperty('line_break_after') && cpt_config.line_break_after) {
            o_counter.append($($("#tpl-counter-line-break").html()));
        }
    } catch(err) {
        console.warn("Error creating counter: ", counter);
    }
}

/*
 * Convert a received value to display nicely
 * - read the local storage of the browser to find cs_category values
 * - set the collapsible state according to the value 1 or 0
 */
function _convert_value(method, value) {
    if (method === "boolean") {
        if (value === '1' || value === 1) {
            value = '<i class="fas fa-1x fa-check"></i>';
        } else {
            value = '<i class="fas fa-1x fa-times"></i>';
        }
    }
    if (method === "boolean-warning") {
        if (value === '1' || value === 1) {
            value = '<i class="fas fa-1x fa-times text-danger"></i>';
        } else {
            value = '<i class="fas fa-1x fa-check text-success"></i>';
        }
    }
    if (method === "seconds") {
        if (value === 0) {
            value = userSettings.tickets_table.empty;
        } else {
            let sec_num = parseInt(value, 10);
            let days    = Math.floor(sec_num / 86400);
            let hours   = Math.floor((sec_num - (days * 86400)) / 3600);
            let minutes = Math.floor((sec_num - (days * 86400) - (hours * 3600)) / 60);
            let seconds = sec_num - (days * 86400) - (hours * 3600) - (minutes * 60);

            if (days > 0) {
                value = days+'j, '+hours+'h, '+minutes+'m, '+seconds+'s';
            } else if (hours > 0) {
                value = hours+'h, '+minutes+'m, '+seconds+'s';
            } else {
                value = minutes+'m, '+seconds+'s';
            }
        }
    }

    return value;
}

/*
 * Log in with provided credentials
 */
function wsLoginPlugin(login_username, login_password) {
    if (g_debugJs) console.debug('wsLoginPlugin, WS url: ', get_ws_url());
    console.info('Login request for: '+login_username);

    return $.ajax( {
        url: get_ws_url(),
        type: 'POST',
        dataType: 'json',
        // contentType: "application/json",
        data: {
            method: 'glpi.doLogin',
            login_name: login_username,
            login_password: login_password,
        },
    })
    .done(function(response) {
        console.info('Login - done', response);
        if (response.faultCode) {
            console.warn("Access denied.", response, response.faultString);

            $("#login-alert").show();

            $("body").trigger(
                $.Event("user_denied",
                    {message: "Accès refusé, vérifiez vos paramètres de connexion et essayez à nouveau."}));
            $.removeCookie('session');
        } else {
            console.info('Access granted.');

            // Hide modal login form
            $('#modalLogin').modal('hide');
            $("#login-alert").hide();

            // Store the session token in a cookie
            g_session_token = response["session"];
            $.cookie('session', g_session_token);
            if (g_debugJs) console.debug('cookie, new session: ', g_session_token);

            // User in the login response
            setCurrentUser(null, response["id"], response["name"], response["realname"] + ' ' + response["firstname"]);

            $("body").trigger(
                $.Event("user_signed_in", {message: "Welcome " + login_username + "."}));
        }
    })
    .fail(function(jqXHR, textStatus) {
        if (g_debugJs) console.debug('wsLoginPlugin - fail', jqXHR);
        console.error('Login failed !');
        console.error(textStatus, jqXHR);
    })
    .always(function() {
        if (g_debugJs) console.debug('Session cookie removed');
        $.removeCookie('session');
    });
}
function wsLogin(login_username, login_password) {
    if (g_debugJs) console.debug('wsLogin, WS url: ', get_ws_url());
    console.info('Login request for: '+login_username);

    // Default is to try using a user token if no credentials are provided
    let headers = {
        'App-Token': g_app_token,
        'Authorization': 'user_token ' + g_user_token
    };
    if (login_username !== undefined && login_password !== undefined){
        headers = {
            'App-Token': g_app_token,
            'Authorization': 'Basic ' + btoa(login_username + ':' + login_password)
        };
    }

    return $.ajax( {
        url: get_ws_url('initSession'),
        type: "GET",
        dataType: "json",
        headers: headers,
        contentType: "application/json"
    })
    .done(function(response) {
        if (g_debugJs) console.debug('wsLogin, response: ', response);

        console.info('Access granted.');

        // Hide modal login form
        $('#modalLogin').modal('hide');
        $("#login-alert").hide();

        // Store the session token in a cookie
        g_session_token = response["session_token"];
        $.cookie('session', g_session_token);
        if (g_debugJs) console.debug('cookie, new session: ', g_session_token);

        $("body").trigger(
            $.Event("user_signed_in", {message: "Welcome " + login_username + "."}));
    })
    .fail(function(jqXHR, textStatus) {
        if (g_debugJs) console.debug('wsLogin - fail', jqXHR);
        if (jqXHR.status === 400) {
            console.warn("Access forbidden.");
            let error_code = jqXHR.responseJSON[0];
            let error_message = jqXHR.responseJSON[1];
            $.each(jqXHR.responseJSON, function (index, string) {
                if (g_debugJs) console.debug(index, string)
            });

            $("body").trigger(
                $.Event("server_denied",
                    {message: 'Connexion impossible avec le serveur configuré.',
                        error_code: error_code, error_message: error_message}));
        } else if (jqXHR.status === 401) {
            console.warn("Access denied.");
            $.each(jqXHR.responseJSON, function (index, string) {
                if (g_debugJs) console.debug(index, string)
            });

            $("body").trigger(
                $.Event("user_denied",
                    {message: "Accès refusé, vérifiez vos paramètres de connexion et essayez à nouveau."}));

            $("#login-alert").show();
        } else {
            console.error('Login failed !');
            console.error(textStatus, jqXHR);
        }
    })
    .always(function() {
        if (g_debugJs) console.debug('Session cookie removed');
        $.removeCookie('session');
    })
}

/*
 * Log out from the current session
 */
function wsLogoutPlugin() {
    if (g_debugJs) console.debug('wsLogoutPlugin');
    console.info('Logout request');

    return $.ajax({
        url: get_ws_url(),
        type: 'GET',
        dataType: 'json',
        data: {
            method: 'glpi.doLogout',
            session: g_session_token,
        }
    })
    .done(function(response) {
        if (g_debugJs) console.debug('wsLogoutPlugin, response: ', response);
        console.info('Bye!');

        $("body").trigger(
            $.Event("user_signed_out", {message: "Bye " + userSettings.user_name + "."}));
    })
    .fail(function(jqXHR, textStatus) {
        if (g_debugJs) console.debug('wsLogoutPlugin - fail', jqXHR);
        console.error('Logout failed !');
        console.error(jqXHR, textStatus);
    })
    .always(function() {
        $.removeCookie('session');
    })
}
function wsLogout() {
    if (g_debugJs) console.debug('wsLogout');
    console.info('Logout request');

    return $.ajax( {
        url: get_ws_url('killSession'),
        type: "GET",
        dataType: "text",
        headers: {
            'App-Token': g_app_token,
            'Session-Token': g_session_token
        }
    })
    .done(function(response) {
        if (g_debugJs) console.debug('wsLogout, response: ', response);
        console.info('Bye!');

        $("body").trigger(
            $.Event("user_signed_out", {message: "Bye " + userSettings.user_name + "."}));
    })
    .fail(function(jqXHR, textStatus) {
        if (g_debugJs) console.debug('wsLogout - fail', jqXHR);
        if (jqXHR.status === 400) {
            console.warn("Access forbidden.");
            let error_code = jqXHR.responseJSON[0];
            let error_message = jqXHR.responseJSON[1];
            $.each(jqXHR.responseJSON, function (index, string) {
                if (g_debugJs) console.debug(index, string)
            });

            $("body").trigger(
                $.Event("server_denied",
                    {message: 'Connexion impossible avec le serveur configuré.',
                        error_code: error_code, error_message: error_message}));
        } else {
            console.error('Logout failed !');
            console.error(jqXHR, textStatus);
        }
    })
    .always(function() {
        $.removeCookie('session');
    })
}

/*
 * Call an API endpoint
 */
function wsCallOld(methodName, parameters) {
    // Add session and methodNameto the parameters
    parameters.session = g_session_token;
    parameters.method = methodName;
    if (g_debugJs) console.warn('wsCallOld, method: ' + methodName + ', parameters: ', parameters);

    let start = new Date().getTime();

    return $.ajax({
        url: get_ws_url(),
        type: 'GET',
        dataType: 'json',
        contentType: "application/json",
        data: parameters
    })
    .done(function(jqXHR) {
        let duration = (new Date().getTime() - start);
        if (g_debugJs) console.debug('wsCallOld:' + methodName + ": '" + duration + "' ms to load.");
        if (g_debugJs) console.debug('Response: ', jqXHR);
        g_server_failed_connections_count=0;
    })
    .fail(function(jqXHR, textStatus) {
        console.error("Server error: " + textStatus + " !");
        console.error(textStatus, jqXHR);

        jsonValue = jQuery.parseJSON( jqXHR.responseText );
        console.log('Error message: ', jsonValue.Message);
    });
}


function wsCall(sEndpoint, parameters) {
    if (parameters === undefined) {
        parameters = {};
    }
    if (g_debugJs) console.debug('wsCall, endpoint: ' + sEndpoint + ', parameters: ', parameters);

    let start = new Date().getTime();

    if (g_plugin_webservices) {
        // Add session and methodName to the parameters
        parameters.debug = "1";
        parameters.session = g_session_token;
        parameters.method = sEndpoint;
    }

    return $.ajax({
        url: get_ws_url(g_plugin_webservices ? null : sEndpoint),
        type: g_plugin_webservices ? "POST" : "GET",
        dataType: "json",
        headers: g_plugin_webservices ? {} : {
            'App-Token': g_app_token,
            'Session-Token': g_session_token
        },
        // contentType: "application/json",
        data: parameters
    })
    .done(function(jqXHR) {
        let duration = (new Date().getTime() - start);
        if (g_debugJs) console.debug('wsCall:' + get_ws_url(sEndpoint) + ": '" + duration + "' ms to load.");
        if (g_debugJs) console.debug('Response: ', jqXHR);
        g_server_failed_connections_count=0;
    })
    .fail(function(jqXHR, textStatus) {
        if (g_plugin_webservices) {
            console.error("Server error: " + textStatus + " !");
            console.error(textStatus, jqXHR);

            let jsonValue = jQuery.parseJSON( jqXHR.responseText );
            console.log('Error message: ', jsonValue.Message);

        } else {
            if (jqXHR.status === 401) {
                let error_code = jqXHR.responseJSON[0];
                let error_message = jqXHR.responseJSON[1];
                $.each(jqXHR.responseJSON, function (index, string) {
                    if (g_debugJs) console.debug(index, string)
                });

                $("body").trigger(
                    $.Event("user_unauthorized",
                        {message: 'Accès non autorisé au serveur configuré.',
                            error_code: error_code, error_message: error_message}));
            } else {
                console.error("wsCall error: ", sEndpoint);
                console.error(textStatus, jqXHR);
            }
        }

        g_server_failed_connections_count++;
        if (g_server_failed_connections_count > g_server_failed_connections_max) {
            // More than 5 server errors, logout ... session expired !
            $.removeCookie('session');
            location.reload();
        }
    })
}

/*
 * Set current entity / host / ...
 */
function setCurrentEntity(entity_id, recursive, entities) {
    console.info("Active entity: ", entity_id, recursive, entities);

    if (entity_id) {
        userSettings.entity_id = entity_id;
    }
    if (recursive) {
        userSettings.entity_recursive = recursive;
    }
    if (entities) {
        userSettings.entities = entities;
    }
}

/*
 * Set current server information
 */
function setCurrentServer(server, comment, url, db) {
    if (g_debugJs) console.debug('setCurrentServer, server: ', server);
    if (server) {
        // Set current server address/name
        g_server = server;
        userSettings.server_name = server;
        $("#gd_server_name").val(server);
    }

    // Set current server information
    if (url) {
        userSettings.server_url = url;
        $("#gd_server_url").val(userSettings.server_url);
    }

    if (comment) {
        userSettings.server_text = comment;
        comment = comment.replace(/\\r\\n/g, "<br>");
        $("#gd_server_text").val(comment);
    }

    if (db) {
        userSettings.server_db = db;
        $("#gd_server_db").val(userSettings.server_db);
    }
}

/*
 * Set current user information
 */
function setCurrentUser(language, id, login, username) {
    if (g_debugJs) console.debug('setCurrentUser: ', login, username);

    // Set current user information
    if (language) {
        userSettings.user_language = language;
        $("#gd_user_language").val(userSettings.user_language);
    }
    if (id) {
        userSettings.user_id = id;
        $("#gd_user_id").val(userSettings.user_id);
    }
    if (login) {
        userSettings.user_login = login;
        $("#gd_user_login").val(userSettings.user_login);
    }
    if (username) {
        userSettings.user_name = username;
        $("#gd_user_name").val(userSettings.user_name);
    }
    // todo - not existing!
    // $("#gd_user_category").val(userSettings.user_category);
}

/*
 * Server availability
 * --------------------------------------------------------------------
 * If server is available, launch request for user information
 * If not, retry every N seconds ... default is 'refresh' seconds.
 */
let serverConnectionTimer=null;
function getServerAvailability(refresh) {
    if (g_debugJs) console.debug('getServerAvailability');

    $("#server-available").addClass('fa-spin');

    if (refresh === '0') {
        if (g_debugJs) console.info('No server availability check.');
        return;
    }
    if (refresh === undefined) {
        refresh = 60;
    }
    if (g_debugJs) console.info('Server connection refresh is set to ' + refresh + ' seconds.');

    // Get active entities to check server connection
    return wsCall(g_plugin_webservices ? 'glpi.listEntities' : 'getActiveEntities')
    .done( function( response ) {
        if (g_debugJs) console.debug('Active entities: ', response);

        if (response.hasOwnProperty("active_entity")) {
            // Glpi REST API
            userSettings.activeEntities = response["active_entity"];
        } else {
            // Plugin Web Services
            userSettings.activeEntities = response;
        }

        // Nothing to do with it ...
        g_server_available = true;
        g_server_failed_connections_count = 0;

        $("body").trigger(
            $.Event("server_online", {message: "The server is available."}));
    })
    .fail(function(jqXHR, textStatus) {
        console.error("Server connection failed: " + textStatus + " !");
        console.error(jqXHR);

        g_server_available=false;
        g_server_failed_connections_count++;
        if (g_server_failed_connections_count > g_server_failed_connections_max) {
            $("body").trigger(
                $.Event("server_offline", {message: "The server is not available!"}));

            console.error('Server connection is not available after ' + g_server_failed_connections_max + ' retries !');
        }

        // Schedule a retry
        if (refresh && ! serverConnectionTimer) {
            serverConnectionTimer = window.setTimeout(function() {
                serverConnectionTimer = null;
                getServerAvailability(refresh);
            }, refresh*1000);
        }
    })
    .always(function() {
        // With a small delay to have the visual effect even if it is very fast...
        window.setTimeout(function() {
            $("#server-available").removeClass('fa-spin');
        }, 500);
    })
}

/*
 * Current session
 * --------------------------------------------------------------------
 * Get the GLPI session
 */
function getFullSession() {
    if (g_debugJs) console.debug('getFullSession');

    return wsCall(g_plugin_webservices ? 'glpi.getMyInfo' : 'getFullSession')
    .done(function(response) {
        if (g_debugJs) console.debug('getFullSession, response: ', response);

        if (response.hasOwnProperty("active_entity")) {
            // Glpi REST API
            let session = response["session"];

            // User in the session
            setCurrentUser(session["glpilanguage"], session["glpiID"], session["glpiname"], session["glpirealname"] + ' ' + session["glpifirstname"]);
        } else {
            // Plugin Web Services
            setCurrentUser(response["language"], response["id"], null, response["realname"] + ' ' + response["firstname"]);

            // Store user information
            userSettings.user_data = response;
        }
    })
}

/*
 * GLPI configuration
 * --------------------------------------------------------------------
 * Get the GLPI configuration
 */
function getGlpiConfig() {
    if (g_debugJs) console.debug('getGlpiConfig');

    return wsCall('getGlpiConfig')
    .done(function(response) {
        if (g_debugJs) console.debug('getGlpiConfig, response: ', response);
        let cfg_glpi = response["cfg_glpi"];

        /*
         * Some interesting data:
         *  asset_types, device_types, central_doc_url, dbversion,
         *  language, languages,
         *  maintenance_mode, maintenance_text
         *  notification_to_myself, notifications_ajax
         *  url_base, url_base_api
         *  version, text_login
         */
        setCurrentServer(null, cfg_glpi["text_login"], cfg_glpi["url_base"], cfg_glpi["dbversion"]);
    })
}

/*
 * --------------------------------------------------------------------
 * GLPI user profiles
 * Get the user profiles and the current active profile
 */
function getMyProfiles() {
    if (g_debugJs) console.debug('getMyProfiles');

    return wsCall(g_plugin_webservices ? 'glpi.listMyProfiles' : 'getMyProfiles')
    .done(function(response) {
        if (g_debugJs) console.debug('getMyProfiles, response: ', response);

        if (response.hasOwnProperty("myprofiles")) {
            // Glpi REST API
            userSettings.user_profiles = response["myprofiles"];

            if (g_debugJs) {
                $.each(userSettings.user_profiles, function (index, profile) {
                    console.debug(profile.id, profile.name, profile.entities)
                })
            }
        } else {
            // Plugin Web Services
            userSettings.user_profiles = response;

            if (g_debugJs) {
                $.each(userSettings.user_profiles, function (index, profile) {
                    console.debug(profile.id, profile.name, profile.current)
                    if (profile.current) {
                        userSettings.active_profile = profile;
                    }
                })
            }
        }
    })
}
function getActiveProfile() {
    if (g_debugJs) console.debug('getActiveProfile');

    return wsCall('getActiveProfile')
    .done(function(response) {
        if (g_debugJs) console.debug('getActiveProfile, response: ', response);
        let active_profile = response["active_profile"];

        userSettings.active_profile = active_profile;

        console.info("Active profile: ", active_profile.id, active_profile.name, active_profile.entities)
    })
}

/*
 * --------------------------------------------------------------------
 * GLPI user entities
 * Get the user entities and the current active entities
 */
function getMyEntities() {
    if (g_debugJs) console.debug('getMyEntities');

    return wsCall(g_plugin_webservices ? 'glpi.listMyEntities' : 'getMyEntities')
    .done(function(response) {
        if (g_debugJs) console.debug('getMyEntities, response: ', response);

        if (response.hasOwnProperty("myentities")) {
            // Glpi REST API
            userSettings.user_entities = response["myentities"];

            if (g_debugJs) {
                $.each(userSettings.user_entities, function (index, entity) {
                    console.debug(entity.id, entity.name)
                })
            }
        } else {
            // Plugin Web Services
            userSettings.user_entities = response;

            if (userSettings.user_entities) {
                setCurrentEntity(response[0].id, response[0].recursive, userSettings.user_entities);
            } else {
                setCurrentEntity(null, null, userSettings.user_entities);
            }

            if (g_debugJs) {
                $.each(userSettings.user_entities, function (index, entity) {
                    console.debug(entity.id, entity.name, entity)
                })
            }
        }
    })
}
function getActiveEntities() {
    if (g_debugJs) console.debug('getActiveEntities');

    return wsCall('getActiveEntities')
    .done(function(response) {
        if (g_debugJs) console.debug('getActiveEntities, response: ', response);
        let active_entity = response["active_entity"];

        setCurrentEntity(active_entity["id"], active_entity["active_entity_recursive"], active_entity["active_entities"]);
    })
}

/*
 * Get all items
 */
function getItems(item_type, parameters) {
    /*
     * API doc available arguments:
        expand_dropdowns (default: false): show dropdown name instead of id. Optional.
        get_hateoas (default: true): Show relation of item in a links attribute. Optional.
        only_id (default: false): keep only id keys in returned data. Optional.
        range (default: 0-50): a string with a couple of number for start and end of pagination separated by a '-'. Ex: 150-200. Optional.
        sort (default 1): id of the searchoption to sort by. Optional.
        order (default ASC): ASC - Ascending sort / DESC Descending sort. Optional.
        searchText (default NULL): array of filters to pass on the query (with key = field and value the text to search)
        is_deleted (default: false): Return deleted element. Optional.
     */

    if (g_debugJs) console.debug('getItems, type: ' + item_type + ', parameters: ', parameters);

    return wsCall(item_type, parameters)
}

/*
 * Search options for an item type
 */
function searchOptions(item_type, parameters) {
    /*
     * API doc available arguments:
        raw: return searchoption uncleaned (as provided by core)
     */

    if (g_debugJs) console.debug('searchOptions, type: ' + item_type + ', parameters: ', parameters);

    return wsCall('listSearchOptions/' + item_type, parameters)
}

/*
 * Search items
 */
function searchItems(item_type, parameters) {
    /*
     * API doc available arguments:
        criteria: array of criterion objects to filter search. Optional. Each criterion object must provide:
            link: (optional for 1st element) logical operator in [AND, OR, AND NOT, AND NOT].
            field: id of the searchoption.
            searchtype: type of search in [contains¹, equals², notequals², lessthan, morethan, under, notunder].
            value: the value to search.

        ¹ - contains will use a wildcard search per default. You can restrict at the beginning using the ^
        character, and/or at the end using the $ character.
        ² - equals and notequals are designed to be used with dropdowns. Do not expect those operators to search
        for a strictly equal value (see ¹ above).

        Ex:
            "criteria": [
                { "field": 1, "searchtype": 'contains', "value": '' },
                { "link": 'AND', "field": 31, "searchtype": 'equals', "value": 1 }
            ]

        metacriteria (optional): array of meta-criterion objects to filter search. Optional.
        A meta search is a link with another itemtype (ex: Computer with softwares).
        Each meta-criterion object must provide:
            link: logical operator in [AND, OR, AND NOT, AND NOT]. Mandatory.
            itemtype: second itemtype to link.
            field: id of the searchoption.
            searchtype: type of search in [contains¹, equals², notequals², lessthan, morethan, under, notunder].
            value: the value to search.

        Ex:
            "metacriteria": [
                { "link": 'AND', "itemtype": 'Monitor', "field": 2, "searchtype": 'contains', "value": '' },
                { "link": 'AND', "itemtype": 'Monitor', "field": 3, "searchtype": 'contains', "value": '' }
            ]

        sort (default 1): id of the searchoption to sort by. Optional.
        order (default ASC): ASC - Ascending sort / DESC Descending sort. Optional.
        range (default 0-50): a string with a couple of number for start and end of pagination separated by a '-'.
        Ex: 150-200. Optional.

        forcedisplay: array of columns to display (default empty = use display preferences and searched criteria).
        Some columns will be always presents (1: id, 2: name, 80: Entity). Optional.

        rawdata (default false): a boolean for displaying raws data of the Search engine of GLPI (like SQL request,
        full searchoptions, etc)

        withindexes (default false): a boolean to retrieve rows indexed by items id. By default this option is set
        to false, because order of JSON objects (which are identified by index) cannot be garrantued (from
        http://json.org/ : An object is an unordered set of name/value pairs). So, we provide arrays to
        guarantying sorted rows.

        uid_cols (default false): a boolean to identify cols by the 'uniqid' of the searchoptions instead of
        a numeric value (see List searchOptions and 'uid' field)

        giveItems (default false): a boolean to retrieve the data with the html parsed from core, new data are provided in data_html key.

        Returns:
            count: 1
            data: [
                // Array of found objects
            ]
            length: 1
            order: "ASC"
            sort: 1
            totalcount: 1
     */

    if (g_debugJs) console.debug('searchItems, type: ' + item_type + ', parameters: ', parameters);

    return wsCall('search/' + item_type, parameters)
}

/*
 * Get an item
 */
function getItem(item_type, items_id, parameters) {
    /*
     * API doc available arguments:
        id: unique identifier of the itemtype. Mandatory.
        expand_dropdowns (default: false): show dropdown name instead of id. Optional.
        get_hateoas (default: true): Show relations of the item in a links attribute. Optional.
        get_sha1 (default: false): Get a sha1 signature instead of the full answer. Optional.
        with_devices: Only for [Computer, NetworkEquipment, Peripheral, Phone, Printer], retrieve the associated components. Optional.
        with_disks: Only for Computer, retrieve the associated file-systems. Optional.
        with_softwares: Only for Computer, retrieve the associated software's installations. Optional.
        with_connections: Only for Computer, retrieve the associated direct connections (like peripherals and printers) .Optional.
        with_networkports: Retrieve all network's connections and advanced network's informations. Optional.
        with_infocoms: Retrieve financial and administrative informations. Optional.
        with_contracts: Retrieve associated contracts. Optional.
        with_documents: Retrieve associated external documents. Optional.
        with_tickets: Retrieve associated ITIL tickets. Optional.
        with_problems: Retrieve associated ITIL problems. Optional.
        with_changes: Retrieve associated ITIL changes. Optional.
        with_notes: Retrieve Notes. Optional.
        with_logs: Retrieve historical. Optional.
     */

    // if (g_debugJs) console.debug('getItem, type: ' + item_type + ', id: ' + items_id + ', parameters: ', parameters);
    if (g_plugin_webservices) {
        parameters = {
            'itemtype': item_type,
            'id': items_id
        }
    }

    return wsCall(g_plugin_webservices ? 'glpi.getObject' : item_type + '/' + items_id, parameters)
}

/*
 * Get an entity information
 */
function getEntity(id, current) {
    if (current === undefined) {
        current = false;
    }

    return $.when(
        getItem('Entity', id, {expand_dropdowns: '1'})
    ).done(function(entity) {
        if (g_debugJs) console.debug("Got entity: ", entity.completename);
        if (current) {
            // Set current server address/name
            userSettings.entity_id = entity.id;
            userSettings.entity_name = entity.name;
            $("#gd_entity_name").val(userSettings.entity_name);

            userSettings.entity_completename = entity.completename;
            $("#gd_entity_completename").val(userSettings.entity_completename);

            userSettings.entity_comment= entity.comment;
            $("#gd_entity_comment").val(userSettings.entity_comment);
        }
    })
}

/*
 * Get a user information
 */
function getUser(id) {
    if (id === undefined) {
        id = userSettings.user_id;
    }

    return $.when(
        getItem('User', id, {expand_dropdowns: '0'})
    ).done(function(user) {
        console.info("Got signed-in user information");

        // Store user information
        userSettings.user_data = user;

        $.Event("user_identified", {message: "Welcome " + user.firstname + " " + user.realname + "."})
    })
}

/*
 * Get some tickets
 */
function getTickets(table, parameters) {

    if (! parameters.hasOwnProperty('sort')) {
        parameters.sort = '1';
    }
    if (! parameters.hasOwnProperty('order')) {
        parameters.order = "ASC";
    }
    if (! parameters.hasOwnProperty('range')) {
        parameters.range = "0-" + (userSettings.tickets_table.page_count - 1);
    }
    if (! parameters.hasOwnProperty('forcedisplay')) {
        parameters.forcedisplay = userSettings.tickets_table.forcedisplay;
    }
    // if (! parameters.hasOwnProperty('giveItems')) {
    //     parameters.giveItems = false;
    // }

    // Get all possible tickets
    return $.when(
        searchItems('Ticket', parameters)
    ).done(function(tickets) {
        if (g_debugJs) console.debug('Found tickets: ', table, tickets);

        userSettings.tickets_table.counts[table] = {};
        userSettings.tickets_table.counts[table].count = parseInt(tickets["count"]);
        userSettings.tickets_table.counts[table].total_count = parseInt(tickets["totalcount"]);

        // Create tickets counter
        if ($("#cpt_" + table).children().length === 0) {
            _create_ticket_counter("tickets-counters", table, userSettings.tickets_table.counts[table].total_count);
        }

        // Create tickets table and header
        if ($("#" + table).children().length === 0) {
            // Build table from the template
            let html_template = $("#tpl-tickets-table").html();
            let cpt_config = userSettings.tickets_counters[table];

            let title = cpt_config.title;
            if (! title) title = cpt_config.name;

            // $("#" + table).
            $("#tickets-tabs").
            append(html_template
            .replace(/__table__/g, table)
            .replace(/__name__/g, cpt_config.name)
            .replace(/__title__/g, title)
            .replace(/__order__/g, cpt_config.order)
            .replace(/__count__/g, tickets["count"])
            .replace(/__totalcount__/g, tickets["totalcount"])
            );

            _update_collapsible_state(table);
        }

        // Update navigation
        // todo - add more tickets with next page
        let range_parser = new RegExp(/(\d+)-(\d+)\/(\d+)/);
        let range = tickets["content-range"].match(range_parser);
        try {
            userSettings.tickets_table.counts[table].range_min = parseInt(range[1]);
            userSettings.tickets_table.counts[table].range_max = parseInt(range[2]);
            userSettings.tickets_table.counts[table].total_count = parseInt(range[3]);

            if (userSettings.tickets_table.range_min <= 0) {
                $("#" + table + " ul.pager li.previous").hide();
            } else {
                $("#" + table + " ul.pager li.previous").show();
            }
            if (userSettings.tickets_table.range_max >= userSettings.tickets_table.total_count - 1) {
                $("#" + table + " ul.pager li.next").hide();
            } else {
                $("#" + table + " ul.pager li.next").show();
            }
        } catch(err) {
            console.warn("Error parsing range-content information.", tickets["content-range"], range);
        }

        // Update table content
        // Get the Ticket item template
        let html_template = $("#tpl-tickets-row").html();
        // Build table header
        let header = $("#" + table + ' thead>tr');
        let header_html = header.html();
        let row = null;

        if (tickets.data && tickets.data.length > 0) {
            // Update table from the options of the provided fields
            $.each(tickets.data[0], function (idx) {
                header_html = header_html.replace(new RegExp('__lbl_' + idx + '__',"g"), userSettings.tickets_searchOptions[idx].name);
                header_html = header_html.replace(new RegExp('__frm_' + idx + '__',"g"), userSettings.tickets_searchOptions[idx].field);
            });
            header.html(header_html);
            // // Remove the template fields that were not provided
            $("#" + table + " thead>tr th:contains('__')" ).remove();

            // Build table rows
            $.each(tickets.data, function (index, ticket) {
                if (g_debugJs) console.debug('Ticket:', ticket);

                row = html_template;
                $.each(ticket, function (idx, value) {
                    // if (value && value.hasOwnProperty('length') && value.length > 25) {
                    //     row = row.replace(new RegExp('__' + idx + '__',"g"), value.substring(0,25)+'&hellip; XXX');
                    // }
                    try {
                        if (userSettings.tickets_table.translate[idx]) {
                            value = userSettings.tickets_table.translate[idx][value];
                        }

                        if (userSettings.tickets_table.convert[idx]) {
                            value = _convert_value(userSettings.tickets_table.convert[idx], value);
                        }
                    } catch(err) {
                        console.warn("Conversion/translation error: ", idx, value)
                    }
                    if (value === null) {
                        value = userSettings.tickets_table.empty;
                    }
                    row = row.replace(new RegExp('__' + idx + '__',"g"), value);
                    row = row.replace(new RegExp('__lbl_' + idx + '__',"g"), value);
                    row = row.replace(new RegExp('__frm_' + idx + '__',"g"), value);
                });
                $("#" + table + " tbody").append(row);
                // Remove the template fields that were not provided
                $("#" + table + " tbody tr:nth-last-child(2) td:contains('__')" ).remove();
            })
        } else {
            // Update table from the options
            $.each(userSettings.tickets_searchOptions, function (idx, option) {
                header_html = header_html.replace(new RegExp('__lbl_' + idx + '__',"g"), option.name);
                header_html = header_html.replace(new RegExp('__frm_' + idx + '__',"g"), option.field);
            });
            header.html(header_html);
            // // Remove the template fields that were not provided
            $("#" + table + " thead>tr th:contains('__')" ).remove();
        }
    })
}

/*
 * Get all Glpi tickets information
 * --------------------------------------------------------------------
 */
function getHelpdeskConfiguration() {
    if (g_debugJs) console.debug('getHelpdeskConfiguration');

    return wsCall('glpi.getHelpdeskConfiguration')
}
function getTicketsDataBis() {
    if (g_debugJs) console.debug('getTicketsData');

    // Get all possible tickets
    $("#loading").addClass('fa-spin').addClass('text-warning');

    _update_collapsible_state('tickets');

    $.when(
        searchOptions('Ticket')
    ).done(function(searchOptions) {
        if (g_debugJs) console.debug('Tickets search options: ', searchOptions);

        // Store tickets search options
        userSettings.tickets_searchOptions = searchOptions;
        /*
         * Standard tickets search options:
         * -----
            1 Titre
            2 ID
            3 Priorité
            4 Demandeur
            5 Technicien
            6 Assigné à un fournisseur
            7 Catégorie
            8 Groupe de techniciens
            9 Source de la demande
            10 Urgence
            11 Impact
            12 Statut
            13 Éléments associés
            14 Type
            15 Date d'ouverture
            16 Date de clôture
            17 Date de résolution
            18 Temps de résolution
            19 Dernière modification
            20 Tâches - Catégorie
            21 Description
            22 Rédacteur
            23 Type de solution
            24 Solution
            25 Description
            26 Tâches - Description
            27 Nombre de suivis
            28 Tâches - Nombre de tâches
            29 Source de la demande
            30 SLAs&nbsp;Temps de résolution
            31 Type
            32 SLAs&nbsp;Niveau d'escalade
            33 Tâches - Statut
            34 Courriel pour le suivi
            35 Suivi par courriel
            36 Date
            37 SLAs&nbsp;Temps de prise en charge
            40 Tous les tickets liés
            41 Nombre de tous les tickets liés
            42 Coût horaire
            43 Coût fixe
            44 Coût matériel
            45 Durée totale
            46 Nombre de ticket dupliqués
            47 Tickets dupliqués
            48 Coût total
            49 Coût - Durée
            50 Tickets parents
            51 Validation minimale nécessaire
            52 Validation
            53 Commentaire de la demande
            54 Commentaire de la validation
            55 Statut de validation
            56 Date de la demande
            57 Date de la validation
            58 Demandeur
            59 Validateur
            60 Date de création
            61 Date de la réponse
            62 Satisfaction
            63 Commentaires
            64 Dernière modification par
            65 Groupe observateur
            66 Observateur
            67 Tickets enfants
            68 Nombre de tickets enfants
            69 Nombre de tickets parents
            71 Groupe demandeur
            80 Entité
            82 Temps de résolution dépassé
            83 Lieu
            84 Numéro du bâtiment
            85 Numéro de la pièce
            86 Commentaires du lieu
            91 Suivi privé
            92 Tâches - Tâche privée
            93 Rédacteur
            94 Tâches - Rédacteur
            95 Tâches - Technicien responsable
            96 Tâches - Durée
            97 Tâches - Date
            101 Adresse
            102 Code postal
            103 Ville
            104 État
            105 Pays
            112 Tâches - Groupe responsable
            119 Nombre de documents
            131 Types d'élément associé
            141 Nombre de problèmes
            142 Documents
            150 Délai de prise en compte
            151 Temps de résolution + Progression
            152 Délai de clôture
            153 Délai d'attente
            154 Délai de résolution
            155 Temps de prise en charge
            158 Temps de prise en charge + progression
            159 Temps de prise en charge dépassé
            173 Tâches - Date de début
            174 Tâches - Date de fin
            175 Tâches - Gabarit de tâche
            180 Temps interne de résolution
            181 Temps interne de résolution + progression
            182 Temps interne de résolution dépassé
            185 Temps interne de prise en compte
            186 Temps interne de prise en charge + progression
            187 Temps interne de prise en charge dépassé
            190 OLA&nbsp;Temps interne de prise en compte
            191 OLA&nbsp;Temps interne de résolution
            192 OLA&nbsp;Niveau d'escalade
            998 Latitude
            999 Longitude
         */

        let tickets_loading = [];
        $.each(userSettings.tickets_table.search_parameters, function (table, parameters) {
            if (g_debugJs) console.debug("Get tickets for: ", table, parameters);
            tickets_loading.push(getTickets(table, parameters));
        });

        $.when.apply($, tickets_loading)
        .done(function() {
            console.info('Got all tickets');

            // Prepare graph data and compute total count
            let data = [];
            let labels = [];
            let colors = [];
            let total_count = 0;
            $.each(userSettings.tickets_table.counts, function (index, table) {
                data.push(table.total_count);

                if (userSettings.tickets_counters.hasOwnProperty(index)) {
                    let counter = userSettings.tickets_counters[index];
                    labels.push(counter.name);
                    colors.push(counter.color);
                } else {
                    console.warn("No name/color property for the couter:", index);
                    labels.push(index);
                    colors.push("#000");
                }
                total_count += table.total_count;
            });

            // Create tickets total counter
            if ($("#cpt_tickets_total").children().length === 0) {
                // Add the counter in prepend mode (true)
                _create_ticket_counter("tickets-counters","tickets_total", total_count, true);
            }

            // Order the tickets counters
            $('#tickets-counters>div').sortElements(function(a, b){
                return $(a).data('order') > $(b).data('order') ? 1 : -1;
            });

            // Order the tickets tables
            $('#tickets-table>div').sortElements(function(a, b){
                return $(a).data('order') > $(b).data('order') ? 1 : -1;
            });

            // Update graph
            let ctx = $("#tickets-pie-graph canvas").get(0).getContext("2d");
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Tickets',
                        data: data,
                        backgroundColor: colors
                    }]
                },
                options: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    responsive: true,
                    maintainAspectRatio: true,
                    hover: {
                        onHover: function(event,elements) {
                            $('#pie-graph-tickets').css('cursor', elements[0] ? 'pointer' : 'default');
                        }
                    }
                }
            });
            $("#pie-graph-tickets .title").show();
            $("#pie-graph-tickets .title span").html(total_count + " tickets").show();
        })
    })
    .always(function() {
        // With a small delay to have the visual effect even if it is very fast...
        window.setTimeout(function() {
            $("#loading").removeClass('fa-spin').removeClass('text-warning');
        }, 500);
    })
}

function getTicketsData() {
    if (g_debugJs) console.debug('getTicketsData');

    // Get all possible tickets
    $("#loading").addClass('fa-spin').addClass('text-warning');

    _update_collapsible_state('tickets');

    $.when(
        searchOptions('Ticket')
    ).done(function(searchOptions) {
        if (g_debugJs) console.debug('Tickets search options: ', searchOptions);

        // Store tickets search options
        userSettings.tickets_searchOptions = searchOptions;
        /*
         * Standard tickets search options:
         * -----
            1 Titre
            2 ID
            3 Priorité
            4 Demandeur
            5 Technicien
            6 Assigné à un fournisseur
            7 Catégorie
            8 Groupe de techniciens
            9 Source de la demande
            10 Urgence
            11 Impact
            12 Statut
            13 Éléments associés
            14 Type
            15 Date d'ouverture
            16 Date de clôture
            17 Date de résolution
            18 Temps de résolution
            19 Dernière modification
            20 Tâches - Catégorie
            21 Description
            22 Rédacteur
            23 Type de solution
            24 Solution
            25 Description
            26 Tâches - Description
            27 Nombre de suivis
            28 Tâches - Nombre de tâches
            29 Source de la demande
            30 SLAs&nbsp;Temps de résolution
            31 Type
            32 SLAs&nbsp;Niveau d'escalade
            33 Tâches - Statut
            34 Courriel pour le suivi
            35 Suivi par courriel
            36 Date
            37 SLAs&nbsp;Temps de prise en charge
            40 Tous les tickets liés
            41 Nombre de tous les tickets liés
            42 Coût horaire
            43 Coût fixe
            44 Coût matériel
            45 Durée totale
            46 Nombre de ticket dupliqués
            47 Tickets dupliqués
            48 Coût total
            49 Coût - Durée
            50 Tickets parents
            51 Validation minimale nécessaire
            52 Validation
            53 Commentaire de la demande
            54 Commentaire de la validation
            55 Statut de validation
            56 Date de la demande
            57 Date de la validation
            58 Demandeur
            59 Validateur
            60 Date de création
            61 Date de la réponse
            62 Satisfaction
            63 Commentaires
            64 Dernière modification par
            65 Groupe observateur
            66 Observateur
            67 Tickets enfants
            68 Nombre de tickets enfants
            69 Nombre de tickets parents
            71 Groupe demandeur
            80 Entité
            82 Temps de résolution dépassé
            83 Lieu
            84 Numéro du bâtiment
            85 Numéro de la pièce
            86 Commentaires du lieu
            91 Suivi privé
            92 Tâches - Tâche privée
            93 Rédacteur
            94 Tâches - Rédacteur
            95 Tâches - Technicien responsable
            96 Tâches - Durée
            97 Tâches - Date
            101 Adresse
            102 Code postal
            103 Ville
            104 État
            105 Pays
            112 Tâches - Groupe responsable
            119 Nombre de documents
            131 Types d'élément associé
            141 Nombre de problèmes
            142 Documents
            150 Délai de prise en compte
            151 Temps de résolution + Progression
            152 Délai de clôture
            153 Délai d'attente
            154 Délai de résolution
            155 Temps de prise en charge
            158 Temps de prise en charge + progression
            159 Temps de prise en charge dépassé
            173 Tâches - Date de début
            174 Tâches - Date de fin
            175 Tâches - Gabarit de tâche
            180 Temps interne de résolution
            181 Temps interne de résolution + progression
            182 Temps interne de résolution dépassé
            185 Temps interne de prise en compte
            186 Temps interne de prise en charge + progression
            187 Temps interne de prise en charge dépassé
            190 OLA&nbsp;Temps interne de prise en compte
            191 OLA&nbsp;Temps interne de résolution
            192 OLA&nbsp;Niveau d'escalade
            998 Latitude
            999 Longitude
         */

        let tickets_loading = [];
        $.each(userSettings.tickets_table.search_parameters, function (table, parameters) {
            if (g_debugJs) console.debug("Get tickets for: ", table, parameters);
            tickets_loading.push(getTickets(table, parameters));
        });

        $.when.apply($, tickets_loading)
        .done(function() {
            console.info('Got all tickets');

            // Prepare graph data and compute total count
            let data = [];
            let labels = [];
            let colors = [];
            let total_count = 0;
            $.each(userSettings.tickets_table.counts, function (index, table) {
                data.push(table.total_count);

                if (userSettings.tickets_counters.hasOwnProperty(index)) {
                    let counter = userSettings.tickets_counters[index];
                    labels.push(counter.name);
                    colors.push(counter.color);
                } else {
                    console.warn("No name/color property for the couter:", index);
                    labels.push(index);
                    colors.push("#000");
                }
                total_count += table.total_count;
            });

            // Create tickets total counter
            if ($("#cpt_tickets_total").children().length === 0) {
                // Add the counter in prepend mode (true)
                _create_ticket_counter("tickets-counters","tickets_total", total_count, true);
            }

            // Order the tickets counters
            $('#tickets-counters>div').sortElements(function(a, b){
                return $(a).data('order') > $(b).data('order') ? 1 : -1;
            });

            // Order the tickets tables
            $('#tickets-table>div').sortElements(function(a, b){
                return $(a).data('order') > $(b).data('order') ? 1 : -1;
            });

            // Update graph
            let ctx = $("#tickets-pie-graph canvas").get(0).getContext("2d");
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Tickets',
                        data: data,
                        backgroundColor: colors
                    }]
                },
                options: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    responsive: true,
                    maintainAspectRatio: true,
                    hover: {
                        onHover: function(event,elements) {
                            $('#pie-graph-tickets').css('cursor', elements[0] ? 'pointer' : 'default');
                        }
                    }
                }
            });
            $("#pie-graph-tickets .title").show();
            $("#pie-graph-tickets .title span").html(total_count + " tickets").show();
        })
    })
    .always(function() {
        // With a small delay to have the visual effect even if it is very fast...
        window.setTimeout(function() {
            $("#loading").removeClass('fa-spin').removeClass('text-warning');
        }, 500);
    })
}

function getTest(item_type, items_id, parameters) {
    if (g_debugJs) console.warn('getTest, type: ' + item_type + ', id: ' + items_id + ', parameters: ', parameters);

    return wsCallOld('test', parameters)
}

$(function() {
    "use strict";

    let page_body = $('body');
    let modal_login = $('#modalLogin');

    // Application about panel
    $("#app_version").val(applicationManifest.version);
    $("#app_copyright").val(applicationManifest.copyright);
    $("#app_release").val(applicationManifest.release);
    $("#app_license").val(applicationManifest.license);

    // Application in debug mode ...
    g_debugJs = get_url_parameter('debug') ? true : g_debugJs;
    if (g_debugJs) console.debug('Glpi frontend, version:', applicationManifest.version);

    // Get the default application configuration
    getDefaultConfiguration('conf/default.json');

    // Set current server ...
    if (get_url_parameter('server')) {
        setCurrentServer(get_url_parameter('server'));
    } else {
        setCurrentServer(g_server);
    }
    if (get_url_parameter('path')) {
        g_path = get_url_parameter('path');
    }

    // Current credentials
    if (get_url_parameter('app_token')) {
        g_app_token = get_url_parameter('app_token');
    }
    if (get_url_parameter('user_token')) {
        g_user_token = get_url_parameter('user_token');
    }

    // Focus in modal windows...
    modal_login
    .on('shown.bs.modal', function () {
        // // Focus in the username field
        // $('#login_username').focus();
        $(document).off('focusin.modal');
    });

    // Collapsed elements
    page_body
    .on('shown.bs.collapse', function (event) {
        localStorage.setItem('cs_' + event.target.id, "1");
    })
    .on('hidden.bs.collapse', function (event) {
        localStorage.setItem('cs_' + event.target.id, "0");
    });

    // Menu choices
    page_body
    .on('click', "#navbar-menu a[href]", function () {
        if (g_debugJs) console.debug("Clicked: ", $(this));

        if (! $(this).data("toggle")) {
            $("#navbar-menu li.active").removeClass("active");
            $(this.parentElement).addClass('active');
        }

        // Hide / display the page panels
        if ($(this).data("panel")) {
            if (localStorage.getItem("page_current")) {
                $("#" + localStorage.getItem("page_current")).fadeOut(1000);
            } else {
                if (userSettings.pages.home_page) {
                    $("#" + userSettings.home_page).fadeOut(1000);
                }
            }
            $("#" + $(this).data("panel")).fadeIn(1000);
            localStorage.setItem("page_current", $(this).data("panel"));
        }
    });

    // Log in/out management
    page_body
    .on('click', '#login-submit', function() {
        if (g_debugJs) console.debug('Login request ...');

        let username = $("#login_username").val();
        let password = $("#login_password").val();
        if (username.length > 0 && password.length > 0) {
            $("#login-alert").hide();
            // Try to log WS user on ...
            if (g_plugin_webservices) {
                wsLoginPlugin(username, password);
            } else {
                wsLogin(username, password);
            }
        } else {
            alert('Merci de renseigner toutes les informations demandées.');
        }

        return false; // cancel original event to prevent real form submitting
    })
    .on("click", '#logout', function () {
        // Log out management
        if (g_debugJs) console.debug('Log out request ...');
        if (g_plugin_webservices) {
            wsLogoutPlugin();
        } else {
            wsLogout();
        }
    });

    // User events
    // -----
    page_body
    .on("user_signed_in", function (event) {
        // User events - sign in
        console.info('User signed in');
        alertify.success(event.message);

        console.info('Loading configuration...');
        $("#loading").addClass('fa-spin').addClass('text-warning');
        $.when(
            getServerAvailability(g_refreshPeriod))
        .done(function() {
            console.info('Configured server is available');

            console.info('Getting configuration...');
            let info_to_get = [];
            if (g_plugin_webservices) {
                info_to_get.push(getMyProfiles());
                info_to_get.push(getMyEntities());
            } else {
                info_to_get.push(getUser());
                info_to_get.push(getGlpiConfig());
                info_to_get.push(getMyProfiles());
                info_to_get.push(getActiveProfile());
                info_to_get.push(getMyEntities());
                info_to_get.push(getActiveEntities());
            }

            // Get current session (before all other) parameters and configuration
            $.when(
                getFullSession(),
            ).done(function() {
                $.when.apply($, info_to_get)
                .done(function() {
                    console.info('Getting configured entities...');
                    let entities_to_get = [];
                    $.each(userSettings.entities, function (index, entity) {
                        if (g_debugJs) console.debug("Get information for entity: ", entity.id);
                        entities_to_get.push(getEntity(entity.id, userSettings.entity_id === entity.id));
                    });

                    /*
                     * There is still an asynchronous activity to get all active entities data,
                     * but the configuration may be considered as finished.
                     */
                    $.when.apply($, entities_to_get).done(function() {
                        console.info('Got all active entities data.');

                        // With a small delay to have the visual effect even if it is very fast...
                        window.setTimeout(function() {
                            $("#loading").removeClass('fa-spin').removeClass('text-warning');
                        }, 500);
                    });

                    console.info('Configuration done.');
                    $("body").trigger(
                        $.Event("configuration_done", {message: "Fetched all the configuration data!"}));
                })
            })
        })
    })
    .on("user_identified", function (event) {
        // User events - sign in
        console.info('User identified');
        alertify.success(event.message);
    })
    .on("user_signed_out", function (event) {
        // User events - sign out
        console.info('User signed out');
        alertify.success(event.message);

        // Reset forms fields
        $.each($('#glpi-data input'), function (index, field) {
            if (g_debugJs) console.debug(index, field);
            field.value = '';
        });

        $.each($('#glpi-data textarea'), function (index, field) {
            if (g_debugJs) console.debug(index, field);
            field.value = '';
        });

        // With a small delay to have the visual effect even if it is very fast...
        window.setTimeout(function() {
            $.removeCookie('session');
            window.location.reload();
        }, 1000);
    })
    .on("user_denied", function (event) {
        // User events - unauthorized access
        console.info('Unauthorized access', event.message);
        alertify.error(event.message);
    })
    .on("user_unauthorized", function (event) {
        // User events - unauthorized access
        console.info('Unauthorized access', event.message);
        alertify.warning(event.message);
    });

    // Server events
    // -----
    page_body
    .on("server_denied", function (event) {
        // User events - unauthorized access
        console.error('Server access:', event.message);
        alertify.error(event.message);

        $("#panel-server").hide();
        $("#panel-tickets").hide();

        if (g_debugJs) {
            alertify.error(event.error_code);
            alertify.error(event.error_message);
        } else {
            console.error("Activer le mode debug donnera plus d'information sur l'erreur rencontrée.")
        }
    })
    .on("server_online", function (event) {
        // User events - sign in
        console.info('Server is online');
        alertify.success(event.message);

        $("#panel-server>form").show();

        // Update UI - no error message, connection button is enabled
        $("#server-available").show();
        $("#server-alert").hide();
        $("#login-submit").toggleClass('disabled', false);
    })
    .on("server_offline", function (event) {
        // User events - unauthorized access
        console.info('Unauthorized access', event.message);
        alertify.error(event.message);

        $("#panel-server>form").hide();
        $("#panel-tickets").hide();

        // Update UI - error message, connection button is disabled
        $("#server-available").hide();
        $("#server-alert").show();
        $("#login-submit").toggleClass('disabled', true);
    });

    // Global events
    // -----
    page_body
    .on("configuration_done", function (event) {
        // Server data configuration is finished
        console.info('Configuration done:', event.message);
        alertify.success(event.message);

        /*
         * Lazy loading the tickets information even if we are not yet on the tickets page
         */
        if (g_plugin_webservices) {
            getTicketsDataBis();
        } else {
            getTicketsData();
        }
    });

    // Table tickets events
    // -----
    page_body
    .on("click", "td>i.fa-chevron-down", function() {
        console.info("Open ticket form !");
    });

    // Get server availability.
    if (get_url_parameter('refresh')) {
        g_refreshPeriod = get_url_parameter('refresh');
    }

    if (! g_plugin_webservices && g_user_token) {
        // A user token is defined, no login is necessary, so simulate a login with empty credentials
        // Try to log WS user on ...
        wsLogin();
    } else {
        // Enable the logout menu
        $("#logout").parent().show();

        // If a session still exist
        if (! g_session_token) {
            // Show modal login form
            modal_login.modal('show');
        } else {
            // Hide modal login form
            modal_login.modal('hide');

            page_body.trigger(
                $.Event("user_signed_in", {message: "Welcome back."}));
        }
    }
})
