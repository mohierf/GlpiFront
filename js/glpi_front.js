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
 * Default Web Services server
 */
let scheme = "http";
let g_server = "localhost";
let g_port = "80";
// Application token got from Glpi setup
let g_app_token = 'KcsQNgF0V7is0sn5jouoAupIm94clhkvcEBDSN4m';
// User token got from Glpi user settings
// let g_user_token = null;
// Current server session token
let g_session_token = null;


/*
 * Console logs debug variables
 *  g_debugJs: general information
 */
let g_debugJs = true;


/*
 * Server connection status
 */
let g_server_available = false;
let g_server_failed_connections_count = 0;
let g_server_failed_connections_max = 5;

// refresh period if connection is not established
let g_refreshPeriod = 60;

// Allow storage of a JSON object in a cookie ...
$.cookie.json = true;

/*
 * User settings
 */
let userSettings = {
    // Server's name
    server: ''
};
if ($.cookie('session')) {
    g_session_token = $.cookie('session');
    if (g_debugJs) console.debug('cookie, existing session: ', g_session_token);
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
    let url = scheme + "://" + g_server + ":" + g_port + '/api';
    if (sEndpoint) {
        url = url + '/' + sEndpoint;
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
  return scheme + "://" + g_server + ":" + g_port + '/status';
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
 * Log in with provided credentials
 */
function wsLogin(login_username, login_password) {
    if (g_debugJs) console.debug('wsLogin, WS url: ', get_ws_url());
    console.info('Login request for: '+login_username);

    return $.ajax( {
        url: get_ws_url('initSession'),
        type: "GET",
        dataType: "json",
        headers: {
            'Authorization': 'Basic ' + btoa(login_username + ':' + login_password),
            'App-Token': g_app_token
        },
        contentType: "application/json"
    })
    .done(function(response) {
        if (g_debugJs) console.debug('wsLogin, response: ', response);

        console.info('Access granted.');

        // Hide modal login form
        $('#modalLogin').modal('hide');
        $("#login-alert").hide();

        // Store the session token in a cookie
        g_session_token = response.session_token;
        $.cookie('session', g_session_token);
        if (g_debugJs) console.debug('cookie, new session: ', g_session_token);

        $("body").trigger(
            jQuery.Event("user_signed_in", {message: "Welcome " + login_username + "."}));
    })
    .fail(function(jqXHR, textStatus) {
        if (g_debugJs) console.debug('wsLogin - fail', jqXHR);
        if (g_debugJs) console.debug('wsLogin - fail', jqXHR.status);
        if (jqXHR.status === 401) {
            console.warn("Access denied.");
            $.each(jqXHR.responseJSON, function (index, string) {
                if (g_debugJs) console.debug(index, string)
            });

            $("body").trigger(
                jQuery.Event("user_denied",
                    {message: "Access denied, check your credentials and try again."}));

            $("#login-alert").show();
            $.removeCookie('session');
        } else {
            console.error('Login failed !');
            console.error(textStatus, jqXHR);
        }
    })
    .always(function() {
    });
}

/*
 * Log out from the current session
 */
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
            jQuery.Event("user_signed_out", {message: "Bye " + userSettings.user_name + "."}));
    })
    .fail(function(jqXHR, textStatus) {
        if (g_debugJs) console.debug('wsLogout - fail', jqXHR);
        console.error('Logout failed !');
        console.error(jqXHR, textStatus);
    })
    .always(function() {
        $.removeCookie('session');
    });
}

/*
 * Call an API endpoint
 */
function wsCall(sEndpoint) {
    let params = [];
    let parameters = {};
    if (g_debugJs) {
        parameters.debug = '1';
    }
    for (let i = 1; i < arguments.length; i++) {
        let object = arguments[i];
        for (let property in object) {
            if (object[property]) parameters[property]=object[property];
        }
    }
    params.push(parameters);
    if (g_debugJs) console.debug('wsCall, endpoint: ' + sEndpoint + ', parameters: ', params);

    let start = new Date().getTime();

    return $.ajax( {
        url: get_ws_url(sEndpoint),
        type: "GET",
        dataType: "json",
        headers: {
            'App-Token': g_app_token,
            'Session-Token': g_session_token
        },
        contentType: "application/json",
        // data: params
    })
    .done(function(jqXHR) {
    let duration = (new Date().getTime() - start);
    if (g_debugJs) console.debug('wsCall: ' + get_ws_url(sEndpoint) + ": '" + duration + "' ms to load.");
    if (g_debugJs) console.debug('Response: ', jqXHR);
    g_server_failed_connections_count=0;

    // Send a timer
    // sendStats('timer', parameters['method'], duration);
    })
    .fail(function(jqXHR, textStatus) {
        if (jqXHR.status === 401) {
            if (g_debugJs) console.debug("Access denied.");
            $.each(jqXHR.responseJSON, function (index, string) {
                if (g_debugJs) console.debug(index, string)
            });

            $("body").trigger(
                jQuery.Event("user_unauthorized", {message: "Trying to get " + sEndpoint + " is not allowed!"}));
        } else {
            console.error("wsCall error: ", sEndpoint);
            console.error(textStatus, jqXHR);
        }

        g_server_failed_connections_count++;
        if (g_server_failed_connections_count > g_server_failed_connections_max) {
            // More than 5 server errors, logout ... session expired !
            $.removeCookie('session');
            location.reload();
        }
    });
}

/*
 * Set current entity / host / ...
 */
function setCurrentEntity(entity_id, recursive, entities) {
    console.info("Active entity: ", entity_id, recursive, entities);

    userSettings.entity_id = entity_id;
    userSettings.entity_recursive = recursive;
    userSettings.entities = entities;
}

/*
 * Set current server information
 */
function setCurrentServer(server, comment, url, db) {
    if (g_debugJs) console.debug('setCurrentServer, server: ', server);
    if (server) {
        // Set current server address/name
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
    $("#gd_user_category").val(userSettings.user_category);
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
    return wsCall('getActiveEntities')
    .done( function( response ) {
        if (g_debugJs) console.debug('Active entities: ', response);

        userSettings.activeEntities = response.active_entity;

        // Nothing to do with it ...
        g_server_available = true;
        g_server_failed_connections_count = 0;
        // Update UI - no error message, connection button is enabled
        $("#server-available").show();
        $("#server-alert").hide();
        $("#login-submit").toggleClass('disabled', false);
    })
    .fail(function(jqXHR, textStatus) {
        console.error("Server connection failed: " + textStatus + " !");
        console.error(jqXHR);

        g_server_available=false;
        g_server_failed_connections_count++;
        if (g_server_failed_connections_count > g_server_failed_connections_max) {
            console.error('Server connection is not available after ' + g_server_failed_connections_max + ' retries !');
        }

        // Update UI - error message, connection button is disabled
        $("#server-available").hide();
        $("#server-alert").show();
        $("#login-submit").toggleClass('disabled', true);

        // Schedule a retry
        if (refresh && ! serverConnectionTimer) {
            serverConnectionTimer = window.setTimeout(function() {
                serverConnectionTimer = null;
                getServerAvailability(refresh);
            }, refresh*1000);
        }
    })
    .always(function() {
        // With a small delay to have thevisual effect even if it is very fast...
        window.setTimeout(function() {
            $("#server-available").removeClass('fa-spin');
        }, 500);
    });
}

/*
 * Current session
 * --------------------------------------------------------------------
 * Get the GLPI session
 */
function getFullSession() {
    if (g_debugJs) console.debug('getFullSession');

    return wsCall('getFullSession')
    .done(function(response) {
        if (g_debugJs) console.debug('getFullSession, response: ', response);
        let session = response.session;

        setCurrentUser(session.glpilanguage, session.glpiID, session.glpiname, session.glpirealname + ' ' + session.glpifirstname);
    });
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
        let cfg_glpi = response.cfg_glpi;

        /*
         * Some interesting data:
         *  asset_types, device_types, central_doc_url, dbversion,
         *  language, languages,
         *  maintenance_mode, maintenance_text
         *  notification_to_myself, notifications_ajax
         *  url_base, url_base_api
         *  version, text_login
         */
        setCurrentServer(null, cfg_glpi.text_login, cfg_glpi.url_base, cfg_glpi.dbversion);
    });
}

/*
 * --------------------------------------------------------------------
 * GLPI user profiles
 * Get the user profiles and the current active profile
 */
function getMyProfiles() {
    if (g_debugJs) console.debug('getMyProfiles');

    return wsCall('getMyProfiles')
    .done(function(response) {
        if (g_debugJs) console.debug('getMyProfiles, response: ', response);
        userSettings.user_profiles = response.myprofiles;

        if (g_debugJs) {
            $.each(userSettings.user_profiles, function (index, profile) {
                console.debug(profile.id, profile.name, profile.entities)
            });
        }
    });
}
function getActiveProfile() {
    if (g_debugJs) console.debug('getActiveProfile');

    return wsCall('getActiveProfile')
    .done(function(response) {
        if (g_debugJs) console.debug('getActiveProfile, response: ', response);
        let active_profile = response.active_profile;

        userSettings.active_profile = active_profile;

        console.info("Active profile: ", active_profile.id, active_profile.name, active_profile.entities)
    });
}

/*
 * --------------------------------------------------------------------
 * GLPI user entities
 * Get the user entities and the current active entities
 */
function getMyEntities() {
    if (g_debugJs) console.debug('getMyEntities');

    return wsCall('getMyEntities')
    .done(function(response) {
        if (g_debugJs) console.debug('getMyEntities, response: ', response);
        userSettings.user_entities = response.myentities;

        if (g_debugJs) {
            $.each(userSettings.user_entities, function (index, entity) {
                console.debug(entity.id, entity.name)
            });
        }
    });
}
function getActiveEntities() {
    if (g_debugJs) console.debug('getActiveEntities');

    return wsCall('getActiveEntities')
    .done(function(response) {
        if (g_debugJs) console.debug('getActiveEntities, response: ', response);
        let active_entity = response.active_entity;

        setCurrentEntity(active_entity.id, active_entity.active_entity_recursive, active_entity.active_entities);
    });
}

/*
 * Get all items
 */
function getItems(item_type) {
    let args = new Array(arguments.length);
    for(let i = 1; i < args.length; ++i) {
        args[i] = arguments[i];
    }

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

    if (g_debugJs) console.debug('getItems, type: ' + item_type + ', parameters: ', args);

    return wsCall(item_type, args)
}

/*
 * Get an item
 */
function getItem(item_type, items_id) {
    let args = new Array(arguments.length);
    for(let i = 2; i < args.length; ++i) {
        args[i] = arguments[i];
    }

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

    if (g_debugJs) console.debug('getItem, type: ' + item_type + ', id: ' + items_id + ', parameters: ', args);

    return wsCall(item_type + '/' + items_id, args)
}

function getEntity(id, current) {
    if (current === undefined) {
        current = false;
    }

    return $.when(
        getItem('Entity', id, {"expand_dropdowns": true })
    ).done(function(entity) {
        console.info("-/- got entity: ", entity.completename);
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
    });
}

/*
 * Get all Glpi configuration
 * --------------------------------------------------------------------
 * combine several API requests to get all the global information
 */
function getConfiguration() {
    if (g_debugJs) console.debug('getConfiguration');

    return $.when(
        getFullSession(),
        getGlpiConfig(),
        getMyProfiles(),
        getActiveProfile(),
        getMyEntities(),
        getActiveEntities()
    ).done(function() {
        console.info('Configuration done.');
    });
}

$(function() {
    "use strict";

    // Application about panel
    $("#app_version").val(applicationManifest.version);
    $("#app_copyright").val(applicationManifest.copyright);
    $("#app_release").val(applicationManifest.release);
    $("#app_license").val(applicationManifest.license);

    // Application in debug mode ...
    g_debugJs = get_url_parameter('debug') ? true : g_debugJs;
    if (g_debugJs) console.debug('Glpi frontend, version:', applicationManifest.version);

    // Set current server ...
    if (get_url_parameter('server')) {
        setCurrentServer(get_url_parameter('server'));
    } else {
        setCurrentServer(g_server);
    }

    // Focus in modal windows...
    $('#modalLogin')
    .on('shown.bs.modal', function () {
        // Focus in the username field
        $('#login_username').focus();
        $(document).off('focusin.modal');
    });

    // Log in/out management
    $('body')
    .on('click', '#login-submit', function() {
        if (g_debugJs) console.debug('Login request ...');

        let username = $("#login_username").val();
        let password = $("#login_password").val();
        if (username.length > 0 && password.length > 0) {
            $("#login-alert").hide();
            // Try to log WS user on ...
            wsLogin(username, password);
        } else {
            alert('Merci de renseigner toutes les informations demandées.');
        }

        return false; // cancel original event to prevent real form submitting
    })
    .on("click", '#logout', function () {
        // Log out management
        if (g_debugJs) console.debug('Log out request ...');
        wsLogout();
    });

    // User events
    // -----
    $('body')
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
            // Get current session parameters and configuration
            $.when(
                getConfiguration()
            ).done(function() {
                console.info('Getting configured entities...');
                let tasks = [];
                $.each(userSettings.entities, function (index, entity) {
                    if (g_debugJs) console.debug("Get information for entity: ", entity.id);
                    tasks.push(getEntity(entity.id, userSettings.entity_id === entity.id));
                });

                $.when.apply($, tasks).done(function() {
                    console.info('Got all entities.');
                });
            });
        })
        .always(function() {
            // With a small delay to have thevisual effect even if it is very fast...
            window.setTimeout(function() {
                $("#loading").removeClass('fa-spin').removeClass('text-warning');
            }, 500);
        });
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

        // With a small delay to have thevisual effect even if it is very fast...
        window.setTimeout(function() {
            $.removeCookie('session');
            window.location.reload();
        }, 2000);
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

    // Get server availability.
    if (get_url_parameter('refresh')) {
        g_refreshPeriod = get_url_parameter('refresh');
    }

    // If a session still exist
    if (! g_session_token) {
        // Show modal login form
        $('#modalLogin').modal('show');
    } else {
        // Hide modal login form
        $('#modalLogin').modal('hide');
    }
});
