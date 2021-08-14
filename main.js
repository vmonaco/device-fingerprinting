let logger = new EventLogger(eventTypes);
let workers = {};
let timeSource = null;

function getTimeSource() {
  for (const e of document.getElementsByName('timeSource')) {
    if (e.checked)
      return e.value;
  }
}

// starts or updates the worker with the current time source
// TODO: there might be a race condition if the time source changes while an update is already in progress
function postEvents() {
  timeSource = getTimeSource();
  for (eventType of eventTypes) {
    workers[eventType].postMessage({
      t: logger.emptyBuffer(timeSource, eventType),
      forceUpdate: true,
      timeSource: timeSource
    });
  }
}

window.onload = function() {
  for (eventType of eventTypes) {
    document.getElementById("container").innerHTML += `
      <div class="row align-items-center">
      <div class="col-lg-1 col-md-1 col-sm-1 text-justify">
      <p class="text-monospace text-center">${eventType}</p>
      </div>

      <div class="col-lg-1 col-md-1 col-sm-1 text-justify">
      <p id="${eventType}_counter" class="text-monospace text-center">0</p>
      </div>

      <div class="col-lg-8 col-md-8 col-sm-8">
      <div id="${eventType}_psd"></div>
      </div>

      <div class="col-lg-1 col-md-1 col-sm-1">
      <div id="${eventType}_freq" class="text-center">-</div>
      </div>

      <div class="col-lg-1 col-md-1 col-sm-1">
      <div id="${eventType}_skew" class="text-center">-</div>
      </div>
      </div>`;

    // init the plot with all zeros as a placeholder
    Plotly.newPlot(`${eventType}_psd`, [{
      x: freqs.slice(),
      y: zeros.slice(),
      type: 'lines'
    }], JSON.parse(JSON.stringify(layout)));

    // start a worker for each event type
    var worker = new Worker('fingerprint.js');

    // the worker continuously updates plots and estimates
    worker.onmessage = function(event) {
      let that = this; // closure

      if (event.data != null) {
        document.getElementById(`${that.eventType}_counter`).innerHTML = event.data.N;
        document.getElementById(`${that.eventType}_freq`).innerHTML = event.data.fundFreq;
        document.getElementById(`${that.eventType}_skew`).innerHTML = event.data.skew;
        Plotly.react(`${that.eventType}_psd`, [{
          x: event.data.freqs,
          y: event.data.Pxx,
          type: 'lines'
        }], JSON.parse(JSON.stringify(layout)));
      }

      // timeout between callbacks to empty the buffer and post new events
      setTimeout(function() {
        that.postMessage({
          t: logger.emptyBuffer(timeSource, that.eventType).slice(0, maxPostEvents),
          forceUpdate: false,
          timeSource: timeSource
        });
      }, updateTimeout);
    };

    worker.onerror = function(error) {
      console.log(error.message);
      throw error;
    };

    worker.eventType = eventType;
    workers[eventType] = worker;
  }

  // start logging events and updating the workers
  logger.startLogging();
  postEvents();
}
