'use strict';

var fs = require('fs');
var path = require('path');
var types = require('image-size/lib/types');

var handlers = {},
    typeMap = {};


// load all available handlers

handlers.bmp = require('image-size/lib/types/bmp');
handlers.gif = require('image-size/lib/types/gif');
handlers.jpg = require('image-size/lib/types/jpg');
handlers.png = require('image-size/lib/types/png');
handlers.psd = require('image-size/lib/types/psd');
handlers.svg = require('image-size/lib/types/svg');
handlers.tiff = require('image-size/lib/types/tiff');
handlers.webp = require('image-size/lib/types/webp');

// load all available handlers
types.forEach(function (type) {
    typeMap[type] = handlers[type].detect;
});

var detector = function (buffer, filepath) {
    var type, result;
    for (type in typeMap) {
        result = typeMap[type](buffer, filepath);
        if (result) {
            return type;
        }
    }
};


// Maximum buffer size, with a default of 128 kilobytes.
// TO-DO: make this adaptive based on the initial signature of the image
var MaxBufferSize = 128 * 1024;

function lookup(buffer, filepath) {
    // detect the file type.. don't rely on the extension
    var type = detector(buffer, filepath);

    // find an appropriate handler for this file type
    if (type in handlers) {
        var size = handlers[type].calculate(buffer, filepath);
        if (size !== false) {
            size.type = type;
            return size;
        }
    }

    // throw up, if we don't understand the file
    throw new TypeError('unsupported file type');
}

function asyncFileToBuffer(filepath, callback) {
    // open the file in read only mode
    fs.open(filepath, 'r', function (err, descriptor) {
        if (err) {
            return callback(err);
        }
        var size = fs.fstatSync(descriptor).size;
        var bufferSize = Math.min(size, MaxBufferSize);
        var buffer = new Buffer(bufferSize);
        // read first buffer block from the file, asynchronously
        fs.read(descriptor, buffer, 0, bufferSize, 0, function (err) {
            if (err) {
                return callback(err);
            }
            // close the file, we are done
            fs.close(descriptor, function (err) {
                callback(err, buffer);
            });
        });
    });
}

function syncFileToBuffer(filepath) {
    // read from the file, synchronously
    var descriptor = fs.openSync(filepath, 'r');
    var size = fs.fstatSync(descriptor).size;
    var bufferSize = Math.min(size, MaxBufferSize);
    var buffer = new Buffer(bufferSize);
    fs.readSync(descriptor, buffer, 0, bufferSize, 0);
    fs.closeSync(descriptor);
    return buffer;
}

/**
 * @params input - buffer or relative/absolute path of the image file
 * @params callback - optional function for async detection
 */
module.exports = function (input, callback) {

    // Handle buffer input
    if (Buffer.isBuffer(input)) {
        return lookup(input);
    }

    // input should be a string at this point
    if (typeof input !== 'string') {
        throw new TypeError('invalid invocation');
    }

    // resolve the file path
    var filepath = path.resolve(input);

    if (typeof callback === 'function') {
        asyncFileToBuffer(filepath, function (err, buffer) {
            if (err) {
                return callback(err);
            }

            // return the dimensions
            var dimensions;
            try {
                dimensions = lookup(buffer, filepath);
            } catch (e) {
                err = e;
            }
            callback(err, dimensions);
        });
    } else {
        var buffer = syncFileToBuffer(filepath);
        return lookup(buffer, filepath);
    }
};

module.exports.types = types;
