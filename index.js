var util = require('util');
var Transform = require('readable-stream/transform');

function selector(x) {
    return {_id: x._id};
}

function update(x) {
    return x;
}

function BulkStream(collection, options) {
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
        list: collection,
        bulk: collection.initializeOrderedBulkOp(),
        selector: (options.selector || selector),
        update: (options.update || update),
        highWaterMark: (~~options.highWaterMark || 100)
    };
}

util.inherits(BulkStream, Transform);

BulkStream.prototype._transform = function(chunk, encoding, done) {
    // store input for output
    this._state.queue.push(chunk);

    // pull the raw object out of Mongoose
    if ('function' === typeof(chunk.toObject))
        chunk = chunk.toObject({depopulate:1});

    if (chunk.hasOwnProperty('_id')) {
        this._state.bulk.find(this._state.selector(chunk)).upsert().updateOne(this._state.update(chunk));
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
        return done();

    this._state.bulk.execute({w:1}, function(error, result) {
        if (error) {
            self.emit('error', error);
        } else if (result.hasWriteErrors()) {
            self.emit('error', result.getWriteErrorAt(0));
        } else {
            var cnt = result.nInserted + result.nUpserted + result.nModified;

            if (cnt < queue.length) {
                self.emit('error', new Error('BulkOp did not complete queue'));
            } else {
                // push bulk work through stream
                queue.forEach(self.push.bind(self));
                // reset bulk so counters don't increment
                self._state.bulk = self._state.list.initializeOrderedBulkOp();
                // mark unit as complete
                done();
                // check if we're flushed
                self._checkFinish();
            }
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
    } else {
        this._state.flush();
        this._state.flush = null;
    }
};

module.exports = function(collection, options) {
    return new BulkStream(collection, options);
};
