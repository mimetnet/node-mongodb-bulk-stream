var tap = require('tap')
    , test = tap.test
    , bulk;

test('require', function(t) {
    bulk = require('../index.js');

    t.ok(bulk, 'mongodb-bulk-stream exists');
    t.type(bulk, 'function', 'require returns a function');
    t.equal(0, Object.keys(bulk).length, 'no hidden exports');
    t.end();
});

test('octor', function(t) {
    t.throws(function() {
        bulk();
    }, {name:'TypeError', message:'First argument is not an object'}, 'throws TypeError');

    t.throws(function() {
        bulk({});
    }, {name:'TypeError', message:'First argument does not have an initializeOrderedBulkOp function'}, '1st Arg.insert TypeError');

    t.doesNotThrow(function() {
        bulk({initializeOrderedBulkOp:function(){}});
    }, 'Mock arguments');

    t.end();
});
