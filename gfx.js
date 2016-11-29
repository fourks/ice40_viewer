var drawAll = false;

function canvas2world(canvas, cx, cy) {
    var wx, wy;
    var cw = canvas.width;
    var ch = canvas.height;
    wx = view_x0 + cx/cw*(view_x1-view_x0);
    wy = view_y0 + (ch-cy)/ch*(view_y1-view_y0);
    return [wx, wy];
}


function world2canvas(canvas, wx, wy) {
    var cx, cy;
    var cw = canvas.width;
    var ch = canvas.height;
    cx = (wx - view_x0)/(view_x1 - view_x0)*cw;
    cy = ch - (wy - view_y0)/(view_y1 - view_y0)*ch;
    return [cx, cy];
}


function worldFillRect(canvas, wx0, wy0, wx1, wy1) {
    var a = world2canvas(canvas, wx0, wy1);
    var b = world2canvas(canvas, wx1, wy0);
    canvas.getContext("2d").fillRect(a[0], a[1], b[0]-a[0], b[1]-a[1]);
}


function worldMoveTo(canvas, c, wx, wy) {
    var a = world2canvas(canvas, wx, wy);
    c.moveTo(a[0], a[1]);
}


function worldLineTo(canvas, c, wx, wy) {
    var a = world2canvas(canvas, wx, wy);
    c.lineTo(a[0], a[1]);
}


function worldHFillText(canvas, c, label, wx, wy, wmax) {
    var a = world2canvas(canvas, wx, wy);
    if (wmax > 0) {
	var m = wmax/(view_x1 - view_x0)*canvas.width;
	c.fillText(label, a[0], a[1], m);
    } else
	c.fillText(label, a[0], a[1]);
}


function worldVFillText(canvas, c, label, wx, wy, wmax) {
    var a = world2canvas(canvas, wx, wy);
    c.save();
    c.translate(a[0], a[1]);
    c.rotate(Math.PI/2);
    if (wmax > 0) {
	var m = wmax/(view_x1 - view_x0)*canvas.height;
	c.fillText(label, 0, 0, m);
    } else
	c.fillText(label, 0, 0);
    c.restore();
}


var wire_coords;
var wire_types;
var wire_supernets;
var wire_count;
var junction_coords;
var junction_types;
var junction_count;
var text_coords;
var text_types;
var text_nets;
var text_supernets;
var text_count;
var tile_wire_idx
var tile_junction_idx;
var tile_text_idx;

var init_wire_count = 100000;
var init_junction_count = 50000;
var init_text_count = 50000;

// Wire types.
var WT_SP4H = 0;
var WT_SP4V = 1;
var WT_SP12H = 2;
var WT_SP12V = 3;
// Junction types.
var JT_DEFAULT = 0;
// Text types.
var TT_SYMBOL_H = 0;
var TT_SYMBOL_V = 1;


function wire_add(wire_type, wire_supernet, x0, y0, x1, y1) {
    if (4*wire_count >= wire_coords.length) {
	var new_len = Math.ceil(wire_count*3/2);
	var tmp1 = new Float32Arrray(4*new_len);
	var tmp2 = new Uint32Array(new_len);
	var tmp3 = new Uint32Array(new_len);
	tmp1.set(wire_coords);
	tmp2.set(wire_types);
	tmp3.set(wire_supernets);
	wire_coords = tmp1;
	wire_types = tmp2;
	wire_supernets = tmp3;
    }
    var idx = 4*wire_count;
    wire_coords[idx++] = x0;
    wire_coords[idx++] = y0;
    wire_coords[idx++] = x1;
    wire_coords[idx++] = y1;
    wire_types[wire_count] = wire_type;
    wire_supernets[wire_count++] = wire_supernet;
}


function junction_add(junction_type, x0, y0) {
    if (2*junction_count >= junction_coords.length) {
	var new_len = Math.ceil(junction_count*3/2);
	var tmp1 = new Float32Arrray(2*new_len);
	var tmp2 = new Uint32Array(new_len);
	tmp1.set(junction_coords);
	tmp2.set(junction_types);
	junction_coords = tmp1;
	junction_types = tmp2;
    }
    var idx = 2*junction_count;
    junction_coords[idx++] = x0;
    junction_coords[idx++] = y0;
    junction_types[junction_count++] = junction_type;
}


function text_add(text_type, text_net, text_supernet, x0, y0) {
    if (2*text_count >= text_coords.length) {
	var new_len = Math.ceil(text_count*3/2);
	var tmp1 = new Float32Arrray(2*new_len);
	var tmp2 = new Uint32Array(new_len);
	var tmp3 = new Uint32Array(new_len);
	var tmp4 = new Int32Array(new_len);
	tmp1.set(text_coords);
	tmp2.set(text_types);
	tmp3.set(text_nets);
	tmp4.set(text_supernets);
	text_coords = tmp1;
	text_types = tmp2;
	text_nets = tmp3;
	text_supernets = tmp4;
    }
    var idx = 2*text_count;
    text_coords[idx++] = x0;
    text_coords[idx++] = y0;
    text_types[text_count] = text_type;
    text_nets[text_count] = text_net;
    text_supernets[text_count++] = text_supernet;
}


function gfx_init() {
    var cw = chipdb.device.width;
    var ch = chipdb.device.height;
    wire_coords = new Float32Array(4*init_wire_count);
    wire_types = new Uint32Array(init_wire_count);
    wire_supernets = new Uint32Array(init_wire_count);
    wire_count = 0;
    junction_coords = new Float32Array(2*init_junction_count);
    junction_types = new Uint32Array(init_junction_count);
    junction_count = 0;
    text_coords = new Float32Array(2*init_text_count);
    text_types = new Uint32Array(init_text_count);
    text_nets = new Uint32Array(init_text_count);
    text_supernets = new Int32Array(init_text_count);
    text_count = 0;
    tile_wire_idx = new Uint32Array(2*cw*ch);
    tile_junction_idx = new Uint32Array(2*cw*ch);
    tile_text_idx = new Uint32Array(2*cw*ch);
}


function mk_tiles(chipdb) {
    var ts;
    var x, y;

    var w = chipdb.device.width;
    var h = chipdb.device.height;
    ts = [];
    for (y = 0; y < h; ++y) {
	ts[y] = [];
	for (x = 0; x < w; ++x) {
	    if (!(y in chipdb.tiles) || !(x in chipdb.tiles[y]))
		continue;
	    var typ = chipdb.tiles[y][x].typ;
	    ts[y][x] = { typ: typ, nets: { } };
	}
    }

    return ts;
}


function tileCol(typ, active) {
    switch (typ) {
    case "io":
	return active ? "#AAEEEE" : "#88AAAA";
    case "logic":
	return active ? "#EEAAEE" : "#a383a3";
    case "ramb":
	return active ? "#EEEEAA" : "#AAAA88";
    case "ramt":
	return active ? "#EEEEAA" : "#AAAA88";
    default:
	return "#000000";
    }
}


var tileEdge = 0.42;
var wireSpc = 0.0102;
var span4Base = - 0.4;
var span12Base = 0.4 - (12*2-1)*wireSpc;
var spanShort = -0.37;
var spanShort2 = -0.282;
var labelMax = 0.4;

function calcOneSpan4H(x, y, i, j, net, supernet) {
    var x1 = x - 0.5;
    var x2 = x + 0.5;
    var y1 = y + span4Base + (13*i+j)*wireSpc;
    if (i < 3) {
	// Crossed-over wires.
	var x3 = x - (7-20)*wireSpc;
	var x4 = x - (5-20)*wireSpc;
	var x5 = x + (6+20)*wireSpc;
	var y2 = y1 + (13 + 1)*wireSpc;
	var y3 = y1 + (13 - 1)*wireSpc;
	if ((j % 2) == 0) {
	    wire_add(WT_SP4H, supernet, x1, y1, x3, y1);
	    wire_add(WT_SP4H, supernet, x3, y1, x5, y2);
	    wire_add(WT_SP4H, supernet, x5, y2, x2, y2);
	} else {
	    wire_add(WT_SP4H, supernet, x1, y1, x4, y1);
	    wire_add(WT_SP4H, supernet, x4, y1, x5, y3);
	    wire_add(WT_SP4H, supernet, x5, y3, x2, y3);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 3) {
	// Connection on left that terminate in this tile.
	var x6 = x + spanShort;
	wire_add(WT_SP4H, supernet, x1, y1, x6, y1);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 4) {
	var x7 = x - spanShort;
	// Connection on bottom that originates in this tile.
	var y4 = y + span4Base + j*wireSpc;
	wire_add(WT_SP4H, supernet, x7, y4, x2, y4);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x7, y4);
    }
}


function calcOneSpan12H(x, y, i, j, net, supernet) {
    var x1 = x - 0.5;
    var x2 = x + 0.5;
    var y1 = y + span12Base + (2*i+j)*wireSpc;
    if (i < 11) {
	var x3 = x - 2*wireSpc;
	var x4 = x - 0*wireSpc;
	var x5 = x + 1*wireSpc;
	var y2 = y+span12Base + (2*(i+1)+j+1)*wireSpc;
	var y3 = y+span12Base + (2*(i+1)+j-1)*wireSpc;
	if ((j % 2) == 0) {
	    wire_add(WT_SP12H, supernet, x1, y1, x3, y1);
	    wire_add(WT_SP12H, supernet, x3, y1, x5, y2);
	    wire_add(WT_SP12H, supernet, x5, y2, x2, y2);
	} else {
	    wire_add(WT_SP12H, supernet, x1, y1, x4, y1);
	    wire_add(WT_SP12H, supernet, x4, y1, x5, y3);
	    wire_add(WT_SP12H, supernet, x5, y3, x2, y3);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 11) {
	var x6 = x + spanShort;
	wire_add(WT_SP12H, supernet, x1, y1, x6, y1);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 12) {
	var x7 = x - spanShort;
	var y4 = y + span12Base + j*wireSpc;
	wire_add(WT_SP12H, supernet, x7, y4, x2, y4);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x7, y4);
    }
}


function calcOneSpan4V(x, y, i, j, net, supernet) {
    var x1 = x + span4Base + (13*(i%4)+j)*wireSpc;
    var x4 = x - 0.5;
    var x5 = x + 0.5;
    var y1 = y + 0.5;
    var y2 = y - 0.5;
    var y8 = y + span4Base + (13*((i+1)%5)+j-0.5)*wireSpc;
    if (i < 3) {
	var x2 = x + span4Base + (13*(i+1)+j+1)*wireSpc;
	var x3 = x + span4Base + (13*(i+1)+j-1)*wireSpc;
	var y3 = y + (7+20)*wireSpc;
	var y4 = y + (5+20)*wireSpc;
	var y5 = y - (6-20)*wireSpc;
	// Crossed-over wires.
	if ((j % 2) == 0) {
	    wire_add(WT_SP4V, supernet, x1, y1, x1, y3);
	    wire_add(WT_SP4V, supernet, x1, y3, x2, y5);
	    wire_add(WT_SP4V, supernet, x2, y5, x2, y2);
	    // Connection to the tile on the left.
	    wire_add(WT_SP4V, supernet, x2, y8, x4, y8);
	    // Interconnect dots.
	    junction_add(JT_DEFAULT, x2, y8);
	} else {
	    wire_add(WT_SP4V, supernet, x1, y1, x1, y4);
	    wire_add(WT_SP4V, supernet, x1, y4, x3, y5);
	    wire_add(WT_SP4V, supernet, x3, y5, x3, y2);
	    // Connection to the tile on the left.
	    wire_add(WT_SP4V, supernet, x3, y8, x4, y8);
	    // Interconnect dots.
	    junction_add(JT_DEFAULT, x3, y8);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else if (i == 3) {
	var y6 = y - spanShort;
	// Connection on top that terminate in this tile.
	wire_add(WT_SP4V, supernet, x1, y1, x1, y6);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else if (i == 4) {
	var y7 = y + spanShort2;
	// Connection on bottom that originates in this tile.
	wire_add(WT_SP4V, supernet, x1, y7, x1, y2);
	// Connection to the tile on the left.
	wire_add(WT_SP4V, supernet, x1, y8, x4, y8);
	// Interconnect dots.
	junction_add(JT_DEFAULT, x1, y8);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y7);
    } else if (i >= 5) {
	var x8 = x - spanShort - wireSpc;
	var y9 = y + span4Base + (13*(i-5)+j-0.5)*wireSpc;
	// Connection to the span4v of the tile column on the right of this tile.
	wire_add(WT_SP4V, supernet, x8, y9, x5, y9);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, x8, y9);
    }
}


function calcOneSpan12V(x, y, i, j, net, supernet) {
    var x1 = x + span12Base + (2*i+j)*wireSpc;
    var y1 = y + 0.5;
    var y2 = y - 0.5;
    if (i < 11) {
	var x2 = x + span12Base + (2*(i+1)+j+1)*wireSpc;
	var x3 = x + span12Base + (2*(i+1)+j-1)*wireSpc;
	var y3 = y + 2*wireSpc;
	var y4 = y + 0*wireSpc;
	var y5 = y - 1*wireSpc;
	if ((j % 2) == 0) {
	    wire_add(WT_SP12V, supernet, x1, y1, x1, y3);
	    wire_add(WT_SP12V, supernet, x1, y3, x2, y5);
	    wire_add(WT_SP12V, supernet, x2, y5, x2, y2);
	} else {
	    wire_add(WT_SP12V, supernet, x1, y1, x1, y4);
	    wire_add(WT_SP12V, supernet, x1, y4, x3, y5);
	    wire_add(WT_SP12V, supernet, x3, y5, x3, y2);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else if (i == 11) {
	var y6 = y - spanShort;
	wire_add(WT_SP12V, supernet, x1, y1, x1, y6);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else {
	var x4 = x + span12Base + j*wireSpc;
	var y7 = y + spanShort;
	wire_add(WT_SP12V, supernet, x4, y7, x4, y2);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x4, y7);
    }
}


function calcTilesSpan(x, y, tile, major, minor, calcOneFn, spanKind) {
    var i, j;

    var tile = g_tiles[y][x];
    var nets = tile.nets;
    for (var net in nets) {
	var netdata = nets[net];
	if (netdata.kind == spanKind) {
	    var idx = netdata.index;
	    var sup;
	    if (net in g_net_connection)
		sup = g_net_connection[net];
	    else
		sup = -1;
	    calcOneFn(x, y, Math.floor(idx/minor), idx%minor, net, sup);
	}
    }
}


function calcTileWires(x, y, tile) {
    if (tile.typ != 'io') {
	// ToDo: io tile needs some differences here.
	calcTilesSpan(x, y, tile, 5, 12, calcOneSpan4H, "sp4h");
	calcTilesSpan(x, y, tile, 13, 2, calcOneSpan12H, "sp12h");
	calcTilesSpan(x, y, tile, 9, 12, calcOneSpan4V, "sp4v");
	calcTilesSpan(x, y, tile, 13, 2, calcOneSpan12V, "sp12v");
    }
}


function calcTiles(ts) {
    var x, y;
    var width = chipdb.device.width;
    var height = chipdb.device.height;

    gfx_init();

    for (y = 0; y < height; ++y) {
	for (x = 0; x < width; ++x) {
	    if (!(y in ts) || !(x in ts[y]))
		continue;
	    var tile = ts[y][x];
	    tile_wire_idx[2*(y*width+x)] = wire_count;
	    tile_junction_idx[2*(y*width+x)] = junction_count;
	    tile_text_idx[2*(y*width+x)] = text_count;
	    calcTileWires(x, y, tile);
	    tile_wire_idx[2*(y*width+x)+1] = wire_count;
	    tile_junction_idx[2*(y*width+x)+1] = junction_count;
	    tile_text_idx[2*(y*width+x)+1] = text_count;
	}
    }
}


var gfx_wire_styles = ["#00003F", "#3F0000", "#00003F", "#3F0000"];

function getWireStyle(wire_type) {
    if (wire_type >= WT_SP4H && wire_type <= WT_SP12V)
	return gfx_wire_styles[wire_type];
    else
	return "#000000";
}


function drawTileWires(canvas, x, y) {
    var c = canvas.getContext("2d");
    var width = chipdb.device.width;
    var height = chipdb.device.height;

    var wire0 = tile_wire_idx[2*(y*width+x)];
    var wire1 = tile_wire_idx[2*(y*width+x)+1];
    var junction0 = tile_junction_idx[2*(y*width+x)];
    var junction1 = tile_junction_idx[2*(y*width+x)+1];
    var text0 = tile_text_idx[2*(y*width+x)];
    var text1 = tile_text_idx[2*(y*width+x)+1];

    // Draw wires.
    var curType = undefined;
    c.lineWidth = 1;
    for (var i = wire0; i < wire1; ++i) {
	var x0 = wire_coords[i*4];
	var y0 = wire_coords[i*4+1];
	var x1 = wire_coords[i*4+2];
	var y1 = wire_coords[i*4+3];
	var wire_type = wire_types[i];
	if (curType == undefined || curType != wire_type) {
	    if (curType != undefined)
		c.stroke();
	    c.strokeStyle = getWireStyle(wire_type);
	    c.lineWidth = 1;
	    c.beginPath();
	    curType = wire_type;
	}
	worldMoveTo(canvas, c, x0, y0);
	worldLineTo(canvas, c, x1, y1);
    }
    if (curType != undefined)
	c.stroke();

    // Draw junctions.
    curType = undefined;
    var oldCap;
    for (var i = junction0; i < junction1; ++i) {
	var x0 = junction_coords[2*i];
	var y0 = junction_coords[2*i+1];
	var junction_type = junction_types[i];
	if (curType = undefined || curType != junction_type) {
	    if (curType != undefined) {
		c.stroke();
		oldCap = c.lineCap;
	    }
	    c.lineWidth = 5;
	    c.lineCap = "round";
	    c.beginPath();
	    curType = junction_type;
	}
	worldMoveTo(canvas, c, x0, y0);
	worldLineTo(canvas, c, x0, y0);
    }
    if (curType != undefined) {
	c.stroke();
	c.lineCap = oldCap;
    }

    // Draw labels.
    curType = undefined;
    var doLabels;
    for (var i = text0; i < text1; ++i) {
	var x0 = text_coords[2*i];
	var y0 = text_coords[2*i+1];
	var net = text_nets[i];
	var supernet = text_supernets[i];
	var text_type = text_types[i];
	if (curType == undefined || curType != text_type) {
	    // Adaptive font size
	    var size = (text_type == TT_SYMBOL_H) ?
		wireSpc/(view_y1-view_y0)*canvas.height :
		wireSpc/(view_x1-view_x0)*canvas.width;
	    size = Math.floor(0.9*size);
	    if (size < 8)
		doLabels = false;
	    else {
		if (size > 30)
		    size = 25;
		c.font = size.toString() + "px Arial";
		doLabels = true;
		c.fillStyle = c.strokeStyle;
	    }
	    c.lineWidth = 1;
	    curType = text_type;
	}
	if (doLabels) {
	    label = net.toString();
	    if (supernet >= 0) {
		var sup = g_supernets[supernet];
		if (sup.syms.length > 0) {
		    label += ": " + sup.syms[0];
		    if (sup.syms.length > 1)
			label += "(+)";
		}
	    }
	    if (curType == TT_SYMBOL_H)
		worldHFillText(canvas, c, label, x0, y0, labelMax);
	    else
		worldVFillText(canvas, c, label, x0, y0, labelMax);
	}
    }
}


function drawTiles(canvas, ts, chipdb) {
    var c = canvas.getContext("2d");
    var x0 = Math.floor(view_x0 - 0.5);
    var x1 = Math.ceil(view_x1 + 0.5);
    var y0 = Math.floor(view_y0 - 0.5);
    var y1 = Math.ceil(view_y1 + 0.5);

    var x, y;
    var width = canvas.width;
    var height = canvas.height;

    // Depending on how many pixels per tile (zoom level), we draw
    // with different level of detail.
    var tile_pixels =
	0.5*(canvas.width/(view_x1 - view_x0) + canvas.height/(view_y1 - view_y0));

    for (y = y0; y < y1; ++y) {
	for (x = x0; x < x1; ++x) {
	    if (!(y in ts) || !(x in ts[y]))
		continue;
	    var tile = ts[y][x];
	    var col = tileCol(tile.typ, tile.active);
	    c.fillStyle = col;
	    worldFillRect(canvas, x-tileEdge, y-tileEdge, x+tileEdge, y+tileEdge);

	    // Label the tile.
	    var size = Math.floor(0.05/(view_y1-view_y0)*canvas.height);
	    if (size < 8 && size >= 2)
		size = 8;
	    c.font = size.toString() + "px Arial";
	    c.fillStyle = "#000000";
	    var label = "(" + x.toString() + " " + y.toString() + ")";
	    worldHFillText(canvas, c, label, x-tileEdge, y+tileEdge);

	    if (tile_pixels > 80)
		drawTileWires(canvas, x, y, tile, chipdb);
	}
    }
}
