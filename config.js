// which events to show plots for
const eventTypes = [
  'keydown',
  // 'keyup',
  'mousemove',
  'wheel',
  // 'mousedown',
  // 'mouseup',
  // 'touchstart',
  'touchmove',
];

// TODO: better way to handle time sources in teh logger
const timeSources = ['timeStamp', 'date', 'performance', 'worker'];

// max number of events to update at once
// this is mainly to rate limit mousemove events
const bufferSize = 50;

// time between worker callbacks
const updateTimeout = 500;

// time between plot updates
const plottingInterval = 500;

// x axis Hz [min, max, step]
const defaultHzRange = [20, 501, 1];

const layout = {
  showlegend: false,
  autosize: true,
  height: 200,
  xaxis: {
    zeroline: false,
    range: [defaultHzRange[0] - 8, defaultHzRange[1] + 8],
  },
  yaxis: {
    showgrid: false,
    zeroline: false,
    showticklabels: false,
  },
  margin: {
    t: 30,
    l: 20,
    r: 20,
    b: 50
  },
  plot_bgcolor: '#fff',
  paper_bgcolor: '#eee',
  title: {
    x: 0.5,
    xanchor: 'center',
    y: 0.84,
    yanchor: 'top',
    font: {
      family: 'Courier New, monospace',
      size: 16,
      color: '#7f7f7f'
    }
  }
};
