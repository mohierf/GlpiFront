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
 */
let userSettings = {
    // Server's name
    server: '',

    // Tickets table display
    tickets_table: {
        // Default page count
        page_count: 5,

        range_min: 0,
        range_max: 0,

        count: 0,
        total_count: 0,

        // Default columns
        forcedisplay: [
            1, 3, 4, 7, 10, 11, 12, 14, 15, 16, 17, 19, 25
        ]
    }
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
                    {message: "Access denied, check your credentials and try again."}));

            $("#login-alert").show();
            $.removeCookie('session');
        } else {
            console.error('Login failed !');
            console.error(textStatus, jqXHR);
        }
    })
    .always(function() {
    })
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
function wsCall(sEndpoint, parameters) {
    if (g_debugJs) console.debug('wsCall, endpoint: ' + sEndpoint + ', parameters: ', parameters);

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
        data: parameters
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
    return wsCall('getActiveEntities')
    .done( function( response ) {
        if (g_debugJs) console.debug('Active entities: ', response);

        userSettings.activeEntities = response["active_entity"];

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
        // With a small delay to have thevisual effect even if it is very fast...
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

    return wsCall('getFullSession')
    .done(function(response) {
        if (g_debugJs) console.debug('getFullSession, response: ', response);
        let session = response["session"];

        setCurrentUser(session["glpilanguage"], session["glpiID"], session["glpiname"], session["glpirealname"] + ' ' + session["glpifirstname"]);
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

    return wsCall('getMyProfiles')
    .done(function(response) {
        if (g_debugJs) console.debug('getMyProfiles, response: ', response);
        userSettings.user_profiles = response["myprofiles"];

        if (g_debugJs) {
            $.each(userSettings.user_profiles, function (index, profile) {
                console.debug(profile.id, profile.name, profile.entities)
            })
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

    return wsCall('getMyEntities')
    .done(function(response) {
        if (g_debugJs) console.debug('getMyEntities, response: ', response);
        userSettings.user_entities = response["myentities"];

        if (g_debugJs) {
            $.each(userSettings.user_entities, function (index, entity) {
                console.debug(entity.id, entity.name)
            })
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

    return wsCall(item_type + '/' + items_id, parameters)
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
        getItem('User', id, {expand_dropdowns: '1'})
    ).done(function(user) {
        console.info("Got user information: ", user);

        // Store user information
        userSettings.user_data = user;
    })
}


/*
 * Get some tickets
 */
function getNewTickets() {
    let parameters = {
        "criteria": [
            { "field": 12, "searchtype": 'equals', "value": '1' }
        ]
    };
    return getTickets("tickets_new", "Nouveaux tickets", parameters);
}
function getProgressingTickets() {
    let parameters = {
        "criteria": [
            { "field": 12, "searchtype": 'equals', "value": 'process' }
        ]
    };
    return getTickets("tickets_progressing", "Tickets en cours", parameters);
}
function getSuspendedTickets() {
    let parameters = {
        "criteria": [
            { "field": 12, "searchtype": 'equals', "value": '4' }
        ]
    };
    return getTickets("tickets_suspended", "Tickets en attente", parameters);
}
function getClosedTickets() {
    let parameters = {
        "criteria": [
            { "field": 12, "searchtype": 'equals', "value": 'old' }
        ]
    };
    return getTickets("tickets_closed", "Tickets résolus et clos", parameters);
}
function getTickets(table, title, parameters) {

    parameters.sort = '1';
    parameters.order = "ASC";
    parameters.range = "0-" + (userSettings.tickets_table.page_count - 1);
    parameters.forcedisplay = userSettings.tickets_table.forcedisplay;

    // Get all possible tickets
    return $.when(
        searchItems('Ticket', parameters)
    ).done(function(tickets) {
        if (g_debugJs) console.debug('Found tickets: ', table, tickets);

        userSettings.tickets_table.count = parseInt(tickets["count"]);
        userSettings.tickets_table.total_count = parseInt(tickets["totalcount"]);

        if ($("#" + table).children().length === 0) {
            // Build table from the template
            let html_template = $("#tpl-tickets-table").html();

            // $("#" + table).
            $("#tickets-tabs").
            append(html_template
            .replace(/__table__/g, table)
            .replace(/__title__/g, title)
            .replace(/__count__/g, tickets["count"])
            .replace(/__totalcount__/g, tickets["totalcount"])
            );
        }

        // Update tickets count
        // $("#" + table + " span.badge:nth-child(2)").text(userSettings.tickets_table.count);
        // $("#" + table + " span.badge:nth-child(1)").text(userSettings.tickets_table.total_count);

        // Update navigation
        let range_parser = new RegExp(/(\d+)-(\d+)\/(\d+)/);
        let range = tickets["content-range"].match(range_parser);
        try {
            userSettings.tickets_table.range_min = parseInt(range[1]);
            userSettings.tickets_table.range_max = parseInt(range[2]);
            userSettings.tickets_table.total_count = parseInt(range[3]);

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
        let head_content = $("#" + table + ' thead>tr').html();
        let row = null;
        let head = null;

        if (tickets.data.length > 0) {
            // Build table header
            head = head_content;
            $.each(tickets.data[0], function (idx) {
                head = head.replace(new RegExp('__' + idx + '__',"g"), userSettings.tickets_searchOptions[idx].name);
            });
            $("#" + table + ' thead>tr').html(head);
        }
        // Build table rows
        $.each(tickets.data, function (index, ticket) {
            if (g_debugJs) console.debug('Ticket:', ticket);

            row = html_template;
            $.each(ticket, function (idx, value) {
                if (value && value.hasOwnProperty('length') && value.length > 25) {
                    row = row.replace(new RegExp('__' + idx + '__',"g"), value.substring(0,25)+'&hellip;');
                } else {
                    row = row.replace(new RegExp('__' + idx + '__',"g"), value);
                }
            });
            $("#" + table + " tbody").append(row);
        })
    })
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
    ).done(function() {
        $.when(
            getUser(),
            getGlpiConfig(),
            getMyProfiles(),
            getActiveProfile(),
            getMyEntities(),
            getActiveEntities()
        ).done(function() {
            console.info('Configuration done.');
        })
    })
}

$(function() {
    "use strict";

    let page_body = $('body');

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
    page_body
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
            // Get current session parameters and configuration
            $.when(
                getConfiguration()
            ).done(function() {
                console.info('Getting configured entities...');
                let tasks = [];
                $.each(userSettings.entities, function (index, entity) {
                    if (g_debugJs) console.debug("Get information for entity: ", entity.id);
                    tasks.push(getEntity(entity.id, userSettings.entity_id === entity.id));
                })

                $.when.apply($, tasks).done(function() {
                    console.info('Got all entities.');
                })

                $("body").trigger(
                    $.Event("configuration_done", {message: "Fetched all the configuration data!"}));
            })
            .done(function() {
            })
        })
        .always(function() {
            // With a small delay to have thevisual effect even if it is very fast...
            window.setTimeout(function() {
                $("#loading").removeClass('fa-spin').removeClass('text-warning');
            }, 500);
        })
    })
    .on("user_signed_out", function (event) {
        // User events - sign out
        console.info('User signed out');
        alertify.success(event.message);

        // Reset forms fields
        $.each($('#glpi-data input'), function (index, field) {
            if (g_debugJs) console.debug(index, field);
            field.value = '';
        })

        $.each($('#glpi-data textarea'), function (index, field) {
            if (g_debugJs) console.debug(index, field);
            field.value = '';
        })

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
        // User events - unauthorized access
        console.info('Configuration done:', event.message);
        alertify.success(event.message);

        // Get all possible tickets
        $("#loading").addClass('fa-spin').addClass('text-warning');
        $("#panel-tickets").show();
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

            $.each(searchOptions, function (idx, so) {
                if (g_debugJs) console.debug(idx, so.name);
            })

            $.when(
                getNewTickets(),
                getProgressingTickets(),
                getSuspendedTickets(),
                getClosedTickets()
            ).done(function() {
                console.info('Got all tickets');
            })
        })
        .always(function() {
            // With a small delay to have thevisual effect even if it is very fast...
            window.setTimeout(function() {
                $("#loading").removeClass('fa-spin').removeClass('text-warning');
            }, 500);
        })
    });

    // Get server availability.
    if (get_url_parameter('refresh')) {
        g_refreshPeriod = get_url_parameter('refresh');
    }

    if (g_user_token) {
        // A user token is defined, no login is necessary, so simulate a login with empty credentials
        // Try to log WS user on ...
        wsLogin();
    } else {
        // If a session still exist
        if (! g_session_token) {
            // Show modal login form
            $('#modalLogin').modal('show');
        } else {
            // Hide modal login form
            $('#modalLogin').modal('hide');
        }
    }
});
