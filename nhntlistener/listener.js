window.onload = function(){

window.AudioContext = window.AudioContext || window.webkitAudioContext;
window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;

var context = null;
var recorder = null;

// the ggwave module instance
var ggwave = null;
var parameters = null;
var instance = null;

var responses = [];
var messageParts = [];
var plantName = ""

var nameFlag = false;

// plant names from SE1 -> SE5
var plantNames = ["Pin-Stripe Calathea", "California Black Rose", "Dracaena Sunray Cane", "Inch Plant", "California Ming Aralia"]

// instantiate the ggwave instance
// ggwave_factory comes from the ggwave.js module
ggwave_factory().then(function(obj) {
    ggwave = obj;
});

var txData = document.getElementById("txData");
var rxData = document.getElementById("rxData");
rxData.innerHTML = 'Press the start button and hold the phone next to the plants.';
var captureStart = document.getElementById("captureStart");
var captureStop = document.getElementById("captureStop");

// helper function
function convertTypedArray(src, type) {
    var buffer = new ArrayBuffer(src.byteLength);
    var baseView = new src.constructor(buffer).set(src);
    return new type(buffer);
}

// initialize audio context and ggwave
function init() {
    if (!context) {
        context = new AudioContext({sampleRate: 48000});

        parameters = ggwave.getDefaultParameters();
        parameters.sampleRateInp = context.sampleRate;
        parameters.sampleRateOut = context.sampleRate;
        instance = ggwave.init(parameters);
    }
}

//
// Tx
//

function onSend() {
    init();

    // pause audio capture during transmission
    captureStop.click();

    // generate audio waveform
    var waveform = ggwave.encode(instance, txData.value, ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, 10)

    // play audio
    var buf = convertTypedArray(waveform, Float32Array);
    var buffer = context.createBuffer(1, buf.length, context.sampleRate);
    buffer.getChannelData(0).set(buf);
    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
}

//
// Rx
//

captureStart.addEventListener("click", function () {
    init();

    let constraints = {
        audio: {
            // not sure if these are necessary to have
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false
        }
    };

    navigator.mediaDevices.getUserMedia(constraints).then(function (e) {
        mediaStream = context.createMediaStreamSource(e);

        var bufferSize = 1024;
        var numberOfInputChannels = 1;
        var numberOfOutputChannels = 1;

        if (context.createScriptProcessor) {
            recorder = context.createScriptProcessor(
                    bufferSize,
                    numberOfInputChannels,
                    numberOfOutputChannels);
        } else {
            recorder = context.createJavaScriptNode(
                    bufferSize,
                    numberOfInputChannels,
                    numberOfOutputChannels);
        }



        recorder.onaudioprocess = function (e) {
            var source = e.inputBuffer;
            var res = ggwave.decode(instance, convertTypedArray(new Float32Array(source.getChannelData(0)), Int8Array));

            if (res && res.length > 0) {
                res = new TextDecoder("utf-8").decode(res);

                // ----------------------------------------------
                // this decodes multipart messages
                // const re = /(\d+):(\d):(\d)\/(\d):/;
                const re = /(\d):(\d)\/(\d):/;
                header = res.match(re)
                console.log(header)

                if(header == null){
                    responses.unshift(res);
                    leftRight = !leftRight;

                }else if(header != null){

                    messageParts.push(res);

                    if(header[2] < header[3]){
                        console.log("waiting for message parts");
                        console.log(messageParts);

                        if(header[2] == 1){
                            if(nameFlag == true){
                                recipient = parseInt(header[1], 10);
                                plantName = getPlantName(recipient);
                                console.log("dot dot dot?");
                                responses.unshift(plantName + " talking. . .");
                            }else{
                                responses.unshift("incoming message. . .");
                            }
                            leftRight = !leftRight;
                        }

                    }else if(header[2] == header[3]){
                        console.log("got all message parts");
                        var message = "";

                        console.log("length: " + responses.length)

                        if(header[3] > 1){
                            console.log("responses: ");
                            console.log(responses);
                            console.log("removing entry");
                            responses.shift();
                            leftRight = !leftRight;
                        }

                        console.log("length: " + responses.length)
                        
                        for(var i = 0; i < messageParts.length; i++){
                            const headerStrip = /(\d):(\d)\/(\d):/g;
                            var part = messageParts[i].replace(headerStrip, '');
                            message = message + " " + part;
                            console.log(message);
                        }

                        if(nameFlag){
                            if(plantName == ""){
                                plantName = getPlantName(parseInt(header[1]));
                            }
                            message = plantName + ": " + message;
                        }

                        responses.unshift(message);
                        // if(header[1] == 1){
                            leftRight = !leftRight;
                        // }
                        messageParts = [];
                    }
                }

                // ----------------------------------------------

                displayResponse();
                console.log(responses);
            }
        }

        mediaStream.connect(recorder);
        recorder.connect(context.destination);
    }).catch(function (e) {
        console.error(e);
    });

    rxData.innerHTML = '-- Microphone active -- ';
    captureStart.hidden = true;
    captureStop.hidden = false;
});

captureStop.addEventListener("click", function () {
    if (recorder) {
        recorder.disconnect(context.destination);
        mediaStream.disconnect(recorder);
        recorder = null;
    }

    rxData.innerHTML = 'Press the start button and hold the phone next to the plants.';
    captureStart.hidden = false;
    captureStop.hidden = true;
});

captureStop.click();

var leftRight = true;

function getPlantName(number){
    plantName = ""
    switch(number){
     case 1:
         plantName = plantNames[0];
         break;
     case 2:
         plantName = plantNames[1];
         break; 
     case 3:
         plantName = plantNames[2];
         break;
     case 4:
         plantName = plantNames[3];
         break;
     case 5:
         plantName = plantNames[4];
         break;  
     default:
         plantName = "unknown";     
    }

    return plantName;
}

function displayResponse() {
    var list = document.getElementById("list");
    list.innerHTML = '';
    for(let i = 0; i < responses.length; i++){
        var li = document.createElement("li");

        // this keeps the messages on the same side, but switehd the side of the new message...complicated but simple
        if(i % 2 == 0){
            if(leftRight){
                li.className = "leftUL";
            }else{
                li.className = "rightUL";
            }
        }else{
            if(leftRight){
                li.className = "rightUL";
            }else{
                li.className = "leftUL";
            }
        }
        if(i == 0){
            li.setAttribute("style", "font-weight: bold");
        }

        li.appendChild(document.createTextNode(responses[i]));
        list.appendChild(li);
    }
}

}
