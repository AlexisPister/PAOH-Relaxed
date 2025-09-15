import * as d3 from 'd3';

import './style.css';
import DynViz from "./src/DynViz";

let jquery = require("jquery");
window.$ = window.jQuery = jquery; // notice the definition of global variables here
require("jquery-ui-dist/jquery-ui.js");
require("jquery-ui-dist/jquery-ui.css");


let dynVis = new DynViz("#main-svg");
dynVis.init();
