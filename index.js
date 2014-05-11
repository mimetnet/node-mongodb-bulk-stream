var util = require('util');
var Transform = require('stream').Transform;

if (!Transform) {
    Transform = require('readable-stream/transform');
}

function selector(x) {
    return {_id: x._id};
}

function update(x) {
    return x;
}

function BulkStream(collection, options) {
    if (!(this instanceof(BulkStream)))
        return new BulkStream(collection, options);

    if ('object' !== typeof(collection))
        throw new TypeError('First argument is not an object');
    if ('function' !== typeof(collection.initializeOrderedBulkOp))
        throw new TypeError('First argument does not have an initializeOrderedBulkOp function');

    if (options) {
        if ('object' !== typeof(options))
            throw new TypeError('Second argument is not an options{} object');
        if (options.selector && 'function' !== typeof(options.selector))
            throw new TypeError('options.selector must be a function');
        if (options.update && 'function' !== typeof(options.update))
            throw new TypeError('options.update must be a function');
    } else {
        options = {};
    }

    Transform.call(this, {objectMode:true, decodeStrings:false});

    this._state = {
        queue: [],
        flush: null,
        bulk: collection.initializeOrderedBulkOp(),
        selector: (options.selector || selector),
        update: (options.update || update),
        highWaterMark: (~~options.highWaterMark || 10)
    };
}

util.inherits(BulkStream, Transform);

BulkStream.prototype._transform = function(chunk, encoding, done) {
    this._state.queue.push(chunk);

    if (chunk.hasOwnProperty('_id')) {
        this._state.bulk.find(this._state.selector(chunk)).updateOne(this._state.update(chunk));
    } else {
        this._state.bulk.insert(chunk);
    }

    if (this._state.highWaterMark > (this._state.queue.length)) {
        done();
    } else {
        this._dequeue(done);
    }
};

BulkStream.prototype._dequeue = function(done) {
    var self = this, queue = this._state.queue.splice(0);

    if (0 === queue.length)
        return;

    this._state.bulk.execute({w:1}, function(error, result) {
        if (error) {
            self.emit('error', error);
        } else if (result.hasWriteErrors()) {
            self.emit('error', result.getWriteErrorAt(0));
        } else {
            queue.forEach(self.push.bind(self));
            done();
            self._checkFinish();
        }
    });
};

BulkStream.prototype._flush = function(done) {
    if (null === this._state.flush) {
        this._state.flush = done;
        this._checkFinish();
    }
};

BulkStream.prototype._checkFinish = function() {
    if (null === this._state.flush)
        return;

    if (0 < this._state.queue.length) {
        this._dequeue(this._state.flush);
    }
};

module.exports = function(collection, options) {
    return new BulkStream(collection, options);
};
