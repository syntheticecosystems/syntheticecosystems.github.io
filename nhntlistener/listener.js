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

// instantiate the ggwave instance
// ggwave_factory comes from the ggwave.js module
ggwave_factory().then(function(obj) {
    ggwave = obj;
});

var txData = document.getElementById("txData");
var rxData = document.getElementById("rxData");
rxData.innerHTML = 'Press the start button to begin listening to the plants!';
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
                
                var messageParts = []
                const re = /\d/g;
                header = res.match(re)

                if(header[1] < header[2]){
                    messageParts.append(res);
                }else if(header[1] == header[2]){
                    var message = "";
                    for(var i = 0; i < messageParts.length; i++){
                        message = message + messageParts[i];
                        console.log(message)
                    }
                    responses.unshift(message);
                }

                displayResponse();
                console.log(responses);
            }
        }

        mediaStream.connect(recorder);
        recorder.connect(context.destination);
    }).catch(function (e) {
        console.error(e);
    });

    rxData.innerHTML = 'listening ...';
    captureStart.hidden = true;
    captureStop.hidden = false;
});

captureStop.addEventListener("click", function () {
    if (recorder) {
        recorder.disconnect(context.destination);
        mediaStream.disconnect(recorder);
        recorder = null;
    }

    rxData.innerHTML = 'Press the start button to begin listening to the plants!';
    captureStart.hidden = false;
    captureStop.hidden = true;
});

captureStop.click();


function displayResponse() {
    var list = document.getElementById("list");
    list.innerHTML = '';
    for(let i = 0; i < responses.length; i++){
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(responses[i]));
        if(i == 0){
            li.setAttribute("style", "font-weight: bold");
        }
        list.appendChild(li);
    } 
}

function parseResponse(){
    const re = /\d/g;



}


}