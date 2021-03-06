let logger = new BufferedEventLogger(eventTypes, timeSources, bufferSize);
let workers = {}; // indexed by eventType
let currentTimeSource = null;

// update the current time source and force all plots to update
function updateTimeSource() {
  for (const e of document.getElementsByName('timeSource')) {
    if (e.checked) {
      currentTimeSource = e.value;
      break;
    }
  }

  // web worker time source is CPU intensive, turn it on only if selected
  if (currentTimeSource == 'worker') {
    logger.enableWorker();
  } else {
    logger.disableWorker();
  }

  updatePlots(true);
}

// update every plot from current the worker estimates
function updatePlots(forceUpdate) {
  for (const eventType of logger.eventTypes) {
    updatePlot(workers[eventType], forceUpdate);
  }
}

// update a plot from a worker that holds device fingerprint estimates
function updatePlot(worker, forceUpdate) {
  // data is null until some events are logged
  if (worker.data == null || worker.data[currentTimeSource] == null) {
    return
  }

  const data = worker.data[currentTimeSource];

  // nothing new since the last update
  if (!forceUpdate && (worker.lastUpdate == data.N)) {
    return;
  }

  let title = `${worker.eventType}`;

  if (data.skew > 0) {
    title += ` (N=${data.N}, ${data.skew} Hz)`;
  } else {
    title += ` (N=${data.N}, no fund. Hz)`;
  }

  Plotly.react(`${worker.eventType}_psd`, [{
        x: data.freqs,
        y: data.Pxx,
        type: 'lines'
      },
      {
        x: data.domFreqs,
        y: data.domPxx,
        mode: 'markers+text',
        text: data.domFreqs.map(x => `${x} Hz`),
        textposition: 'top',
        type: 'scatter'
      }
    ], {
      ...layout,
      title: {
        ...layout.title,
        text: title,
      },
      yaxis: {
        showgrid: false,
        zeroline: false,
        showticklabels: false,
        range: [0, data.maxPxx*1.5],
      },
    });

  worker.lastUpdate = data.N;
}

window.onload = function() {
  for (const eventType of logger.eventTypes) {
    document.getElementById("container").innerHTML += `
      <div class="row align-items-center">
      <div class="col-lg-12 col-md-12 col-sm-12">
      <div id="${eventType}_psd"></div>
      </div>
      </div>`;

    // TODO: init the plot with all zeros as a placeholder
    Plotly.newPlot(`${eventType}_psd`, [], {
      ...layout,
      title: {
        ...layout.title,
        text: `${eventType} (N=0, no fund. Hz)`,
      },
    });

    // start a worker for each event type
    var worker = new Worker('fingerprint.js');
    worker.eventType = eventType;
    workers[eventType] = worker;

    // continuously update estimates with a timeout between callbacks
    worker.onmessage = function(event) {
      let that = this; // closure

      if (event.data != null) {
        that.data = event.data;
      }

      // timeout between callbacks to empty the buffer and post new events
      setTimeout(function() {
        that.postMessage(logger.emptyBuffer(that.eventType));
      }, updateTimeout);
    };

    worker.onerror = function(error) {
      console.log(error.message);
      throw error;
    };

    // starts the callback loop
    worker.postMessage(logger.emptyBuffer(eventType));
  }

  // start logging events and updating the workers
  logger.startLogging();
  updateTimeSource();
  setInterval(function() { updatePlots(false); }, plottingInterval);
}
