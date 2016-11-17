function getLineParser(s) {
    var parser = { str: s, pos: 0 };
    return parser;
}


function nextLine(parser) {
    var oldpos = parser.pos;
    var str = parser.str;
    if (oldpos >= str.length)
	return null;
    var newpos = str.indexOf("\n", oldpos);
    if (newpos < 0)
	newpos = str.length;
    var line = str.substring(oldpos, newpos);
    if (newpos < str.length)
	++newpos;
    parser.pos = newpos;
    return line;
}


function nextNonBlankLine(parser) {
    for (;;) {
	var line = nextLine(parser);
	if (line == null)
	    return null;
	if (line.length == 0)
	    continue;
	if (line.substr(0, 1) == "#")
	    continue;
	return line;
    }
}


function unNextLine(parser, line) {
    var del = line.length + 1;
    if (del > parser.pos)
	throw "Attempt to unNextLine() past start of buffer";
    parser.pos -= del;
}


function parse_bitdef(a, cols) {
    var p = a.indexOf("[");
    var q = a.indexOf("]");
    if (a.substr(0, 1) != "B" || p < 0 || q < 0 || !(p < q))
	throw "Invalid bitdef '" + a + "'";
    var row = parseInt(a.substring(1, p));
    var col = parseInt(a.substring(p+1, q));
    return row*cols+col;
}


function get_bit(bits, idx) {
    var val = bits[Math.floor(idx/32)] & (1 << (31 - (idx % 32)));
    return val ? 1 : 0;
}


function chipdb_parse_step(parser, chipdb, onComplete) {
    var i;

    // Parse out arguments from .section header.
    var line_args = function(line, end, typ) {
	if (end >= line.length)
	    throw "No arguments on type '" + typ + "'";
	return line.substring(end + 1, line.length).split(" ");
    };

    // Singleton section. Just fields for each arg on the .TYPE line.
    var init_single_args = function(args_names) {
	return function (typ, line, end) {
	    var strargs = line_args(line, end, typ);
	    if (typ in chipdb)
		throw "Duplicate section '" + typ + "'";
	    var typdata = { };
	    var i;
	    for (i = 0; i < args_names.length; ++i) {
		if (i >= strargs.length)
		    throw "Missing argument " + i + " for typ '" + typ + "'"
		var a = strargs[i];
		var n = args_names[i];
		if (n.substr(0,1) == ".")
		    n = n.substring(1, n.length);
		else
		    a = parseInt(a);
		typdata[n] = a;
	    }
	    chipdb[typ] = typdata;
	    return typdata;
	};
    };

    // Single .section argument which becomes hash key containing nested hash.
    var init_hash_hash = function (typ, line, end) {
	var entry;
	if (typ in chipdb)
	    entry = chipdb[typ];
	else
	    chipdb[typ] = entry = { };
	var typdata = { };
	var strargs = line_args(line, end, typ);
	if (strargs.length != 1)
	    throw "Unexpected arguments for section '" + line + "'";
	entry[strargs[0]] = typdata;
	return typdata;
    }

    var tile_init = function(typ, line, end) {
	if (!('tiles' in chipdb))
	    chipdb.tiles = [];
	var arr = chipdb.tiles;
	var args = line_args(line, end, typ);
	var x = parseInt(args[0]);
	var y = parseInt(args[1]);
	if (!(y in arr))
	    arr[y] = [];
	// Strip trailing '_tile' from type name.
	var typname = typ.substring(0, typ.length-5);
	arr[y][x] = { typ: typname, buffers: [], routings: [] };
	return arr;
    };

    var init_buffer_routing = function (kind) {
	return function(typ, line, end) {
	    var args = line_args(line, end, typ);
	    if (args.length < 4)
		throw "Too few arguments for ." + kind + " line '" + line + "'"
	    var tile_x = parseInt(args[0]);
	    var tile_y = parseInt(args[1]);
	    var net = parseInt(args[2]);
	    if (!(tile_y in chipdb.tiles) || !(tile_x in chipdb.tiles[tile_y]))
		throw "Unknown tile (" + tile_x + " " + tile_y + ") in ." + kind;
	    var tile_typ = chipdb.tiles[tile_y][tile_x].typ;
	    var tile_cols = chipdb[tile_typ + "_tile_bits"].columns;
	    // Reverse bitindex list, so that the first one is bit 0 in the
	    // result from parInt(*, 2) of the config values for each source net.
	    var bit_indexes = args.slice(3).reverse().map
		(function (b) { return parse_bitdef(b, tile_cols); });
	    var arrsize = 1 << bit_indexes.length;
	    var arr = new Int32Array(arrsize);
	    // Initialize to -1 meaning 'No connection'.
	    arr.fill(-1);
	    chipdb.tiles[tile_y][tile_x][kind+"s"].push({ dst_net: net,
							  config_bits: bit_indexes,
							  src_nets: arr });
	    return arr;
	};
    };

    var tile_bits_add = function(data, values) {
	if (!('function' in data))
	    data.function = { };
	if (values.length < 2)
	    throw "Missing bitdef for function '" + values[1] + "'";
	data.function[values[0]] = [parse_bitdef(values[1], data.columns)];
	for (var i = 2; i < values.length; ++i)
	    data.function[values[0]].push(parse_bitdef(values[i], data.columns));
    };

    var buffer_routing_add = function(typdata, values) {
	typdata[parseInt(values[0], 2)] = parseInt(values[1]);
    };

    // Process a bunch of sections, then yield to avoid non-responsive GUI.
    // Need a fairly large number of sections at once, otherwise things become
    // really slow. The chipdb-8k.txt has 400k sections and 3M lines...
for (i = 0; i < 5000; ++i) {
    var line = nextNonBlankLine(parser);
    if (line == null) {
	return onComplete(chipdb);
    }

    if (line.substr(0, 1) != ".")
	throw ("Unexpected line: '" + line + "'.");
    var end = line.indexOf(" ", 1);
    if (end < 0)
	end = line.length;
    var typ = line.substring(1, end);
    var args = [];
    var init_func = function (typ, line, end) { };
    var content_func = function (data, values) { };
    switch(typ) {
    case "device":
	init_func = init_single_args([".device", "width", "height", "num_nets"]);
	break;
    case "pins":
	init_func = init_hash_hash;
	content_func = function (typdata, values) {
	    var entry = { pin_num: values[0], tile_x: parseInt(values[1]),
			  tile_y: parseInt(values[2]), num_nets: parseInt(values[3]) };
	    typdata[values[0]] = entry;
	};
	break;
    case "gbufin":
	break;
    case "gbufpin":
	break;
    case "iolatch":
	break;
    case "ieren":
	break;
    case "colbuf":
	break;
    case "io_tile":
	init_func = tile_init;
	break;
    case "logic_tile":
	init_func = tile_init;
	break;
    case "ramb_tile":
	init_func = tile_init;
	break;
    case "ramt_tile":
	init_func = tile_init;
	break;
    case "io_tile_bits":
	init_func = init_single_args(["columns", "rows"]);
	content_func = tile_bits_add;
	break;
    case "logic_tile_bits":
	init_func = init_single_args(["columns", "rows"]);
	content_func = tile_bits_add;
	break;
    case "ramb_tile_bits":
	init_func = init_single_args(["columns", "rows"]);
	content_func = tile_bits_add;
	break;
    case "ramt_tile_bits":
	init_func = init_single_args(["columns", "rows"]);
	content_func = tile_bits_add;
	break;
    case "extra_cell":
	break;
    case "extra_bits":
	break;
    case "net":
	init_func = function(typ, line, end) {
	    var args = line_args(line, end, typ);
	    if (args.length != 1)
		throw "Unexpected args for .net section header: '" + line + "'";
	    var net = parseInt(args[0]);
	    if (!('nets' in chipdb))
		chipdb.nets = [];
	    chipdb.nets[net] = { names: [], kind: "?" };
	    return chipdb.nets[net];
	};
	content_func = function(typdata, values) {
	    if (values.length != 3)
		throw "Unexpected line in .net section";
	    var netname = values[2];
	    var entry = {tile_x: parseInt(values[0]),
			 tile_y: parseInt(values[1]),
			 name: netname};
	    typdata.names.push(entry);
	    if (netname.substr(0, 6) == "sp12_h")
		typdata.kind = "sp12h";
	    else if (netname.substr(0, 6) == "sp12_v")
		typdata.kind = "sp12v";
	    else if (netname.substr(0, 5) == "sp4_h")
		typdata.kind = "sp4h";
	    else if (netname.substr(0, 5) == "sp4_v")
		typdata.kind = "sp4v";
	    // ToDo: more net kinds.
	};
	break;
    case "buffer":
	init_func = init_buffer_routing("buffer");;
	content_func = buffer_routing_add;
	break;
    case "routing":
	init_func = init_buffer_routing("routing");;
	content_func = buffer_routing_add;
	break
    default:
	throw "Unknown type found: '" + typ + "'";
    }

    var typdata;
    if (init_func)
	typdata = init_func(typ, line, end);
    else
	typdata = null;

    for (;;) {
	line = nextLine(parser);
	if (line == null) {
	    return onComplete(chipdb);
	}
	if (line == "")
	    break;
	if (line.substring(0, 1) == ".") {
	    unNextLine(parser, line);
	    break;
	}	    
	var values = line.split(" ");
	content_func(typdata, values);
    }
}

    // Yield for other tasks before processing the next chunk...
    setTimeout(function () { chipdb_parse_step(parser, chipdb, onComplete); }, 0);
}


function asc_parse_step(parser, chipdb, ts, syms, data, onComplete) {
    var i;
for (i = 0; i < 200; ++i) {
    var line = nextLine(parser);
    if (line == null) {
	return onComplete(ts, syms, data);
    }
    if (line.substr(0, 1) != ".")
	throw ("Unexpected line: '" + line + "'");

    if (line.substr(1, 7) == "comment") {
	console.log("Loading .asc from:" + line.substr(8));
	continue;
    }
    if (line.substr(1, 7) == "device ") {
	var device_name = line.substr(8);
	if (device_name != chipdb.device.device)
	    throw ".asc is for device '" + device_name + "', but chipdb is for device '" +
		  chipdb.device.device + "'";
	continue;
    }
    var as = line.split(" ");
    if (line.substr(1, 9) == "extra_bit") {
	if (as.length != 4)
	    throw "Unexpected format for line '" + line + "'";
	if (!('extra_bit' in data))
	    data.extra_bit = [];
	data.extra_bit.push([parseInt(as[1]), parseInt(as[2]), parseInt(as[3])]);
	continue;
    }
    if (as.length != 3)
	throw "Unexpected format for section line '" + line + "'";
    var typ = as[0];
    if (typ == ".sym") {
	syms[parseInt(as[1])] = as[2]
	continue;
    }
    var tile_x = parseInt(as[1]);
    var tile_y = parseInt(as[2]);
    if (!(tile_y in ts) || !(tile_x in ts[tile_y]))
	throw "Unexpected tile at (" + tile_x + " " + tile_y + ")";
    tile = ts[tile_y][tile_x];

    var line_parser;
    if (typ == ".ram_data") {
	if (tile.typ != "ramb")
	    throw "ram_data for (" + tile_x + " " + tile_y + "), but not a ramb tile";
	// .ram_data size seems to be hardcoded at 4096 bits, in lines of 32-byte hex.
	var ram_data = tile.ram_data = new Uint32Array(4096/32);
	var idx = 0;
	line_parser = function (line) {
	    var i;
	    if (line.length != 64)
		throw "Bad .ram_data line (length != 64): '" + line + "'";
	    if (idx > 4096/32)
		throw "Too much .ram_data for (" + tile_x + " " + tile_y + ")";
	    for (i = 0; i < 8; ++i) {
		ram_data[idx++] = parseInt(line.substr(i*8, 8), 16);
	    }
	};
    } else if (typ == ".io_tile" || typ == ".logic_tile" ||
	       typ == ".ramb_tile" || typ == ".ramt_tile") {
	var typ2 = typ.substring(1, typ.length-5);
	if (tile.typ != typ2)
	    throw "Wrong section " + typ + " for tile (" + tile_x + " " + tile_y +
		") which is of type " + tile.typ;
	var bitcols = chipdb[typ2 + "_tile_bits"]['columns'];
	var bitrows = chipdb[typ2 + "_tile_bits"]['rows'];
	var bits = bitcols * bitrows;
	var words = Math.floor((bits+31)/32);
	var config_bits = tile.config_bits = new Uint32Array(words);
	var sofar = 0;
	line_parser = function (line) {
	    var pos = 0;
	    if (sofar > bits)
		throw "Too many config bits for tile (" + tile_x + " " + tile_y + ")";
	    if (sofar % 32) {
		var rest = 32 - (sofar % 32);
		if (rest > line.length)
		    rest = line.length;
		config_bits[Math.floor(sofar/32)] |=
		    (parseInt(line.substr(0, rest), 2) << (32-(sofar % 32)-rest));
		sofar += rest;
		pos += rest;
	    }
	    while (pos + 32 <= line.length) {
		config_bits[Math.floor(sofar/32)] = parseInt(line.substr(pos, 32), 2);
		pos += 32;
		sofar += 32;
	    }
	    if (pos < line.length) {
		config_bits[Math.floor(sofar/32)] =
		    parseInt(line.substr(pos), 2) << (32 - (line.length - pos));
		sofar += line.length - pos;
	    }
	};
    } else
	throw "Unkonwn section type '" + typ + "'";

    for (;;) {
	line = nextLine(parser);
	if (line == null) {
	    return onComplete(ts, syms, data);
	}
	if (line == "")
	    break;
	if (line.substring(0, 1) == ".") {
	    unNextLine(parser, line);
	    break;
	}
	line_parser(line);
    }
}
    // Yield for other tasks before processing the next chunk...
    setTimeout(function () { asc_parse_step(parser, chipdb, ts, syms, data, onComplete) });
}
