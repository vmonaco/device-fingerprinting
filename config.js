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

const timeSources = ['timeStamp','date','performance'];

// max number of events to update at once
// this is mainly to rate limit mousemove events
const bufferSize = 50;

// time between worker callbacks
const updateTimeout = 500;

// time between plot updates
const plottingInterval = 500;

const defaultHzRange = [20, 501, 1]; // min, max, step

const layout = {
  showlegend: false,
  autosize: true,
  height: 200,
  xaxis: {
    zeroline: false,
    title: {
      text: 'Hz',
      font: {
        family: 'Courier New, monospace',
        size: 16,
        color: '#7f7f7f'
      },
    },
    range: [defaultHzRange[0]-2, defaultHzRange[1]+2],
  },
  yaxis: {
    showgrid: false,
    zeroline: false,
    showticklabels: false,
  },
  margin: {
    t: 50,
    l: 20,
    r: 20,
    b: 50
  },
};
