import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

/** react-plotly.js bound to the minified Plotly bundle (smaller than the full build). */
const Plot = createPlotlyComponent(Plotly);
export default Plot;

export const PLOT_CONFIG = { displaylogo: false, responsive: true, displayModeBar: false } as const;
