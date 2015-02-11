'use strict';

var webrtcConnectivity;
var webrtcCall;

var toCall = "sip:vtest@alissas.gre.hp.com";

/**
 *  A simple function for checking if it's really a string
 */
function isString(o) {
    return (Object.prototype.toString.call(o) === '[object String]');
}

/**
 * Main funciton in charge to initialize the minimum for a WebRTC Call
 */
function initCallHandler() {

    /**
     * A simple click handler on a button
     * for a call initialization
     */
	$('#placeCall').click(function() {

        // Pass arguments
		var options = {
            'audio': true,
            'video': true,
            'localVideoEl' : 'localVideo',
            'remoteVideoEl' : 'remoteVideo'
		};

        // Createa call, @see newCall
	    webrtcCall = newCall(toCall, options);

        // Now place the call
	    webrtcCall.place();

	});

    /**
     * A simple click handler on a close button
     */
	$('#hangUpCall').click(function() {
        // Destroy the call
		if (webrtcCall) {
			webrtcCall.destroy();
			webrtcCall = undefined;
		}
	});


    /*
     * This is a mandatory operation
     * The first step is to get a valid Channel Key via a xhr | REST API
     * If a key is retrieved we can connect to the Internet Signaling Function
     */ 
    requestChannelKey(
        'SF',
        function(err, endPointData) {
            if (err) {
                // log the error to the console
                console.warn('Channel Key Query : ' + err);
            } else {

                if (!endPointData.ck || !endPointData.gwUris) {
                    console.warn('No valid endpoint data received');
                }
                else {
                    console.log('Channel key returned : ' + endPointData.ck);
                    console.log('Gateways returned    : ' + endPointData.gwUris);

                    // At tihs point we have a new endPointData, we can pass it for
                    // a new connectivity request (one CK per connectivity)
                    // One connectivity can place multiple calls.
                    //
                    webrtcConnectivity = newConnectivity(endPointData);
                }
            }
        }
    );

}

/**
 * Simple funciton for a REST Query
 */ 
function requestChannelKey(type, cb) {

    var ajaxURL = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/webrtc/endpoint';

    var request = $.ajax({
        url: ajaxURL,
        type: 'post'
    });

    // callback handler that will be called on success
    request.done(
        function(response, textStatus, jqXHR) {

            if (cb !== undefined) {
                cb(undefined, response);
            }
        }
    );

    // callback handler that will be called on failure
    request.fail(
        function(jqXHR, textStatus, errorThrown) {

            if (cb !== undefined) {
                cb(errorThrown);
            }
        }
    );
}

/**
 * One we have a connectivity, we can place event handlers on it
 * eg. State of the channel (connected, disconnected, error)
 * but also some external events such as Incoming Call, Incoming Message
 * which are not linked to an active call when arrived
 */ 
function newConnectivity(endPointData) {

    /*
     rtcConfiguration: {
     iceServers: [ {url: 'stun:stun.l.google.com:19302'} ]
     }
     */
	var connectivity;

    try {

        // Create an instance of a WebRTC connectivity            
        connectivity = WebRTCFactory.createConnectivity(endPointData);

        //
        // Handle webrtc connectivity errors
        //
        if (connectivity) {

            connectivity.on('error', function(error) {
                console.log(error);
            });

            //
            // Handle WebRTC connection Signaling Channel Events
            //
            connectivity.on('signaling', function(event) {

                event.stopPropagation = true;

                switch (event.state) {

                    case event.STATE_SIGNALING_READY:
                        $('.status').text('Ready');
                        break;

                    case event.STATE_SIGNALING_STALE:
                        $('.status').text('Stale');
                        break;

                    case event.STATE_SIGNALING_NOT_CONNECTED:
                        $('.status').text('Not Connected');
                        break;

                    case event.STATE_SIGNALING_CONNECTING:
                        $('.status').text('Connecting');
                        break;

                    case event.STATE_SIGNALING_INCOMING_CALL:
                        $('.status').text('Incoming Call');
                        break;

                    case event.STATE_SIGNALING_OUTGOING_CALL:
                        break;

                    case event.STATE_SIGNALING_INCOMING_MESSAGE_STATUS:
                        $('.status').text('Incoming Message Status');
                        break;

                    case event.STATE_SIGNALING_INCOMING_MESSAGE:
                    case event.STATE_SIGNALING_OUTGOING_MESSAGE:
                        $('.status').text('Message Status');
                        break;

                    default:
                        break;
                }
            });

            connectivity.connect();

        }
    }
    catch(ex) {
        console.warn(ex);
    }

    return connectivity;
}


/**
 * New call is a simple function in charge to manage 
 * incoming call (connectivity detected @see STATE_SIGNALING_INCOMING_CALL)
 * or an outgoing call when a call is pending. It attaches some events
 * to the call itself in order to dected MESSAGE in call or Hangup...
 */ 
function newCall(callObj, mediaStreamConstraints) {

    if (!webrtcConnectivity) {
        throw 'No connectivity available';
    }

    var uri = isString(callObj) ? callObj : undefined;
    var call = isString(callObj) ? undefined : callObj;
	var callType = 'audio';

    var callId;

    if (mediaStreamConstraints && mediaStreamConstraints.video) {
        
        callType = 'video';

        mediaStreamConstraints.video = {
            mandatory: {
                minWidth: 1280,
                minHeight: 720
            }
        };
    }

    // Create an instance of a WebRTC call
    if (uri !== undefined) {
        var options = {};
        options.mediaStreamConstraints = mediaStreamConstraints;
        call = webrtcConnectivity.createCall(uri, options);
    }

    callId = call.getId();

    call.on('error', function(event) {
    	console.error(event);
    });

    call.on('session', function(event) {
		if (event.signalingState === event.SESSION_CLOSED) {
			webrtcCall = undefined;
		}
    });

    call.on('media', function(event) {
    	console.log(event);
    });
    
    // Send Event
    return call;
}

/**
 * jquery entry point when the dom is ready
 */
$(document).ready(function(e) {	
	if (isWebRTCEnabled()) {
		initCallHandler();
	} else {
		console.warn('WebRTC is NOT supported');
	}  
});

